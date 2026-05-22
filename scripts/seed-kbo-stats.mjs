#!/usr/bin/env node
// @ts-check
/**
 * Statiz(또는 KBO 공식)에서 시뮬 엔진용 선수 스탯을 시드한다.
 *
 * 출력: data/kbo_players_2026.json
 * 형식: docs/sim-engine-spec.md §8 참조
 *
 * !!! 주의 !!!
 * - Statiz는 1인 운영 사이트. robots.txt + 이용약관 확인 후 호출 매너 준수 (§8.3).
 * - 본 스크립트는 **스켈레톤**. 실제 CSS 셀렉터·URL 패턴은 Statiz 페이지를 수동 정찰
 *   후 채워야 동작. 현재 상태에선 dry-run으로 매핑 로직만 검증.
 * - 동일 페이지 반복 호출은 최소화: 시즌당 1회 시드 + 변경 시점 수동 재실행.
 *
 * 사용법:
 *   node scripts/seed-kbo-stats.mjs --dry-run   # 시드 데이터(가짜) 생성
 *   node scripts/seed-kbo-stats.mjs --live      # 실제 스크래핑 (셀렉터 채운 뒤)
 *
 * TODO (작업 순서):
 *   1) Statiz 팀 페이지 URL 확정 + 페이지 구조 정찰 (DevTools)
 *   2) CSS 셀렉터 채우기 (PLAYER_ROW_SELECTOR 등)
 *   3) 한 팀(예: LG)으로 dry-run 결과 검증
 *   4) 10팀 전체 시드
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const OUT_PATH = join(PROJECT_ROOT, "data", "kbo_players_2026.json");

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 BallPlay-Seed/0.1 (contact: dev@ballplay.local)";

const TEAMS = [
  { id: "lg", statizCode: "LG" },
  { id: "doosan", statizCode: "OB" },
  { id: "kt", statizCode: "KT" },
  { id: "samsung", statizCode: "SS" },
  { id: "ssg", statizCode: "SK" },
  { id: "nc", statizCode: "NC" },
  { id: "kia", statizCode: "HT" },
  { id: "hanwha", statizCode: "HH" },
  { id: "kiwoom", statizCode: "WO" },
  { id: "lotte", statizCode: "LT" }
];

// TODO: Statiz 정찰 후 URL 패턴 확정
const STATIZ_BATTER_URL = (teamCode, year) =>
  `https://statiz.sporki.com/team/?m=batting&t_code=${teamCode}&year=${year}`;
const STATIZ_PITCHER_URL = (teamCode, year) =>
  `https://statiz.sporki.com/team/?m=pitching&t_code=${teamCode}&year=${year}`;

// 호출 간격 (ms). 1인 운영 사이트에 부담 안 주기 위해 넉넉히.
const FETCH_INTERVAL_MS = 3000;

const args = process.argv.slice(2);
const flags = {
  dryRun: args.includes("--dry-run") || !args.includes("--live"),
  year: 2026
};

main().catch((err) => {
  console.error("[seed-kbo-stats] failed:", err);
  process.exit(1);
});

async function main() {
  console.log(`[seed-kbo-stats] mode=${flags.dryRun ? "dry-run" : "live"} year=${flags.year}`);

  /** @type {{snapshotDate:string, source:string, teams: Record<string, {batters: any[], pitchers: any[]}>}} */
  const out = {
    snapshotDate: new Date().toISOString().slice(0, 10),
    source: "Statiz (scaffold)",
    teams: {}
  };

  for (const team of TEAMS) {
    console.log(`  - team=${team.id} (${team.statizCode})`);
    out.teams[team.id] = flags.dryRun
      ? await makeFakeTeamFromRoster(team.id)
      : await scrapeTeam(team, flags.year);
    if (!flags.dryRun) await sleep(FETCH_INTERVAL_MS);
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(out, null, 2), "utf8");
  console.log(`[seed-kbo-stats] wrote ${OUT_PATH}`);
}

// ============================================================
// Live 모드 (TODO: 실제 셀렉터 채워야 함)
// ============================================================
async function scrapeTeam(team, year) {
  const batters = await scrapePage(STATIZ_BATTER_URL(team.statizCode, year), parseBatterRow);
  await sleep(FETCH_INTERVAL_MS);
  const pitchers = await scrapePage(STATIZ_PITCHER_URL(team.statizCode, year), parsePitcherRow);
  return { batters, pitchers };
}

async function scrapePage(url, parseRow) {
  const html = await fetchHtml(url);
  // TODO: cheerio로 파싱. 현재는 빈 배열 반환.
  console.warn(`[seed-kbo-stats] TODO: parse ${url} (selector not yet defined)`);
  return [];
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko" }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

// TODO: Statiz HTML 행 → SimBatter
function parseBatterRow(_$row) {
  return null;
}

// TODO: Statiz HTML 행 → SimPitcher
function parsePitcherRow(_$row) {
  return null;
}

// ============================================================
// Dry-run: 실제 roster JSON에 가짜 스탯을 오버레이.
// 라인업 빌더가 저장한 실 playerId로 시뮬 엔진을 돌릴 수 있도록.
// ============================================================
async function makeFakeTeamFromRoster(teamId) {
  const rosterPath = join(PROJECT_ROOT, "data", "rosters", `${teamId}.json`);
  const roster = JSON.parse(await readFile(rosterPath, "utf8"));
  const players = roster.players ?? [];

  // 중복 id 제거 (같은 등번호의 트레이드 직전/직후 선수가 둘 다 잡힌 경우)
  const seen = new Set();
  const unique = [];
  for (const p of players) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    unique.push(p);
  }

  const batters = [];
  const pitchers = [];
  let starterCount = 0;
  let closerAssigned = false;

  // 등번호가 가장 큰 투수에게 마무리(세이브 30+) 부여 — 통상 마무리는 높은 등번호
  const pitcherCandidates = unique
    .filter((p) => p.primaryPosition === "P")
    .sort((a, b) => b.jerseyNumber - a.jerseyNumber);

  for (const p of unique) {
    if (p.primaryPosition === "P") {
      const isStarter = starterCount < 5;
      if (isStarter) starterCount++;
      const isCloser = !isStarter && !closerAssigned && pitcherCandidates[0]?.id === p.id;
      if (isCloser) closerAssigned = true;
      pitchers.push(makeFakeP(p, isStarter, isCloser));
    } else {
      batters.push(makeFakeBatter(p));
    }
  }

  return { batters, pitchers };
}

function makeFakeBatter(player) {
  // KBO 리그 평균에 맞춘 분포 (mean이 anchor와 일치). 분산은 좁게 ±10~15%.
  // baseline: AVG .270, OBP .345, K rate .22, BB rate .09, HR rate .025
  const pa = 400 + Math.floor(Math.random() * 200);
  const ab = Math.floor(pa * 0.88);
  const avgTarget = 0.255 + Math.random() * 0.030;       // 0.255~0.285 (mean ~.270)
  const hits = Math.floor(ab * avgTarget);
  const doubles = Math.floor(hits * 0.18);
  const triples = Math.floor(hits * 0.02);
  const homers = Math.floor(hits * (0.06 + Math.random() * 0.06));  // 6~12% of hits = HR
  const walks = Math.floor(pa * (0.075 + Math.random() * 0.025));   // 7.5~10% BB
  const hbp = Math.floor(pa * 0.01);
  const strikeouts = Math.floor(pa * (0.19 + Math.random() * 0.06)); // 19~25% K
  const singles = hits - doubles - triples - homers;
  const tb = singles + doubles * 2 + triples * 3 + homers * 4;

  const avg = hits / ab;
  const obp = (hits + walks + hbp) / pa;
  const slg = tb / ab;
  const iso = slg - avg;
  const babip = (hits - homers) / Math.max(1, ab - strikeouts - homers);
  const bbRate = walks / pa;
  const kRate = strikeouts / pa;
  const contactScore = 1 - kRate;

  return {
    playerId: player.id,
    name: player.name,
    battingHand: player.battingHand ?? (Math.random() < 0.4 ? "L" : "R"),
    pa, ab, hits, doubles, triples, homers, walks, hbp, strikeouts,
    avg: round3(avg), obp: round3(obp), slg: round3(slg), iso: round3(iso),
    babip: round3(babip), bbRate: round3(bbRate), kRate: round3(kRate),
    contactScore: round3(contactScore)
  };
}

function makeFakeP(player, isStarter, isCloser) {
  // KBO 리그 평균 anchor: K9 ~7.5, BB9 ~3.5, HR9 ~1.0, WHIP ~1.30, ERA ~4.20
  // 분산은 ±15% 좁게.
  const ip = isStarter ? 120 + Math.random() * 60 : 30 + Math.random() * 30;
  const k9Target = 6.8 + Math.random() * 1.6;        // 6.8~8.4
  const bb9Target = 2.8 + Math.random() * 1.6;       // 2.8~4.4
  const hr9Target = 0.7 + Math.random() * 0.7;       // 0.7~1.4
  const k = Math.round(ip * k9Target / 9);
  const bb = Math.round(ip * bb9Target / 9);
  const hr = Math.round(ip * hr9Target / 9);
  // 피안타: WHIP 1.20~1.40 사이 → hits/IP = WHIP - BB/IP
  const whipTarget = 1.20 + Math.random() * 0.20;
  const hitsAllowed = Math.max(0, Math.round(ip * whipTarget - bb));
  const earnedRuns = Math.round(ip * (3.5 + Math.random() * 1.5) / 9);
  const saves = isCloser
    ? 25 + Math.floor(Math.random() * 10)
    : (isStarter ? 0 : Math.random() < 0.2 ? 1 + Math.floor(Math.random() * 3) : 0);
  const holds = isStarter || isCloser ? 0 : Math.floor(Math.random() * 20);
  const era = (earnedRuns * 9) / ip;
  const whip = (hitsAllowed + bb) / ip;
  const k9 = (k * 9) / ip;
  const bb9 = (bb * 9) / ip;
  const hr9 = (hr * 9) / ip;

  return {
    playerId: player.id,
    name: player.name,
    throwingHand: player.throwingHand ?? (Math.random() < 0.3 ? "L" : "R"),
    role: isStarter ? "SP" : "RP", // CL은 엔진 변환 시 saves로 자동 식별
    ip: round1(ip), k, bb, hr, hitsAllowed, earnedRuns,
    saves, holds,
    era: round2(era), whip: round2(whip),
    k9: round2(k9), bb9: round2(bb9), hr9: round2(hr9),
    staminaPitches: isStarter ? 100 : (isCloser ? 20 : 25)
  };
}

function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }
function round3(n) { return Math.round(n * 1000) / 1000; }

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
