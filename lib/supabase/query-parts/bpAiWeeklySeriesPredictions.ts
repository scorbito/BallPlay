import type { SupabaseClient } from "@supabase/supabase-js";
import { getTeam } from "@/lib/constants/teams";
import type { AiProvider } from "@/lib/supabase/query-parts/bpAiPredictions";

export type WeeklySeriesGroup = "early" | "weekend";

type BpAiWeeklySeriesRow = {
  id: string;
  week_start_date: string;
  series_group: WeeklySeriesGroup;
  series_start_date: string;
  series_end_date: string;
  home_team_id: string;
  away_team_id: string;
  label: string;
  headline: string;
  published_at: string;
};

type BpAiWeeklySeriesPredictionRow = {
  id: string;
  series_id: string;
  week_start_date: string;
  ai_provider: AiProvider;
  model_name: string | null;
  predicted_winner_team_id: string;
  predicted_result: "sweep_win" | "winning" | "split" | "losing" | "sweep_loss";
  predicted_wins: number;
  predicted_losses: number;
  confidence: number;
  key_factor: string;
  one_liner: string;
  detailed_analysis: string;
  published_at: string;
};

export type AiWeeklySeriesPick = {
  provider: AiProvider;
  modelName: string | null;
  teamId: string;
  result: string;
  note: string;
  oneLiner: string;
  detailedAnalysis: string;
  confidence: number;
};

export type AiWeeklySeries = {
  id: string;
  group: WeeklySeriesGroup;
  label: string;
  range: string;
  weekStartDate: string;
  homeTeamId: string;
  awayTeamId: string;
  headline: string;
  picks: AiWeeklySeriesPick[];
};

const SERIES_SELECT =
  "id,week_start_date,series_group,series_start_date,series_end_date,home_team_id,away_team_id,label,headline,published_at";

const PREDICTION_SELECT =
  "id,series_id,week_start_date,ai_provider,model_name,predicted_winner_team_id,predicted_result,predicted_wins,predicted_losses,confidence,key_factor,one_liner,detailed_analysis,published_at";

function formatSeriesRange(startDate: string, endDate: string): string {
  const [, startMonth, startDay] = startDate.split("-");
  const [, endMonth, endDay] = endDate.split("-");
  return `${Number(startMonth)}.${Number(startDay)} - ${Number(endMonth)}.${Number(endDay)}`;
}

function formatPredictionResult(row: BpAiWeeklySeriesPredictionRow): string {
  const teamName = getTeam(row.predicted_winner_team_id).shortName;
  if (row.predicted_result === "sweep_win" || row.predicted_wins === 3) return `${teamName} 스윕승`;
  if (row.predicted_result === "split") return "팽팽한 시리즈";
  if (row.predicted_result === "losing") return `${teamName} 루징`;
  if (row.predicted_result === "sweep_loss") return `${teamName} 스윕패`;
  if (row.predicted_wins === 2 && row.predicted_losses === 1) return `${teamName} 위닝`;
  if (row.predicted_wins > 0 || row.predicted_losses > 0) {
    return `${teamName} ${row.predicted_wins}승 ${row.predicted_losses}패`;
  }
  return `${teamName} 위닝`;
}

function buildSeries(
  row: BpAiWeeklySeriesRow,
  predictions: BpAiWeeklySeriesPredictionRow[]
): AiWeeklySeries {
  return {
    id: row.id,
    group: row.series_group,
    label: row.label,
    range: formatSeriesRange(row.series_start_date, row.series_end_date),
    weekStartDate: row.week_start_date,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    headline: row.headline,
    picks: predictions.map((prediction) => ({
      provider: prediction.ai_provider,
      modelName: prediction.model_name,
      teamId: prediction.predicted_winner_team_id,
      result: formatPredictionResult(prediction),
      note: prediction.key_factor,
      oneLiner: prediction.one_liner,
      detailedAnalysis: prediction.detailed_analysis,
      confidence: prediction.confidence
    }))
  };
}

export async function listAiWeeklySeriesForWeek(
  client: SupabaseClient,
  weekStartDate: string
): Promise<{ ok: true; rows: AiWeeklySeries[] } | { ok: false; error: string }> {
  const { data: seriesRows, error: seriesError } = await client
    .from("bp_ai_weekly_series")
    .select(SERIES_SELECT)
    .eq("week_start_date", weekStartDate)
    .order("series_group", { ascending: true })
    .order("series_start_date", { ascending: true });

  if (seriesError) return { ok: false, error: seriesError.message };
  const series = (seriesRows ?? []) as unknown as BpAiWeeklySeriesRow[];
  const seriesIds = series.map((row) => row.id);
  if (seriesIds.length === 0) return { ok: true, rows: [] };

  const { data: predictionRows, error: predictionError } = await client
    .from("bp_ai_weekly_series_predictions")
    .select(PREDICTION_SELECT)
    .in("series_id", seriesIds)
    .order("ai_provider", { ascending: true });

  if (predictionError) return { ok: false, error: predictionError.message };

  const predictionsBySeries = new Map<string, BpAiWeeklySeriesPredictionRow[]>();
  for (const prediction of (predictionRows ?? []) as unknown as BpAiWeeklySeriesPredictionRow[]) {
    const list = predictionsBySeries.get(prediction.series_id) ?? [];
    list.push(prediction);
    predictionsBySeries.set(prediction.series_id, list);
  }

  return {
    ok: true,
    rows: series.map((row) => buildSeries(row, predictionsBySeries.get(row.id) ?? []))
  };
}

export async function getAiWeeklySeriesById(
  client: SupabaseClient,
  seriesId: string
): Promise<{ ok: true; row: AiWeeklySeries | null } | { ok: false; error: string }> {
  const { data: seriesRow, error: seriesError } = await client
    .from("bp_ai_weekly_series")
    .select(SERIES_SELECT)
    .eq("id", seriesId)
    .maybeSingle();

  if (seriesError) return { ok: false, error: seriesError.message };
  if (!seriesRow) return { ok: true, row: null };

  const { data: predictionRows, error: predictionError } = await client
    .from("bp_ai_weekly_series_predictions")
    .select(PREDICTION_SELECT)
    .eq("series_id", seriesId)
    .order("ai_provider", { ascending: true });

  if (predictionError) return { ok: false, error: predictionError.message };

  return {
    ok: true,
    row: buildSeries(
      seriesRow as unknown as BpAiWeeklySeriesRow,
      (predictionRows ?? []) as unknown as BpAiWeeklySeriesPredictionRow[]
    )
  };
}
