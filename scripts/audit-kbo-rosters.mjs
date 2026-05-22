#!/usr/bin/env node
// @ts-check
/**
 * KBO 공식 사이트의 선수 목록을 다시 스크래핑해서, 등번호 중복으로 인해
 * 현재 data/rosters/{teamId}.json에서 누락된 선수가 있는지 점검한다.
 *
 * - 상세 페이지는 fetch하지 않음 (빠른 audit용)
 * - 등번호 충돌이 발견되면 누가 살아남고 누가 누락됐는지 출력
 * - 파일은 쓰지 않는다 (audit-only)
 *
 * 사용:
 *   node scripts/audit-kbo-rosters.mjs
 *   node scripts/audit-kbo-rosters.mjs --team=ssg
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { load as cheerioLoad } from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const ROSTERS_DIR = join(PROJECT_ROOT, "data", "rosters");

const BASE_URL = "https://www.koreabaseball.com/Player/Search.aspx";
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
    const jerseyNumber = parseInt(jerseyText.replace(/\D/g, ""), 10);
    if (Number.isNaN(jerseyNumber)) return;
    const href = nameCell.find("a").attr("href") ?? "";
    const playerIdMatch = href.match(/playerId=(\d+)/);
    const kboPlayerId = playerIdMatch ? playerIdMatch[1] : null;
    players.push({ name, jerseyNumber, positionRaw, kboPlayerId });
  });
  return players;
}

function findPageNumbers(html) {
  const matches = [...html.matchAll(/ucPager\$btnNo(\d+)/g)];
  const nums = new Set(matches.map((m) => parseInt(m[1], 10)));
  return [...nums].sort((a, b) => a - b);
}

async function scrapeTeam(team) {
  const getRes = await fetch(BASE_URL, {
    headers: { "User-Agent": USER_AGENT, Referer: "https://www.koreabaseball.com/" }
  });
  if (!getRes.ok) return null;
  const cookie = (getRes.headers.get("set-cookie") || "").split(";")[0];
  let html = await getRes.text();
  let state = extractViewState(html);

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
  if (!res.ok) return null;
  html = await res.text();
  state = extractViewState(html);
  let $ = cheerioLoad(html);
  const allRows = [...parsePlayers($)];

  const pageNums = findPageNumbers(html);
  for (const pageNum of pageNums.filter((n) => n > 1)) {
    await new Promise((r) => setTimeout(r, 300));
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
    allRows.push(...parsePlayers($));
  }

  return allRows;
}

function loadCurrentRoster(teamId) {
  try {
    const path = join(ROSTERS_DIR, `${teamId}.json`);
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { team: null };
  for (const a of args) {
    if (a.startsWith("--team=")) out.team = a.split("=")[1];
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const targets = args.team ? TEAMS.filter((t) => t.id === args.team) : TEAMS;
  if (targets.length === 0) {
    console.error(`Unknown team: ${args.team}`);
    process.exit(1);
  }

  console.log("KBO 로스터 audit (등번호 충돌 + 누락 점검)\n");

  let totalKbo = 0;
  let totalCurrent = 0;
  let totalMissing = 0;

  for (const team of targets) {
    process.stdout.write(`${team.name}... `);
    const kboRows = await scrapeTeam(team);
    if (!kboRows) {
      console.log("FAIL");
      continue;
    }
    const current = loadCurrentRoster(team.id);
    const currentNames = new Set((current?.players ?? []).map((p) => p.name));
    const kboNames = new Set(kboRows.map((r) => r.name));

    // 등번호별 그룹
    const byJersey = new Map();
    for (const r of kboRows) {
      if (!byJersey.has(r.jerseyNumber)) byJersey.set(r.jerseyNumber, []);
      byJersey.get(r.jerseyNumber).push(r);
    }
    const dupJerseys = [...byJersey.entries()].filter(([, rows]) => rows.length > 1);

    // 우리 파일엔 없지만 KBO엔 있는 선수
    const missing = kboRows.filter((r) => !currentNames.has(r.name));

    // 우리 파일엔 있지만 KBO엔 없는 선수 (방출/은퇴 추정)
    const removed = [...currentNames].filter((n) => !kboNames.has(n));

    totalKbo += kboRows.length;
    totalCurrent += current?.players?.length ?? 0;
    totalMissing += missing.length;

    console.log(`KBO ${kboRows.length}명 / 현재 ${current?.players?.length ?? 0}명`);

    if (dupJerseys.length > 0) {
      console.log(`  ⚠ 등번호 중복:`);
      for (const [jersey, rows] of dupJerseys) {
        const names = rows.map((r) => `${r.name}(${r.positionRaw},id=${r.kboPlayerId ?? "?"})`).join(" / ");
        console.log(`    #${jersey} → ${names}`);
      }
    }
    if (missing.length > 0) {
      console.log(`  ⚠ 누락 ${missing.length}명:`);
      for (const r of missing) {
        console.log(`    #${r.jerseyNumber} ${r.name} (${r.positionRaw})`);
      }
    }
    if (removed.length > 0) {
      console.log(`  ℹ 현재 파일엔 있으나 KBO엔 없음 ${removed.length}명: ${removed.slice(0, 8).join(", ")}${removed.length > 8 ? " ..." : ""}`);
    }

    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(`\n총합 — KBO ${totalKbo}명 / 현재 ${totalCurrent}명 / 누락 ${totalMissing}명`);
}

main().catch((err) => {
  console.error("audit 오류:", err);
  process.exit(1);
});
