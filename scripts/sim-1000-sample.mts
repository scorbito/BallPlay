// 샘플: 오늘 두산 vs 한화 경기를 어제 타순 + 오늘 선발투수로 1000판 시뮬.
// 실행: npx tsx scripts/sim-1000-sample.ts
//
// - 어제 타순: bp_team_recent_lineups (team_id별 최신)
// - 오늘 선발: games.home_starter / away_starter (이름 매칭으로 로스터 ID 추출)
//   매칭 실패 시 autoPitcherLineup 폴백 (stamina 1위)
// - 나머지 투수 슬롯(마무리/불펜)은 autoPitcherLineup 자동
// - 1000판 결과 콘솔 + JSON 저장

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { simulateGame, buildSimTeamInput } from "@/lib/sim";
import { fillMissingPitcherSlots } from "@/lib/sim/autoPitcherLineup";
import { buildStatsDirectory } from "@/lib/sim/statsLoader";
import { getRoster } from "@/lib/rosters";
import type {
  SavedLineup,
  Position
} from "@/lib/types/lineup";
import type { SimGameResult, SimTeamInput } from "@/lib/sim/types";

// ── env (.env.local) ──────────────────────────────────────────
const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
    })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

// ── KST 오늘 ──────────────────────────────────────────────────
const kstToday = (() => {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
})();

// ── 오늘 두산 vs 한화 경기 찾기 ───────────────────────────────
const { data: games, error: gErr } = await sb
  .from("games")
  .select("id, game_date, game_time, stadium, home_team_id, away_team_id, home_starter, away_starter, status")
  .eq("game_date", kstToday)
  .or(
    "and(home_team_id.eq.doosan,away_team_id.eq.hanwha),and(home_team_id.eq.hanwha,away_team_id.eq.doosan)"
  );

if (gErr || !games || games.length === 0) {
  console.error(`❌ ${kstToday} 두산 vs 한화 경기를 찾을 수 없습니다.`, gErr?.message);
  process.exit(1);
}
const game = games[0];

console.log("=".repeat(70));
console.log(`📅 ${game.game_date} ${game.game_time?.slice(0, 5) ?? ""} | ${game.stadium}`);
console.log(`   ${game.away_team_id} (선발 ${game.away_starter ?? "?"})  @  ${game.home_team_id} (선발 ${game.home_starter ?? "?"})`);
console.log(`   game_id: ${game.id}, status: ${game.status}`);
console.log("=".repeat(70));

// ── 팀별 최신(어제) 라인업 ────────────────────────────────────
type RecentBatter = { order: number; name: string; position: string | null; rosterId: string | null };
type RecentRow = { team_id: string; game_date: string; batting: RecentBatter[]; starter_name: string | null };

async function getLatestLineup(teamId: string): Promise<RecentRow> {
  const { data, error } = await sb
    .from("bp_team_recent_lineups")
    .select("team_id, game_date, batting, starter_name")
    .eq("team_id", teamId)
    .order("game_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`recent_lineups[${teamId}]: ${error.message}`);
  if (!data) throw new Error(`recent_lineups[${teamId}]: 데이터 없음`);
  return data as RecentRow;
}

const [homeRecent, awayRecent] = await Promise.all([
  getLatestLineup(game.home_team_id),
  getLatestLineup(game.away_team_id)
]);
console.log(`\n어제 라인업 출처: home=${homeRecent.game_date} / away=${awayRecent.game_date}`);

// ── 라인업 → SimTeamInput ─────────────────────────────────────
function findRosterIdByName(teamId: string, name: string | null): string | null {
  if (!name) return null;
  const roster = getRoster(teamId);
  if (!roster) return null;
  const trimmed = name.trim();
  const exact = roster.find((p) => p.name === trimmed);
  if (exact) return exact.id;
  const partial = roster.find((p) => p.name.includes(trimmed) || trimmed.includes(p.name));
  return partial?.id ?? null;
}

function buildTeam(
  teamId: string,
  recent: RecentRow,
  todayStarterName: string | null,
  displayName: string
): SimTeamInput {
  // 타순: bp_team_recent_lineups.batting에 rosterId가 이미 있음. 없는 경우 이름으로 폴백 매칭.
  const slots: SavedLineup["slots"] = recent.batting.map((b, i) => {
    let pid = b.rosterId;
    if (!pid) {
      pid = findRosterIdByName(teamId, b.name);
      if (!pid) console.warn(`  ⚠ [${teamId}] 타자 ${b.order}번 "${b.name}" 매칭 실패`);
    }
    return {
      order: b.order ?? i + 1,
      playerId: pid ?? "",
      position: (b.position as Position) ?? "DH"
    };
  });
  const batting: SavedLineup = { slots };

  // 투수 슬롯[0] = 오늘 선발(이름 매칭). 실패 시 null → autoPitcherLineup가 stamina 폴백.
  const starterId = findRosterIdByName(teamId, todayStarterName);
  if (todayStarterName && !starterId) {
    console.warn(`  ⚠ [${teamId}] 오늘 선발 "${todayStarterName}" 매칭 실패 → stamina 1위로 폴백`);
  } else if (starterId) {
    console.log(`  ✓ [${teamId}] 오늘 선발 ${todayStarterName} → ${starterId}`);
  }
  const initialSlots: (string | null)[] = Array(9).fill(null);
  initialSlots[0] = starterId;
  const validIds = new Set(getRoster(teamId).map((p) => p.id));
  const pitching = fillMissingPitcherSlots(teamId, initialSlots, validIds);
  if (!pitching) throw new Error(`fillMissingPitcherSlots 실패: ${teamId}`);

  const stats = buildStatsDirectory([teamId]);
  const built = buildSimTeamInput(teamId, batting, pitching, stats, displayName);
  if (!built.ok) {
    console.error(`❌ ${teamId} SimTeamInput 빌드 실패:`, built.issues);
    throw new Error(`buildSimTeamInput 실패: ${teamId}`);
  }
  if (built.issues.length) console.warn(`  ⚠ [${teamId}] issues:`, built.issues);
  return built.team;
}

console.log(`\n[${game.home_team_id}] 라인업 빌드`);
const homeTeam = buildTeam(game.home_team_id, homeRecent, game.home_starter, `${game.home_team_id} (홈)`);
console.log(`[${game.away_team_id}] 라인업 빌드`);
const awayTeam = buildTeam(game.away_team_id, awayRecent, game.away_starter, `${game.away_team_id} (원정)`);

// ── 1000판 실행 ───────────────────────────────────────────────
const N = 1000;
console.log(`\n⚡ ${N}판 시뮬레이션 시작...`);
const t0 = Date.now();
const results: SimGameResult[] = [];
for (let seed = 0; seed < N; seed++) {
  results.push(simulateGame({ home: homeTeam, away: awayTeam }, seed));
}
const elapsedMs = Date.now() - t0;
console.log(`✅ ${N}판 완료 — ${elapsedMs}ms (평균 ${(elapsedMs / N).toFixed(2)}ms/판)`);

// ── 집계 ──────────────────────────────────────────────────────
// playerId → 이름 매핑 (boxScore에는 이름이 없음)
const nameMap: Record<string, { name: string; team: string }> = {};
for (const b of homeTeam.batters) nameMap[b.playerId] = { name: b.name, team: game.home_team_id };
for (const b of awayTeam.batters) nameMap[b.playerId] = { name: b.name, team: game.away_team_id };
const collectPitchers = (t: SimTeamInput) => {
  const arr = [];
  // SimTeamInput 구조에 따라 starter/bullpen 또는 pitchers 배열일 수 있음 — 둘 다 처리
  const anyT = t as any;
  if (anyT.starter) arr.push(anyT.starter);
  if (Array.isArray(anyT.bullpen)) arr.push(...anyT.bullpen);
  if (Array.isArray(anyT.pitchers)) arr.push(...anyT.pitchers);
  return arr;
};
for (const p of collectPitchers(homeTeam)) nameMap[p.playerId] = { name: p.name, team: game.home_team_id };
for (const p of collectPitchers(awayTeam)) nameMap[p.playerId] = { name: p.name, team: game.away_team_id };

let homeWins = 0, awayWins = 0, ties = 0;
let homeRunsSum = 0, awayRunsSum = 0;
let extraInningCount = 0;
const diffHist: Record<number, number> = {};

type BatAgg = { pa: number; ab: number; hits: number; hr: number; rbi: number; runs: number; bb: number; k: number };
type PitchAgg = { games: number; ipOuts: number; hits: number; runs: number; er: number; bb: number; k: number; hr: number };
const batAgg: Record<string, BatAgg> = {};
const pitchAgg: Record<string, PitchAgg> = {};
const mvpFreq: Record<string, number> = {};

for (const r of results) {
  const h = r.finalScore.home;
  const a = r.finalScore.away;
  if (h > a) homeWins++;
  else if (a > h) awayWins++;
  else ties++;
  homeRunsSum += h;
  awayRunsSum += a;
  const d = h - a;
  diffHist[d] = (diffHist[d] ?? 0) + 1;
  if (r.innings.length > 9) extraInningCount++;

  for (const [pid, b] of Object.entries(r.boxScore.batting)) {
    const acc = (batAgg[pid] ??= { pa: 0, ab: 0, hits: 0, hr: 0, rbi: 0, runs: 0, bb: 0, k: 0 });
    acc.pa += b.pa; acc.ab += b.ab; acc.hits += b.hits;
    acc.hr += b.homers; acc.rbi += b.rbi; acc.runs += b.runs;
    acc.bb += b.walks; acc.k += b.strikeouts;
  }
  for (const [pid, p] of Object.entries(r.boxScore.pitching)) {
    const acc = (pitchAgg[pid] ??= { games: 0, ipOuts: 0, hits: 0, runs: 0, er: 0, bb: 0, k: 0, hr: 0 });
    acc.games += 1; acc.ipOuts += p.ipOuts; acc.hits += p.hits;
    acc.runs += p.runs; acc.er += p.earnedRuns; acc.bb += p.walks;
    acc.k += p.strikeouts; acc.hr += p.homers;
  }
  if (r.mvp?.playerId) mvpFreq[r.mvp.playerId] = (mvpFreq[r.mvp.playerId] ?? 0) + 1;
}

// ── 출력 ──────────────────────────────────────────────────────
const pct = (n: number) => (n / N * 100).toFixed(1) + "%";
console.log("\n" + "=".repeat(70));
console.log(`📊 결과 — ${game.away_team_id} @ ${game.home_team_id} (N=${N})`);
console.log("=".repeat(70));
console.log(`승률: ${game.home_team_id}(홈) ${homeWins}승 ${pct(homeWins)}  vs  ${game.away_team_id}(원정) ${awayWins}승 ${pct(awayWins)}  무 ${ties}`);
console.log(`평균 득점: ${game.home_team_id} ${(homeRunsSum / N).toFixed(2)} - ${(awayRunsSum / N).toFixed(2)} ${game.away_team_id}`);
console.log(`연장 진입: ${extraInningCount}회 (${pct(extraInningCount)})`);

console.log("\n── 점수차 분포 (홈 - 원정) ──");
const diffKeys = Object.keys(diffHist).map(Number).sort((a, b) => a - b);
for (const d of diffKeys) {
  const sign = d > 0 ? "+" : "";
  const count = diffHist[d];
  const bar = "█".repeat(Math.max(0, Math.round((count / N) * 60)));
  console.log(`  ${(sign + d).padStart(4)}점: ${bar} ${count}`);
}

console.log("\n── 타자 누적 TOP 10 (안타+홈런×2 정렬) ──");
const topBat = Object.entries(batAgg)
  .map(([pid, b]) => ({ pid, ...b, avg: b.ab > 0 ? b.hits / b.ab : 0 }))
  .sort((a, b) => b.hits + b.hr * 2 - (a.hits + a.hr * 2))
  .slice(0, 10);
console.log("  선수            팀       PA   AB    H   HR  RBI    R   BB    K  AVG");
for (const b of topBat) {
  const info = nameMap[b.pid] ?? { name: b.pid, team: "?" };
  console.log(
    `  ${info.name.padEnd(8)} ${info.team.padEnd(8)} ${String(b.pa).padStart(4)} ${String(b.ab).padStart(4)} ${String(b.hits).padStart(4)} ${String(b.hr).padStart(4)} ${String(b.rbi).padStart(4)} ${String(b.runs).padStart(4)} ${String(b.bb).padStart(4)} ${String(b.k).padStart(4)}  ${b.avg.toFixed(3)}`
  );
}

console.log("\n── 투수 누적 (등판 횟수순) ──");
const topPit = Object.entries(pitchAgg)
  .map(([pid, p]) => ({ pid, ...p, ip: p.ipOuts / 3, era: p.ipOuts > 0 ? (p.er * 27) / p.ipOuts : 0 }))
  .sort((a, b) => b.games - a.games);
console.log("  선수            팀       G     IP    H    R   ER   BB    K   HR    ERA");
for (const p of topPit.slice(0, 12)) {
  const info = nameMap[p.pid] ?? { name: p.pid, team: "?" };
  console.log(
    `  ${info.name.padEnd(8)} ${info.team.padEnd(8)} ${String(p.games).padStart(4)} ${p.ip.toFixed(1).padStart(6)} ${String(p.hits).padStart(4)} ${String(p.runs).padStart(4)} ${String(p.er).padStart(4)} ${String(p.bb).padStart(4)} ${String(p.k).padStart(4)} ${String(p.hr).padStart(4)}  ${p.era.toFixed(2)}`
  );
}

console.log("\n── MVP 빈도 TOP 10 ──");
const topMvp = Object.entries(mvpFreq).sort((a, b) => b[1] - a[1]).slice(0, 10);
for (const [pid, c] of topMvp) {
  const info = nameMap[pid] ?? { name: pid, team: "?" };
  console.log(`  ${info.name.padEnd(8)} (${info.team}) ${String(c).padStart(4)}회  ${pct(c)}`);
}

// ── JSON 저장 ─────────────────────────────────────────────────
const outFile = `scripts/sim-1000-sample-${game.id}.json`;
writeFileSync(
  outFile,
  JSON.stringify(
    {
      gameId: game.id,
      gameDate: game.game_date,
      gameTime: game.game_time,
      homeTeamId: game.home_team_id,
      awayTeamId: game.away_team_id,
      homeStarter: game.home_starter,
      awayStarter: game.away_starter,
      lineupSource: { home: homeRecent.game_date, away: awayRecent.game_date },
      N,
      elapsedMs,
      summary: {
        homeWins,
        awayWins,
        ties,
        homeAvgRuns: homeRunsSum / N,
        awayAvgRuns: awayRunsSum / N,
        extraInningCount
      },
      diffHist,
      batters: Object.fromEntries(
        Object.entries(batAgg).map(([pid, b]) => [pid, { ...nameMap[pid], ...b }])
      ),
      pitchers: Object.fromEntries(
        Object.entries(pitchAgg).map(([pid, p]) => [pid, { ...nameMap[pid], ...p }])
      ),
      mvpFreq: Object.fromEntries(
        Object.entries(mvpFreq).map(([pid, c]) => [pid, { ...nameMap[pid], count: c }])
      )
    },
    null,
    2
  )
);
console.log(`\n💾 저장: ${outFile}`);
