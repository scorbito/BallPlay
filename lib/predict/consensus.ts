import { createSupabaseCacheClient } from "@/lib/supabase/server";
import { listGamesFromDb } from "@/lib/supabase/queries";
import {
  listAiPredictionResultsForDate,
  type AiProvider,
  type BpAiPredictionResultRow
} from "@/lib/supabase/query-parts/bpAiPredictions";

// 종합분석&예측 — 3개 AI 픽 + 불펜 데일리 + 최근 폼을 사후 취합해 경기별 종합픽 산출.
// 확률 모델: provider별 채점 이력 적중률(축소추정 +10경기 55%) → 신뢰도 r → 픽한 팀 odds *= r/(1-r).
// 의견이 갈린 경기는 r을 0.5 쪽으로 60% 축소 — 실측상 갈린 경기 다수결 적중이 낮아(1/8) 과신 방지.

export type ProviderPick = {
  provider: AiProvider;
  teamId: string;
  confidence: number;
  keyFactor: string;
  isCorrect: boolean | null;
};

export type TeamFormLine = {
  wins: number;
  losses: number;
  draws: number;
  runsScored: number;
  runsAllowed: number;
};

export type TeamBullpenLine = {
  recent10Era: number | null;
  recent10Whip: number | null;
  lateRunsPerGame: number | null;
  pitchesLast3Days: number;
  backToBackPitchers: number;
  highUsageYesterday: number;
};

export type ConsensusGameCard = {
  gameId: string;
  gameTime: string | null;
  stadium: string;
  homeTeamId: string;
  awayTeamId: string;
  homeStarter: string | null;
  awayStarter: string | null;
  /** 선발 시즌 ERA (스냅샷 최신값). 새 외국인 등 기록 없으면 null. */
  homeStarterEra: number | null;
  awayStarterEra: number | null;
  picks: ProviderPick[];
  /** 3개 미만이면 null — 종합픽 미산출 */
  consensusTeamId: string | null;
  consensusProb: number | null;
  unanimous: boolean;
  homeForm: TeamFormLine | null;
  awayForm: TeamFormLine | null;
  homeBullpen: TeamBullpenLine | null;
  awayBullpen: TeamBullpenLine | null;
  /** 피로 경고 문구 (팀명 포함, 조건 충족 시만) */
  fatigueFlags: string[];
  /** 작성형 종합분석 리포트 (bp_ai_consensus_daily). 없으면 화면이 자동 요약으로 폴백. */
  analysis: string | null;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  gameStatus: string;
};

export type ConsensusPageData = {
  selectedDate: string;
  cards: ConsensusGameCard[];
  unanimousCount: number;
  splitCount: number;
  /** provider별 채점 이력 (신뢰도 산출 근거 표시용) */
  providerRecords: Array<{ provider: AiProvider; correct: number; total: number }>;
};

const PROVIDER_ORDER: AiProvider[] = ["gpt", "gemini", "claude"];

function shrunkReliability(correct: number, total: number): number {
  return (correct + 5.5) / (total + 10);
}

/** AI 예측 상세 화면의 "종합분석" 탭용 — 해당 경기 1건의 종합 카드. */
export async function loadConsensusCardForGame(
  selectedDate: string,
  gameId: string
): Promise<ConsensusGameCard | null> {
  const data = await loadConsensusPageData(selectedDate);
  return data.cards.find((c) => c.gameId === gameId) ?? null;
}

export async function loadConsensusPageData(selectedDate: string): Promise<ConsensusPageData> {
  const client = createSupabaseCacheClient(60);

  const [games, predsResult, gradedResult, bullpenResult, recentGamesResult, analysisResult] = await Promise.all([
    // ⚠️ 캐시 클라이언트 필수 — 기본 admin 클라이언트는 no-store fetch 라 ISR 라우트
    // (/predict/ai-winner/[gameId], revalidate=60) 의 정적 렌더를 깨서 500 을 유발한다.
    listGamesFromDb({ from: selectedDate, to: selectedDate }, client).catch(() => []),
    listAiPredictionResultsForDate(client, selectedDate),
    client.from("bp_ai_predictions").select("ai_provider,is_correct").not("is_correct", "is", null),
    client
      .from("bp_team_bullpen_daily")
      .select("*")
      .lte("snapshot_date", selectedDate)
      .order("snapshot_date", { ascending: false })
      .limit(30),
    client
      .from("games")
      .select("game_date,home_team_id,away_team_id,home_score,away_score")
      .lt("game_date", selectedDate)
      .not("home_score", "is", null)
      .order("game_date", { ascending: false })
      .limit(140),
    // 작성형 종합분석 리포트 — 테이블 미생성(42P01) 등 오류 시 data=null 로 조용히 폴백.
    client
      .from("bp_ai_consensus_daily")
      .select("game_id, analysis, pick_team_id, probability")
      .eq("game_date", selectedDate)
  ]);

  const analysisByGame = new Map<string, string>();
  // 리포트 창이 저장한 종합픽·확률 — 화면 재계산보다 우선한다 (계산식 개정이 리포트 쪽에서 일어남).
  const reportPickByGame = new Map<string, { teamId: string; prob: number }>();
  for (const row of analysisResult.data ?? []) {
    if (typeof row.analysis === "string" && row.analysis.length > 0) analysisByGame.set(row.game_id, row.analysis);
    const prob = Number(row.probability);
    if (row.pick_team_id && Number.isFinite(prob) && prob > 0) {
      reportPickByGame.set(row.game_id, { teamId: row.pick_team_id, prob });
    }
  }

  // provider 신뢰도
  const record: Record<string, { o: number; t: number }> = {};
  for (const row of gradedResult.data ?? []) {
    const key = row.ai_provider as string;
    record[key] = record[key] ?? { o: 0, t: 0 };
    record[key].t += 1;
    if (row.is_correct) record[key].o += 1;
  }
  const reliability: Record<string, number> = {};
  for (const p of PROVIDER_ORDER) reliability[p] = shrunkReliability(record[p]?.o ?? 0, record[p]?.t ?? 0);

  // 팀별 최근 10경기 폼
  const form = new Map<string, TeamFormLine & { games: number }>();
  for (const g of recentGamesResult.data ?? []) {
    for (const [teamId, my, opp] of [
      [g.home_team_id, g.home_score, g.away_score],
      [g.away_team_id, g.away_score, g.home_score]
    ] as Array<[string, number, number]>) {
      const line = form.get(teamId) ?? { wins: 0, losses: 0, draws: 0, runsScored: 0, runsAllowed: 0, games: 0 };
      if (line.games >= 10) continue;
      line.games += 1;
      line.runsScored += my;
      line.runsAllowed += opp;
      if (my > opp) line.wins += 1;
      else if (my < opp) line.losses += 1;
      else line.draws += 1;
      form.set(teamId, line);
    }
  }

  // 팀별 불펜 데일리 (최신 1건)
  const bullpen = new Map<string, TeamBullpenLine>();
  for (const row of bullpenResult.data ?? []) {
    if (bullpen.has(row.team_id)) continue;
    bullpen.set(row.team_id, {
      recent10Era: row.recent10_era,
      recent10Whip: row.recent10_whip,
      lateRunsPerGame: row.late_runs_allowed_per_game,
      pitchesLast3Days: row.pitches_last_3_days ?? 0,
      backToBackPitchers: row.back_to_back_pitchers ?? 0,
      highUsageYesterday: row.high_usage_yesterday ?? 0
    });
  }

  // 선발 시즌 ERA — 스냅샷 최신값 (이름 매칭, 새 외국인 등 미등록은 null)
  const starterEra = new Map<string, number>();
  const starterNames = Array.from(
    new Set(games.flatMap((g) => [g.homeStarter, g.awayStarter]).filter((n): n is string => Boolean(n)))
  );
  if (starterNames.length > 0) {
    const orFilter = starterNames.map((n) => `sim_payload->>name.eq.${n}`).join(",");
    const { data: pitcherRows } = await client
      .from("bp_player_stats_snapshots")
      .select("snapshot_date, sim_payload")
      .eq("kind", "pitcher")
      .or(orFilter)
      .order("snapshot_date", { ascending: false })
      .limit(120);
    for (const row of pitcherRows ?? []) {
      const name = row.sim_payload?.name as string | undefined;
      const era = row.sim_payload?.era;
      if (name && !starterEra.has(name) && typeof era === "number") starterEra.set(name, era);
    }
  }

  // 게임별 픽 취합
  const predRows: BpAiPredictionResultRow[] = predsResult.ok ? predsResult.rows : [];
  const picksByGame = new Map<string, ProviderPick[]>();
  for (const row of predRows) {
    const list = picksByGame.get(row.game_id) ?? [];
    list.push({
      provider: row.ai_provider,
      teamId: row.predicted_winner_team_id,
      confidence: row.confidence,
      keyFactor: row.key_factor ?? "",
      isCorrect: row.is_correct
    });
    picksByGame.set(row.game_id, list);
  }

  const cards: ConsensusGameCard[] = games.map((g) => {
    const picks = (picksByGame.get(g.id) ?? []).sort(
      (a, b) => PROVIDER_ORDER.indexOf(a.provider) - PROVIDER_ORDER.indexOf(b.provider)
    );
    const unanimous = picks.length > 0 && new Set(picks.map((p) => p.teamId)).size === 1;

    // 종합픽·확률: 리포트 창이 bp_ai_consensus_daily 에 저장한 값을 우선 사용.
    // (확신도 혼합·라이브 판정 신뢰도 등 계산식 개정은 consensus-pick.mjs 쪽에서 관리)
    // 리포트 미작성일 때만 구식 재계산으로 폴백.
    const reportPick = reportPickByGame.get(g.id) ?? null;
    let consensusTeamId: string | null = reportPick?.teamId ?? null;
    let consensusProb: number | null = reportPick?.prob ?? null;
    if (!reportPick && picks.length >= 3) {
      let odds = 1; // 홈팀 기준
      for (const p of picks) {
        const base = reliability[p.provider] ?? 0.55;
        const r = unanimous ? base : 0.5 + (base - 0.5) * 0.4;
        const factor = r / (1 - r);
        odds *= p.teamId === g.homeTeamId ? factor : 1 / factor;
      }
      const pHome = odds / (1 + odds);
      consensusTeamId = pHome >= 0.5 ? g.homeTeamId : g.awayTeamId;
      consensusProb = Math.max(pHome, 1 - pHome);
    }

    const homeBp = bullpen.get(g.homeTeamId) ?? null;
    const awayBp = bullpen.get(g.awayTeamId) ?? null;
    const fatigueFlags: string[] = [];
    for (const [teamId, bp] of [
      [g.homeTeamId, homeBp],
      [g.awayTeamId, awayBp]
    ] as Array<[string, TeamBullpenLine | null]>) {
      if (!bp) continue;
      if (bp.pitchesLast3Days >= 250) fatigueFlags.push(`${teamId}:3일 ${bp.pitchesLast3Days}구`);
      if (bp.backToBackPitchers >= 2) fatigueFlags.push(`${teamId}:연투 ${bp.backToBackPitchers}명`);
      if (bp.highUsageYesterday >= 2) fatigueFlags.push(`${teamId}:전날 과부하 ${bp.highUsageYesterday}명`);
    }

    return {
      gameId: g.id,
      gameTime: g.time ?? null,
      stadium: g.stadium ?? "",
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      homeStarter: g.homeStarter ?? null,
      awayStarter: g.awayStarter ?? null,
      homeStarterEra: g.homeStarter ? starterEra.get(g.homeStarter) ?? null : null,
      awayStarterEra: g.awayStarter ? starterEra.get(g.awayStarter) ?? null : null,
      picks,
      consensusTeamId,
      consensusProb,
      unanimous,
      homeForm: form.get(g.homeTeamId) ?? null,
      awayForm: form.get(g.awayTeamId) ?? null,
      homeBullpen: homeBp,
      awayBullpen: awayBp,
      fatigueFlags,
      analysis: analysisByGame.get(g.id) ?? null,
      actualHomeScore: g.homeScore ?? null,
      actualAwayScore: g.awayScore ?? null,
      gameStatus: g.status ?? "scheduled"
    };
  });

  const withConsensus = cards.filter((c) => c.consensusTeamId !== null);
  return {
    selectedDate,
    cards,
    unanimousCount: withConsensus.filter((c) => c.unanimous).length,
    splitCount: withConsensus.filter((c) => !c.unanimous).length,
    providerRecords: PROVIDER_ORDER.map((p) => ({
      provider: p,
      correct: record[p]?.o ?? 0,
      total: record[p]?.t ?? 0
    }))
  };
}
