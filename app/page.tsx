import { unstable_noStore as noStore } from "next/cache";
import { CommunityScreen } from "@/components/domain/CommunityScreen";
import { listMatchPostsFromDb } from "@/lib/supabase/query-parts/matchPosts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: { gameId?: string; date?: string };
};

export default async function HomePage({ searchParams }: HomePageProps) {
  noStore();

  const matchTalkGameId = searchParams?.gameId;
  const matchTalkDate = searchParams?.date;

  const ssr = createSupabaseServerClient();
  const { data: authData } = await ssr.auth.getUser();
  const currentUserId = authData.user?.id ?? null;

  const initialMatchPosts = await listMatchPostsFromDb({
    limit: 20,
    gameId: matchTalkGameId,
    date: matchTalkDate
  }).catch(() => []);

  return (
    <CommunityScreen
      initialMatchPosts={initialMatchPosts}
      currentUserId={currentUserId}
      initialMatchTalkGameId={matchTalkGameId}
      initialMatchTalkDate={matchTalkDate}
    />
  );
}
