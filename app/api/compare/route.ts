import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getRoster } from "@/lib/rosters";
import { makeFallbackBatter, makeFallbackPitcher } from "@/lib/sim/leagueAverage";
import { buildStatsDirectoryWithRecentForm } from "@/lib/sim/statsLoaderWithRecent";
import { listStandingsFromDb } from "@/lib/supabase/query-parts/core";
import { teams } from "@/lib/constants/teams";
import type { SimBatter, SimPitcher } from "@/lib/sim/types";
import type {
  CompareLineupSlot,
  CompareStarterOption,
  CompareTeamResponse,
} from "@/lib/compare/types";

// 팀 스탯·순위·라인업·로테이션은 하루 1회(마감 sync) 후에만 바뀌므로 길게 캐시.
// 30분 신선 + 1시간 SWR → origin/DB 히트 최소화.
const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
};

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
}

function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 이름으로 로스터 투수 ID 매칭 (동명이인은 투수 여부로 필터). */
function findPitcherId(teamId: string, name: string | null): string | null {
  if (!name) return null;
  const roster = getRoster(teamId);
  const trimmed = name.trim();
  const exact = roster.find((p) => p.name === trimmed && p.primaryPosition === "P");
  if (exact) return exact.id;
  const partial = roster.find(
    (p) => p.primaryPosition === "P" && (p.name.includes(trimmed) || trimmed.includes(p.name))
  );
  return partial?.id ?? null;
}

export async function GET(request: NextRequest): Promise<NextResponse<CompareTeamResponse>> {
  const teamId = request.nextUrl.searchParams.get("team");
  if (!teamId || !teams.some((t) => t.id === teamId)) {
    return NextResponse.json({ ok: false, error: "Unknown team" }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();
  const today = kstToday();
  const season = Number(today.slice(0, 4));

  // 저장된 스탯 스냅샷 기반 디렉토리 (최근폼 블렌딩 포함). 요청 중 스크래핑 없음.
  const stats = await buildStatsDirectoryWithRecentForm(adminClient, [teamId], { asOfDate: today });

  const roster = getRoster(teamId);

  // 로스터 전체 타자/투수 스탯 (교체 후보). 시드에 없으면 리그평균 fallback.
  const rosterBatters: SimBatter[] = roster
    .filter((p) => p.primaryPosition !== "P")
    .map((p) => stats.batters.get(p.id) ?? makeFallbackBatter(p.id, p.name, p.battingHand ?? "R"));

  const rosterPitchers: SimPitcher[] = roster
    .filter((p) => p.primaryPosition === "P")
    .map((p) => stats.pitchers.get(p.id) ?? makeFallbackPitcher(p.id, p.name, p.throwingHand ?? "R"));

  const rosterNameById = new Map(roster.map((p) => [p.id, p.name]));

  // 병렬 조회: 순위 · 최근 라인업 · 선발 로테이션
  const [standings, lineupRes, gamesRes] = await Promise.all([
    listStandingsFromDb(season),
    adminClient
      .from("bp_team_recent_lineups")
      .select("batting")
      .eq("team_id", teamId)
      .lte("game_date", today)
      .order("game_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    adminClient
      .from("games")
      .select("game_date, home_team_id, away_team_id, home_starter, away_starter")
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .gte("game_date", addDays(today, -45))
      .lte("game_date", addDays(today, 2))
      .order("game_date", { ascending: false }),
  ]);

  // 순위/전적
  const standingRow = standings.find((s) => s.teamId === teamId);
  const standing = standingRow
    ? {
        rank: standingRow.rank,
        wins: standingRow.wins,
        losses: standingRow.losses,
        draws: standingRow.draws,
        winRate: standingRow.winRate,
        form: standingRow.form,
      }
    : null;

  // 최근 타순 9인 — rosterId 매칭된 슬롯만.
  const battingRaw = (lineupRes.data?.batting ?? []) as Array<{
    order: number;
    name: string;
    position: string | null;
    rosterId: string | null;
  }>;
  const battingLineup: CompareLineupSlot[] = battingRaw
    .filter((s) => s.rosterId)
    .map((s) => ({
      order: s.order,
      rosterId: s.rosterId as string,
      name: rosterNameById.get(s.rosterId as string) ?? s.name,
      position: s.position,
    }))
    .sort((a, b) => a.order - b.order);

  // 선발 로테이션 — 최근~예정 경기의 이 팀 선발을 수집.
  type GameRow = {
    game_date: string;
    home_team_id: string;
    away_team_id: string;
    home_starter: string | null;
    away_starter: string | null;
  };
  const games = (gamesRes.data ?? []) as GameRow[];
  const starterByDate: Array<{ date: string; id: string; name: string }> = [];
  for (const g of games) {
    const name = g.home_team_id === teamId ? g.home_starter : g.away_starter;
    const id = findPitcherId(teamId, name);
    if (id && name) starterByDate.push({ date: g.game_date, id, name: rosterNameById.get(id) ?? name });
  }

  // 오늘/최근 선발 — today 이하 중 가장 최근, 없으면 예정 경기 중 가장 이른 것.
  const pastOrToday = starterByDate.filter((s) => s.date <= today); // 이미 date desc 정렬
  const upcoming = [...starterByDate].filter((s) => s.date > today).sort((a, b) => a.date.localeCompare(b.date));
  const recentPick = pastOrToday[0] ?? upcoming[0] ?? null;
  const recentStarter: CompareStarterOption | null = recentPick
    ? { rosterId: recentPick.id, name: recentPick.name, lastDate: recentPick.date }
    : null;

  // 로테이션 후보 — rosterId 중복 제거, 최근 등판일 유지.
  const optionMap = new Map<string, CompareStarterOption>();
  for (const s of starterByDate) {
    if (!optionMap.has(s.id)) optionMap.set(s.id, { rosterId: s.id, name: s.name, lastDate: s.date });
  }
  const starterOptions = Array.from(optionMap.values());

  return NextResponse.json(
    {
      ok: true,
      teamId,
      season,
      standing,
      recentStarter,
      starterOptions,
      battingLineup,
      rosterBatters,
      rosterPitchers,
    },
    { headers: PUBLIC_CACHE_HEADERS }
  );
}
