#!/usr/bin/env node
// @ts-check
/**
 * KBO 공식 사이트(koreabaseball.com)에서 시즌 타자/투수 스탯을 스크래핑한다.
 *
 *   1군 타자: /Record/Player/HitterBasic/Basic1.aspx + Basic2.aspx
 *   1군 투수: /Record/Player/PitcherBasic/Basic1.aspx + Basic2.aspx
 *   2군 타자: /Futures/Record/Player/HitterBasic/Basic1.aspx + Basic2.aspx
 *   2군 투수: /Futures/Record/Player/PitcherBasic/Basic1.aspx + Basic2.aspx
 *
 * KBO 사이트는 ASP.NET WebForms이라 __VIEWSTATE 포함 POST가 필요.
 * 팀 드롭다운(ddlTeam) postback으로 팀별 데이터 받음.
 *
 * 출력: data/kbo_players_2026.json (statsLoader.ts와 동일 스키마)
 *
 * 사용법:
 *   node scripts/scrape-kbo-stats.mjs --probe        # 폼 필드 구조 출력 (디버그)
 *   node scripts/scrape-kbo-stats.mjs --team=doosan  # 한 팀만
 *   node scripts/scrape-kbo-stats.mjs                # 10팀 전부
 *   node scripts/scrape-kbo-stats.mjs --year=2026    # 시즌 지정
 *   node scripts/scrape-kbo-stats.mjs --no-futures   # 1군만
 *
 * 매너:
 *   - 페이지 사이 1.5s 딜레이 (KBO 사이트는 사용량 많은 곳이라 0.3s로도 무난할 듯하지만
 *     스크래퍼는 보수적으로)
 *   - User-Agent에 연락처 명시
 *   - 시즌당 1회 시드 + 변경 시점 수동 재실행
 */

import { writeFile, mkdir, readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { load as cheerioLoad } from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const ROSTERS_DIR = join(PROJECT_ROOT, "data", "rosters");
const OUT_PATH = join(PROJECT_ROOT, "data", "kbo_players_2026.json");

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 BallPlay-Seed/0.1 (contact: dev@ballplay.local)";

const FETCH_DELAY_MS = 1500;

// KBO 시스템 ddlTeam 코드 ↔ 우리 시스템 teamId
// shortName: KBO 통계 페이지 td[2]에 들어가는 짧은 이름 (2군 필터 폴백용)
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
  hitterBasic1_1g: "https://www.koreabaseball.com/Record/Player/HitterBasic/Basic1.aspx",
  hitterBasic2_1g: "https://www.koreabaseball.com/Record/Player/HitterBasic/Basic2.aspx",
  pitcherBasic1_1g: "https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx",
  pitcherBasic2_1g: "https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic2.aspx",
  // 2군은 Basic1+Basic2 통합 단일 페이지. URL 패턴도 1군과 다름.
  hitter_2g: "https://www.koreabaseball.com/Futures/Player/Hitter.aspx",
  pitcher_2g: "https://www.koreabaseball.com/Futures/Player/Pitcher.aspx"
};

// ============================================================
// 진입점
// ============================================================
const args = process.argv.slice(2);
const flags = {
  probe: args.includes("--probe"),
  team: args.find((a) => a.startsWith("--team="))?.split("=")[1] ?? null,
  year: Number(args.find((a) => a.startsWith("--year="))?.split("=")[1] ?? 2026),
  noFutures: args.includes("--no-futures")
};

main().catch((err) => {
  console.error("[scrape-kbo-stats] failed:", err);
  process.exit(1);
});

async function main() {
  console.log(
    `[scrape-kbo-stats] year=${flags.year} probe=${flags.probe} team=${flags.team ?? "ALL"} no-futures=${flags.noFutures}`
  );

  if (flags.probe) {
    await probeFormFields(PAGES.hitterBasic1_1g);
    return;
  }

  // 로스터 로드 (이름+팀 매칭의 source of truth)
  const rosters = await loadRosters();
  console.log(
    `[scrape-kbo-stats] rosters loaded: ${Object.keys(rosters).length}팀 / ${Object.values(rosters).reduce(
      (s, r) => s + r.players.length,
      0
    )}명`
  );

  /** @type {{snapshotDate:string, source:string, teams: Record<string, {batters:any[], pitchers:any[]}>}} */
  const out = {
    snapshotDate: new Date().toISOString().slice(0, 10),
    source: `koreabaseball.com (1군${flags.noFutures ? "" : "+2군"})`,
    teams: {}
  };

  // 각 팀별로 4페이지(1군 H1+H2, 1군 P1+P2) [+ 2군 H1+H2, 2군 P1+P2] 스크래핑
  const targetTeams = flags.team
    ? TEAMS.filter((t) => t.id === flags.team)
    : TEAMS;
  if (targetTeams.length === 0) {
    throw new Error(`unknown team: ${flags.team}`);
  }

  for (const team of targetTeams) {
    console.log(`\n[team] ${team.name} (${team.kboCode})`);
    const roster = rosters[team.id];
    if (!roster) {
      console.warn(`  ⚠ no roster found for ${team.id}, skipping`);
      continue;
    }

    const collected = { batters: [], pitchers: [] };

    // 1군 타자 — Basic1 + Basic2 머지
    const hit1Rows1g = await scrapeStatsPage(PAGES.hitterBasic1_1g, team.kboCode, team.shortName, flags.year, parseHitterBasic1Row);
    await sleep(FETCH_DELAY_MS);
    const hit2Rows1g = await scrapeStatsPage(PAGES.hitterBasic2_1g, team.kboCode, team.shortName, flags.year, parseHitterBasic2Row);
    const merged1gHit = mergeRowsByName(hit1Rows1g, hit2Rows1g);
    console.log(`  1군 타자: ${merged1gHit.length}명`);
    for (const row of merged1gHit) {
      const sim = makeSimBatter(row, roster);
      if (sim) collected.batters.push(sim);
    }

    await sleep(FETCH_DELAY_MS);

    // 1군 투수
    const pit1Rows1g = await scrapeStatsPage(PAGES.pitcherBasic1_1g, team.kboCode, team.shortName, flags.year, parsePitcherBasic1Row);
    await sleep(FETCH_DELAY_MS);
    const pit2Rows1g = await scrapeStatsPage(PAGES.pitcherBasic2_1g, team.kboCode, team.shortName, flags.year, parsePitcherBasic2Row);
    const merged1gPit = mergeRowsByName(pit1Rows1g, pit2Rows1g);
    console.log(`  1군 투수: ${merged1gPit.length}명`);
    for (const row of merged1gPit) {
      const sim = makeSimPitcher(row, roster);
      if (sim) collected.pitchers.push(sim);
    }

    if (!flags.noFutures) {
      await sleep(FETCH_DELAY_MS);

      // 2군 타자 (Basic1+2 통합 단일 페이지)
      const hit2g = await scrapeStatsPage(PAGES.hitter_2g, team.kboCode, team.shortName, flags.year, parseFuturesHitterRow);
      console.log(`  2군 타자: ${hit2g.length}명`);
      const existingBatterIds = new Set(collected.batters.map((b) => b.playerId));
      for (const row of hit2g) {
        const sim = makeSimBatter(row, roster);
        if (sim && !existingBatterIds.has(sim.playerId)) {
          collected.batters.push(sim);
        }
      }

      await sleep(FETCH_DELAY_MS);

      // 2군 투수
      const pit2g = await scrapeStatsPage(PAGES.pitcher_2g, team.kboCode, team.shortName, flags.year, parseFuturesPitcherRow);
      console.log(`  2군 투수: ${pit2g.length}명`);
      const existingPitcherIds = new Set(collected.pitchers.map((p) => p.playerId));
      for (const row of pit2g) {
        const sim = makeSimPitcher(row, roster);
        if (sim && !existingPitcherIds.has(sim.playerId)) {
          collected.pitchers.push(sim);
        }
      }
    }

    out.teams[team.id] = collected;
    console.log(
      `  ✓ ${team.name}: 타자 ${collected.batters.length} / 투수 ${collected.pitchers.length}`
    );
  }

  // 일부 팀만 받았으면 나머지는 기존 파일에서 보존
  if (flags.team) {
    try {
      const prev = JSON.parse(await readFile(OUT_PATH, "utf8"));
      for (const tid of Object.keys(prev.teams ?? {})) {
        if (!out.teams[tid]) out.teams[tid] = prev.teams[tid];
      }
      out.source = `${out.source} (partial update of ${flags.team})`;
    } catch {
      // 기존 파일 없으면 무시
    }
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(out, null, 2), "utf8");
  console.log(`\n[scrape-kbo-stats] wrote ${OUT_PATH}`);
  reportUnmatched(rosters, out);
}

// ============================================================
// ASP.NET 공통 처리 — 페이지에서 viewstate + 컨트롤 이름 자동 추출
// ============================================================

function extractViewState(html) {
  return {
    viewState: html.match(/id="__VIEWSTATE" value="([^"]+)"/)?.[1] ?? "",
    viewStateGenerator: html.match(/id="__VIEWSTATEGENERATOR" value="([^"]+)"/)?.[1] ?? "",
    eventValidation: html.match(/id="__EVENTVALIDATION" value="([^"]+)"/)?.[1] ?? ""
  };
}

/** ddlTeam (또는 ddlOrganization 등 KBO가 사용하는 팀 select)의 name attribute를 찾아냄.
 *  페이지마다 컨트롤 prefix가 다를 수 있어서 동적으로 탐지. */
function findFormFieldName($, candidates) {
  for (const cand of candidates) {
    const el = $(`select[name$="${cand}"], input[name$="${cand}"]`).first();
    if (el.length > 0) {
      return el.attr("name");
    }
  }
  return null;
}

/** 디버그용 — Basic1 페이지의 모든 select/input name을 출력 */
async function probeFormFields(url) {
  console.log(`[probe] GET ${url}`);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerioLoad(html);
  console.log("\n--- <select> elements ---");
  $("select").each((_, el) => {
    const $el = $(el);
    console.log(`name=${$el.attr("name")}  id=${$el.attr("id")}  options=${$el.find("option").length}`);
  });
  console.log("\n--- table classes ---");
  $("table").each((_, el) => {
    const $el = $(el);
    console.log(`class=${$el.attr("class") ?? "(none)"}  rows=${$el.find("tbody tr").length}`);
  });
  console.log("\n--- first tbody row sample ---");
  const firstRow = $('table[class*="tData"] tbody tr').first();
  if (firstRow.length === 0) {
    console.log("(no table[class*=tData] found — check table class)");
  } else {
    firstRow.find("td").each((i, td) => {
      console.log(`  td[${i}] = "${$(td).text().trim()}"`);
    });
  }
  console.log("\n--- pagination links (postback) ---");
  $("a[href*='doPostBack']").each((_, el) => {
    const $el = $(el);
    console.log(`  text="${$el.text().trim()}"  href=${($el.attr("href") || "").slice(0, 120)}`);
  });
}

/** GET 응답의 <form> 안 모든 input/select를 form data로 수집.
 *  ASP.NET WebForms는 hfPage/hfOrderBy 같은 hidden까지 전부 전송해야 200 OK로
 *  실제 데이터 페이지를 돌려줌. (일부만 보내면 에러 페이지 반환) */
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

/**
 * 시즌 스탯 페이지 한 곳을 팀 필터로 fetch 후 행 파싱.
 *   1. GET → cookie + 모든 form field 자동 수집
 *   2. EVENTTARGET을 ddlTeam$ddlTeam으로 override, 팀 코드 set
 *   3. POST → tData 파싱. 팀별 25명 안팎이라 보통 1페이지로 끝남.
 *
 * 2군 페이지엔 ddlTeam이 없을 수 있어서 그 경우엔 초기 GET 응답을 그대로 파싱하고
 * 팀명(td[2])으로 필터링.
 */
async function scrapeStatsPage(url, kboTeamCode, kboTeamShortName, year, parseRow) {
  // 1) 초기 GET
  const initRes = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko" }
  });
  if (!initRes.ok) {
    console.warn(`    ! GET ${url} → ${initRes.status}, skipping`);
    return [];
  }
  const cookie = (initRes.headers.get("set-cookie") || "").split(";")[0];
  const initHtml = await initRes.text();
  const $init = cheerioLoad(initHtml);
  const teamSelectName = findFormFieldName($init, ["ddlTeam$ddlTeam", "ddlTeam"]);

  let html = initHtml;
  let $ = $init;

  if (teamSelectName) {
    // 2) 모든 form field 수집 + 팀 코드 override + POST
    const form = collectFormFields($init);
    form.set("__EVENTTARGET", teamSelectName);
    form.set("__EVENTARGUMENT", "");
    form.set(teamSelectName, kboTeamCode);
    // 시즌도 명시 (요청한 year로)
    const seasonName = findFormFieldName($init, ["ddlSeason$ddlSeason", "ddlSeason"]);
    if (seasonName) form.set(seasonName, String(year));

    const postRes = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "ko-KR,ko",
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: url,
        ...(cookie && { Cookie: cookie })
      },
      body: form.toString()
    });
    if (!postRes.ok) {
      console.warn(`    ! POST ${url} → ${postRes.status}, skipping`);
      return [];
    }
    html = await postRes.text();
    $ = cheerioLoad(html);
  }
  // ddlTeam이 없는 페이지(2군 등)는 초기 GET 응답을 그대로 파싱 (팀명으로 필터)

  const rows = [];
  $('table[class*="tData"] tbody tr, table.tEx tbody tr, table.tbl tbody tr').each((_, el) => {
    const cells = $(el).find("td").map((__, td) => $(td).text().trim()).get();
    if (cells.length < 3) return;
    // 팀 필터를 못 건 경우 (2군) td[2]가 우리 팀 약칭이 아니면 skip
    if (!teamSelectName && kboTeamShortName && cells[2] !== kboTeamShortName) return;
    const parsed = parseRow(cells);
    if (parsed) rows.push(parsed);
  });
  return rows;
}

// ============================================================
// 행 파서 — KBO 페이지의 컬럼 순서에 맞춰 SimBatter/SimPitcher용 raw 객체 생성
// ============================================================

/** Basic1: 순위 / 선수명 / 팀명 / AVG / G / PA / AB / R / H / 2B / 3B / HR / TB / RBI / SAC / SF */
function parseHitterBasic1Row(c) {
  if (c.length < 16) return null;
  return {
    name: c[1],
    teamName: c[2],
    avg: numOr0(c[3]),
    g: numOr0(c[4]),
    pa: numOr0(c[5]),
    ab: numOr0(c[6]),
    r: numOr0(c[7]),
    h: numOr0(c[8]),
    doubles: numOr0(c[9]),
    triples: numOr0(c[10]),
    hr: numOr0(c[11]),
    tb: numOr0(c[12]),
    rbi: numOr0(c[13]),
    sac: numOr0(c[14]),
    sf: numOr0(c[15])
  };
}

/** Basic2: 순위 / 선수명 / 팀명 / AVG / BB / IBB / HBP / SO / GDP / SLG / OBP / ... */
function parseHitterBasic2Row(c) {
  if (c.length < 11) return null;
  return {
    name: c[1],
    teamName: c[2],
    avg: numOr0(c[3]),
    bb: numOr0(c[4]),
    ibb: numOr0(c[5]),
    hbp: numOr0(c[6]),
    so: numOr0(c[7]),
    gdp: numOr0(c[8]),
    slg: numOr0(c[9]),
    obp: numOr0(c[10])
  };
}

/** Basic1: 순위 / 선수명 / 팀명 / ERA / G / W / L / SV / HLD / WPCT / IP / H / HR / BB / HBP / SO / R / ER / WHIP */
function parsePitcherBasic1Row(c) {
  if (c.length < 19) return null;
  return {
    name: c[1],
    teamName: c[2],
    era: numOr0(c[3]),
    g: numOr0(c[4]),
    w: numOr0(c[5]),
    l: numOr0(c[6]),
    sv: numOr0(c[7]),
    hld: numOr0(c[8]),
    wpct: numOr0(c[9]),
    ip: parseIp(c[10]),
    h: numOr0(c[11]),
    hr: numOr0(c[12]),
    bb: numOr0(c[13]),
    hbp: numOr0(c[14]),
    so: numOr0(c[15]),
    r: numOr0(c[16]),
    er: numOr0(c[17]),
    whip: numOr0(c[18])
  };
}

/** 2군 통합 타자: 순위/선수명/팀명/AVG/G/PA/AB/R/H/2B/3B/HR/RBI/SB/BB/HBP/SO/SLG/OBP (19개) */
function parseFuturesHitterRow(c) {
  if (c.length < 19) return null;
  return {
    name: c[1],
    teamName: c[2],
    avg: numOr0(c[3]),
    g: numOr0(c[4]),
    pa: numOr0(c[5]),
    ab: numOr0(c[6]),
    r: numOr0(c[7]),
    h: numOr0(c[8]),
    doubles: numOr0(c[9]),
    triples: numOr0(c[10]),
    hr: numOr0(c[11]),
    rbi: numOr0(c[12]),
    sb: numOr0(c[13]),
    bb: numOr0(c[14]),
    hbp: numOr0(c[15]),
    so: numOr0(c[16]),
    slg: numOr0(c[17]),
    obp: numOr0(c[18])
  };
}

/** 2군 투수: 순위/선수명/팀명/ERA/G/W/L/SV/HLD/WPCT/IP/H/HR/BB/HBP/SO/R/ER (18개, WHIP 없음 → IP·H·BB로 계산) */
function parseFuturesPitcherRow(c) {
  if (c.length < 18) return null;
  const ip = parseIp(c[10]);
  const h = numOr0(c[11]);
  const bb = numOr0(c[13]);
  return {
    name: c[1],
    teamName: c[2],
    era: numOr0(c[3]),
    g: numOr0(c[4]),
    w: numOr0(c[5]),
    l: numOr0(c[6]),
    sv: numOr0(c[7]),
    hld: numOr0(c[8]),
    wpct: numOr0(c[9]),
    ip,
    h,
    hr: numOr0(c[12]),
    bb,
    hbp: numOr0(c[14]),
    so: numOr0(c[15]),
    r: numOr0(c[16]),
    er: numOr0(c[17]),
    whip: ip > 0 ? Math.round(((h + bb) / ip) * 100) / 100 : 0
  };
}

/** Basic2: 순위 / 선수명 / 팀명 / ERA / CG / SHO / QS / BSV / TBF / NP / AVG / 2B / 3B / SAC / SF / IBB / WP / BK */
function parsePitcherBasic2Row(c) {
  if (c.length < 11) return null;
  return {
    name: c[1],
    teamName: c[2],
    era: numOr0(c[3]),
    cg: numOr0(c[4]),
    sho: numOr0(c[5]),
    qs: numOr0(c[6]),
    bsv: numOr0(c[7]),
    tbf: numOr0(c[8]),
    np: numOr0(c[9]),
    oavg: numOr0(c[10])
  };
}

function numOr0(s) {
  if (s == null) return 0;
  const cleaned = String(s).replace(/[^\d.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** IP는 "123 2/3" 형태로 옴 — 소수로 변환 */
function parseIp(s) {
  if (!s) return 0;
  const m = String(s).trim().match(/^(\d+)(?:\s+(\d)\/3)?$/);
  if (!m) return numOr0(s);
  const whole = parseInt(m[1], 10);
  const frac = m[2] ? parseInt(m[2], 10) / 3 : 0;
  return Math.round((whole + frac) * 10) / 10;
}

// ============================================================
// 행 병합 — 같은 (이름, 팀명) → 하나로 합침
// ============================================================
function mergeRowsByName(rowsA, rowsB) {
  const keyOf = (r) => `${r.name}|${r.teamName}`;
  const map = new Map(rowsA.map((r) => [keyOf(r), { ...r }]));
  for (const r of rowsB) {
    const k = keyOf(r);
    if (map.has(k)) {
      Object.assign(map.get(k), r);
    } else {
      map.set(k, { ...r });
    }
  }
  return [...map.values()];
}

// ============================================================
// 로스터 매칭 — KBO 통계 행의 (이름, 팀명) → roster의 player.id
// ============================================================

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

/** 이름으로 roster에서 매칭. 동명이인은 kind(타자/투수)로 1차 필터, 1군 출장 우선. */
function findPlayerInRoster(name, roster, kind) {
  if (!roster) return null;
  let candidates = roster.players.filter((p) => p.name === name);
  if (candidates.length === 0) return null;
  if (candidates.length > 1 && kind) {
    // kind=batter: 투수가 아닌 사람만 / kind=pitcher: 투수만
    const filtered = kind === "pitcher"
      ? candidates.filter((p) => p.primaryPosition === "P")
      : candidates.filter((p) => p.primaryPosition !== "P");
    if (filtered.length > 0) candidates = filtered;
  }
  if (candidates.length === 1) return candidates[0];
  // 그래도 여러 명이면 1군 출장 우선
  const active = candidates.find((p) => (p.seasonGames ?? 0) > 0);
  return active ?? candidates[0];
}

// ============================================================
// raw stats → SimBatter/SimPitcher 변환
// ============================================================

function makeSimBatter(row, roster) {
  const player = findPlayerInRoster(row.name, roster, "batter");
  if (!player) return null;
  const pa = row.pa || 0;
  const ab = row.ab || 0;
  const h = row.h || 0;
  const doubles = row.doubles || 0;
  const triples = row.triples || 0;
  const homers = row.hr || 0;
  const bb = row.bb || 0;
  const hbp = row.hbp || 0;
  const so = row.so || 0;

  // KBO 페이지의 AVG/OBP/SLG는 그대로 사용 (이미 계산된 값)
  // 누락된 부수 지표는 계산
  const avg = row.avg || (ab > 0 ? h / ab : 0);
  const obp = row.obp || (pa > 0 ? (h + bb + hbp) / pa : 0);
  const slg = row.slg || (ab > 0 ? (h - doubles - triples - homers + doubles * 2 + triples * 3 + homers * 4) / ab : 0);
  const iso = slg - avg;
  const babip = (h - homers) / Math.max(1, ab - so - homers);
  const bbRate = pa > 0 ? bb / pa : 0;
  const kRate = pa > 0 ? so / pa : 0;
  const contactScore = 1 - kRate;

  return {
    playerId: player.id,
    name: player.name,
    battingHand: player.battingHand ?? "R",
    pa,
    ab,
    hits: h,
    doubles,
    triples,
    homers,
    walks: bb,
    hbp,
    strikeouts: so,
    avg: round3(avg),
    obp: round3(obp),
    slg: round3(slg),
    iso: round3(iso),
    babip: round3(babip),
    bbRate: round3(bbRate),
    kRate: round3(kRate),
    contactScore: round3(contactScore)
  };
}

function makeSimPitcher(row, roster) {
  const player = findPlayerInRoster(row.name, roster, "pitcher");
  if (!player) return null;
  const ip = row.ip || 0;
  const k = row.so || 0;
  const bb = row.bb || 0;
  const hr = row.hr || 0;
  const hitsAllowed = row.h || 0;
  const earnedRuns = row.er || 0;
  const saves = row.sv || 0;
  const holds = row.hld || 0;
  const wins = row.w || 0;
  const losses = row.l || 0;

  const era = row.era || (ip > 0 ? (earnedRuns * 9) / ip : 0);
  const whip = row.whip || (ip > 0 ? (hitsAllowed + bb) / ip : 0);
  const k9 = ip > 0 ? (k * 9) / ip : 0;
  const bb9 = ip > 0 ? (bb * 9) / ip : 0;
  const hr9 = ip > 0 ? (hr * 9) / ip : 0;

  // role 추정 — 선발 판정: GS가 없으니 IP/G로 근사 (G > 0 && IP/G >= 4)
  const g = row.g || 0;
  const ipPerGame = g > 0 ? ip / g : 0;
  const role = ipPerGame >= 4 ? "SP" : "RP"; // CL은 시뮬 어댑터가 saves 기준으로 자동 재분류
  const staminaPitches = role === "SP" ? Math.max(80, Math.round(ipPerGame * 18)) : Math.max(20, Math.round(ipPerGame * 18));

  return {
    playerId: player.id,
    name: player.name,
    throwingHand: player.throwingHand ?? "R",
    role,
    ip: Math.round(ip * 10) / 10,
    k,
    bb,
    hr,
    hitsAllowed,
    earnedRuns,
    saves,
    holds,
    wins,
    losses,
    era: round2(era),
    whip: round2(whip),
    k9: round2(k9),
    bb9: round2(bb9),
    hr9: round2(hr9),
    staminaPitches
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
function round3(n) {
  return Math.round(n * 1000) / 1000;
}

// ============================================================
// 검증 리포트
// ============================================================
function reportUnmatched(rosters, out) {
  console.log("\n[검증]");
  for (const team of TEAMS) {
    const teamOut = out.teams[team.id];
    if (!teamOut) continue;
    const roster = rosters[team.id];
    if (!roster) continue;
    const matchedIds = new Set([
      ...teamOut.batters.map((b) => b.playerId),
      ...teamOut.pitchers.map((p) => p.playerId)
    ]);
    const unmatched = roster.players.filter((p) => !matchedIds.has(p.id));
    const activeUnmatched = unmatched.filter((p) => (p.seasonGames ?? 0) > 0);
    console.log(
      `  ${team.name}: 매칭 ${matchedIds.size}/${roster.players.length}명 / 미매칭 중 1군기록 보유 ${activeUnmatched.length}명`
    );
    if (activeUnmatched.length > 0 && activeUnmatched.length <= 5) {
      for (const p of activeUnmatched) console.log(`     - ${p.name} (#${p.jerseyNumber}, G=${p.seasonGames})`);
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
