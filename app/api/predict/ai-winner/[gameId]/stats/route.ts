import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { fetchOnDemandStarterStats } from "@/lib/server/kbo/fetchOnDemandStarterStats";
import { getRoster } from "@/lib/rosters";
import { makeFallbackBatter, makeFallbackPitcher } from "@/lib/sim/leagueAverage";
import type { SimBatter, SimPitcher } from "@/lib/sim/types";
import statsData from "@/data/kbo_players_2026.json";

type StatsFile = {
  teams: Record<
    string,
    {
      batters: SimBatter[];
      pitchers: SimPitcher[];
    }
  >;
};

const STATS = statsData as unknown as StatsFile;

function findRosterPlayerIdByName(teamId: string, name: string | null, isPitcher: boolean): string | null {
  if (!name) return null;
  const roster = getRoster(teamId);
  const trimmed = name.trim();

  // 동명이인 처리: 포지션 일치 여부 필터
  const match = roster.find((p) => {
    if (p.name !== trimmed) return false;
    const pIsPitcher = p.primaryPosition === "P";
    return pIsPitcher === isPitcher;
  });
  if (match) return match.id;

  const partial = roster.find((p) => {
    const nameMatch = p.name.includes(trimmed) || trimmed.includes(p.name);
    if (!nameMatch) return false;
    const pIsPitcher = p.primaryPosition === "P";
    return pIsPitcher === isPitcher;
  });
  return partial?.id ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  const adminClient = createSupabaseAdminClient();

  // 1. 경기 정보 조회
  const { data: game, error: gErr } = await adminClient
    .from("games")
    .select("id, game_date, home_team_id, away_team_id, home_starter, away_starter")
    .eq("id", params.gameId)
    .single();

  if (gErr || !game) {
    return NextResponse.json({ ok: false, error: gErr?.message ?? "Game not found" }, { status: 404 });
  }

  const { home_team_id: homeTeamId, away_team_id: awayTeamId, home_starter: homeStarterName, away_starter: awayStarterName, game_date: gameDate } = game;

  // 2. 선발 투수 온디맨드 크롤링 수행
  await fetchOnDemandStarterStats(adminClient, [homeTeamId, awayTeamId], gameDate);

  // 3. 선발 투수 스탯 획득
  const homeStarterId = findRosterPlayerIdByName(homeTeamId, homeStarterName, true);
  const awayStarterId = findRosterPlayerIdByName(awayTeamId, awayStarterName, true);

  const starterIds = [homeStarterId, awayStarterId].filter(Boolean) as string[];
  
  let dbStarters: any[] = [];
  if (starterIds.length > 0) {
    const { data: dbData } = await adminClient
      .from("bp_player_stats_snapshots")
      .select("player_id, sim_payload")
      .in("player_id", starterIds)
      .eq("snapshot_date", gameDate)
      .eq("kind", "pitcher");
    dbStarters = dbData ?? [];
  }

  const getStarterPayload = (teamId: string, id: string | null, name: string | null): SimPitcher => {
    const dbMatch = dbStarters.find((s) => s.player_id === id);
    if (dbMatch?.sim_payload) return dbMatch.sim_payload as SimPitcher;

    // 로컬 JSON 백업 조회
    if (id) {
      const jsonMatch = STATS.teams[teamId]?.pitchers.find((p) => p.playerId === id);
      if (jsonMatch) return jsonMatch;
    }

    // 최종 fallback
    return makeFallbackPitcher(id || `${teamId}-fallback-starter`, name || "선발", "R");
  };

  const homeStarterStats = getStarterPayload(homeTeamId, homeStarterId, homeStarterName);
  const awayStarterStats = getStarterPayload(awayTeamId, awayStarterId, awayStarterName);

  // 4. 팀 타선 평균 타격 지표 계산
  const getTeamBattingAvg = async (teamId: string) => {
    // 최근 9인 라인업 조회
    const { data: lineupRow } = await adminClient
      .from("bp_team_recent_lineups")
      .select("batting")
      .eq("team_id", teamId)
      .lte("game_date", gameDate)
      .order("game_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const batting = lineupRow?.batting || [];
    const batters = STATS.teams[teamId]?.batters || [];
    const roster = getRoster(teamId);

    let totalAvg = 0, totalObp = 0, totalSlg = 0, totalOps = 0, totalContact = 0;
    let count = 0;

    for (const slot of batting) {
      const pid = slot.rosterId;
      if (!pid) continue;
      let stat = batters.find((b) => b.playerId === pid);
      if (!stat) {
        const p = roster.find((x) => x.id === pid);
        stat = makeFallbackBatter(pid, slot.name, p?.battingHand || "R");
      }
      totalAvg += stat.avg;
      totalObp += stat.obp;
      totalSlg += stat.slg;
      totalOps += stat.obp + stat.slg;
      totalContact += stat.contactScore;
      count++;
    }

    if (count === 0) {
      // 라인업 매칭이 불가능한 경우 리그 평균 기본값 리턴
      return { avg: 0.260, obp: 0.330, slg: 0.390, ops: 0.720, contact: 0.850 };
    }

    return {
      avg: Number((totalAvg / count).toFixed(3)),
      obp: Number((totalObp / count).toFixed(3)),
      slg: Number((totalSlg / count).toFixed(3)),
      ops: Number((totalOps / count).toFixed(3)),
      contact: Number((totalContact / count).toFixed(3))
    };
  };

  const [homeBatting, awayBatting] = await Promise.all([
    getTeamBattingAvg(homeTeamId),
    getTeamBattingAvg(awayTeamId)
  ]);

  // 5. 최근 10경기 득실 페이스 데이터
  const getRecentGames = async (teamId: string) => {
    const { data: games } = await adminClient
      .from("games")
      .select("id, game_date, home_team_id, away_team_id, home_score, away_score")
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .eq("status", "finished")
      .lt("game_date", gameDate) // 경기 시점 이전의 최근 경기들만 필터링
      .order("game_date", { ascending: false })
      .limit(10);

    const formatted = (games ?? []).map((g) => {
      const isHome = g.home_team_id === teamId;
      const myScore = isHome ? g.home_score : g.away_score;
      const oppScore = isHome ? g.away_score : g.home_score;
      return {
        date: g.game_date,
        score: myScore ?? 0,
        opponentScore: oppScore ?? 0
      };
    });

    // 오름차순(옛날 경기 -> 최근 경기 순)으로 정렬하여 꺾은선 렌더링에 적합하게 배치
    return formatted.reverse();
  };

  const [homeRecent, awayRecent] = await Promise.all([
    getRecentGames(homeTeamId),
    getRecentGames(awayTeamId)
  ]);

  return NextResponse.json({
    ok: true,
    gameId: params.gameId,
    starters: {
      home: {
        name: homeStarterStats.name,
        era: homeStarterStats.era,
        whip: homeStarterStats.whip,
        k9: homeStarterStats.k9,
        bb9: homeStarterStats.bb9
      },
      away: {
        name: awayStarterStats.name,
        era: awayStarterStats.era,
        whip: awayStarterStats.whip,
        k9: awayStarterStats.k9,
        bb9: awayStarterStats.bb9
      }
    },
    batting: {
      home: homeBatting,
      away: awayBatting
    },
    recentGames: {
      home: homeRecent,
      away: awayRecent
    }
  });
}
