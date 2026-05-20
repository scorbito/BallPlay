"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { Button } from "@/components/common/Button";
import { CommentThread } from "@/components/common/CommentThread";
import { ModalShell } from "@/components/common/ModalShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import {
  createMatchPostCommentAction,
  deleteMatchPostAction,
  deleteMatchPostCommentAction,
  listMatchPostCommentsAction
} from "@/lib/actions/matchTalk";
import { getTeam } from "@/lib/constants/teams";
import { useAppState } from "@/lib/state/AppState";
import type { MatchPost, MatchPostComment, MatchPostStatusSnapshot } from "@/lib/types/domain";
import { MATCH_POST_EMOTION_META } from "@/lib/constants/matchPostEmotion";

const STATUS_ORDER: MatchPostStatusSnapshot[] = ["finished", "in_progress", "scheduled"];
const STATUS_PRIORITY: Record<MatchPostStatusSnapshot, number> = {
  finished: 3,
  in_progress: 2,
  scheduled: 1
};

type TimelineMode = "date" | "game";

type MatchTalkTimelineProps = {
  posts: MatchPost[];
  currentUserId: string | null;
  mode: TimelineMode;
  onToggleLike: (postId: string) => void;
  onDeleted: (postId: string) => void;
  /** 작성자 탭 시 프로필 모달 열기 핸들러 */
  onAuthorClick?: (userId: string) => void;
};

type GameGroup = {
  key: string;
  label: string;
  posts: MatchPost[];
};

type StatusGroup = {
  status: MatchPostStatusSnapshot;
  label: string;
  posts: MatchPost[];
};

export function MatchTalkTimeline({
  posts,
  currentUserId,
  mode,
  onToggleLike,
  onDeleted,
  onAuthorClick
}: MatchTalkTimelineProps) {
  const gameGroups = useMemo(() => groupByGame(posts, mode), [posts, mode]);

  return (
    <div className="match-talk-timeline" aria-label="경기톡 타임라인">
      {gameGroups.map((gameGroup) => (
        <section className="match-talk-timeline-game" key={gameGroup.key}>
          {mode === "date" ? <h3 className="match-talk-timeline-game-title">{gameGroup.label}</h3> : null}
          {(() => {
            const statusGroups = groupByStatus(gameGroup.posts);
            return statusGroups.map((statusGroup, gIdx) => {
              const prev = statusGroups[gIdx - 1];
              const showFinishedMarker =
                prev?.status === "finished" && statusGroup.status === "in_progress";
              return (
                <section className="match-talk-timeline-section" key={`${gameGroup.key}-${statusGroup.status}`}>
                  {showFinishedMarker ? (
                    <h4 className="match-talk-timeline-status match-talk-timeline-status-marker">경기 종료</h4>
                  ) : null}
                  {statusGroup.status === "in_progress" ? (
                    splitByScore(statusGroup.posts).map((scoreGroup, idx) => (
                      <div key={`${gameGroup.key}-in-progress-${idx}`}>
                        <h4 className="match-talk-timeline-status">{scoreGroup.label}</h4>
                        <div className="match-talk-timeline-items">
                          {scoreGroup.posts.map((post) => (
                            <MatchTalkTimelineItem
                              key={post.id}
                              post={post}
                              currentUserId={currentUserId}
                              onToggleLike={() => onToggleLike(post.id)}
                              onDeleted={onDeleted}
                              onAuthorClick={onAuthorClick}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      <h4 className="match-talk-timeline-status">{statusGroup.label}</h4>
                      {statusGroup.posts.length > 0 ? (
                        <div className="match-talk-timeline-items">
                          {statusGroup.posts.map((post) => (
                            <MatchTalkTimelineItem
                              key={post.id}
                              post={post}
                              currentUserId={currentUserId}
                              onToggleLike={() => onToggleLike(post.id)}
                              onDeleted={onDeleted}
                              onAuthorClick={onAuthorClick}
                            />
                          ))}
                        </div>
                      ) : null}
                    </>
                  )}
                </section>
              );
            });
          })()}
        </section>
      ))}
    </div>
  );
}

function groupByGame(posts: MatchPost[], mode: TimelineMode): GameGroup[] {
  if (mode === "game") {
    return [{ key: "selected-game", label: "", posts }];
  }

  const map = new Map<string, MatchPost[]>();
  for (const post of posts) {
    const key = post.gameId || "unknown";
    map.set(key, [...(map.get(key) ?? []), post]);
  }

  return Array.from(map.entries())
    .map(([key, list]) => ({
      key,
      label: formatGameTitle(list[0]),
      posts: list
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
}

function groupByStatus(posts: MatchPost[]) {
  const referencePost = posts[0];
  const currentStatus = referencePost?.game.currentStatus;
  const groups = STATUS_ORDER.map((status) => {
    const list = posts
      .filter((post) => post.statusAtPost === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (list.length === 0) return null;
    return {
      status,
      label: formatStatusLabel(status, list[0]),
      posts: list
    };
  }).filter(Boolean) as StatusGroup[];

  if (referencePost && currentStatus !== "scheduled" && currentStatus !== "canceled") {
    const hasCurrentMarker = groups.some((group) => group.status === currentStatus);
    if (!hasCurrentMarker) {
      groups.push({
        status: currentStatus,
        label: formatStatusMarkerLabel(currentStatus),
        posts: []
      });
    }
  }

  return groups.sort((a, b) => STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status]);
}

/**
 * in_progress 글들을 동일 점수 스냅샷 연속 구간으로 분할.
 * 글은 createdAt desc(최신 먼저)로 정렬돼 들어오므로,
 * 위에서 아래로 갈수록 시간이 거꾸로 흐른다 — 점수가 바뀌면 새 라벨을 출력해
 * 각 회차/점수의 마커를 글 사이에 보이게 한다.
 */
function splitByScore(posts: MatchPost[]): { label: string; posts: MatchPost[] }[] {
  const result: { label: string; posts: MatchPost[] }[] = [];
  let currentKey: string | null = null;
  for (const post of posts) {
    const key = `${post.inningAtPost ?? "-"}|${post.scoreAwayAtPost ?? "-"}:${post.scoreHomeAtPost ?? "-"}`;
    if (key !== currentKey) {
      result.push({ label: formatStatusLabel("in_progress", post), posts: [post] });
      currentKey = key;
    } else {
      result[result.length - 1].posts.push(post);
    }
  }
  return result;
}

function formatGameTitle(post?: MatchPost) {
  if (!post) return "경기 정보 없음";
  const away = post.game.awayTeamId ? getTeam(post.game.awayTeamId).shortName : post.game.awayTeamId;
  const home = post.game.homeTeamId ? getTeam(post.game.homeTeamId).shortName : post.game.homeTeamId;
  const stadium = post.game.stadium ? ` · ${post.game.stadium}` : "";
  return `${away} vs ${home}${stadium}`;
}

function formatStatusLabel(status: MatchPostStatusSnapshot, post: MatchPost) {
  const away = post.game.awayTeamId ? getTeam(post.game.awayTeamId).shortName : post.game.awayTeamId;
  const home = post.game.homeTeamId ? getTeam(post.game.homeTeamId).shortName : post.game.homeTeamId;
  if (status === "scheduled") return "경기 전";

  const awayScore = post.scoreAwayAtPost ?? "-";
  const homeScore = post.scoreHomeAtPost ?? "-";
  const prefix = status === "finished" ? "최종" : "진행 중";
  const inning =
    status === "in_progress" && post.inningAtPost ? `${post.inningAtPost}회 ` : "";
  return `${inning}${prefix} · ${away} ${awayScore} : ${homeScore} ${home}`;
}

function formatStatusMarkerLabel(status: MatchPostStatusSnapshot) {
  if (status === "finished") return "최종";
  if (status === "in_progress") return "진행 중";
  return "경기 전";
}

type MatchTalkTimelineItemProps = {
  post: MatchPost;
  currentUserId: string | null;
  onToggleLike: () => void;
  onDeleted: (postId: string) => void;
  onAuthorClick?: (userId: string) => void;
};

function MatchTalkTimelineItem({ post, currentUserId, onToggleLike, onDeleted, onAuthorClick }: MatchTalkTimelineItemProps) {
  const { profile, showToast } = useAppState();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<MatchPostComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [loadingComments, setLoadingComments] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  const isOwner = Boolean(currentUserId && post.userId === currentUserId);
  const emotion = MATCH_POST_EMOTION_META[post.emotionTag];

  const handleToggleComments = async () => {
    if (commentsOpen) {
      setCommentsOpen(false);
      return;
    }

    setCommentsOpen(true);
    if (commentsLoaded) return;

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
      showToast(err instanceof Error ? err.message : "댓글 등록에 실패했어요.");
      throw err;
    }
  };

  const handleCommentDelete = async (commentId: string) => {
    try {
      await deleteMatchPostCommentAction(commentId);
      setComments((current) => current.filter((c) => c.id !== commentId));
      setCommentCount((n) => Math.max(0, n - 1));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "댓글 삭제에 실패했어요.");
      throw err;
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteMatchPostAction(post.id);
      setConfirmOpen(false);
      showToast("삭제했어요.");
      onDeleted(post.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "삭제에 실패했어요.");
      setDeleting(false);
    }
  };

  return (
    <article className="match-talk-timeline-item">
      <span className="match-talk-timeline-dot" aria-hidden="true" />
      <div className="match-talk-timeline-card">
        <header className="match-talk-timeline-item-header">
          {(() => {
            const avatar = post.authorAvatarUrl ? (
              <span className="match-talk-timeline-avatar">
                <Image alt="" src={post.authorAvatarUrl} fill sizes="30px" style={{ objectFit: "cover" }} />
              </span>
            ) : (
              <span className="match-talk-timeline-avatar match-talk-timeline-avatar-initial">
                {(post.authorNickname || "?").slice(0, 1)}
              </span>
            );
            const meta = (
              <div>
                <div className="match-talk-timeline-name-row">
                  <strong>{post.authorNickname}</strong>
                </div>
                <span>{post.timeAgo}</span>
              </div>
            );
            if (onAuthorClick && post.userId) {
              return (
                <button
                  type="button"
                  className="match-talk-timeline-author profile-author-trigger"
                  aria-label={`${post.authorNickname}님의 프로필 보기`}
                  onClick={() => onAuthorClick(post.userId)}
                >
                  {avatar}
                  {meta}
                </button>
              );
            }
            return (
              <div className="match-talk-timeline-author">
                {avatar}
                {meta}
              </div>
            );
          })()}
          <div className="match-talk-timeline-meta">
            {post.authorTeamId ? <TeamBadge teamId={post.authorTeamId} size="sm" /> : null}
            {isOwner ? (
              <button
                type="button"
                className="match-talk-timeline-delete"
                aria-label="경기톡 삭제"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 size={14} />
              </button>
            ) : null}
          </div>
        </header>

        <p className="match-talk-timeline-body">{post.body}</p>
        {post.photoUrl ? (
          <button
            type="button"
            className="match-talk-timeline-photo-thumb"
            onClick={() => setPhotoOpen(true)}
            aria-label="사진 크게 보기"
          >
            <Image
              src={post.photoUrl}
              alt=""
              width={160}
              height={120}
              sizes="160px"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </button>
        ) : null}

        <div className="match-talk-timeline-actions">
          <span
            className="match-talk-timeline-emotion"
            title={emotion.label}
            aria-label={`감정 태그: ${emotion.label}`}
          >
            {emotion.emoji}
          </span>
          <div className="match-talk-timeline-reactions">
            <button
              type="button"
              onClick={onToggleLike}
              className={post.likedByMe ? "match-talk-timeline-action active" : "match-talk-timeline-action"}
              aria-pressed={post.likedByMe}
            >
              <Heart fill={post.likedByMe ? "currentColor" : "none"} size={18} />
              <span>{post.likeCount}</span>
            </button>
            <button
              type="button"
              onClick={handleToggleComments}
              className={commentsOpen ? "match-talk-timeline-action active" : "match-talk-timeline-action"}
              aria-expanded={commentsOpen}
            >
              <MessageCircle size={18} fill={commentsOpen ? "currentColor" : "none"} />
              <span>{commentCount}</span>
            </button>
          </div>
        </div>

        {commentsOpen ? (
          <div className="match-post-comments-region">
            {loadingComments ? (
              <p className="match-post-comments-loading">댓글을 불러오는 중...</p>
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
      </div>

      <ModalShell
        open={confirmOpen}
        title="경기톡 삭제"
        onClose={() => !deleting && setConfirmOpen(false)}
        backdropClassName="match-talk-timeline-confirm-backdrop"
        panelClassName="dark-confirm-panel match-talk-timeline-confirm-panel"
      >
        <div className="confirm-stack">
          <p>이 글을 삭제할까요?</p>
          <span className="confirm-hint">삭제 후에는 되돌릴 수 없어요.</span>
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

      {post.photoUrl ? (
        <Lightbox
          open={photoOpen}
          close={() => setPhotoOpen(false)}
          slides={[{ src: post.photoUrl }]}
          plugins={[Zoom]}
          zoom={{ maxZoomPixelRatio: 4, scrollToZoom: true, doubleTapDelay: 300, doubleClickDelay: 300 }}
          carousel={{ finite: true }}
          animation={{ fade: 200 }}
          controller={{ closeOnBackdropClick: true }}
        />
      ) : null}
    </article>
  );
}
