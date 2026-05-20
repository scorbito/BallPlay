"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { CommentThread } from "@/components/common/CommentThread";
import { MatchPostCard } from "@/components/domain/MatchPostCard";
import { ProfileModal, useProfileModal } from "@/components/domain/modals/ProfileModal";
import {
  createMatchPostCommentAction,
  deleteMatchPostCommentAction,
  toggleMatchPostLikeAction
} from "@/lib/actions/matchTalk";
import { useAppState } from "@/lib/state/AppState";
import type { MatchPost, MatchPostComment } from "@/lib/types/domain";

type MatchPostDetailScreenProps = {
  post: MatchPost;
  initialComments: MatchPostComment[];
  currentUserId: string | null;
};

export function MatchPostDetailScreen({ post: initialPost, initialComments, currentUserId }: MatchPostDetailScreenProps) {
  const { profile, showToast } = useAppState();
  const router = useRouter();
  const profileModal = useProfileModal();
  const [post, setPost] = useState<MatchPost>(initialPost);
  const [comments, setComments] = useState<MatchPostComment[]>(initialComments);

  const isPostOwner = Boolean(currentUserId && post.userId === currentUserId);

  const handleToggleLike = async () => {
    if (!currentUserId) {
      showToast("로그인 후 좋아요를 누를 수 있어요.");
      return;
    }
    // 낙관 업데이트
    setPost((current) => ({
      ...current,
      likedByMe: !current.likedByMe,
      likeCount: current.likedByMe ? current.likeCount - 1 : current.likeCount + 1
    }));
    try {
      const result = await toggleMatchPostLikeAction(post.id);
      setPost((current) => ({ ...current, likedByMe: result.liked, likeCount: result.count }));
    } catch (err) {
      // 롤백
      setPost((current) => ({
        ...current,
        likedByMe: !current.likedByMe,
        likeCount: current.likedByMe ? current.likeCount - 1 : current.likeCount + 1
      }));
      showToast(err instanceof Error ? err.message : "좋아요 실패");
    }
  };

  const handleCommentSubmit = async (body: string) => {
    if (!currentUserId) {
      showToast("로그인이 필요합니다.");
      throw new Error("not signed in");
    }
    try {
      const result = await createMatchPostCommentAction({ postId: post.id, body });
      setComments((current) => [
        ...current,
        {
          id: result.id,
          matchPostId: post.id,
          userId: currentUserId,
          authorNickname: profile.nickname || "나",
          authorTeamId: profile.mainTeamId,
          authorAvatarUrl: profile.avatarUrl ?? null,
          body,
          createdAt: new Date().toISOString(),
          timeAgo: "방금 전"
        }
      ]);
      setPost((current) => ({ ...current, commentCount: current.commentCount + 1 }));
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "댓글 등록 실패");
      throw err;
    }
  };

  const handleCommentDelete = async (commentId: string) => {
    try {
      await deleteMatchPostCommentAction(commentId);
      setComments((current) => current.filter((c) => c.id !== commentId));
      setPost((current) => ({ ...current, commentCount: Math.max(0, current.commentCount - 1) }));
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "댓글 삭제 실패");
      throw err;
    }
  };

  return (
    <AppShell activeTab="home" title="경기톡" theme="dark" backHref="/">
      <MatchPostCard
        post={post}
        currentUserId={currentUserId}
        onToggleLike={handleToggleLike}
        onAuthorClick={profileModal.openProfile}
      />

      <div style={{ padding: "0 16px" }}>
        <CommentThread
          comments={comments.map((c) => ({
            id: c.id,
            userId: c.userId,
            authorNickname: c.authorNickname,
            authorAvatarUrl: c.authorAvatarUrl,
            body: c.body,
            timeAgo: c.timeAgo
          }))}
          currentUserId={currentUserId}
          canDeleteAsOwner={isPostOwner}
          onSubmit={handleCommentSubmit}
          onDelete={handleCommentDelete}
          onAuthorClick={profileModal.openProfile}
        />
      </div>
      <ProfileModal {...profileModal.modalProps} />
    </AppShell>
  );
}
