#!/usr/bin/env node
// @ts-check
/**
 * [PoC] KBO 공식 선수 프로필 사진 수집기 — "닮은 선수 찾기" 실현 가능성 검증용.
 *
 * 1) Search.aspx에서 팀별 선수 목록 + kboPlayerId를 긁는다 (audit-kbo-rosters.mjs와 동일 경로)
 * 2) 네이버 CDN에서 프로필 사진을 받는다. 연도는 최신부터 역순 폴백:
 *      https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/person/middle/{year}/{playerId}.jpg
 * 3) public/poc-face/photos/{playerId}.jpg + players.json 저장
 *
 * 사진 원본은 임베딩 추출용 중간 산출물이다. PoC 종료 후 삭제하고 .bin만 남긴다.
 * (public/poc-face/photos/ 는 .gitignore 처리)
 *
 * 사용:
 *   node scripts/poc-face-fetch-photos.mjs
 *   node scripts/poc-face-fetch-photos.mjs --team=lg
 *   node scripts/poc-face-fetch-photos.mjs --limit=30      # 팀당 N명만 (빠른 검증)
 *   node scripts/poc-face-fetch-photos.mjs --tier=first    # 1군 주력만 (팬 인지도 확보)
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { load as cheerioLoad } from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const OUT_DIR = join(PROJECT_ROOT, "public", "poc-face");
const PHOTO_DIR = join(OUT_DIR, "photos");

const BASE_URL = "https://www.koreabaseball.com/Player/Search.aspx";
const CDN = "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/person";
// 최신 시즌 사진이 없는 선수(부상/2군/신인 등)를 위해 역순 폴백한다.
const PHOTO_YEARS = [2026, 2025, 2024];
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const TEAMS = [
  { id: "lg", kboCode: "LG", name: "LG 트윈스" },
  { id: "doosan", kboCode: "OB", name: "두산 베어스" },
  { id: "kt", kboCode: "KT", name: "KT 위즈" },
  { id: "samsung", kboCode: "SS", name: "삼성 라이온즈" },
  { id: "ssg", kboCode: "SK", name: "SSG 랜더스" },
  { id: "nc", kboCode: "NC", name: "NC 다이노스" },
  { id: "kia", kboCode: "HT", name: "KIA 타이거즈" },
  { id: "hanwha", kboCode: "HH", name: "한화 이글스" },
  { id: "kiwoom", kboCode: "WO", name: "키움 히어로즈" },
  { id: "lotte", kboCode: "LT", name: "롯데 자이언츠" }
];

const CTL = "ctl00$ctl00$ctl00$cphContents$cphContents$cphContents";

/**
 * 1군 주력 판정 기준 (data/rosters/*.json 의 seasonGames 기준).
 * 투수는 선발이 ~20경기, 불펜이 ~50경기라 단일 임계값을 쓰면 투수가 거의 사라진다.
 * 포지션별로 나눠야 팀당 20명 안팎으로 고르게 남는다.
 */
const TIER_FIRST = { pitcher: 20, batter: 50 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** data/rosters 에서 "이름|등번호" → seasonGames·포지션 맵을 만든다. */
function loadRosterIndex() {
  const index = new Map();
  for (const team of TEAMS) {
    let roster;
    try {
      roster = JSON.parse(readFileSync(join(PROJECT_ROOT, "data", "rosters", `${team.id}.json`), "utf-8"));
    } catch {
      continue;
    }
    for (const p of roster.players ?? []) {
      index.set(`${p.name}|${p.jerseyNumber}`, {
        games: p.seasonGames ?? 0,
        isPitcher: p.primaryPosition === "P"
      });
    }
  }
  return index;
}

/** 1군 주력 여부. 로스터에 없으면(신규 등록 등) 보수적으로 제외한다. */
function isFirstTier(rosterIndex, name, jerseyNumber) {
  const entry = rosterIndex.get(`${name}|${jerseyNumber}`);
  if (!entry) return false;
  return entry.games >= (entry.isPitcher ? TIER_FIRST.pitcher : TIER_FIRST.batter);
}

function extractViewState(html) {
  return {
    viewState: html.match(/id="__VIEWSTATE" value="([^"]+)"/)?.[1] ?? "",
    viewStateGenerator: html.match(/id="__VIEWSTATEGENERATOR" value="([^"]+)"/)?.[1] ?? "",
    eventValidation: html.match(/id="__EVENTVALIDATION" value="([^"]+)"/)?.[1] ?? ""
  };
}

function buildForm({ vs, vsg, ev, teamCode, eventTarget, page = "" }) {
  const form = new URLSearchParams();
  form.set("__EVENTTARGET", eventTarget);
  form.set("__EVENTARGUMENT", "");
  form.set("__LASTFOCUS", "");
  form.set("__VIEWSTATE", vs);
  form.set("__VIEWSTATEGENERATOR", vsg);
  form.set("__EVENTVALIDATION", ev);
  form.set(`${CTL}$hfPage`, page);
  form.set(`${CTL}$ddlTeam`, teamCode);
  form.set(`${CTL}$ddlPosition`, "");
  form.set(`${CTL}$txtSearchPlayerName`, "");
  return form.toString();
}

function parsePlayers($) {
  const players = [];
  $("table.tEx tbody tr").each((_, el) => {
    const cells = $(el).find("td");
    if (cells.length < 4) return;
    const jerseyText = $(cells[0]).text().trim();
    const nameCell = $(cells[1]);
    const name = nameCell.text().trim();
    const positionRaw = $(cells[3]).text().trim();
    if (!name || !jerseyText) return;
    const href = nameCell.find("a").attr("href") ?? "";
    const kboPlayerId = href.match(/playerId=(\d+)/)?.[1] ?? null;
    if (!kboPlayerId) return; // 사진 URL을 만들 수 없으므로 스킵
    players.push({
      name,
      jerseyNumber: parseInt(jerseyText.replace(/\D/g, ""), 10) || null,
      positionRaw,
      kboPlayerId
    });
  });
  return players;
}

function findPageNumbers(html) {
  const nums = new Set([...html.matchAll(/ucPager\$btnNo(\d+)/g)].map((m) => parseInt(m[1], 10)));
  return [...nums].sort((a, b) => a - b);
}

async function scrapeTeam(team) {
  const getRes = await fetch(BASE_URL, {
    headers: { "User-Agent": USER_AGENT, Referer: "https://www.koreabaseball.com/" }
  });
  if (!getRes.ok) throw new Error(`초기 GET 실패 ${getRes.status}`);
  const cookie = (getRes.headers.get("set-cookie") || "").split(";")[0];
  let html = await getRes.text();
  let state = extractViewState(html);

  const post = (body) =>
    fetch(BASE_URL, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: BASE_URL,
        ...(cookie && { Cookie: cookie })
      },
      body
    });

  let res = await post(
    buildForm({
      vs: state.viewState,
      vsg: state.viewStateGenerator,
      ev: state.eventValidation,
      teamCode: team.kboCode,
      eventTarget: `${CTL}$ddlTeam`
    })
  );
  if (!res.ok) throw new Error(`팀 선택 POST 실패 ${res.status}`);
  html = await res.text();
  state = extractViewState(html);
  const rows = [...parsePlayers(cheerioLoad(html))];

  for (const pageNum of findPageNumbers(html).filter((n) => n > 1)) {
    await sleep(300);
    res = await post(
      buildForm({
        vs: state.viewState,
        vsg: state.viewStateGenerator,
        ev: state.eventValidation,
        teamCode: team.kboCode,
        eventTarget: `${CTL}$ucPager$btnNo${pageNum}`,
        page: String(pageNum)
      })
    );
    if (!res.ok) break;
    html = await res.text();
    state = extractViewState(html);
    rows.push(...parsePlayers(cheerioLoad(html)));
  }
  return rows;
}

/** 연도 역순 폴백으로 사진을 받는다. 성공 시 {year, bytes}, 전부 없으면 null */
async function downloadPhoto(playerId) {
  const dest = join(PHOTO_DIR, `${playerId}.jpg`);
  if (existsSync(dest)) return { year: null, bytes: 0, cached: true };

  for (const year of PHOTO_YEARS) {
    const res = await fetch(`${CDN}/middle/${year}/${playerId}.jpg`, {
      headers: { "User-Agent": USER_AGENT, Referer: "https://www.koreabaseball.com/" }
    });
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    // 404 대체 이미지(수백 바이트)를 걸러낸다.
    if (buf.length < 2000) continue;
    writeFileSync(dest, buf);
    return { year, bytes: buf.length, cached: false };
  }
  return null;
}

function parseArgs() {
  const out = { team: null, limit: 0, tier: null };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--team=")) out.team = a.split("=")[1];
    else if (a.startsWith("--limit=")) out.limit = parseInt(a.split("=")[1], 10) || 0;
    else if (a.startsWith("--tier=")) out.tier = a.split("=")[1];
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const targets = args.team ? TEAMS.filter((t) => t.id === args.team) : TEAMS;
  if (targets.length === 0) {
    console.error(`알 수 없는 팀: ${args.team}`);
    process.exit(1);
  }

  mkdirSync(PHOTO_DIR, { recursive: true });

  const firstTierOnly = args.tier === "first";
  const rosterIndex = firstTierOnly ? loadRosterIndex() : null;
  if (firstTierOnly) {
    console.log(
      `1군 필터: 투수 ${TIER_FIRST.pitcher}경기 / 야수 ${TIER_FIRST.batter}경기 이상 (로스터 ${rosterIndex.size}명 기준)`
    );
  }

  const players = [];
  const missing = [];

  for (const team of targets) {
    process.stdout.write(`\n[${team.name}] 선수 목록 스크랩... `);
    let rows;
    try {
      rows = await scrapeTeam(team);
    } catch (err) {
      console.log(`실패: ${err.message}`);
      continue;
    }
    const scraped = rows.length;
    if (firstTierOnly) rows = rows.filter((r) => isFirstTier(rosterIndex, r.name, r.jerseyNumber));
    if (args.limit > 0) rows = rows.slice(0, args.limit);
    console.log(firstTierOnly ? `${rows.length}명 (전체 ${scraped}명 중 1군)` : `${rows.length}명 (playerId 보유)`);

    let ok = 0;
    for (const row of rows) {
      const photo = await downloadPhoto(row.kboPlayerId);
      if (photo) {
        ok += 1;
        players.push({
          id: row.kboPlayerId,
          name: row.name,
          team: team.id,
          teamName: team.name,
          no: row.jerseyNumber,
          pos: row.positionRaw,
          photoYear: photo.year,
          kboUrl: `https://www.koreabaseball.com/Record/Player/HitterDetail/Basic.aspx?playerId=${row.kboPlayerId}`
        });
      } else {
        missing.push({ team: team.id, name: row.name, id: row.kboPlayerId });
      }
      await sleep(120); // KBO CDN 예의상 간격
    }
    console.log(`  사진 확보 ${ok}/${rows.length}`);
  }

  writeFileSync(join(OUT_DIR, "players.json"), JSON.stringify(players, null, 2), "utf-8");

  console.log(`\n=== 요약 ===`);
  console.log(`사진 확보: ${players.length}명`);
  console.log(`사진 없음: ${missing.length}명`);
  if (missing.length > 0) {
    console.log(missing.slice(0, 15).map((m) => `  - ${m.team} ${m.name} (${m.id})`).join("\n"));
    if (missing.length > 15) console.log(`  ... 외 ${missing.length - 15}명`);
  }
  const byYear = {};
  for (const p of players) byYear[p.photoYear ?? "cached"] = (byYear[p.photoYear ?? "cached"] ?? 0) + 1;
  console.log(`연도 분포:`, byYear);
  console.log(`\n저장 위치: public/poc-face/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
