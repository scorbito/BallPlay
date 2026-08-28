import type {
  MatchPost,
  MatchPostComment,
  CommunityPostType,
  MatchPostEmotionTag,
  MatchPostStatusSnapshot
} from "@/lib/types/domain";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

type MatchPostRow = {
  id: string;
  user_id: string;
  post_type: CommunityPostType;
  title: string | null;
  game_id: string | null;
  body: string;
  photo_url: string | null;
  emotion_tag: MatchPostEmotionTag;
  score_home_at_post: number | null;
  score_away_at_post: number | null;
  inning_at_post: number | null;
  status_at_post: MatchPostStatusSnapshot;
  created_at: string;
};

type ProfileRow = {
  id: string;
  nickname: string;
  main_team_id: string;
  avatar_image_url: string | null;
};

type GameRow = {
  id: string;
  game_date: string;
  stadium: string;
  home_team_id: string;
  away_team_id: string;
  status: "scheduled" | "in_progress" | "finished" | "canceled";
};

function getTimeAgo(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(createdAt).toISOString().slice(0, 10);
}

async function getCurrentUserId(): Promise<string | null> {
  // 세션 토큰 오차(예: "JWT issued at future")로 auth.getUser 가 실패해도 비로그인으로 취급.
  try {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export type ListMatchPostsParams = {
  postType?: CommunityPostType;
  /** YYYY-MM-DD — 해당 날짜의 경기들만 */
  date?: string;
  /** 특정 경기 1개 */
  gameId?: string;
  /** 응원팀 필터 (작성자 main_team_id 기준) */
  authorTeamId?: string;
  emotionTag?: MatchPostEmotionTag;
  /** 마이페이지용 */
  onlyMine?: boolean;
  /** 무한 스크롤용 cursor (created_at) */
  cursor?: string;
  limit?: number;
};

export async function listMatchPostsFromDb(params: ListMatchPostsParams = {}): Promise<MatchPost[]> {
  const admin = createSupabaseAdminClient();
  const viewerId = await getCurrentUserId();
  const limit = params.limit ?? 20;

  let query = admin
    .from("match_posts")
    .select("id,user_id,post_type,title,game_id,body,photo_url,emotion_tag,score_home_at_post,score_away_at_post,inning_at_post,status_at_post,created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  query = query.eq("post_type", params.postType ?? "match_talk");

  if (params.cursor) {
    query = query.lt("created_at", params.cursor);
  }
  if (params.gameId) {
    query = query.eq("game_id", params.gameId);
  }
  if (params.emotionTag) {
    query = query.eq("emotion_tag", params.emotionTag);
  }
  if (params.onlyMine) {
    if (!viewerId) return [];
    query = query.eq("user_id", viewerId);
  }

  // date 필터는 game_date 기준이라 games 테이블 조회 후 game_id 셋으로 적용
  if (params.date) {
    const { data: gameIds } = await admin
      .from("games")
      .select("id")
      .eq("game_date", params.date);
    const ids = (gameIds ?? []).map((g) => g.id);
    if (ids.length === 0) return [];
    query = query.in("game_id", ids);
  }

  const { data: rows, error } = await query.returns<MatchPostRow[]>();
  if (error) throw new Error(`경기톡 목록 조회 실패: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const gameIds = Array.from(new Set(rows.flatMap((r) => r.game_id ? [r.game_id] : [])));
  const safeGameIds = gameIds.length > 0 ? gameIds : ["__none__"];
  const postIds = rows.map((r) => r.id);

  const [
    { data: profiles },
    { data: games },
    { data: likes },
    { data: comments },
    { data: myLikes },
    { data: attendances }
  ] = await Promise.all([
    admin.from("profiles")
      .select("id,nickname,main_team_id,avatar_image_url")
      .in("id", userIds)
      .returns<ProfileRow[]>(),
    admin.from("games")
      .select("id,game_date,stadium,home_team_id,away_team_id,status")
      .in("id", safeGameIds)
      .returns<GameRow[]>(),
    admin.from("match_post_likes")
      .select("match_post_id")
      .in("match_post_id", postIds),
    admin.from("match_post_comments")
      .select("match_post_id")
      .in("match_post_id", postIds),
    viewerId
      ? admin.from("match_post_likes")
          .select("match_post_id")
          .in("match_post_id", postIds)
          .eq("user_id", viewerId)
      : Promise.resolve({ data: [] as Array<{ match_post_id: string }> }),
    admin.from("attendances")
      .select("user_id,game_id")
      .in("user_id", userIds)
      .in("game_id", safeGameIds)
  ]);

  // 작성자 필터(응원팀): 프로필 조인 후 클라이언트 사이드 필터
  // (DB에서 직접 조인하지 않는 이유: rows를 먼저 페이지네이션 한정 후 보강하는 패턴 유지)
  const profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const gamesById = new Map((games ?? []).map((g) => [g.id, g]));

  const likeCountMap = new Map<string, number>();
  for (const row of likes ?? []) {
    likeCountMap.set(row.match_post_id, (likeCountMap.get(row.match_post_id) ?? 0) + 1);
  }
  const commentCountMap = new Map<string, number>();
  for (const row of comments ?? []) {
    commentCountMap.set(row.match_post_id, (commentCountMap.get(row.match_post_id) ?? 0) + 1);
  }
  const myLikedSet = new Set((myLikes ?? []).map((r) => r.match_post_id));
  const attendanceSet = new Set(
    (attendances ?? []).map((a) => `${a.user_id}:${a.game_id}`)
  );

  let mapped: MatchPost[] = rows.map((row) => {
    const profile = profilesById.get(row.user_id);
    const game = row.game_id ? gamesById.get(row.game_id) : undefined;
    return {
      id: row.id,
      userId: row.user_id,
      postType: row.post_type,
      title: row.title,
      gameId: row.game_id,
      body: row.body,
      photoUrl: row.photo_url,
      emotionTag: row.emotion_tag,
      scoreHomeAtPost: row.score_home_at_post,
      scoreAwayAtPost: row.score_away_at_post,
      inningAtPost: row.inning_at_post,
      statusAtPost: row.status_at_post,
      createdAt: row.created_at,
      timeAgo: getTimeAgo(row.created_at),
      authorNickname: profile?.nickname ?? "승요팬",
      authorTeamId: profile?.main_team_id ?? "lg",
      authorAvatarUrl: profile?.avatar_image_url ?? null,
      authorAttended: attendanceSet.has(`${row.user_id}:${row.game_id}`),
      game: {
        date: game?.game_date ?? "",
        homeTeamId: game?.home_team_id ?? "",
        awayTeamId: game?.away_team_id ?? "",
        stadium: game?.stadium ?? "",
        currentStatus: game?.status ?? "scheduled"
      },
      likeCount: likeCountMap.get(row.id) ?? 0,
      commentCount: commentCountMap.get(row.id) ?? 0,
      likedByMe: myLikedSet.has(row.id)
    };
  });

  if (params.authorTeamId) {
    mapped = mapped.filter((p) => p.authorTeamId === params.authorTeamId);
  }

  return mapped;
}

export async function getMatchPostByIdFromDb(id: string): Promise<MatchPost | null> {
  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("match_posts")
    .select("id,user_id,post_type,title,game_id,body,photo_url,emotion_tag,score_home_at_post,score_away_at_post,inning_at_post,status_at_post,created_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<MatchPostRow>();

  if (error) throw new Error(`경기톡 조회 실패: ${error.message}`);
  if (!row) return null;

  const viewerId = await getCurrentUserId();

  const [
    { data: profile },
    { data: game },
    { count: likeCount },
    { count: commentCount },
    { data: myLike }
  ] = await Promise.all([
    admin.from("profiles")
      .select("id,nickname,main_team_id,avatar_image_url")
      .eq("id", row.user_id)
      .maybeSingle<ProfileRow>(),
    admin.from("games")
      .select("id,game_date,stadium,home_team_id,away_team_id,status")
      .eq("id", row.game_id ?? "__none__")
      .maybeSingle<GameRow>(),
    admin.from("match_post_likes")
      .select("user_id", { count: "exact", head: true })
      .eq("match_post_id", row.id),
    admin.from("match_post_comments")
      .select("id", { count: "exact", head: true })
      .eq("match_post_id", row.id),
    viewerId
      ? admin.from("match_post_likes")
          .select("match_post_id")
          .eq("match_post_id", row.id)
          .eq("user_id", viewerId)
          .maybeSingle()
      : Promise.resolve({ data: null })
  ]);

  return {
    id: row.id,
    userId: row.user_id,
    postType: row.post_type,
    title: row.title,
    gameId: row.game_id,
    body: row.body,
    photoUrl: row.photo_url,
    emotionTag: row.emotion_tag,
    scoreHomeAtPost: row.score_home_at_post,
    scoreAwayAtPost: row.score_away_at_post,
    inningAtPost: row.inning_at_post,
    statusAtPost: row.status_at_post,
    createdAt: row.created_at,
    timeAgo: getTimeAgo(row.created_at),
    authorNickname: profile?.nickname ?? "승요팬",
    authorTeamId: profile?.main_team_id ?? "lg",
    authorAvatarUrl: profile?.avatar_image_url ?? null,
    game: {
      date: game?.game_date ?? "",
      homeTeamId: game?.home_team_id ?? "",
      awayTeamId: game?.away_team_id ?? "",
      stadium: game?.stadium ?? "",
      currentStatus: game?.status ?? "scheduled"
    },
    likeCount: likeCount ?? 0,
    commentCount: commentCount ?? 0,
    likedByMe: Boolean(myLike)
  };
}

type MatchPostCommentRow = {
  id: string;
  match_post_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export async function listMatchPostCommentsFromDb(matchPostId: string): Promise<MatchPostComment[]> {
  const admin = createSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("match_post_comments")
    .select("id,match_post_id,user_id,body,created_at")
    .eq("match_post_id", matchPostId)
    .order("created_at", { ascending: true })
    .returns<MatchPostCommentRow[]>();

  if (error) throw new Error(`경기톡 댓글 조회 실패: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profiles } = await admin
    .from("profiles")
    .select("id,nickname,main_team_id,avatar_image_url")
    .in("id", userIds)
    .returns<ProfileRow[]>();
  const profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return rows.map((row) => {
    const profile = profilesById.get(row.user_id);
    return {
      id: row.id,
      matchPostId: row.match_post_id,
      userId: row.user_id,
      authorNickname: profile?.nickname ?? "승요팬",
      authorTeamId: profile?.main_team_id ?? "lg",
      authorAvatarUrl: profile?.avatar_image_url ?? null,
      body: row.body,
      createdAt: row.created_at,
      timeAgo: getTimeAgo(row.created_at)
    };
  });
}

/**
 * 경기톡 글 개수 카운트.
 * 홈 카드의 글 개수 뱃지(`💬 N`)용. 한 번에 여러 game_id 카운트.
 */
export async function countMatchPostsByGameIds(gameIds: string[]): Promise<Record<string, number>> {
  if (gameIds.length === 0) return {};
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("match_posts")
    .select("game_id")
    .is("deleted_at", null)
    .in("game_id", gameIds);
  if (error) throw new Error(`경기톡 카운트 조회 실패: ${error.message}`);
  const result: Record<string, number> = {};
  for (const row of data ?? []) {
    result[row.game_id] = (result[row.game_id] ?? 0) + 1;
  }
  return result;
}
