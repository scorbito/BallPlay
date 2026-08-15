#!/usr/bin/env node
// @ts-check
/**
 * data/wordle/guessable.json 에 KBO playerId(pid)를 채운다.
 *
 * 워들 데이터의 id 는 "kia-5"(팀+등번호) 형식이라 프로필 사진 주소를 만들 수 없다.
 * 사진 CDN 은 KBO playerId 를 쓰므로, 선수 검색 페이지에서 긁어와 이름+팀+등번호로 잇는다.
 * 사진 자체는 내려받지 않는다 — 화면에서는 CDN 을 인라인 링크로 참조하기 때문이다.
 *
 * 사용:
 *   node scripts/wordle-fill-player-id.mjs --dry-run   # 매칭률만 확인
 *   node scripts/wordle-fill-player-id.mjs             # guessable.json 갱신
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { load as cheerioLoad } from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const GUESSABLE_PATH = join(PROJECT_ROOT, "data", "wordle", "guessable.json");
const ANSWERS_PATH = join(PROJECT_ROOT, "data", "wordle", "answers.json");
const CAREERS_PATH = join(PROJECT_ROOT, "data", "grid", "careers-raw.json");

const BASE_URL = "https://www.koreabaseball.com/Player/Search.aspx";
const CDN = "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/person/middle";
const PHOTO_YEARS = [2026, 2025, 2024];
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const TEAMS = [
  { id: "lg", kboCode: "LG" },
  { id: "doosan", kboCode: "OB" },
  { id: "kt", kboCode: "KT" },
  { id: "samsung", kboCode: "SS" },
  { id: "ssg", kboCode: "SK" },
  { id: "nc", kboCode: "NC" },
  { id: "kia", kboCode: "HT" },
  { id: "hanwha", kboCode: "HH" },
  { id: "kiwoom", kboCode: "WO" },
  { id: "lotte", kboCode: "LT" }
];

const CTL = "ctl00$ctl00$ctl00$cphContents$cphContents$cphContents";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    if (!name || !jerseyText) return;
    const pid = (nameCell.find("a").attr("href") ?? "").match(/playerId=(\d+)/)?.[1] ?? null;
    if (!pid) return;
    players.push({ name, jersey: parseInt(jerseyText.replace(/\D/g, ""), 10), pid });
  });
  return players;
}

const findPageNumbers = (html) =>
  [...new Set([...html.matchAll(/ucPager\$btnNo(\d+)/g)].map((m) => parseInt(m[1], 10)))].sort((a, b) => a - b);

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
  if (!res.ok) throw new Error(`팀 POST 실패 ${res.status}`);
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

/** 사진이 실제로 존재하는 연도를 찾는다. 없으면 null. */
async function probePhotoYear(pid) {
  for (const year of PHOTO_YEARS) {
    try {
      const res = await fetch(`${CDN}/${year}/${pid}.jpg`);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 2000) return year;
    } catch {
      /* 다음 연도 */
    }
  }
  return null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const guessable = JSON.parse(readFileSync(GUESSABLE_PATH, "utf-8"));
  const players = guessable.players;

  // 정답 풀(base64 로 가려둔 id) — 사진이 꼭 필요한 대상이라 따로 집계한다.
  const answersRaw = JSON.parse(readFileSync(ANSWERS_PATH, "utf-8"));
  const answerIds = new Set(
    (Array.isArray(answersRaw) ? answersRaw : Object.values(answersRaw).find(Array.isArray)).map((a) =>
      Buffer.from(a, "base64").toString("utf-8")
    )
  );

  console.log(`워들 선수 ${players.length}명 (정답 풀 ${answerIds.size}명) — KBO playerId 수집 중…`);

  /** 1차 키 "팀|이름|등번호", 2차 키 "팀|이름" */
  const byFull = new Map();
  const byTeamName = new Map();
  /** 같은 팀에 동명이인이 있으면 이름 폴백을 쓸 수 없다 — 엉뚱한 선수가 붙는다. */
  const dupTeamName = new Set();
  for (const team of TEAMS) {
    try {
      const rows = await scrapeTeam(team);
      for (const r of rows) {
        byFull.set(`${team.id}|${r.name}|${r.jersey}`, r.pid);
        const nameKey = `${team.id}|${r.name}`;
        if (byTeamName.has(nameKey)) dupTeamName.add(nameKey);
        else byTeamName.set(nameKey, r.pid);
      }
      process.stdout.write(`  ${team.id} ${rows.length}명\n`);
    } catch (err) {
      console.log(`  ${team.id} 실패: ${err.message}`);
    }
  }

  // 역대 기록 폴백 인덱스 — 현역(최근 시즌 출장)이고 동명이인이 없는 선수만 담는다.
  const careerByName = new Map();
  try {
    const careers = JSON.parse(readFileSync(CAREERS_PATH, "utf-8")).players;
    const dupName = new Set();
    for (const c of careers) {
      const lastYear = Math.max(...(c.entries ?? []).map((e) => e.year ?? 0));
      if (lastYear < 2026 || !c.playerId) continue;
      if (careerByName.has(c.name)) dupName.add(c.name);
      else careerByName.set(c.name, c.playerId);
    }
    dupName.forEach((n) => careerByName.delete(n));
  } catch {
    console.log("  (역대 기록 파일을 읽지 못해 폴백을 건너뜁니다)");
  }

  let matched = 0;
  let byNameFallback = 0;
  let byCareerFallback = 0;
  const unmatched = [];
  for (const p of players) {
    const exact = byFull.get(`${p.teamId}|${p.name}|${p.jersey}`);
    if (exact) {
      p.pid = exact;
      matched += 1;
      continue;
    }
    // 워들 스냅샷 생성 이후 등번호가 바뀐 선수는 등번호 키로 못 찾는다.
    // 같은 팀에 동명이인이 없을 때만 이름으로 잇는다.
    const nameKey = `${p.teamId}|${p.name}`;
    const loose = dupTeamName.has(nameKey) ? null : byTeamName.get(nameKey);
    if (loose) {
      p.pid = loose;
      matched += 1;
      byNameFallback += 1;
      continue;
    }
    // 부상자 명단 등으로 선수 검색 목록에서 빠지는 경우가 있다. 그리드용으로 모아둔
    // 역대 기록(careers-raw.json)에는 남아 있으므로 마지막 폴백으로 쓴다.
    const career = careerByName.get(p.name);
    if (career) {
      p.pid = career;
      matched += 1;
      byCareerFallback += 1;
    } else {
      unmatched.push(p);
    }
  }

  console.log(
    `\nplayerId 매칭: ${matched}/${players.length}명 (이름 폴백 ${byNameFallback}명, 역대기록 폴백 ${byCareerFallback}명)`
  );
  if (unmatched.length > 0) {
    console.log(`  미매칭 ${unmatched.length}명: ${unmatched.slice(0, 20).map((p) => `${p.name}(${p.teamId})`).join(", ")}`);
  }

  // 정답 풀은 사진이 반드시 필요하므로 CDN 존재 여부까지 확인한다.
  const answerPlayers = players.filter((p) => answerIds.has(p.id));
  console.log(`\n정답 풀 ${answerPlayers.length}명 사진 확인 중…`);
  let cursor = 0;
  let withPhoto = 0;
  const noPhoto = [];
  const workers = Array.from({ length: 8 }, async () => {
    while (cursor < answerPlayers.length) {
      const p = answerPlayers[cursor];
      cursor += 1;
      if (!p.pid) {
        noPhoto.push(`${p.name}(pid 없음)`);
        continue;
      }
      const year = await probePhotoYear(p.pid);
      if (year) {
        p.py = year;
        withPhoto += 1;
      } else {
        noPhoto.push(`${p.name}(사진 없음)`);
      }
    }
  });
  await Promise.all(workers);

  console.log(`정답 풀 사진 확보: ${withPhoto}/${answerPlayers.length}명`);
  if (noPhoto.length > 0) console.log(`  누락: ${noPhoto.join(", ")}`);

  if (dryRun) {
    console.log("\n--dry-run 이므로 파일을 쓰지 않았습니다.");
    return;
  }
  writeFileSync(GUESSABLE_PATH, JSON.stringify(guessable), "utf-8");
  console.log(`\n저장: data/wordle/guessable.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
