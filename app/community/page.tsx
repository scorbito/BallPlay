import type { Metadata } from "next";
import { CommunityScreen } from "@/components/domain/CommunityScreen";
import { listMatchPostsFromDb } from "@/lib/supabase/query-parts/matchPosts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "커뮤니티 | 야구놀이터" };

export default async function CommunityPage() {
  // 세션 토큰이 잠깐 어긋나도(예: "JWT issued at future" 시계 오차) 공개 게시판이
  // 통째로 크래시하지 않도록 방어. 인증 실패는 비로그인으로, 목록 실패는 빈 목록으로 폴백.
  let currentUserId: string | null = null;
  try {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    currentUserId = data.user?.id ?? null;
  } catch {
    currentUserId = null;
  }

  const [initialFreePosts, initialMatchPosts] = await Promise.all([
    listMatchPostsFromDb({ postType: "free", limit: 20 }).catch(() => []),
    listMatchPostsFromDb({ postType: "match_talk", limit: 20 }).catch(() => [])
  ]);

  return <CommunityScreen initialFreePosts={initialFreePosts} initialMatchPosts={initialMatchPosts} currentUserId={currentUserId} />;
}
