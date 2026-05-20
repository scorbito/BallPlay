"use client";

import { useState } from "react";
import Image from "next/image";
import { Heart, MessageCircle, MoreHorizontal, Trash2, Check } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { ModalShell } from "@/components/common/ModalShell";
import { Button } from "@/components/common/Button";
import { CommentThread } from "@/components/common/CommentThread";
import { getTeam } from "@/lib/constants/teams";
import {
  createMatchPostCommentAction,
  deleteMatchPostAction,
  deleteMatchPostCommentAction,
  listMatchPostCommentsAction
} from "@/lib/actions/matchTalk";
import { useAppState } from "@/lib/state/AppState";
import type { MatchPost, MatchPostComment } from "@/lib/types/domain";
import { useRouter } from "next/navigation";
import { MATCH_POST_EMOTION_META } from "@/lib/constants/matchPostEmotion";

type MatchPostCardProps = {
  post: MatchPost;
  currentUserId: string | null;
  onToggleLike: () => void;
  onClickGameFilter?: () => void;
  /** 삭제 성공 후 호출. 부모(목록)가 feed state에서 해당 글을 제거할 때 사용. */
  onDeleted?: (postId: string) => void;
  /** 작성자 아바타/닉네임 탭 시 프로필 모달 열기 핸들러. 없으면 클릭 비활성. */
  onAuthorClick?: (userId: string) => void;
};

export function MatchPostCard({ post, currentUserId, onToggleLike, onClickGameFilter, onDeleted, onAuthorClick }: MatchPostCardProps) {
  const { profile, showToast } = useAppState();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 댓글 펼치기/접기 (목록 안에서 토글)
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<MatchPostComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [loadingComments, setLoadingComments] = useState(false);

  const handleToggleComments = async () => {
    // 펼쳐져 있으면 접기
    if (commentsOpen) {
      setCommentsOpen(false);
      return;
    }
    setCommentsOpen(true);
    // 처음 펼칠 때만 fetch
    if (!commentsLoaded) {
      setLoadingComments(true);
      try {
        const list = await listMatchPostCommentsAction(post.id);
        setComments(list);
        setCommentsLoaded(true);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "댓글을 불러오지 못했어요.");
      } finally {
        setLoadingComments(false);
      }
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
      setCommentCount((n) => n + 1);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "댓글 등록 실패");
      throw err;
    }
  };

  const handleCommentDelete = async (commentId: string) => {
    try {
      await deleteMatchPostCommentAction(commentId);
      setComments((current) => current.filter((c) => c.id !== commentId));
      setCommentCount((n) => Math.max(0, n - 1));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "댓글 삭제 실패");
      throw err;
    }
  };

  const isOwner = Boolean(currentUserId && post.userId === currentUserId);
  const emotion = MATCH_POST_EMOTION_META[post.emotionTag];

  const homeTeam = post.game.homeTeamId ? getTeam(post.game.homeTeamId) : null;
  const awayTeam = post.game.awayTeamId ? getTeam(post.game.awayTeamId) : null;

  // 경기 날짜를 M/D로 축약 (예: "2026-05-13" → "5/13")
  const dateLabel = (() => {
    const raw = post.game.date;
    if (!raw) return "";
    const [, m, d] = raw.split("-");
    if (!m || !d) return raw;
    return `${Number(m)}/${Number(d)}`;
  })();

  const scoreLabel = (() => {
    const prefix = dateLabel ? `${dateLabel} · ` : "";
    const home = homeTeam?.shortName ?? post.game.homeTeamId;
    const away = awayTeam?.shortName ?? post.game.awayTeamId;
    if (post.statusAtPost === "scheduled") {
      return `${prefix}${away} vs ${home} · 경기 전`;
    }
    const h = post.scoreHomeAtPost ?? "-";
    const a = post.scoreAwayAtPost ?? "-";
    const inningWord =
      post.statusAtPost === "in_progress" && post.inningAtPost
        ? `${post.inningAtPost}회 `
        : "";
    const statusSuffix =
      post.statusAtPost === "in_progress" ? ` · ${inningWord}진행 중`
      : post.statusAtPost === "finished" ? " (최종)"
      : "";
    return `${prefix}${away} ${a} : ${h} ${home}${statusSuffix}`;
  })();

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteMatchPostAction(post.id);
      setConfirmOpen(false);
      showToast("삭제되었어요.");
      if (onDeleted) {
        // 부모 목록이 feed state에서 제거해주므로 router.refresh()는 불필요.
        onDeleted(post.id);
      } else {
        router.refresh();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "삭제 실패");
      setDeleting(false);
    }
  };

  return (
    <article className="match-post-card">
      <header className="match-post-header">
        {(() => {
          const avatar = post.authorAvatarUrl ? (
            <span className="match-post-avatar">
              <Image alt="" src={post.authorAvatarUrl} fill sizes="32px" style={{ objectFit: "cover" }} />
            </span>
          ) : (
            <span className="match-post-avatar match-post-avatar-initial">
              {(post.authorNickname || "?").slice(0, 1)}
            </span>
          );
          const meta = (
            <div className="match-post-author-meta">
              <div className="match-post-author-name">
                <strong>{post.authorNickname}</strong>
              </div>
              <span className="match-post-time">{post.timeAgo}</span>
            </div>
          );
          if (onAuthorClick && post.userId) {
            return (
              <button
                type="button"
                className="match-post-author profile-author-trigger"
                aria-label={`${post.authorNickname}님의 프로필 보기`}
                onClick={() => onAuthorClick(post.userId)}
              >
                {avatar}
                {meta}
              </button>
            );
          }
          return (
            <div className="match-post-author">
              {avatar}
              {meta}
            </div>
          );
        })()}

        <div className="match-post-header-right">
          {post.authorTeamId ? <TeamBadge teamId={post.authorTeamId} size="sm" /> : null}
          {isOwner ? (
            <div className="match-post-more">
              <button
                type="button"
                className="icon-button"
                aria-label="더보기"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <MoreHorizontal size={18} />
              </button>
              {menuOpen ? (
                <div className="match-post-more-menu" role="menu" onMouseLeave={() => setMenuOpen(false)}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmOpen(true);
                    }}
                  >
                    <Trash2 size={14} /> 삭제
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {onClickGameFilter ? (
        <button
          type="button"
          className="match-post-game-context"
          onClick={onClickGameFilter}
          aria-label="이 경기 글만 보기"
        >
          <span className="match-post-score">{scoreLabel}</span>
          {post.game.currentStatus === "canceled" ? (
            <span className="match-post-canceled-badge">경기 취소됨</span>
          ) : null}
          <span
            className="match-post-emotion-emoji"
            title={emotion.label}
            aria-label={`감정 태그: ${emotion.label}`}
          >
            {emotion.emoji}
          </span>
        </button>
      ) : (
        <div className="match-post-game-context match-post-game-context-static">
          <span className="match-post-score">{scoreLabel}</span>
          {post.game.currentStatus === "canceled" ? (
            <span className="match-post-canceled-badge">경기 취소됨</span>
          ) : null}
          <span
            className="match-post-emotion-emoji"
            title={emotion.label}
            aria-label={`감정 태그: ${emotion.label}`}
          >
            {emotion.emoji}
          </span>
        </div>
      )}

      <div className="match-post-link">
        <p className="match-post-body">{post.body}</p>

        {post.photoUrl ? (
          <div className="match-post-photo">
            <Image
              src={post.photoUrl}
              alt=""
              width={960}
              height={1280}
              sizes="(max-width: 480px) 100vw, 480px"
              style={{ width: "100%", height: "auto" }}
            />
          </div>
        ) : null}

      </div>

      <div className="match-post-actions">
        <button
          type="button"
          onClick={onToggleLike}
          className="match-post-action"
          style={post.likedByMe ? { color: "#ff6a2b" } : undefined}
          aria-pressed={post.likedByMe}
        >
          <Heart fill={post.likedByMe ? "currentColor" : "none"} size={18} />
          <span>{post.likeCount}</span>
        </button>
        <button
          type="button"
          onClick={handleToggleComments}
          className="match-post-action"
          aria-expanded={commentsOpen}
          aria-label={commentsOpen ? "댓글 접기" : "댓글 펼치기"}
          style={commentsOpen ? { color: "#ff6a2b" } : undefined}
        >
          <MessageCircle size={18} fill={commentsOpen ? "currentColor" : "none"} />
          <span>{commentCount}</span>
        </button>
      </div>

      {commentsOpen ? (
        <div className="match-post-comments-region">
          {loadingComments ? (
            <p className="match-post-comments-loading">댓글을 불러오는 중…</p>
          ) : (
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
              canDeleteAsOwner={isOwner}
              onSubmit={handleCommentSubmit}
              onDelete={handleCommentDelete}
              onAuthorClick={onAuthorClick}
            />
          )}
        </div>
      ) : null}

      <ModalShell
        open={confirmOpen}
        title="경기톡 삭제"
        onClose={() => !deleting && setConfirmOpen(false)}
        panelClassName="dark-confirm-panel"
      >
        <div className="confirm-stack">
          <p>이 글을 삭제할까요?</p>
          <span className="confirm-hint">삭제 후엔 되돌릴 수 없어요.</span>
          <div className="confirm-actions">
            <button
              type="button"
              className="confirm-cancel"
              disabled={deleting}
              onClick={() => setConfirmOpen(false)}
            >
              취소
            </button>
            <Button disabled={deleting} onClick={confirmDelete}>
              {deleting ? "삭제 중" : "삭제하기"}
            </Button>
          </div>
        </div>
      </ModalShell>
    </article>
  );
}
