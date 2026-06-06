import { PlayoffHubScreen } from "@/components/domain/stadium/playoff/PlayoffHubScreen";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLatestPlayoffRun } from "@/lib/supabase/query-parts/bpPlayoff";

export const dynamic = "force-dynamic";

export default async function PlayoffPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const latestRun = user ? await getLatestPlayoffRun(supabase, user.id) : null;

  return <PlayoffHubScreen initialRun={latestRun} loggedIn={Boolean(user)} />;
}
