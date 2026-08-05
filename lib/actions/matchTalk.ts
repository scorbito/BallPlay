"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { refreshGameLiveScore, toMatchPostSnapshotColumns } from "@/lib/server/kbo/liveScore";
import {
  getMatchPostByIdFromDb,
  listMatchPostsFromDb,
  listMatchPostCommentsFromDb,
  type ListMatchPostsParams
} from "@/lib/supabase/query-parts/matchPosts";
import { getThisWeekRangeKst } from "@/lib/utils/matchTalkWeek";
import type {
  MatchPost,
  MatchPostComment,
  MatchPostEmotionTag
} from "@/lib/types/domain";

const EMOTION_TAGS = new Set<MatchPostEmotionTag>(["cheer", "support", "anger", "anxiety"]);

export type WriteableGameOption = {
  id: string;
  date: string;
  time: string | null;
  stadium: string;
  homeTeamId: string;
  awayTeamId: string;
  status: "scheduled" | "in_progress" | "finished" | "canceled";
};

export type LiveScorePreview = {
  gameId: string;
  homeScore: number | null;
  awayScore: number | null;
  innings: number | null;
  status: "scheduled" | "in_progress" | "finished" | "canceled";
  source: "cache" | "kbo" | "stale";
};

/**
 * 작성 모달에서 선택된 경기의 현재 라이브 스코어를 미리 보여주기 위한 server action.
 * 내부적으로 refreshGameLiveScore의 lazy refresh 로직을 그대로 사용한다 (TTL 2분).
 */
export async function getLiveScorePreviewAction(gameId: string): Promise<LiveScorePreview | null> {
  if (!gameId) return null;
  const snapshot = await refreshGameLiveScore(gameId);
  if (!snapshot) return null;
  return {
    gameId: snapshot.gameId,
    homeScore: snapshot.homeScore,
    awayScore: snapshot.awayScore,
    innings: snapshot.innings,
    status: snapshot.status,
    source: snapshot.source
  };
}

/**
 * 작성 모달용: 이번 주 월~일 사이의 경기 목록을 한 번에 가져온다.
 * 취소된 경기는 작성 선택지에서 제외(기획서 §3.1).
 */
export async function listWriteableGamesAction(): Promise<WriteableGameOption[]> {
  const admin = createSupabaseAdminClient();
  const { from, to } = getThisWeekRangeKst();
  const { data, error } = await admin
    .from("games")
    .select("id, game_date, game_time, stadium, home_team_id, away_team_id, status")
    .gte("game_date", from)
    .lte("game_date", to)
    .neq("status", "canceled")
    .order("game_date", { ascending: true })
    .order("game_time", { ascending: true });

  if (error) throw new Error(`작성 가능 경기 조회 실패: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    date: row.game_date as string,
    time: (row.game_time as string | null) ?? null,
    stadium: row.stadium as string,
    homeTeamId: row.home_team_id as string,
    awayTeamId: row.away_team_id as string,
    status: row.status as WriteableGameOption["status"]
  }));
}

export type CreateMatchPostInput = {
  gameId: string;
  body: string;
  emotionTag: MatchPostEmotionTag;
  photoUrl?: string | null;
};

export async function createMatchPostAction(input: CreateMatchPostInput): Promise<{ id: string }> {
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("로그인이 필요합니다.");
  }

  const body = input.body.trim();
  if (body.length === 0) {
    throw new Error("내용을 입력해주세요.");
  }
  if (body.length > 300) {
    throw new Error("내용은 300자 이내로 작성해주세요.");
  }
  if (!EMOTION_TAGS.has(input.emotionTag)) {
    throw new Error("감정 태그를 선택해주세요.");
  }

  const admin = createSupabaseAdminClient();

  // 1) 경기 존재 + 이번 주 월~일 + 취소 아닌지 검증
  const { data: game, error: gameError } = await admin
    .from("games")
    .select("id, game_date, status")
    .eq("id", input.gameId)
    .maybeSingle();
  if (gameError) throw new Error(`경기 조회 실패: ${gameError.message}`);
  if (!game) throw new Error("경기를 찾을 수 없어요.");

  const { from, to } = getThisWeekRangeKst();
  if (game.game_date < from || game.game_date > to) {
    throw new Error("이번 주 경기에만 글을 작성할 수 있어요.");
  }
  if (game.status === "canceled") {
    throw new Error("취소된 경기에는 글을 작성할 수 없어요.");
  }

  // 2) 라이브 스코어 lazy refresh → 박제값 확정
  const snapshot = await refreshGameLiveScore(input.gameId);
  const snapshotCols = toMatchPostSnapshotColumns(snapshot);

  // 3) insert
  const { data: inserted, error: insertError } = await admin
    .from("match_posts")
    .insert({
      user_id: authData.user.id,
      post_type: "match_talk",
      game_id: input.gameId,
      body,
      photo_url: input.photoUrl ?? null,
      emotion_tag: input.emotionTag,
      ...snapshotCols
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new Error(`경기톡 저장 실패: ${insertError?.message ?? "unknown"}`);
  }

  revalidatePath("/community");
  revalidatePath("/");

  return { id: inserted.id };
}

export type CreateFreePostInput = {
  title: string;
  body: string;
  photoUrl?: string | null;
};

export async function createFreePostAction(input: CreateFreePostInput): Promise<{ id: string }> {
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();
  if (authError || !authData.user) throw new Error("로그인이 필요합니다.");

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) throw new Error("제목을 입력해주세요.");
  if (title.length > 80) throw new Error("제목은 80자 이내로 작성해주세요.");
  if (!body) throw new Error("내용을 입력해주세요.");
  if (body.length > 1000) throw new Error("내용은 1000자 이내로 작성해주세요.");

  const admin = createSupabaseAdminClient();
  const { data: inserted, error } = await admin
    .from("match_posts")
    .insert({
      user_id: authData.user.id,
      post_type: "free",
      title,
      game_id: null,
      body,
      photo_url: input.photoUrl ?? null,
      emotion_tag: "cheer",
      status_at_post: "scheduled"
    })
    .select("id")
    .single();

  if (error || !inserted) throw new Error(`자유글 저장 실패: ${error?.message ?? "unknown"}`);
  revalidatePath("/community");
  return { id: inserted.id };
}
export async function listMatchPostsAction(params: ListMatchPostsParams = {}): Promise<MatchPost[]> {
  return listMatchPostsFromDb(params);
}

export async function loadMoreMatchPostsAction(
  cursor: string,
  limit = 20,
  filters: Pick<ListMatchPostsParams, "gameId" | "date" | "postType"> = {}
): Promise<MatchPost[]> {
  return listMatchPostsFromDb({ cursor, limit, ...filters });
}

/** 단건 조회 — 작성 직후 새 글을 화면 상단에 prepend하기 위한 server action */
export async function getMatchPostByIdAction(id: string): Promise<MatchPost | null> {
  return getMatchPostByIdFromDb(id);
}

export type GameContextInfo = {
  id: string;
  date: string;
  stadium: string;
  homeTeamId: string;
  awayTeamId: string;
  status: "scheduled" | "in_progress" | "finished" | "canceled";
};

/**
 * 경기톡 화면에서 특정 게임으로 필터 진입했지만 글이 한 건도 없는 경우를 위해
 * 게임 정보만 가볍게 조회한다. 컨텍스트 헤더 표시와 "이번 주 여부" 판단에 사용.
 */
export async function getGameContextAction(gameId: string): Promise<GameContextInfo | null> {
  if (!gameId) return null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("games")
    .select("id, game_date, stadium, home_team_id, away_team_id, status")
    .eq("id", gameId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    date: data.game_date as string,
    stadium: data.stadium as string,
    homeTeamId: data.home_team_id as string,
    awayTeamId: data.away_team_id as string,
    status: data.status as GameContextInfo["status"]
  };
}

export async function deleteMatchPostAction(postId: string): Promise<void> {
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("로그인이 필요합니다.");
  }

  const admin = createSupabaseAdminClient();

  // 소유 확인 후 soft delete
  const { data: post, error: fetchError } = await admin
    .from("match_posts")
    .select("id, user_id")
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle();
  if (fetchError) throw new Error(`글 조회 실패: ${fetchError.message}`);
  if (!post) throw new Error("글을 찾을 수 없어요.");
  if (post.user_id !== authData.user.id) {
    throw new Error("본인 글만 삭제할 수 있어요.");
  }

  const { error: updateError } = await admin
    .from("match_posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("user_id", authData.user.id);
  if (updateError) throw new Error(`글 삭제 실패: ${updateError.message}`);

  revalidatePath("/community");
  revalidatePath("/");
}

export type ToggleMatchPostLikeResult = { liked: boolean; count: number };

export async function toggleMatchPostLikeAction(postId: string): Promise<ToggleMatchPostLikeResult> {
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("로그인이 필요합니다.");
  }
  const me = authData.user.id;
  const admin = createSupabaseAdminClient();

  // 글 살아있는지 확인
  const { data: post } = await admin
    .from("match_posts")
    .select("id")
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!post) throw new Error("글을 찾을 수 없어요.");

  const { data: existing } = await admin
    .from("match_post_likes")
    .select("user_id")
    .eq("match_post_id", postId)
    .eq("user_id", me)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("match_post_likes")
      .delete()
      .eq("match_post_id", postId)
      .eq("user_id", me);
    if (error) throw new Error(`좋아요 취소 실패: ${error.message}`);
  } else {
    const { error } = await admin
      .from("match_post_likes")
      .insert({ match_post_id: postId, user_id: me });
    if (error) throw new Error(`좋아요 실패: ${error.message}`);
  }

  const { count, error: countError } = await admin
    .from("match_post_likes")
    .select("user_id", { count: "exact", head: true })
    .eq("match_post_id", postId);
  if (countError) throw new Error(`카운트 조회 실패: ${countError.message}`);

  revalidatePath("/community");

  return { liked: !existing, count: count ?? 0 };
}

export async function listMatchPostCommentsAction(postId: string): Promise<MatchPostComment[]> {
  return listMatchPostCommentsFromDb(postId);
}

export async function createMatchPostCommentAction(input: { postId: string; body: string }): Promise<{ id: string }> {
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("로그인이 필요합니다.");
  }

  const body = input.body.trim();
  if (body.length === 0) {
    throw new Error("댓글 내용을 입력해주세요.");
  }
  if (body.length > 500) {
    throw new Error("댓글은 500자 이내로 작성해주세요.");
  }

  const admin = createSupabaseAdminClient();

  // 살아있는 글에만 댓글 가능
  const { data: post } = await admin
    .from("match_posts")
    .select("id")
    .eq("id", input.postId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!post) throw new Error("글을 찾을 수 없어요.");

  const { data: inserted, error } = await admin
    .from("match_post_comments")
    .insert({
      match_post_id: input.postId,
      user_id: authData.user.id,
      body
    })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(`댓글 저장 실패: ${error?.message ?? "unknown"}`);
  }

  revalidatePath("/community");

  return { id: inserted.id };
}

export async function deleteMatchPostCommentAction(commentId: string): Promise<void> {
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("로그인이 필요합니다.");
  }

  const admin = createSupabaseAdminClient();

  // 본인 댓글 또는 글 작성자
  const { data: comment, error: fetchError } = await admin
    .from("match_post_comments")
    .select("id, user_id, match_post_id")
    .eq("id", commentId)
    .maybeSingle();
  if (fetchError) throw new Error(`댓글 조회 실패: ${fetchError.message}`);
  if (!comment) throw new Error("댓글을 찾을 수 없어요.");

  let canDelete = comment.user_id === authData.user.id;
  if (!canDelete) {
    const { data: post } = await admin
      .from("match_posts")
      .select("user_id")
      .eq("id", comment.match_post_id)
      .maybeSingle();
    canDelete = post?.user_id === authData.user.id;
  }
  if (!canDelete) {
    throw new Error("본인 댓글이거나 본인 글의 댓글만 삭제할 수 있어요.");
  }

  const { error: deleteError } = await admin
    .from("match_post_comments")
    .delete()
    .eq("id", commentId);
  if (deleteError) throw new Error(`댓글 삭제 실패: ${deleteError.message}`);

  revalidatePath("/community");
}
