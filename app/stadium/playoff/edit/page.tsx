import { redirect } from "next/navigation";
import { PlayoffLineupEditor } from "@/components/domain/stadium/playoff/PlayoffLineupEditor";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActivePlayoffRun } from "@/lib/supabase/query-parts/bpPlayoff";

export const dynamic = "force-dynamic";

export default async function PlayoffEditPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const run = user ? await getActivePlayoffRun(supabase, user.id) : null;
  if (!run) redirect("/stadium/playoff");
  return <PlayoffLineupEditor run={run} />;
}
