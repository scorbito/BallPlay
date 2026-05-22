#!/usr/bin/env node
// @ts-check
/**
 * KBO 선수별 "최근 10경기" 기록 수집.
 *
 *   /Record/Player/HitterDetail/Basic.aspx?playerId=XXX
 *   /Record/Player/PitcherDetail/Basic.aspx?playerId=XXX
 *
 * 각 선수 detail 페이지에서 <h6>최근 10경기</h6> 다음의 <table>을 파싱.
 *
 * 출력: data/recent10_2026.json
 * 시뮬 통합 시 hot/cold 가중치 계산에 사용 (예: 0.7*시즌 + 0.3*최근).
 *
 * 비용:
 *   - 1군 선수 약 500명 × 1.5초 딜레이 = 약 12~13분
 *   - 한 시즌 시드용. 정기 cron 금지.
 *
 * 사용법:
 *   node scripts/scrape-kbo-recent10.mjs --probe       # detail 페이지 구조 디버그
 *   node scripts/scrape-kbo-recent10.mjs --team=doosan # 한 팀만 (테스트)
 *   node scripts/scrape-kbo-recent10.mjs --limit=10    # 선수 10명만 (스모크)
 *   node scripts/scrape-kbo-recent10.mjs               # 전체
 *
 * 참고 — 원본 Python 코드: 사용자 별도 폴더(데이터수집/collect_recent10.py).
 * 우리 컨벤션(ES modules, cheerio, polite delay, KBO ID ↔ 우리 roster ID 매칭)으로 포팅.
 */

import { writeFile, mkdir, readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { load as cheerioLoad } from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const ROSTERS_DIR = join(PROJECT_ROOT, "data", "rosters");
const OUT_PATH = join(PROJECT_ROOT, "data", "recent10_2026.json");

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 BallPlay-Seed/0.1 (contact: dev@ballplay.local)";

const FETCH_DELAY_MS = 1500;

const TEAMS = [
  { id: "lg", kboCode: "LG", shortName: "LG", name: "LG 트윈스" },
  { id: "doosan", kboCode: "OB", shortName: "두산", name: "두산 베어스" },
  { id: "kt", kboCode: "KT", shortName: "KT", name: "KT 위즈" },
  { id: "samsung", kboCode: "SS", shortName: "삼성", name: "삼성 라이온즈" },
  { id: "ssg", kboCode: "SK", shortName: "SSG", name: "SSG 랜더스" },
  { id: "nc", kboCode: "NC", shortName: "NC", name: "NC 다이노스" },
  { id: "kia", kboCode: "HT", shortName: "KIA", name: "KIA 타이거즈" },
  { id: "hanwha", kboCode: "HH", shortName: "한화", name: "한화 이글스" },
  { id: "kiwoom", kboCode: "WO", shortName: "키움", name: "키움 히어로즈" },
  { id: "lotte", kboCode: "LT", shortName: "롯데", name: "롯데 자이언츠" }
];

const PAGES = {
  hitterList: "https://www.koreabaseball.com/Record/Player/HitterBasic/Basic1.aspx",
  pitcherList: "https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx",
  hitterDetail: "https://www.koreabaseball.com/Record/Player/HitterDetail/Basic.aspx",
  pitcherDetail: "https://www.koreabaseball.com/Record/Player/PitcherDetail/Basic.aspx"
};

const args = process.argv.slice(2);
const flags = {
  probe: args.includes("--probe"),
  team: args.find((a) => a.startsWith("--team="))?.split("=")[1] ?? null,
  limit: Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 0) || null,
  skipRoster: args.includes("--skip-roster") // 기존 ID 캐시 재사용
};

main().catch((err) => {
  console.error("[scrape-kbo-recent10] failed:", err);
  process.exit(1);
});

async function main() {
  console.log(
    `[scrape-kbo-recent10] probe=${flags.probe} team=${flags.team ?? "ALL"} limit=${flags.limit ?? "none"}`
  );

  if (flags.probe) {
    await probeDetailPage();
    return;
  }

  // 우리 roster 로드 (KBO ID ↔ 우리 ID 매칭용)
  const rosters = await loadRosters();
  console.log(
    `[scrape-kbo-recent10] rosters loaded: ${Object.keys(rosters).length}팀 / ${Object.values(rosters).reduce(
      (s, r) => s + r.players.length,
      0
    )}명`
  );

  // 1) 팀별 KBO playerId 목록 수집
  const targetTeams = flags.team
    ? TEAMS.filter((t) => t.id === flags.team)
    : TEAMS;
  if (targetTeams.length === 0) throw new Error(`unknown team: ${flags.team}`);

  console.log("\n[1/2] 팀별 KBO playerId 수집...");
  const allHitterIds = [];
  const allPitcherIds = [];
  for (const team of targetTeams) {
    const hitters = await fetchTeamPlayerIds(PAGES.hitterList, team);
    await sleep(FETCH_DELAY_MS);
    const pitchers = await fetchTeamPlayerIds(PAGES.pitcherList, team);
    await sleep(FETCH_DELAY_MS);
    allHitterIds.push(...hitters);
    allPitcherIds.push(...pitchers);
    console.log(`  ${team.name}: 타자 ${hitters.length} / 투수 ${pitchers.length}`);
  }
  console.log(
    `  합계: 타자 ${allHitterIds.length} / 투수 ${allPitcherIds.length}`
  );

  // 우리 roster의 player.id에 매칭
  const matchedHitters = allHitterIds
    .map((p) => ({ ...p, ourPlayerId: matchToOurRoster(p, rosters) }))
    .filter((p) => p.ourPlayerId);
  const matchedPitchers = allPitcherIds
    .map((p) => ({ ...p, ourPlayerId: matchToOurRoster(p, rosters) }))
    .filter((p) => p.ourPlayerId);
  console.log(
    `  매칭: 타자 ${matchedHitters.length}/${allHitterIds.length} / 투수 ${matchedPitchers.length}/${allPitcherIds.length}`
  );

  // 2) 선수별 최근 10경기 fetch
  const limit = flags.limit ?? undefined;
  console.log(
    `\n[2/2] 선수별 최근 10경기 수집 (1.5s 간격, 예상 ${Math.round(
      ((matchedHitters.length + matchedPitchers.length) * FETCH_DELAY_MS) / 1000 / 60
    )}분)...`
  );

  const out = {
    snapshotDate: new Date().toISOString().slice(0, 10),
    source: "koreabaseball.com (HitterDetail/PitcherDetail Basic.aspx)",
    note: "최근 10경기 일자별 기록. is_summary=true는 합계 행.",
    hitters: {},
    pitchers: {}
  };

  let i = 0;
  for (const p of (limit ? matchedHitters.slice(0, limit) : matchedHitters)) {
    i++;
    const rows = await fetchRecent10(PAGES.hitterDetail, p.kboPlayerId);
    if (rows && rows.length) out.hitters[p.ourPlayerId] = rows;
    if (i % 20 === 0) console.log(`  타자 ${i}/${matchedHitters.length} 처리...`);
    await sleep(FETCH_DELAY_MS);
  }

  i = 0;
  for (const p of (limit ? matchedPitchers.slice(0, limit) : matchedPitchers)) {
    i++;
    const rows = await fetchRecent10(PAGES.pitcherDetail, p.kboPlayerId);
    if (rows && rows.length) out.pitchers[p.ourPlayerId] = rows;
    if (i % 20 === 0) console.log(`  투수 ${i}/${matchedPitchers.length} 처리...`);
    await sleep(FETCH_DELAY_MS);
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(out, null, 2), "utf8");
  console.log(`\n[scrape-kbo-recent10] wrote ${OUT_PATH}`);
  console.log(
    `  최근10 데이터 있는 선수: 타자 ${Object.keys(out.hitters).length} / 투수 ${Object.keys(out.pitchers).length}`
  );
}

// ============================================================
// 1) 팀별 KBO playerId 수집 (목록 페이지 → 팀 postback → href에서 추출)
// ============================================================

async function fetchTeamPlayerIds(listUrl, team) {
  const initRes = await fetch(listUrl, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko" }
  });
  if (!initRes.ok) return [];
  const cookie = (initRes.headers.get("set-cookie") || "").split(";")[0];
  const $init = cheerioLoad(await initRes.text());

  const teamSelectName = $init('select[name$="ddlTeam$ddlTeam"]').attr("name");
  if (!teamSelectName) return [];

  // 모든 form field 수집 + 팀 코드 override (scrape-kbo-stats.mjs와 동일 패턴)
  const form = collectFormFields($init);
  form.set("__EVENTTARGET", teamSelectName);
  form.set("__EVENTARGUMENT", "");
  form.set(teamSelectName, team.kboCode);

  const postRes = await fetch(listUrl, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "ko-KR,ko",
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: listUrl,
      ...(cookie && { Cookie: cookie })
    },
    body: form.toString()
  });
  if (!postRes.ok) return [];
  const $ = cheerioLoad(await postRes.text());

  // <a href="...playerId=12345">선수명</a> 추출
  const players = [];
  const seen = new Set();
  $('a[href*="playerId"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const m = href.match(/playerId=(\d+)/);
    if (!m) return;
    const kboPlayerId = m[1];
    if (seen.has(kboPlayerId)) return;
    seen.add(kboPlayerId);
    players.push({
      kboPlayerId,
      name: $(el).text().trim(),
      teamId: team.id,
      teamCode: team.kboCode
    });
  });
  return players;
}

// ============================================================
// 2) 선수 detail 페이지에서 "최근 10경기" 표 파싱
// ============================================================

async function fetchRecent10(detailUrl, kboPlayerId) {
  const url = `${detailUrl}?playerId=${kboPlayerId}`;
  let html;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko" }
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }
  const $ = cheerioLoad(html);

  // <h6>최근 10경기</h6> 다음에 등장하는 첫 <table>.
  // sibling 직접 매칭이 안 되는 경우(wrapper div 끼어있음)도 있어 DOM 순회로 탐색.
  const table = findNextTable($, "최근 10경기");
  if (!table || table.length === 0) return null;

  const trs = table.find("tr");
  if (trs.length < 2) return null;

  const headers = trs
    .eq(0)
    .find("th, td")
    .map((_, th) => $(th).text().trim())
    .get();

  const rows = [];
  trs.slice(1).each((_, tr) => {
    const cells = $(tr).find("td").map((__, td) => $(td).text().trim()).get();
    if (cells.length === 0) return;
    if (cells[0] === "기록이 없습니다.") return;
    if (cells.length !== headers.length) return;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx];
    });
    // "합계" 행 식별
    row.is_summary = row["일자"] === "합계";
    rows.push(row);
  });
  return rows;
}

// ============================================================
// roster 매칭 — KBO playerId가 우리 roster의 player.id와 다름
// ============================================================
//
// KBO playerId: KBO 시스템 고유 숫자 ID (예: "67893")
// 우리 player.id: "doosan-24" 형태 (teamId-jerseyNumber)
//
// 매칭 키: (teamId, name). roster에 KBO playerId가 저장돼있지 않아서
// 이름으로 매핑. 동명이인 거의 없음. (있으면 1군 출장자 우선)

function matchToOurRoster(kboPlayer, rosters) {
  const roster = rosters[kboPlayer.teamId];
  if (!roster) return null;
  const candidates = roster.players.filter((p) => p.name === kboPlayer.name);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].id;
  const active = candidates.find((p) => (p.seasonGames ?? 0) > 0);
  return (active ?? candidates[0]).id;
}

// ============================================================
// 공통 헬퍼 (scrape-kbo-stats.mjs와 동일 패턴)
// ============================================================

/** h6 텍스트로 anchor 잡고, 그 h6 다음에 등장하는 첫 <table>을 DOM 순회로 찾기.
 *  cheerio엔 BeautifulSoup의 find_next 같은 게 없어서 모든 element를 순회하며 위치 비교. */
function findNextTable($, h6Text) {
  let foundH6 = false;
  let result = null;
  // body 안의 모든 element를 깊이 우선으로 순회
  const walk = (node) => {
    if (result) return;
    const $node = $(node);
    if (node.type === "tag") {
      const tag = node.tagName?.toLowerCase();
      if (!foundH6 && tag === "h6" && $node.text().trim() === h6Text) {
        foundH6 = true;
        return;
      }
      if (foundH6 && tag === "table") {
        result = $node;
        return;
      }
    }
    $node.children().each((_, child) => walk(child));
  };
  walk($("body")[0] ?? $.root()[0]);
  return result;
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

async function loadRosters() {
  const out = {};
  const files = await readdir(ROSTERS_DIR);
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const raw = await readFile(join(ROSTERS_DIR, f), "utf8");
    const data = JSON.parse(raw);
    out[data.teamId] = data;
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// 디버그: detail 페이지의 "최근 10경기" 표 구조 확인
// ============================================================
async function probeDetailPage() {
  // 임의의 선수 (LG 박해민 부근) — 실제 활성 playerId 하나 사용
  // 첫 GET으로 타자 목록 → 첫 playerId 추출 → detail probe
  const initRes = await fetch(PAGES.hitterList, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko" }
  });
  const $list = cheerioLoad(await initRes.text());
  const firstHref = $list('a[href*="playerId"]').first().attr("href") || "";
  const m = firstHref.match(/playerId=(\d+)/);
  if (!m) {
    console.log("(playerId not found on list page)");
    return;
  }
  const probeId = m[1];
  console.log(`[probe] detail for playerId=${probeId}`);
  const detailRes = await fetch(`${PAGES.hitterDetail}?playerId=${probeId}`, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko" }
  });
  const $ = cheerioLoad(await detailRes.text());
  console.log(`\n--- <h6> headings ---`);
  $("h6").each((_, el) => {
    console.log(`  "${$(el).text().trim()}"`);
  });
  console.log(`\n--- "최근 10경기" 표 ---`);
  const table = findNextTable($, "최근 10경기");
  if (!table || table.length === 0) {
    console.log("(not found — h6 텍스트 또는 DOM 구조 변경 확인)");
    return;
  }
  const headers = table.find("tr").eq(0).find("th, td").map((_, th) => $(th).text().trim()).get();
  console.log("headers:", headers);
  const firstRow = table.find("tr").eq(1).find("td").map((_, td) => $(td).text().trim()).get();
  console.log("first row:", firstRow);
  const allRows = table.find("tr").length - 1;
  console.log(`total data rows: ${allRows}`);
}
