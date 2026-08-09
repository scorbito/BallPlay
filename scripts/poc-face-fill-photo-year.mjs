#!/usr/bin/env node
// @ts-check
/**
 * public/face/players.json 에 사진 연도(y)를 채운다.
 *
 * KBO 프로필 사진 CDN 경로에 연도가 들어가는데, 최신 시즌 사진이 없는 선수가 있어
 * 연도를 역순으로 프로브해 실제 존재하는 연도를 확정한다. 클라이언트에서 onError로
 * 폴백시키면 선수마다 404 요청이 한두 번씩 더 나가므로 빌드 타임에 확정한다.
 *
 * 사용: node scripts/poc-face-fill-photo-year.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(__dirname, "..", "public", "face", "players.json");

const CDN = "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/person/middle";
const YEARS = [2026, 2025, 2024];
const CONCURRENCY = 8;

async function probeYear(playerId) {
  for (const year of YEARS) {
    try {
      const res = await fetch(`${CDN}/${year}/${playerId}.jpg`, { method: "GET" });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      // 404 대체 이미지(수백 바이트)를 걸러낸다.
      if (buf.byteLength < 2000) continue;
      return year;
    } catch {
      /* 네트워크 오류는 다음 연도로 */
    }
  }
  return null;
}

async function main() {
  const players = JSON.parse(readFileSync(PLAYERS_PATH, "utf-8"));
  console.log(`선수 ${players.length}명 연도 확인 중…`);

  let done = 0;
  let cursor = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < players.length) {
      const i = cursor;
      cursor += 1;
      players[i].y = await probeYear(players[i].id);
      done += 1;
      if (done % 40 === 0) console.log(`  ${done}/${players.length}`);
    }
  });
  await Promise.all(workers);

  const missing = players.filter((p) => p.y === null);
  writeFileSync(PLAYERS_PATH, JSON.stringify(players), "utf-8");

  const byYear = {};
  for (const p of players) byYear[p.y ?? "없음"] = (byYear[p.y ?? "없음"] ?? 0) + 1;
  console.log("\n연도 분포:", byYear);
  if (missing.length > 0) {
    console.log(`사진 없음 ${missing.length}명:`, missing.map((p) => p.name).join(", "));
  }
  console.log(`저장: public/face/players.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
