import { notFound, redirect } from "next/navigation";
import { PlayoffLineupEditor } from "@/components/domain/stadium/playoff/PlayoffLineupEditor";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActivePlayoffRun } from "@/lib/supabase/query-parts/bpPlayoff";
import { getUserTier } from "@/lib/auth/userTier";

export const dynamic = "force-dynamic";

export default async function PlayoffEditPage() {
  const supabase = createSupabaseServerClient();
  const userTier = await getUserTier(supabase);
  if (userTier.tier !== "admin") notFound();
  const user = userTier.user;
  const run = user ? await getActivePlayoffRun(supabase, user.id) : null;
  if (!run) redirect("/stadium/playoff");
  return <PlayoffLineupEditor run={run} />;
}
