import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getRoster } from "@/lib/rosters";
import { makeFallbackBatter, makeFallbackPitcher } from "@/lib/sim/leagueAverage";
import { buildStatsDirectoryWithRecentForm } from "@/lib/sim/statsLoaderWithRecent";
import type { SimBatter, SimPitcher } from "@/lib/sim/types";

const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900"
};

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
  const season = new Date(gameDate).getFullYear();

  // 2. 저장된 스탯 스냅샷만 읽는다. 요청 중 KBO 스크래핑은 cron sync-kbo-stats로 분리한다.
  const stats = await buildStatsDirectoryWithRecentForm(adminClient, [homeTeamId, awayTeamId], {
    asOfDate: gameDate
  });

  // 3. 선발 투수 스탯 획득
  const homeStarterId = findRosterPlayerIdByName(homeTeamId, homeStarterName, true);
  const awayStarterId = findRosterPlayerIdByName(awayTeamId, awayStarterName, true);

  const getStarterPayload = (teamId: string, id: string | null, name: string | null): SimPitcher => {
    // DB 스냅샷 디렉터리에서 경기일 기준 최신 스탯 조회.
    if (id) {
      const dbSnapshot = stats.pitchers.get(id);
      if (dbSnapshot) return dbSnapshot;
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
    const roster = getRoster(teamId);

    let totalAvg = 0, totalObp = 0, totalSlg = 0, totalOps = 0, totalContact = 0;
    let count = 0;

    for (const slot of batting) {
      const pid = slot.rosterId;
      if (!pid) continue;
      let stat: SimBatter | undefined = stats.batters.get(pid);
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

  // 6. 팀 순위 및 성적(Form 포함) 획득
  const getTeamStandings = async () => {
    const { data } = await adminClient
      .from("team_standings")
      .select("team_id, rank, wins, losses, draws, form")
      .in("team_id", [homeTeamId, awayTeamId])
      .eq("season", season);
    return data ?? [];
  };

  // 7. 이번 시즌 상대 전적 (당일 경기 직전까지)
  const getH2HRecord = async () => {
    const { data } = await adminClient
      .from("games")
      .select("home_team_id, away_team_id, home_score, away_score")
      .eq("status", "finished")
      .gte("game_date", `${season}-01-01`)
      .lt("game_date", gameDate)
      .or(`and(home_team_id.eq.${homeTeamId},away_team_id.eq.${awayTeamId}),and(home_team_id.eq.${awayTeamId},away_team_id.eq.${homeTeamId})`);
    return data ?? [];
  };

  // 병렬 데이터 조회 수행
  const [
    homeBatting,
    awayBatting,
    homeRecent,
    awayRecent,
    standings,
    h2hGames
  ] = await Promise.all([
    getTeamBattingAvg(homeTeamId),
    getTeamBattingAvg(awayTeamId),
    getRecentGames(homeTeamId),
    getRecentGames(awayTeamId),
    getTeamStandings(),
    getH2HRecord()
  ]);

  // 상대전적 가공
  let homeH2HWins = 0;
  let awayH2HWins = 0;
  let h2hDraws = 0;

  for (const g of h2hGames) {
    const isHomeTeamRealHome = g.home_team_id === homeTeamId;
    const homeScore = g.home_score ?? 0;
    const awayScore = g.away_score ?? 0;
    if (homeScore > awayScore) {
      if (isHomeTeamRealHome) homeH2HWins++; else awayH2HWins++;
    } else if (awayScore > homeScore) {
      if (isHomeTeamRealHome) awayH2HWins++; else homeH2HWins++;
    } else {
      h2hDraws++;
    }
  }

  // 팀 평균자책점(ERA) 가중평균 계산
  const getTeamEra = (teamId: string) => {
    const rosterIds = new Set(getRoster(teamId).filter((p) => p.primaryPosition === "P").map((p) => p.id));
    const pitchers = Array.from(stats.pitchers.values()).filter((p) => rosterIds.has(p.playerId));
    let totalIp = 0;
    let totalEarnedRuns = 0;
    for (const p of pitchers) {
      totalIp += p.ip;
      totalEarnedRuns += p.earnedRuns;
    }
    if (totalIp === 0) return 4.50;
    return Number(((totalEarnedRuns * 9) / totalIp).toFixed(2));
  };

  // 시즌 전체 팀 타율 계산
  const getTeamBattingAvgAll = (teamId: string) => {
    const rosterIds = new Set(getRoster(teamId).filter((p) => p.primaryPosition !== "P").map((p) => p.id));
    const batters = Array.from(stats.batters.values()).filter((b) => rosterIds.has(b.playerId));
    let totalAb = 0;
    let totalHits = 0;
    for (const b of batters) {
      totalAb += b.ab || 0;
      totalHits += b.hits || 0;
    }
    if (totalAb === 0) return 0.260;
    return Number((totalHits / totalAb).toFixed(3));
  };

  const homeTeamEra = getTeamEra(homeTeamId);
  const awayTeamEra = getTeamEra(awayTeamId);
  const homeTeamBattingAvgAll = getTeamBattingAvgAll(homeTeamId);
  const awayTeamBattingAvgAll = getTeamBattingAvgAll(awayTeamId);

  const homeStanding = standings.find((s) => s.team_id === homeTeamId);
  const awayStanding = standings.find((s) => s.team_id === awayTeamId);

  return NextResponse.json({
    ok: true,
    gameId: params.gameId,
    starters: {
      home: {
        name: homeStarterStats.name,
        wins: homeStarterStats.wins ?? 0,
        losses: homeStarterStats.losses ?? 0,
        era: homeStarterStats.era,
        whip: homeStarterStats.whip,
        k9: homeStarterStats.k9,
        bb9: homeStarterStats.bb9
      },
      away: {
        name: awayStarterStats.name,
        wins: awayStarterStats.wins ?? 0,
        losses: awayStarterStats.losses ?? 0,
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
    },
    teamStandings: {
      home: homeStanding ? {
        rank: homeStanding.rank,
        wins: homeStanding.wins,
        losses: homeStanding.losses,
        draws: homeStanding.draws,
        form: homeStanding.form,
        teamEra: homeTeamEra,
        teamBattingAvg: homeTeamBattingAvgAll
      } : { rank: 0, wins: 0, losses: 0, draws: 0, form: [], teamEra: homeTeamEra, teamBattingAvg: homeTeamBattingAvgAll },
      away: awayStanding ? {
        rank: awayStanding.rank,
        wins: awayStanding.wins,
        losses: awayStanding.losses,
        draws: awayStanding.draws,
        form: awayStanding.form,
        teamEra: awayTeamEra,
        teamBattingAvg: awayTeamBattingAvgAll
      } : { rank: 0, wins: 0, losses: 0, draws: 0, form: [], teamEra: awayTeamEra, teamBattingAvg: awayTeamBattingAvgAll }
    },
    h2hRecord: {
      wins: homeH2HWins,
      losses: awayH2HWins,
      draws: h2hDraws
    }
  }, { headers: PUBLIC_CACHE_HEADERS });
}
