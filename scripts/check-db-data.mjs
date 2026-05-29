// 5가지 데이터 존재 여부 확인:
// 1. 선수 스냅샷 (bp_player_stats_snapshots)
// 2. 주간 델타 계산 함수 — 코드측 (recentFormLoader.ts) + 두 스냅샷 존재 확인
// 3. 팀별 최신 라인업 (bp_team_recent_lineups)
// 4. 내일 경기일정 + 선발투수 (games)
// 5. 뉴스 (bp_news)

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
    })
);

// anon 키 사용 — 5개 테이블 모두 RLS SELECT 공개. 쓰기는 정책상 차단됨.
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

const KST = (d) => new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const now = new Date();
const todayKST = KST(now);
const tomorrowKST = KST(new Date(now.getTime() + 24 * 60 * 60 * 1000));

console.log("=".repeat(60));
console.log(`기준 시각: now=${now.toISOString()} | today(KST)=${todayKST} | tomorrow(KST)=${tomorrowKST}`);
console.log("=".repeat(60));

// 1) 선수 스냅샷
{
  console.log("\n[1] bp_player_stats_snapshots — 선수 시즌 누적 스탯 스냅샷");
  const { count, error: cErr } = await sb
    .from("bp_player_stats_snapshots")
    .select("*", { count: "exact", head: true });
  if (cErr) console.error("  ERR:", cErr.message);
  else console.log(`  총 행 수: ${count}`);

  const { data: dates, error: dErr } = await sb
    .from("bp_player_stats_snapshots")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(2000);
  if (dErr) console.error("  ERR:", dErr.message);
  else {
    const uniq = [...new Set((dates ?? []).map((r) => r.snapshot_date))].slice(0, 5);
    console.log(`  최근 snapshot_date (상위 5개): ${uniq.join(", ")}`);
  }

  const { data: byKind, error: kErr } = await sb
    .from("bp_player_stats_snapshots")
    .select("kind, team_id")
    .order("snapshot_date", { ascending: false })
    .limit(2000);
  if (!kErr && byKind) {
    const batters = byKind.filter((r) => r.kind === "batter").length;
    const pitchers = byKind.filter((r) => r.kind === "pitcher").length;
    const teams = new Set(byKind.map((r) => r.team_id)).size;
    console.log(`  최신 2000행 분포: batter=${batters}, pitcher=${pitchers}, 팀 수=${teams}`);
  }

  const { data: sample, error: sErr } = await sb
    .from("bp_player_stats_snapshots")
    .select("player_id, team_id, kind, snapshot_date, sim_payload")
    .order("snapshot_date", { ascending: false })
    .limit(2);
  if (!sErr && sample?.length) {
    console.log(`  샘플:`);
    sample.forEach((r) => {
      const name = r.sim_payload?.name ?? "?";
      const stat = r.kind === "batter"
        ? `avg=${r.sim_payload?.avg}, ops=${(r.sim_payload?.obp + r.sim_payload?.slg)?.toFixed(3)}`
        : `era=${r.sim_payload?.era}, whip=${r.sim_payload?.whip}`;
      console.log(`    ${r.snapshot_date} | ${r.team_id} | ${r.kind} | ${name} | ${stat}`);
    });
  }
}

// 2) 주간 델타 — 한 선수에 대해 두 개 스냅샷이 있는지 확인
{
  console.log("\n[2] 주간 델타 계산 — 코드: lib/sim/recentFormLoader.ts");
  console.log("    DB측 전제: 한 player_id에 snapshot이 2개 이상 있어야 델타 계산 가능");

  const { data, error } = await sb
    .from("bp_player_stats_snapshots")
    .select("player_id, kind, snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(3000);
  if (error) console.error("  ERR:", error.message);
  else {
    const counts = new Map();
    for (const r of data) {
      const key = `${r.player_id}|${r.kind}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const players = counts.size;
    const withDelta = [...counts.values()].filter((n) => n >= 2).length;
    console.log(`  최근 3000행 기준: 고유 선수 수=${players}, 델타 계산 가능(>=2 스냅샷)=${withDelta}`);
  }
}

// 3) 팀별 최신 라인업
{
  console.log("\n[3] bp_team_recent_lineups — 팀별 경기 선발 라인업");
  const { count, error: cErr } = await sb
    .from("bp_team_recent_lineups")
    .select("*", { count: "exact", head: true });
  if (cErr) console.error("  ERR:", cErr.message);
  else console.log(`  총 행 수: ${count}`);

  const { data: latest, error: lErr } = await sb
    .from("bp_team_recent_lineups")
    .select("team_id, game_date, game_id, is_home, starter_name, batting")
    .order("game_date", { ascending: false })
    .limit(5);
  if (lErr) console.error("  ERR:", lErr.message);
  else {
    console.log(`  최근 5건:`);
    (latest ?? []).forEach((r) => {
      const lineupSize = Array.isArray(r.batting) ? r.batting.length : "?";
      console.log(`    ${r.game_date} | ${r.game_id} | ${r.team_id} (${r.is_home ? "홈" : "원정"}) | 선발투수=${r.starter_name ?? "-"} | 타순=${lineupSize}명`);
    });
  }
}

// 4) 내일 경기일정 + 선발투수
{
  console.log(`\n[4] games — ${tomorrowKST} 경기일정 + 선발투수`);
  const { data, error } = await sb
    .from("games")
    .select("id, external_id, game_date, game_time, stadium, home_team_id, away_team_id, home_starter, away_starter, starter_fetched_at, status")
    .eq("game_date", tomorrowKST);
  if (error) console.error("  ERR:", error.message);
  else if (!data || data.length === 0) {
    console.log(`  내일(${tomorrowKST}) 경기 없음. 오늘(${todayKST})도 확인:`);
    const { data: today, error: tErr } = await sb
      .from("games")
      .select("id, external_id, game_date, game_time, stadium, home_team_id, away_team_id, home_starter, away_starter, starter_fetched_at, status")
      .eq("game_date", todayKST);
    if (tErr) console.error("  ERR:", tErr.message);
    else if (!today || today.length === 0) console.log(`    오늘도 경기 없음`);
    else {
      console.log(`    오늘 ${today.length}경기:`);
      today.forEach((g) => {
        console.log(`      ${g.external_id ?? g.id} | ${g.game_time ?? "-"} ${g.stadium} | ${g.away_team_id}(${g.away_starter ?? "-"}) @ ${g.home_team_id}(${g.home_starter ?? "-"}) | status=${g.status} | fetched=${g.starter_fetched_at ?? "-"}`);
      });
    }
  } else {
    console.log(`  내일 ${data.length}경기:`);
    data.forEach((g) => {
      console.log(`    ${g.external_id ?? g.id} | ${g.game_time ?? "-"} ${g.stadium} | ${g.away_team_id}(${g.away_starter ?? "-"}) @ ${g.home_team_id}(${g.home_starter ?? "-"}) | status=${g.status} | fetched=${g.starter_fetched_at ?? "-"}`);
    });
  }
}

// 5) 뉴스
{
  console.log("\n[5] bp_news — KBO 뉴스 제목/링크");
  const { count, error: cErr } = await sb
    .from("bp_news")
    .select("*", { count: "exact", head: true });
  if (cErr) console.error("  ERR:", cErr.message);
  else console.log(`  총 행 수: ${count}`);

  const { data, error } = await sb
    .from("bp_news")
    .select("title, url, source, published_at, created_at")
    .order("published_at", { ascending: false })
    .limit(5);
  if (error) console.error("  ERR:", error.message);
  else {
    console.log(`  최근 5건:`);
    (data ?? []).forEach((n) => {
      console.log(`    [${n.source ?? "-"}] ${n.published_at?.slice(0, 16) ?? "-"} | ${n.title}`);
      console.log(`      ${n.url}`);
    });
  }
}

console.log("\n" + "=".repeat(60));
console.log("완료");
