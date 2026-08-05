import type { Metadata } from "next";
import { CommunityScreen } from "@/components/domain/CommunityScreen";
import { listMatchPostsFromDb } from "@/lib/supabase/query-parts/matchPosts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "커뮤니티 | 야구놀이터" };

export default async function CommunityPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [initialFreePosts, initialMatchPosts] = await Promise.all([
    listMatchPostsFromDb({ postType: "free", limit: 20 }),
    listMatchPostsFromDb({ postType: "match_talk", limit: 20 })
  ]);

  return <CommunityScreen initialFreePosts={initialFreePosts} initialMatchPosts={initialMatchPosts} currentUserId={user?.id ?? null} />;
}
