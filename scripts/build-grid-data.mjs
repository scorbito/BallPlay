#!/usr/bin/env node
// @ts-check
/**
 * data/grid/careers-raw.json → data/grid/players.json (클라이언트 번들용 경량 스냅샷)
 *
 * 원본은 900KB 라 그대로 import 하면 번들이 커진다. 게임에 필요한 6개 값만
 * 배열 튜플로 눕혀 100KB 대로 줄인다.
 *
 * 튜플: [이름, 팀비트마스크, 투수여부(0|1), 데뷔연도, 마지막연도, 시즌수]
 *
 * 사용법: node scripts/build-grid-data.mjs
 */

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const IN_PATH = join(PROJECT_ROOT, "data", "grid", "careers-raw.json");
const OUT_PATH = join(PROJECT_ROOT, "data", "grid", "players.json");

/** 비트 순서 = lib/grid/teams.ts 의 GRID_TEAMS 순서. 바꾸면 저장된 데이터가 어긋난다. */
const TEAM_ORDER = ["lg", "doosan", "kt", "samsung", "ssg", "nc", "kia", "hanwha", "kiwoom", "lotte"];

/**
 * KBO 역대 팀명 → 현재 프랜차이즈.
 * 해체 구단(삼미·청보·태평양·현대·쌍방울)은 승계 구단이 없으므로 팀 축에서 제외한다.
 * 히어로즈는 현대 선수단을 인수했을 뿐 별개 프랜차이즈다.
 */
const FRANCHISE = {
  LG: "lg",
  MBC: "lg",
  OB: "doosan",
  두산: "doosan",
  KT: "kt",
  삼성: "samsung",
  SK: "ssg",
  SSG: "ssg",
  NC: "nc",
  해태: "kia",
  KIA: "kia",
  빙그레: "hanwha",
  한화: "hanwha",
  우리: "kiwoom",
  서울: "kiwoom",
  히어로즈: "kiwoom",
  넥센: "kiwoom",
  키움: "kiwoom",
  롯데: "lotte",
  현대: null,
  태평양: null,
  청보: null,
  삼미: null,
  쌍방울: null
};

const raw = JSON.parse(await readFile(IN_PATH, "utf-8"));

const unknownTeams = new Map();
const tuples = [];
let skippedNoTeam = 0;

for (const player of raw.players) {
  let mask = 0;
  const years = new Set();
  for (const entry of player.entries) {
    if (!(entry.teamName in FRANCHISE)) {
      unknownTeams.set(entry.teamName, (unknownTeams.get(entry.teamName) ?? 0) + 1);
      continue;
    }
    years.add(entry.year);
    const franchise = FRANCHISE[entry.teamName];
    if (franchise) mask |= 1 << TEAM_ORDER.indexOf(franchise);
  }
  // 현존 10구단 이력이 없으면 팀 축에서 정답이 될 수 없다 — 해체 구단에서만 뛴 선수.
  if (mask === 0) {
    skippedNoTeam += 1;
    continue;
  }
  const yearList = [...years];
  tuples.push([
    player.name,
    mask,
    player.kind === "pitcher" ? 1 : 0,
    Math.min(...yearList),
    Math.max(...yearList),
    years.size
  ]);
}

if (unknownTeams.size > 0) {
  console.log("⚠ 매핑 안 된 팀명 — FRANCHISE 에 추가 필요:");
  for (const [name, count] of unknownTeams) console.log(`   "${name}" ${count}회`);
}

// 이름 오름차순으로 고정 — diff 를 안정적으로 유지한다.
tuples.sort((a, b) => String(a[0]).localeCompare(String(b[0]), "ko") || a[3] - b[3]);

const out = { teams: TEAM_ORDER, players: tuples };
await writeFile(OUT_PATH, JSON.stringify(out), "utf-8");

// ── 검증 리포트 ──
const pairCount = new Map();
for (const [, mask] of tuples) {
  const owned = TEAM_ORDER.filter((_, i) => mask & (1 << i));
  for (let i = 0; i < owned.length; i++)
    for (let j = i + 1; j < owned.length; j++) {
      const key = [owned[i], owned[j]].sort().join("|");
      pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
    }
}
const counts = [...pairCount.values()].sort((a, b) => a - b);
const multi = tuples.filter(([, mask]) => {
  let n = 0;
  for (let i = 0; i < TEAM_ORDER.length; i++) if (mask & (1 << i)) n++;
  return n >= 2;
}).length;

console.log(`\n선수 ${tuples.length}명 (해체 구단 전용 제외 ${skippedNoTeam}명)`);
console.log(`  2팀 이상 경험(팀×팀 정답 재고): ${multi}명`);
console.log(`  팀 조합 ${pairCount.size}개 — 최소 ${counts[0]}명 / 중앙값 ${counts[Math.floor(counts.length / 2)]}명 / 최대 ${counts.at(-1)}명`);
console.log(`저장: ${OUT_PATH}`);
