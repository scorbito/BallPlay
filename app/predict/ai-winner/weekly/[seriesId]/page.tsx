import { AiWeeklySeriesRevealScreen } from "@/components/domain/AiWeeklySeriesRevealScreen";

export const dynamic = "force-dynamic";

export default function AiWeeklySeriesRevealPage({
  params
}: {
  params: { seriesId: string };
}) {
  return <AiWeeklySeriesRevealScreen seriesId={params.seriesId} />;
}
