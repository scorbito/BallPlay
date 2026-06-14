import { PlayoffHubScreen } from "@/components/domain/stadium/playoff/PlayoffHubScreen";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLatestPlayoffRun } from "@/lib/supabase/query-parts/bpPlayoff";

export const dynamic = "force-dynamic";

export default async function PlayoffPage({
  searchParams
}: {
  searchParams?: { result?: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const latestRun = user ? await getLatestPlayoffRun(supabase, user.id) : null;
  const showLatestResult = searchParams?.result === "1";

  return <PlayoffHubScreen initialRun={latestRun} loggedIn={Boolean(user)} showLatestResult={showLatestResult} />;
}
