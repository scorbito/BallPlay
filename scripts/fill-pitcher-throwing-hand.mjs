#!/usr/bin/env node
// @ts-check
/**
 * 로스터(data/rosters/*.json)에서 throwingHand 가 비어있는 투수를 KBO 사이트에서 채운다.
 *
 * 일회성 스크립트. 흐름:
 *   1. 모든 로스터 로드 → primaryPosition==="P" && !throwingHand 인 투수 수집 (팀별)
 *   2. 누락 투수가 있는 팀만 KBO PitcherBasic/Basic1 팀 페이지 스크래핑 →
 *      이름 → playerId 맵 구성 (동명이인은 매칭 보류 + warn)
 *   3. 각 누락 투수: playerId 로 PitcherDetail/Basic.aspx GET → lblPosition 파싱 →
 *      괄호 안 첫 글자(좌=L / 우=R) → throwingHand
 *   4. 로스터 JSON 의 해당 투수 객체에 throwingHand 추가 (battingHand 앞에 삽입)
 *
 * KBO fetch/viewstate/팀 POST 흐름은 scripts/scrape-kbo-stats.mjs 와 동일 패턴을 복사 재사용.
 *
 * 사용법:
 *   node scripts/fill-pitcher-throwing-hand.mjs --dry-run   # 파일 안 쓰고 매칭/파싱 결과만 출력
 *   node scripts/fill-pitcher-throwing-hand.mjs             # 실제 로스터 JSON 갱신
 *
 * 매너: 페이지 사이 1.5s 딜레이, User-Agent 연락처 명시.
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { load as cheerioLoad } from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const ROSTERS_DIR = join(PROJECT_ROOT, "data", "rosters");

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 BallPlay-Seed/0.1 (contact: dev@ballplay.local)";

const FETCH_DELAY_MS = 1500;

const PLAYER_SEARCH =
  "https://www.koreabaseball.com/Player/Search.aspx";
const PITCHER_DETAIL =
  "https://www.koreabaseball.com/Record/Player/PitcherDetail/Basic.aspx";

// teamId ↔ KBO ddlTeam 코드 (scrape-kbo-stats.mjs 와 동일)
const TEAM_KBO_CODE = {
  lg: "LG",
  doosan: "OB",
  kt: "KT",
  samsung: "SS",
  ssg: "SK",
  nc: "NC",
  kia: "HT",
  hanwha: "HH",
  kiwoom: "WO",
  lotte: "LT"
};

const flags = {
  dryRun: process.argv.slice(2).includes("--dry-run")
};

main().catch((err) => {
  console.error("[fill-pitcher-throwing-hand] failed:", err);
  process.exit(1);
});

async function main() {
  console.log(
    `[fill-pitcher-throwing-hand] dry-run=${flags.dryRun}\n`
  );

  // 1) 로스터 로드 + 누락 투수 수집
  const files = (await readdir(ROSTERS_DIR)).filter((f) => f.endsWith(".json"));
  /** @type {{teamId:string, file:string, raw:string, data:any}[]} */
  const rosters = [];
  for (const f of files) {
    const raw = await readFile(join(ROSTERS_DIR, f), "utf8");
    rosters.push({ teamId: f.replace(/\.json$/, ""), file: join(ROSTERS_DIR, f), raw, data: JSON.parse(raw) });
  }

  /** @type {Record<string, any[]>} teamId → 누락 투수 객체 */
  const missingByTeam = {};
  let totalMissing = 0;
  for (const r of rosters) {
    const miss = r.data.players.filter(
      (p) => p.primaryPosition === "P" && !p.throwingHand
    );
    if (miss.length > 0) {
      missingByTeam[r.teamId] = miss;
      totalMissing += miss.length;
    }
  }

  console.log(`[수집] throwingHand 없는 투수: ${totalMissing}명 (${Object.keys(missingByTeam).length}팀)`);
  for (const [tid, miss] of Object.entries(missingByTeam)) {
    console.log(`  ${tid}: ${miss.map((p) => p.name).join(", ")}`);
  }
  console.log("");

  if (totalMissing === 0) {
    console.log("채울 투수 없음. 종료.");
    return;
  }

  // 결과 누적
  /** @type {{teamId:string, name:string, playerId:string, position:string, hand:string}[]} */
  const filled = [];
  /** @type {{teamId:string, name:string, reason:string}[]} */
  const failures = [];

  // 2) 누락 투수마다 KBO 선수검색(Player/Search.aspx)으로 playerId 조회.
  //    같은 팀+투수 결과가 2명 이상이면 동명이인 → 보류.
  for (const teamId of Object.keys(missingByTeam)) {
    const kboCode = TEAM_KBO_CODE[teamId];
    if (!kboCode) {
      for (const p of missingByTeam[teamId]) failures.push({ teamId, name: p.name, reason: "unknown teamId (KBO code 없음)" });
      continue;
    }
    console.log(`\n[team] ${teamId} (${kboCode}) — 누락 ${missingByTeam[teamId].length}명`);

    for (const p of missingByTeam[teamId]) {
      const ids = await searchPlayerIds(p.name, kboCode);
      await sleep(FETCH_DELAY_MS);
      if (!ids || ids.length === 0) {
        failures.push({ teamId, name: p.name, reason: "이름 매칭 실패 (검색 결과 없음)" });
        console.warn(`  ✗ ${p.name}: 매칭 실패`);
        continue;
      }
      if (ids.length > 1) {
        failures.push({ teamId, name: p.name, reason: `동명이인 ${ids.length}명 (playerId: ${ids.join(", ")})` });
        console.warn(`  ⚠ ${p.name}: 동명이인 ${ids.length}명 → 보류`);
        continue;
      }
      const playerId = ids[0];
      const { position, hand } = await fetchThrowingHand(playerId);
      await sleep(FETCH_DELAY_MS);
      if (!hand) {
        failures.push({ teamId, name: p.name, reason: `파싱 실패 (lblPosition="${position}")` });
        console.warn(`  ✗ ${p.name} (id=${playerId}): 파싱 실패 position="${position}"`);
        continue;
      }
      filled.push({ teamId, name: p.name, playerId, position, hand });
      console.log(`  ✓ ${p.name} (id=${playerId}): "${position}" → ${hand}`);
    }
  }

  // 3) 결과 요약
  const left = filled.filter((f) => f.hand === "L").length;
  const right = filled.filter((f) => f.hand === "R").length;
  console.log(`\n[결과] 성공 ${filled.length}명 (좌투 ${left} / 우투 ${right}) / 실패 ${failures.length}명`);
  if (failures.length > 0) {
    console.log("  실패 명단:");
    for (const f of failures) console.log(`    - [${f.teamId}] ${f.name}: ${f.reason}`);
  }

  if (flags.dryRun) {
    console.log("\n[dry-run] 파일 쓰지 않음.");
    return;
  }

  // 4) 로스터 JSON 갱신 — battingHand 앞에 throwingHand 삽입, 포맷 보존
  const byTeam = {};
  for (const f of filled) {
    (byTeam[f.teamId] ??= {})[f.name] = f.hand;
  }
  const writtenFiles = [];
  for (const r of rosters) {
    const updates = byTeam[r.teamId];
    if (!updates) continue;
    let updated = false;
    for (const p of r.data.players) {
      if (p.primaryPosition === "P" && !p.throwingHand && updates[p.name]) {
        // battingHand 앞에 throwingHand 삽입 (객체 키 순서 재구성)
        insertThrowingHandBeforeBatting(p, updates[p.name]);
        updated = true;
      }
    }
    if (updated) {
      const trailingNewline = r.raw.endsWith("\n") ? "\n" : "";
      await writeFile(r.file, JSON.stringify(r.data, null, 2) + trailingNewline, "utf8");
      writtenFiles.push(r.file);
      console.log(`  wrote ${r.file}`);
    }
  }

  // 5) 갱신 후 잔존 카운트
  let remaining = 0;
  const remainingList = [];
  for (const r of rosters) {
    for (const p of r.data.players) {
      if (p.primaryPosition === "P" && !p.throwingHand) {
        remaining++;
        remainingList.push(`[${r.teamId}] ${p.name}`);
      }
    }
  }
  console.log(`\n[갱신 완료] 파일 ${writtenFiles.length}개 / 잔존 누락 ${remaining}명`);
  if (remainingList.length > 0) console.log("  잔존: " + remainingList.join(", "));
}

/**
 * 객체에 throwingHand 키를 battingHand 앞에 삽입. battingHand 가 없으면 끝에 추가.
 * 다른 키 순서/값은 보존.
 */
function insertThrowingHandBeforeBatting(p, hand) {
  const entries = Object.entries(p);
  for (const k of Object.keys(p)) delete p[k];
  let inserted = false;
  for (const [k, v] of entries) {
    if (k === "battingHand" && !inserted) {
      p.throwingHand = hand;
      inserted = true;
    }
    p[k] = v;
  }
  if (!inserted) p.throwingHand = hand;
}

// ============================================================
// KBO 스크래핑 (scrape-kbo-stats.mjs 패턴 복사)
// ============================================================

/**
 * KBO 선수검색(Player/Search.aspx)에 팀+이름 필터로 POST → 결과 행에서 playerId 수집.
 * 이름 정확 일치 + 포지션이 "투수"인 결과만 채택. 2명 이상이면 동명이인.
 *
 * 결과 행 셀: [백넘버, 선수명(a.playerId), 팀, 포지션, 생년월일, 신장/체중, 경력]
 * 검색은 부분일치라 동명이인/유사명이 섞일 수 있어 이름 정확일치로 한 번 더 거름.
 *
 * @returns {Promise<string[]>} 정확일치 투수 playerId 목록 (중복 제거)
 */
async function searchPlayerIds(name, kboCode) {
  const initRes = await fetch(PLAYER_SEARCH, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko" }
  });
  if (!initRes.ok) throw new Error(`GET PlayerSearch → ${initRes.status}`);
  const cookie = (initRes.headers.get("set-cookie") || "").split(";")[0];
  const $init = cheerioLoad(await initRes.text());

  const form = collectFormFields($init);
  const teamName = findFormFieldName($init, ["ddlTeam$ddlTeam", "ddlTeam"]);
  const nameField = findFormFieldName($init, ["txtSearchPlayerName"]);
  const btn = $init("input[name$='btnSearch']");
  if (teamName) form.set(teamName, kboCode);
  if (nameField) form.set(nameField, name);
  if (btn.length) form.set(btn.attr("name"), btn.attr("value") ?? "검색");

  const postRes = await fetch(PLAYER_SEARCH, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "ko-KR,ko",
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: PLAYER_SEARCH,
      ...(cookie && { Cookie: cookie })
    },
    body: form.toString()
  });
  if (!postRes.ok) throw new Error(`POST PlayerSearch(${name}) → ${postRes.status}`);
  const $ = cheerioLoad(await postRes.text());

  const ids = [];
  $("table tbody tr").each((_, el) => {
    const tds = $(el).find("td");
    if (tds.length < 4) return;
    const rowName = $(tds[1]).text().trim();
    const rowPos = $(tds[3]).text().trim();
    if (rowName !== name) return;       // 정확일치만
    if (rowPos !== "투수") return;       // 투수만 (동명이인 야수 배제)
    const href = $(tds[1]).find('a[href*="playerId="]').attr("href") || "";
    const id = href.match(/playerId=(\d+)/)?.[1];
    if (id && !ids.includes(id)) ids.push(id);
  });
  return ids;
}

/**
 * PitcherDetail/Basic.aspx?playerId 에서 lblPosition 파싱.
 * 형식: "투수(좌투좌타)" / "투수(우언더)" / "내야수(우투우타)" 등.
 * 괄호 안 첫 글자: 좌→L, 우→R. 없으면 hand=null.
 */
async function fetchThrowingHand(playerId) {
  const url = `${PITCHER_DETAIL}?playerId=${playerId}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko" }
  });
  if (!res.ok) return { position: `HTTP ${res.status}`, hand: null };
  const $ = cheerioLoad(await res.text());
  const position = $('span[id*="lblPosition"]').first().text().trim();
  const inner = position.match(/\(([^)]*)\)/)?.[1] ?? "";
  const first = inner.charAt(0);
  const hand = first === "좌" ? "L" : first === "우" ? "R" : null;
  return { position, hand };
}

// --- ASP.NET 폼 헬퍼 (scrape-kbo-stats.mjs 복사) ---

function findFormFieldName($, candidates) {
  for (const cand of candidates) {
    const el = $(`select[name$="${cand}"], input[name$="${cand}"]`).first();
    if (el.length > 0) return el.attr("name");
  }
  return null;
}

function collectFormFields($) {
  const form = new URLSearchParams();
  $("form input").each((_, el) => {
    const name = $(el).attr("name");
    if (!name) return;
    const type = ($(el).attr("type") || "").toLowerCase();
    if (type === "submit" || type === "button" || type === "image") return;
    if (type === "checkbox" || type === "radio") {
      if ($(el).attr("checked") != null) form.set(name, $(el).attr("value") ?? "");
      return;
    }
    form.set(name, $(el).attr("value") ?? "");
  });
  $("form select").each((_, el) => {
    const name = $(el).attr("name");
    if (!name) return;
    const selected =
      $(el).find("option[selected]").attr("value") ??
      $(el).find("option").first().attr("value") ??
      "";
    form.set(name, selected);
  });
  return form;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
