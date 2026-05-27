#!/usr/bin/env node
// @ts-check
/**
 * KBO 박스스코어 → 팀별 선발 라인업 수집 → bp_team_recent_lineups upsert.
 *
 * 흐름:
 *   1. GetKboGameList(날짜) → 종료 경기 목록 (G_ID, AWAY_ID/HOME_ID, 선발투수)
 *   2. 각 경기 GetBoxScore → tables[1]=원정타자, tables[2]=홈타자
 *   3. 각 타순(1~9) 첫 행 = 선발 → 포지션 매핑 + roster 이름 매칭
 *   4. 선발투수는 GetKboGameList의 T_PIT_P_NM(원정)/B_PIT_P_NM(홈)
 *   5. Supabase upsert (game_id, team_id) unique
 *
 * 사용법:
 *   node scripts/scrape-kbo-lineups.mjs                  # 어제(KST) 경기
 *   node scripts/scrape-kbo-lineups.mjs 2026-05-27       # 특정 날짜
 *   node scripts/scrape-kbo-lineups.mjs 2026-05-20 2026-05-27  # 범위(백필)
 *   node scripts/scrape-kbo-lineups.mjs --dry-run 2026-05-27   # 저장 안 하고 출력만
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

// ── env ──────────────────────────────────────────────────
const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
    })
);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dates = args.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BASE = "https://www.koreabaseball.com";

// ── KBO 팀 코드 → 우리 team id ─────────────────────────────
// AWAY_ID/HOME_ID는 KBO 레거시 2글자 코드(OB/HT/WO/SK 등). 정확 매칭 먼저, 그 다음 팀명 fallback.
const KBO_TEAM_CODE = {
  OB: "doosan", LG: "lg", KT: "kt", SK: "ssg", SSG: "ssg", NC: "nc",
  WO: "kiwoom", SS: "samsung", LT: "lotte", HT: "kia", HH: "hanwha"
};
function parseTeamCode(name) {
  if (!name) return null;
  const up = name.toUpperCase().trim();
  if (KBO_TEAM_CODE[up]) return KBO_TEAM_CODE[up];
  // 한글/영문 팀명 fallback
  if (up.includes("LG")) return "lg";
  if (up.includes("KT")) return "kt";
  if (up.includes("SSG")) return "ssg";
  if (up.includes("NC")) return "nc";
  if (up.includes("두산") || up.includes("DOO")) return "doosan";
  if (up.includes("KIA") || up.includes("기아") || up.includes("타이거즈")) return "kia";
  if (up.includes("롯데") || up.includes("LOT")) return "lotte";
  if (up.includes("삼성") || up.includes("SAM")) return "samsung";
  if (up.includes("한화") || up.includes("HAN")) return "hanwha";
  if (up.includes("키움") || up.includes("히어로즈") || up.includes("KIW")) return "kiwoom";
  return null;
}

// ── 포지션 약어 → 시뮬 포지션 코드 (한자 주의) ──────────────
const POSITION_MAP = {
  "투": "P", "포": "C",
  "一": "1B", "二": "2B", "三": "3B", "유": "SS",
  "좌": "LF", "중": "CF", "우": "RF",
  "지": "DH"
};

// ── roster 로딩: { teamId: Map<정규화이름, rosterId> } ─────
function normalizeName(s) {
  return (s ?? "").replace(/\s+/g, "").trim();
}
function loadRosters() {
  const dir = resolve(process.cwd(), "data", "rosters");
  const map = {};
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const data = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const nameToId = new Map();
    for (const p of data.players ?? []) {
      nameToId.set(normalizeName(p.name), p.id);
    }
    map[data.teamId] = nameToId;
  }
  return map;
}

// ── KBO API ──────────────────────────────────────────────
async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Referer: `${BASE}/Schedule/GameCenter/Main.aspx`,
      "X-Requested-With": "XMLHttpRequest",
      Origin: BASE
    },
    body: new URLSearchParams(body).toString()
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return JSON.parse(await res.text());
}

async function fetchGameList(yyyymmdd) {
  const data = await post("/ws/Main.asmx/GetKboGameList", { leId: "1", srId: "0", date: yyyymmdd });
  return data?.game ?? [];
}

async function fetchBoxScore(gameId, seasonId) {
  return post("/ws/Schedule.asmx/GetBoxScore", { leId: "1", srId: "0", seasonId, gameId });
}

// ── 타자 테이블 → 선발 9인 추출 ─────────────────────────────
// 각 타순(1~9)의 첫 행만 = 선발. 교체(같은 타순 2번째+)는 무시.
function extractStarters(batterTable, nameToId) {
  const rows = batterTable?.rows ?? [];
  const seen = new Set();
  const starters = [];
  for (const r of rows) {
    const cells = (r.row ?? []).map((c) => (c.Text ?? "").replace(/&nbsp;/g, "").trim());
    const order = parseInt(cells[0], 10);
    if (!Number.isInteger(order) || order < 1 || order > 9) continue;
    if (seen.has(order)) continue; // 이미 그 타순의 선발 잡음
    seen.add(order);
    const posAbbr = cells[1];
    const name = cells[2];
    starters.push({
      order,
      name,
      position: POSITION_MAP[posAbbr] ?? posAbbr ?? null,
      rosterId: nameToId?.get(normalizeName(name)) ?? null
    });
  }
  starters.sort((a, b) => a.order - b.order);
  return starters;
}

// ── 메인 ─────────────────────────────────────────────────
function kstYesterday() {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  kst.setDate(kst.getDate() - 1);
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

function expandDateRange(from, to) {
  const out = [];
  const d = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (d <= end) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const targetDates =
  dates.length === 0
    ? [kstYesterday()]
    : dates.length === 1
    ? [dates[0]]
    : expandDateRange(dates[0], dates[dates.length - 1]);

const rosters = loadRosters();
console.log(`로스터 로드: ${Object.keys(rosters).length}팀`);
console.log(`대상 날짜: ${targetDates.join(", ")}${dryRun ? " (dry-run)" : ""}\n`);

let totalRows = 0;
let unmatched = 0;

for (const dateStr of targetDates) {
  const yyyymmdd = dateStr.replaceAll("-", "");
  const seasonId = dateStr.slice(0, 4);
  let games;
  try {
    games = await fetchGameList(yyyymmdd);
  } catch (e) {
    console.log(`[${dateStr}] GetKboGameList 실패: ${e.message}`);
    continue;
  }

  // 종료 경기만 (GAME_STATE_SC === "3"), 취소 제외
  const finished = games.filter(
    (g) => String(g.GAME_STATE_SC) === "3" && String(g.CANCEL_SC_ID ?? "0") === "0"
  );
  console.log(`[${dateStr}] 경기 ${games.length}개 중 종료 ${finished.length}개`);

  for (const g of finished) {
    const gameId = g.G_ID;
    const awayTeam = parseTeamCode(g.AWAY_ID || g.AWAY_NM);
    const homeTeam = parseTeamCode(g.HOME_ID || g.HOME_NM);
    if (!awayTeam || !homeTeam) {
      console.log(`  ${gameId}: 팀 코드 매칭 실패 (away=${g.AWAY_ID}, home=${g.HOME_ID})`);
      continue;
    }

    let box;
    try {
      box = await fetchBoxScore(gameId, seasonId);
      await new Promise((r) => setTimeout(r, 200)); // polite delay
    } catch (e) {
      console.log(`  ${gameId}: GetBoxScore 실패 ${e.message}`);
      continue;
    }

    const tables = box?.tables ?? [];
    const awayBatters = extractStarters(tables[1], rosters[awayTeam]);
    const homeBatters = extractStarters(tables[2], rosters[homeTeam]);

    const records = [
      {
        game_id: gameId,
        game_date: dateStr,
        team_id: awayTeam,
        is_home: false,
        batting: awayBatters,
        starter_name: (g.T_PIT_P_NM ?? "").trim() || null,
        starter_roster_id: rosters[awayTeam]?.get(normalizeName(g.T_PIT_P_NM)) ?? null,
        source: "kbo-boxscore"
      },
      {
        game_id: gameId,
        game_date: dateStr,
        team_id: homeTeam,
        is_home: true,
        batting: homeBatters,
        starter_name: (g.B_PIT_P_NM ?? "").trim() || null,
        starter_roster_id: rosters[homeTeam]?.get(normalizeName(g.B_PIT_P_NM)) ?? null,
        source: "kbo-boxscore"
      }
    ];

    for (const rec of records) {
      const miss = rec.batting.filter((b) => !b.rosterId).length;
      unmatched += miss;
      console.log(
        `  ${gameId} ${rec.team_id}${rec.is_home ? "(H)" : "(A)"}: 타자 ${rec.batting.length}명, 미매칭 ${miss}, 선발투수 ${rec.starter_name ?? "?"}${rec.starter_roster_id ? "" : "(미매칭)"}`
      );
    }

    if (!dryRun) {
      const { error } = await sb
        .from("bp_team_recent_lineups")
        .upsert(records, { onConflict: "game_id,team_id" });
      if (error) {
        console.log(`  ${gameId}: upsert 실패 — ${error.message}`);
        continue;
      }
    }
    totalRows += records.length;
  }
}

console.log(`\n완료: ${totalRows}행 ${dryRun ? "(dry-run, 미저장)" : "upsert"}, 타자 미매칭 누적 ${unmatched}명`);
