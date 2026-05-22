#!/usr/bin/env node
// @ts-check
/**
 * KBO 공식 사이트(koreabaseball.com/Player/Search.aspx)에서 10개 구단 선수 명단을
 * 스크래핑하여 data/rosters/{teamId}.json 파일로 저장한다.
 *
 * KBO 사이트는 ASP.NET WebForms 기반이라 단순 GET이 아닌 POST(__VIEWSTATE 동봉)로
 * 팀 선택을 전달하고, 페이지네이션도 postback으로 동작한다.
 *
 * 사용법:
 *   node scripts/scrape-kbo-rosters.mjs
 *   node scripts/scrape-kbo-rosters.mjs --team=doosan
 *   node scripts/scrape-kbo-rosters.mjs --dry-run
 *
 * 트레이드/방출/콜업 시: 그냥 다시 실행하면 됨.
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { load as cheerioLoad } from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const OUT_DIR = join(PROJECT_ROOT, "data", "rosters");

const BASE_URL = "https://www.koreabaseball.com/Player/Search.aspx";
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// KBO 팀 코드 매핑 (KBO 사이트의 select option value와 우리 시스템 id 연결)
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

// ASP.NET 폼 필드명 prefix (KBO 사이트가 사용하는 컨트롤 경로)
const CTL = "ctl00$ctl00$ctl00$cphContents$cphContents$cphContents";

/** ASP.NET HTML에서 __VIEWSTATE/__VIEWSTATEGENERATOR/__EVENTVALIDATION 추출 */
function extractViewState(html) {
  return {
    viewState: html.match(/id="__VIEWSTATE" value="([^"]+)"/)?.[1] ?? "",
    viewStateGenerator: html.match(/id="__VIEWSTATEGENERATOR" value="([^"]+)"/)?.[1] ?? "",
    eventValidation: html.match(/id="__EVENTVALIDATION" value="([^"]+)"/)?.[1] ?? ""
  };
}

/** 폼 데이터를 만들어 POST. searchTeam만 선택한 page 1 상태. */
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

/** 한 페이지의 HTML에서 선수 행 파싱 — playerId/Hitter|Pitcher 구분도 함께 추출 */
function parsePlayers($, teamId) {
  const players = [];
  $("table.tEx tbody tr").each((_, el) => {
    const cells = $(el).find("td");
    if (cells.length < 4) return;
    const jerseyText = $(cells[0]).text().trim();
    const nameCell = $(cells[1]);
    const name = nameCell.text().trim();
    const positionRaw = $(cells[3]).text().trim();

    if (!name || !jerseyText) return;
    const jerseyNumber = parseInt(jerseyText.replace(/\D/g, ""), 10);
    if (Number.isNaN(jerseyNumber)) return;

    // <a href="/Record/Player/HitterDetail/Basic.aspx?playerId=12345">이름</a> 패턴에서 추출
    const href = nameCell.find("a").attr("href") ?? "";
    const playerIdMatch = href.match(/playerId=(\d+)/);
    const playerId = playerIdMatch ? playerIdMatch[1] : null;
    const isPitcher = /PitcherDetail/i.test(href);

    // id는 assignStableIds()에서 결정 (등번호 충돌 시 알파벳/이전id 기준)
    players.push({
      id: "",
      name,
      jerseyNumber,
      primaryPosition: mapKboPosition(positionRaw),
      _rawPosition: positionRaw,
      _playerId: playerId,
      _isPitcher: isPitcher
    });
  });
  return players;
}

/** 선수 상세 페이지에서 투/타 정보 + 시즌 경기수(G) 파싱. 실패 시 null. */
async function fetchPlayerDetail(player, cookie) {
  if (!player._playerId) return null;
  const path = player._isPitcher ? "PitcherDetail" : "HitterDetail";
  const url = `https://www.koreabaseball.com/Record/Player/${path}/Basic.aspx?playerId=${player._playerId}`;

  let html;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Referer: BASE_URL,
        ...(cookie && { Cookie: cookie })
      }
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  // 1) 투/타 — <span id="...lblPosition">투수(우투우타)</span>
  let throwingHand;
  let battingHand;
  const m = html.match(/lblPosition"[^>]*>[^<(]*\(([^)]+)\)/);
  if (m) {
    const inner = m[1];
    const throwMatch = inner.match(/(좌|우)투/);
    const batMatch = inner.match(/(좌|우|양)타/);
    const throwingMap = { 우: "R", 좌: "L" };
    const battingMap = { 우: "R", 좌: "L", 양: "S" };
    throwingHand = throwMatch ? throwingMap[throwMatch[1]] : undefined;
    battingHand = batMatch ? battingMap[batMatch[1]] : undefined;
  }

  // 2) 시즌 G(경기수) — 첫번째 stats 테이블의 첫 행 3번째 셀.
  //    야수: 팀명 / AVG / G / PA / ...
  //    투수: 팀명 / ERA / G / CG / ...
  //    행이 없으면 0 (이번 시즌 1군 출장 없음 = 2군).
  let seasonGames = 0;
  const statsTableMatch = html.match(/<table class="tbl tt[^"]*"[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
  if (statsTableMatch) {
    const firstRowMatch = statsTableMatch[1].match(/<tr>([\s\S]*?)<\/tr>/);
    if (firstRowMatch) {
      const cells = [...firstRowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1].trim());
      // cells[0]=팀명, cells[1]=AVG/ERA, cells[2]=G
      const gText = cells[2];
      if (gText) {
        const gNum = parseInt(gText.replace(/\D/g, ""), 10);
        if (!Number.isNaN(gNum)) seasonGames = gNum;
      }
    }
  }

  return { throwingHand, battingHand, seasonGames };
}

/** 페이지네이션 링크에서 사용 가능한 다음 페이지 번호 추출 */
function findPageNumbers(html) {
  // ucPager$btnNoN 패턴 찾기
  const matches = [...html.matchAll(/ucPager\$btnNo(\d+)/g)];
  const nums = new Set(matches.map((m) => parseInt(m[1], 10)));
  return [...nums].sort((a, b) => a - b);
}

/**
 * 새 스크랩 결과에 안정적인 id를 부여한다.
 *
 * 규칙:
 *  - 이전 파일에 이름이 일치하는 선수가 있으면 그 id 그대로 보존 (안정성).
 *  - 등번호가 한 명만 가지면 `${teamId}-${jerseyNumber}` (단순 id).
 *  - 등번호 충돌이면 알파벳 1순위가 단순 id, 나머지는 `${teamId}-p${kboPlayerId}`.
 *  - kboPlayerId가 없는 케이스는 fallback `${teamId}-x${index}`.
 */
function assignStableIds(players, teamId, prevByName) {
  // 1) (name, jersey) 정확 매칭으로만 prev id 보존.
  //    동명이인 모호성 차단: 등번호가 다르면 다른 사람으로 간주, 새 id 부여.
  //    트레이드오프: 시즌 중 등번호 변경 시 id가 바뀜 (드문 케이스라 수용).
  for (const p of players) {
    const matches = prevByName.get(p.name) ?? [];
    const sameJersey = matches.filter((m) => m.jerseyNumber === p.jerseyNumber);
    if (sameJersey.length === 1) {
      p.id = sameJersey[0].id;
    }
    // 그 외 — empty 상태로 두고 step 2가 새 id 부여
  }

  // 2) 등번호 그룹별로 처리
  const byJersey = new Map();
  for (const p of players) {
    if (!byJersey.has(p.jerseyNumber)) byJersey.set(p.jerseyNumber, []);
    byJersey.get(p.jerseyNumber).push(p);
  }

  for (const [jersey, group] of byJersey.entries()) {
    if (group.length === 1) {
      // 충돌 없음 — id 비어있을 때만 단순 id 부여
      const p = group[0];
      if (!p.id) p.id = `${teamId}-${jersey}`;
      continue;
    }
    // 충돌 — 단순 id 우선권 결정
    const simpleId = `${teamId}-${jersey}`;
    let simpleHolder = group.find((p) => p.id === simpleId);
    if (!simpleHolder) {
      // 이전 파일에서 단순 id 가졌던 사람이 그룹에 없으면 알파벳 1순위
      const sorted = [...group].sort((a, b) => a.name.localeCompare(b.name, "ko"));
      simpleHolder = sorted[0];
    }
    for (let i = 0; i < group.length; i++) {
      const p = group[i];
      if (p === simpleHolder) {
        p.id = simpleId;
      } else if (!p.id) {
        // 이전 id 없는 새 선수만 새 id 부여
        p.id = p._playerId ? `${teamId}-p${p._playerId}` : `${teamId}-x${jersey}-${i}`;
      }
      // p.id가 이미 있으면 (이전 파일에서 가져옴) 그대로 둠
    }
  }

  // 3) 최종 검증 — 동일 id 발생 시 충돌 보고
  const seen = new Set();
  for (const p of players) {
    if (seen.has(p.id)) {
      console.warn(`  ⚠ id 충돌: ${p.id} (${p.name}) — fallback 적용`);
      p.id = p._playerId ? `${teamId}-p${p._playerId}` : `${teamId}-x-${p.name}`;
    }
    seen.add(p.id);
  }
}

/** "내야수/외야수" 같은 일반 분류를 우리 시스템의 9포지션 중 하나로 매핑.
 *  세부 포지션은 알 수 없으니 기본값을 두고 사용자가 라인업에서 수동 조정. */
function mapKboPosition(rawPos) {
  const p = (rawPos || "").trim();
  if (p.includes("투수")) return "P";
  if (p.includes("포수")) return "C";
  if (p.includes("1루")) return "1B";
  if (p.includes("2루")) return "2B";
  if (p.includes("3루")) return "3B";
  if (p.includes("유격")) return "SS";
  if (p.includes("좌익")) return "LF";
  if (p.includes("중견")) return "CF";
  if (p.includes("우익")) return "RF";
  if (p.includes("지명")) return "DH";
  if (p.includes("내야")) return "3B"; // 기본값
  if (p.includes("외야")) return "CF"; // 기본값
  return "DH";
}

/** 한 팀의 모든 페이지를 순회하며 명단 수집 */
async function scrapeTeam(team) {
  process.stdout.write(`  ${team.name} (${team.kboCode})... `);

  // 1) 초기 GET → __VIEWSTATE 등 캡처
  const getRes = await fetch(BASE_URL, {
    headers: { "User-Agent": USER_AGENT, Referer: "https://www.koreabaseball.com/" }
  });
  if (!getRes.ok) {
    console.log(`FAIL (GET ${getRes.status})`);
    return null;
  }
  const cookie = (getRes.headers.get("set-cookie") || "").split(";")[0];
  let html = await getRes.text();
  let state = extractViewState(html);

  // 2) 팀 선택 POST → 페이지 1
  let res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: BASE_URL,
      ...(cookie && { Cookie: cookie })
    },
    body: buildForm({
      vs: state.viewState,
      vsg: state.viewStateGenerator,
      ev: state.eventValidation,
      teamCode: team.kboCode,
      eventTarget: `${CTL}$ddlTeam`
    })
  });
  if (!res.ok) {
    console.log(`FAIL (POST ${res.status})`);
    return null;
  }
  html = await res.text();
  state = extractViewState(html);
  let $ = cheerioLoad(html);
  const allPlayers = [...parsePlayers($, team.id)];
  // 중복은 _playerId(KBO 고유) 기준으로 제거. _playerId 없으면 name+jersey 조합.
  const seenKey = new Set(allPlayers.map((p) => p._playerId ?? `${p.name}-${p.jerseyNumber}`));

  // 3) 페이지 2 이상이 있으면 순회
  const pageNums = findPageNumbers(html);
  const remainingPages = pageNums.filter((n) => n > 1);

  for (const pageNum of remainingPages) {
    await new Promise((r) => setTimeout(r, 300)); // 페이지 사이 짧은 딜레이
    res = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: BASE_URL,
        ...(cookie && { Cookie: cookie })
      },
      body: buildForm({
        vs: state.viewState,
        vsg: state.viewStateGenerator,
        ev: state.eventValidation,
        teamCode: team.kboCode,
        eventTarget: `${CTL}$ucPager$btnNo${pageNum}`,
        page: String(pageNum)
      })
    });
    if (!res.ok) break;
    html = await res.text();
    state = extractViewState(html);
    $ = cheerioLoad(html);
    const players = parsePlayers($, team.id);
    for (const p of players) {
      const key = p._playerId ?? `${p.name}-${p.jerseyNumber}`;
      if (!seenKey.has(key)) {
        allPlayers.push(p);
        seenKey.add(key);
      }
    }
  }

  // 정렬 — 등번호 오름차순
  allPlayers.sort((a, b) => a.jerseyNumber - b.jerseyNumber);

  // 3.5) 이전 파일 로드해서 id 안정성 보장 (name → 후보 배열, 동명이인 대응)
  const prevByName = new Map();
  try {
    const prevPath = join(OUT_DIR, `${team.id}.json`);
    const prev = JSON.parse(await readFile(prevPath, "utf-8"));
    for (const p of prev.players ?? []) {
      if (!prevByName.has(p.name)) prevByName.set(p.name, []);
      prevByName.get(p.name).push(p);
    }
  } catch {
    // 첫 스크랩이거나 파일 없음 — 무시
  }
  assignStableIds(allPlayers, team.id, prevByName);

  // 4) 각 선수 상세 페이지에서 투/타 + 시즌 G 가져오기 (순차, 100ms 간격)
  process.stdout.write(`(상세 ${allPlayers.length}건 fetch... `);
  let detailed = 0;
  let activeIn1군 = 0;
  for (const p of allPlayers) {
    const d = await fetchPlayerDetail(p, cookie);
    if (d) {
      if (d.throwingHand) p.throwingHand = d.throwingHand;
      if (d.battingHand) p.battingHand = d.battingHand;
      p.seasonGames = d.seasonGames;
      if (d.seasonGames > 0) activeIn1군 += 1;
      detailed += 1;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  process.stdout.write(`${detailed}건, 1군 ${activeIn1군}명) `);

  // _rawPosition 통계 출력 + 디버깅 필드 정리
  const posSummary = allPlayers.reduce((acc, p) => {
    acc[p._rawPosition] = (acc[p._rawPosition] || 0) + 1;
    return acc;
  }, {});
  for (const p of allPlayers) {
    delete p._rawPosition;
    delete p._playerId;
    delete p._isPitcher;
  }

  const posStr = Object.entries(posSummary)
    .map(([k, v]) => `${k}${v}`)
    .join(" ");
  console.log(`${allPlayers.length}명  (${posStr})`);

  return {
    teamId: team.id,
    teamName: team.name,
    _scrapedAt: new Date().toISOString(),
    _source: BASE_URL,
    _note:
      "포지션: KBO는 투수/포수/내야수/외야수만 분류. 내야수→3B 기본값, 외야수→CF 기본값으로 매핑되어 있으며 라인업 빌더에서 세부 포지션 수동 조정 가능.",
    players: allPlayers
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { team: null, dryRun: false };
  for (const a of args) {
    if (a === "--dry-run") out.dryRun = true;
    else if (a.startsWith("--team=")) out.team = a.split("=")[1];
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const targets = args.team ? TEAMS.filter((t) => t.id === args.team) : TEAMS;

  if (args.team && targets.length === 0) {
    console.error(`Unknown team id: ${args.team}`);
    console.error(`Available: ${TEAMS.map((t) => t.id).join(", ")}`);
    process.exit(1);
  }

  if (!args.dryRun) await mkdir(OUT_DIR, { recursive: true });

  console.log("KBO 선수 명단 스크래핑 시작\n");

  let totalPlayers = 0;
  for (const team of targets) {
    const data = await scrapeTeam(team);
    if (!data) continue;
    totalPlayers += data.players.length;
    if (!args.dryRun) {
      const path = join(OUT_DIR, `${team.id}.json`);
      await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
    }
    // 팀 사이 1초 딜레이
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n완료. 총 ${totalPlayers}명.`);
  if (!args.dryRun) {
    console.log(`결과: ${OUT_DIR}/{team}.json`);
  }
}

main().catch((err) => {
  console.error("스크래퍼 오류:", err);
  process.exit(1);
});
