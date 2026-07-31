#!/usr/bin/env node
// @ts-check
/**
 * KBO 전 시즌(1982~현재) × 전 구단의 1군 출장자 명단을 수집해
 * data/grid/careers-raw.json 으로 저장한다. 그리드 게임("9칸을 채워라!")의 원본 데이터.
 *
 * 왜 기록실 페이지인가:
 *   선수 상세(Total.aspx)를 선수별로 도는 방법도 있지만 은퇴 선수는 playerId 목록을
 *   구할 방법이 없다. 기록실 시즌 페이지는 팀명이 행에 함께 들어 있어 한 번의 순회로
 *   "연도 × 팀 × 선수"가 전부 나온다.
 *
 * 함정 두 가지 (수정 전 데이터가 조용히 깨졌던 지점):
 *   1) 팀을 선택하지 않으면 규정타석/규정이닝 충족자만 나온다. 반드시 팀 필터를 건다.
 *   2) 페이지네이션 후 hfPage 가 2 이상으로 남으면 다음 조회가 "2페이지"를 요청해
 *      빈 결과를 받는다. 시즌·팀 전환 때마다 hfPage 를 1로 리셋해야 한다.
 *   3) 타자 페이지는 투수까지 포함해 노출한다. 투수 판정은 투수 페이지 등장 여부로만
 *      한다(안 그러면 류현진·선동열이 타자가 된다).
 *
 * 사용법:
 *   node scripts/scrape-kbo-careers.mjs
 *   node scripts/scrape-kbo-careers.mjs --dry-run
 *
 * 소요: 약 15분 (요청 사이 120ms). 시즌이 끝날 때마다 한 번씩 돌리면 된다.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { load as cheerioLoad } from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const OUT_PATH = join(PROJECT_ROOT, "data", "grid", "careers-raw.json");

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
// KBO 기록실의 ASP.NET 컨트롤 경로 prefix
const CTL = "ctl00$ctl00$ctl00$cphContents$cphContents$cphContents";

const PAGES = [
  { kind: "batter", url: "https://www.koreabaseball.com/Record/Player/HitterBasic/Basic1.aspx" },
  { kind: "pitcher", url: "https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx" }
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 현재 페이지의 hidden input + select 선택값을 그대로 폼으로 복원 */
function formState(html) {
  const $ = cheerioLoad(html);
  const body = new URLSearchParams();
  $("input[type=hidden]").each((_, el) => {
    const name = $(el).attr("name");
    if (name) body.set(name, $(el).attr("value") ?? "");
  });
  $("select").each((_, el) => {
    const name = $(el).attr("name");
    if (name) body.set(name, $(el).find("option[selected]").attr("value") ?? "");
  });
  return body;
}

async function post(url, cookie, body, tries = 3) {
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: url,
          ...(cookie && { Cookie: cookie })
        },
        body: body.toString()
      });
      if (res.ok) return await res.text();
    } catch {
      // 재시도
    }
    await sleep(800 * (attempt + 1));
  }
  return null;
}

/** 결과 테이블 파싱 — 순위 | 선수명 | 팀명 | ... (선수명 셀에 playerId 링크) */
function parseRows(html) {
  const $ = cheerioLoad(html);
  const out = [];
  $("table tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 3) return;
    const name = $(tds[1]).text().trim();
    const teamName = $(tds[2]).text().trim();
    const playerId = ($(tds[1]).find("a").attr("href") ?? "").match(/playerId=(\d+)/)?.[1] ?? null;
    if (!name || !teamName) return;
    out.push({ playerId, name, teamName });
  });
  return out;
}

function extraPageNumbers(html) {
  return [...new Set([...html.matchAll(/ucPager\$btnNo(\d+)/g)].map((m) => Number(m[1])))]
    .filter((n) => n > 1)
    .sort((a, b) => a - b);
}

async function crawl({ kind, url }) {
  const getRes = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  const cookie = (getRes.headers.get("set-cookie") || "").split(";")[0];
  let html = await getRes.text();

  const $init = cheerioLoad(html);
  const seasons = $init("select[name$='ddlSeason$ddlSeason'] option")
    .map((_, o) => $init(o).attr("value"))
    .get()
    .filter((v) => v && v !== "9999") // 9999 = 통산 옵션
    .sort();

  const records = [];
  for (const year of seasons) {
    let body = formState(html);
    body.set("__EVENTTARGET", `${CTL}$ddlSeason$ddlSeason`);
    body.set("__EVENTARGUMENT", "");
    body.set(`${CTL}$hfPage`, "1");
    body.set(`${CTL}$ddlTeam$ddlTeam`, "");
    body.set(`${CTL}$ddlSeason$ddlSeason`, year);
    const seasonHtml = await post(url, cookie, body);
    if (!seasonHtml) {
      console.log(`  !! ${kind} ${year} 시즌 전환 실패`);
      continue;
    }
    html = seasonHtml;
    await sleep(120);

    // 팀 드롭다운은 시즌마다 바뀐다 — 해태/MBC/청보/쌍방울/현대까지 여기서 나온다.
    const $season = cheerioLoad(html);
    const teamCodes = $season("select[name$='ddlTeam$ddlTeam'] option")
      .map((_, o) => $season(o).attr("value"))
      .get()
      .filter(Boolean);

    let yearRows = 0;
    const emptyTeams = [];
    for (const team of teamCodes) {
      body = formState(html);
      body.set("__EVENTTARGET", `${CTL}$ddlTeam$ddlTeam`);
      body.set("__EVENTARGUMENT", "");
      body.set(`${CTL}$hfPage`, "1");
      body.set(`${CTL}$ddlTeam$ddlTeam`, team);
      const teamHtml = await post(url, cookie, body);
      if (!teamHtml) {
        console.log(`  !! ${kind} ${year} ${team} 실패`);
        continue;
      }
      html = teamHtml;

      const first = parseRows(html);
      for (const row of first) records.push({ ...row, year: Number(year), kind });
      yearRows += first.length;
      if (first.length === 0) emptyTeams.push(team);
      await sleep(120);

      for (const pageNo of extraPageNumbers(html)) {
        body = formState(html);
        body.set("__EVENTTARGET", `${CTL}$ucPager$btnNo${pageNo}`);
        body.set("__EVENTARGUMENT", "");
        body.set(`${CTL}$hfPage`, String(pageNo));
        const pageHtml = await post(url, cookie, body);
        if (!pageHtml) break;
        html = pageHtml;
        const rows = parseRows(html);
        for (const row of rows) records.push({ ...row, year: Number(year), kind });
        yearRows += rows.length;
        await sleep(120);
      }
    }
    console.log(
      `  ${kind} ${year}: ${yearRows}행 (팀 ${teamCodes.length}개)` +
        (emptyTeams.length ? `  ⚠빈팀 ${emptyTeams.join(",")}` : "")
    );
  }
  return records;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log("KBO 전 시즌 출장자 수집 시작\n");

  const all = [];
  for (const page of PAGES) {
    console.log(`### ${page.kind}`);
    const rows = await crawl(page);
    console.log(`### ${page.kind} 완료: ${rows.length}행\n`);
    all.push(...rows);
  }

  // 투수 판정 — 투수 페이지에 한 번이라도 등장했으면 투수.
  const pitcherIds = new Set(all.filter((r) => r.kind === "pitcher" && r.playerId).map((r) => r.playerId));

  // playerId 기준 병합 (id 가 없으면 이름으로 — 아주 오래된 기록에 간혹 링크가 없다)
  const byPlayer = new Map();
  for (const row of all) {
    const key = row.playerId ? `id:${row.playerId}` : `nm:${row.name}`;
    if (!byPlayer.has(key)) {
      byPlayer.set(key, { playerId: row.playerId, name: row.name, kind: "batter", entries: [] });
    }
    const player = byPlayer.get(key);
    // 같은 연도·같은 팀 중복 제거 (타자/투수 양쪽 목록에 걸린 선수)
    if (!player.entries.some((e) => e.year === row.year && e.teamName === row.teamName)) {
      player.entries.push({ year: row.year, teamName: row.teamName });
    }
  }
  for (const player of byPlayer.values()) {
    if (player.playerId && pitcherIds.has(player.playerId)) player.kind = "pitcher";
  }

  const players = [...byPlayer.values()];
  const pitchers = players.filter((p) => p.kind === "pitcher").length;
  console.log(`총 ${all.length}행 → 선수 ${players.length}명 (투수 ${pitchers} / 타자 ${players.length - pitchers})`);

  if (dryRun) {
    console.log("\n--dry-run: 저장하지 않음");
    return;
  }
  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify({ rows: all.length, players }), "utf-8");
  console.log(`저장: ${OUT_PATH}`);
  console.log("다음: node scripts/build-grid-data.mjs");
}

main().catch((err) => {
  console.error("스크래퍼 오류:", err);
  process.exit(1);
});
