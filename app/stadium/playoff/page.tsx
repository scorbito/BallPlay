import { notFound } from "next/navigation";
import { PlayoffHubScreen } from "@/components/domain/stadium/playoff/PlayoffHubScreen";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLatestPlayoffRun } from "@/lib/supabase/query-parts/bpPlayoff";
import { getUserTier } from "@/lib/auth/userTier";

export const dynamic = "force-dynamic";

export default async function PlayoffPage({
  searchParams
}: {
  searchParams?: { result?: string };
}) {
  const supabase = createSupabaseServerClient();
  const userTier = await getUserTier(supabase);
  if (userTier.tier !== "admin") notFound();
  const user = userTier.user;
  const latestRun = user ? await getLatestPlayoffRun(supabase, user.id) : null;
  const showLatestResult = searchParams?.result === "1";

  return <PlayoffHubScreen initialRun={latestRun} loggedIn={Boolean(user)} showLatestResult={showLatestResult} />;
}
