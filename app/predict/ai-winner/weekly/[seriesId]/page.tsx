import { AiWeeklySeriesRevealScreen } from "@/components/domain/AiWeeklySeriesRevealScreen";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAiWeeklySeriesById } from "@/lib/supabase/query-parts/bpAiWeeklySeriesPredictions";

export const dynamic = "force-dynamic";

export default async function AiWeeklySeriesRevealPage({
  params
}: {
  params: { seriesId: string };
}) {
  const supabase = createSupabaseAdminClient();
  const result = await getAiWeeklySeriesById(supabase, params.seriesId);
  const series = result.ok ? result.row : null;
  return <AiWeeklySeriesRevealScreen series={series} backDate={series?.weekStartDate} />;
}

