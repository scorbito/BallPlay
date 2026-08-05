"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutList, PenLine, Rows3 } from "lucide-react";
import { MatchPostCard } from "@/components/domain/MatchPostCard";
import { MatchTalkTimeline } from "@/components/domain/MatchTalkTimeline";
import { MatchTalkComposerModal } from "@/components/domain/modals/MatchTalkComposerModal";
import { FreePostComposerModal } from "@/components/domain/modals/FreePostComposerModal";
import { ProfileModal, useProfileModal } from "@/components/domain/modals/ProfileModal";
import {
  getGameContextAction,
  getMatchPostByIdAction,
  listMatchPostsAction,
  loadMoreMatchPostsAction,
  toggleMatchPostLikeAction,
  type GameContextInfo
} from "@/lib/actions/matchTalk";
import { getTeam } from "@/lib/constants/teams";
import { useAppState } from "@/lib/state/AppState";
import type { CommunityPostType, MatchPost } from "@/lib/types/domain";
import { getThisWeekRangeKst } from "@/lib/utils/matchTalkWeek";

const PAGE_SIZE = 20;

type MatchTalkFeedProps = {
  initialPosts: MatchPost[];
  currentUserId: string | null;
  initialGameId?: string;
  initialDate?: string;
  postType?: CommunityPostType;
};

type MatchTalkViewMode = "card" | "timeline";

export function MatchTalkFeed({
  initialPosts,
  currentUserId,
  initialGameId,
  initialDate,
  postType = "match_talk"
}: MatchTalkFeedProps) {
  const { showToast } = useAppState();
  const isMatchTalk = postType === "match_talk";
  const profileModal = useProfileModal();
  const [feed, setFeed] = useState<MatchPost[]>(initialPosts);
  const [hasMore, setHasMore] = useState(initialPosts.length === PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [gameFilter, setGameFilter] = useState<string | undefined>(initialGameId);
  const [dateFilter, setDateFilter] = useState<string | undefined>(initialGameId ? undefined : initialDate);
  const [viewMode, setViewMode] = useState<MatchTalkViewMode>(initialGameId || initialDate ? "timeline" : "card");
  const [composerOpen, setComposerOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const skipFirstFilterFetchRef = useRef(true);

  const activeFilters = useMemo(
    () => ({ postType, gameId: gameFilter, date: gameFilter ? undefined : dateFilter }),
    [postType, gameFilter, dateFilter]
  );
  const isFiltered = Boolean(activeFilters.gameId || activeFilters.date);

  const contextFromFeed = useMemo(() => {
    if (!gameFilter) return null;
    return feed.find((p) => p.gameId === gameFilter)?.game ?? null;
  }, [feed, gameFilter]);

  const [fallbackContext, setFallbackContext] = useState<GameContextInfo | null>(null);
  useEffect(() => {
    if (!gameFilter || contextFromFeed) {
      setFallbackContext(null);
      return;
    }

    let cancelled = false;
    getGameContextAction(gameFilter)
      .then((info) => {
        if (!cancelled) setFallbackContext(info);
      })
      .catch(() => {
        if (!cancelled) setFallbackContext(null);
      });

    return () => {
      cancelled = true;
    };
  }, [gameFilter, contextFromFeed]);

  const selectedGameContext = useMemo(() => {
    if (contextFromFeed) return contextFromFeed;
    if (!fallbackContext) return null;
    return {
      date: fallbackContext.date,
      homeTeamId: fallbackContext.homeTeamId,
      awayTeamId: fallbackContext.awayTeamId,
      stadium: fallbackContext.stadium,
      currentStatus: fallbackContext.status
    };
  }, [contextFromFeed, fallbackContext]);

  const filteredGameDate = contextFromFeed?.date ?? fallbackContext?.date ?? null;
  const isFilteredGameWritable = useMemo(() => {
    if (!filteredGameDate) return true;
    const { from, to } = getThisWeekRangeKst();
    return filteredGameDate >= from && filteredGameDate <= to;
  }, [filteredGameDate]);

  useEffect(() => {
    if (skipFirstFilterFetchRef.current) {
      skipFirstFilterFetchRef.current = false;
      return;
    }

    let cancelled = false;
    listMatchPostsAction({ limit: PAGE_SIZE, ...activeFilters })
      .then((list) => {
        if (cancelled) return;
        setFeed(list);
        setHasMore(list.length === PAGE_SIZE);
      })
      .catch(() => {
        if (!cancelled) showToast("경기톡을 불러오지 못했어요.");
      });

    return () => {
      cancelled = true;
    };
  }, [activeFilters, showToast]);

  useEffect(() => {
    if (!hasMore || loadingMore) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting) return;
      const last = feed[feed.length - 1];
      if (!last?.createdAt) {
        setHasMore(false);
        return;
      }

      setLoadingMore(true);
      loadMoreMatchPostsAction(last.createdAt, PAGE_SIZE, activeFilters)
        .then((more) => {
          setFeed((current) => {
            const seen = new Set(current.map((p) => p.id));
            return [...current, ...more.filter((p) => !seen.has(p.id))];
          });
          if (more.length < PAGE_SIZE) setHasMore(false);
        })
        .catch(() => setHasMore(false))
        .finally(() => setLoadingMore(false));
    }, { rootMargin: "200px 0px" });

    observer.observe(node);
    return () => observer.disconnect();
  }, [activeFilters, feed, hasMore, loadingMore]);

  const clearFilters = () => {
    setGameFilter(undefined);
    setDateFilter(undefined);
    setViewMode("card");
  };

  const handleGameFilter = (gameId: string) => {
    setGameFilter(gameId);
    setDateFilter(undefined);
    setViewMode("timeline");
  };

  const handleToggleLike = async (postId: string) => {
    if (!currentUserId) {
      showToast("로그인 후 좋아요를 누를 수 있어요.");
      return;
    }

    setFeed((current) =>
      current.map((p) =>
        p.id === postId
          ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likedByMe ? p.likeCount - 1 : p.likeCount + 1 }
          : p
      )
    );

    try {
      const result = await toggleMatchPostLikeAction(postId);
      setFeed((current) =>
        current.map((p) => (p.id === postId ? { ...p, likedByMe: result.liked, likeCount: result.count } : p))
      );
    } catch (err) {
      setFeed((current) =>
        current.map((p) =>
          p.id === postId
            ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likedByMe ? p.likeCount - 1 : p.likeCount + 1 }
            : p
        )
      );
      showToast(err instanceof Error ? err.message : "좋아요 처리에 실패했어요.");
    }
  };

  const handlePostCreated = async (newPostId: string) => {
    try {
      const fresh = await getMatchPostByIdAction(newPostId);
      if (!fresh || fresh.postType !== postType) return;
      if (gameFilter && fresh.gameId !== gameFilter) return;
      if (dateFilter && fresh.game.date !== dateFilter) return;

      setFeed((current) => {
        if (current.some((p) => p.id === fresh.id)) return current;
        return [fresh, ...current];
      });
    } catch {
      showToast("작성한 경기톡을 다시 불러오지 못했어요.");
    }
  };

  const handlePostDeleted = (postId: string) => {
    setFeed((current) => current.filter((p) => p.id !== postId));
  };

  const handleWriteClick = () => {
    if (!currentUserId) {
      showToast("로그인 후 글을 작성할 수 있어요.");
      return;
    }
    setComposerOpen(true);
  };

  const emptyMessage = (() => {
    if (!isMatchTalk) return "아직 자유글이 없어요. 첫 글을 남겨보세요.";
    if (gameFilter) {
      return isFilteredGameWritable
        ? "이 경기의 글이 아직 없어요. 첫 글을 남겨보세요."
        : "지난 경기에는 글을 받을 수 없어요. 글 작성은 이번 주 경기만 가능해요.";
    }
    if (dateFilter) return "이 날짜의 경기톡이 아직 없어요.";
    return "아직 경기톡이 없어요. 첫 글을 남겨보세요.";
  })();

  return (
    <>
      <div className="community-head match-talk-head">
        <div className="filter-chips match-talk-filter-controls">
          {isFiltered ? (
            <>
              <button type="button" className="chip" onClick={clearFilters}>
                필터 해제
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => setViewMode(viewMode === "timeline" ? "card" : "timeline")}
              >
                {viewMode === "timeline" ? <LayoutList size={15} /> : <Rows3 size={15} />}
                {viewMode === "timeline" ? "카드로 보기" : "타임라인 보기"}
              </button>
            </>
          ) : (
            <div className="match-talk-intro">
              {isMatchTalk ? <><p className="match-talk-intro-title">경기 흐름에 맞춰 자유롭게 이야기해요.</p><p className="match-talk-filter-hint">날짜나 경기를 선택하면 타임라인으로도 볼 수 있어요.</p></> : <><p className="match-talk-intro-title">야구 이야기, 질문, 응원을 자유롭게 나눠보세요.</p><p className="match-talk-filter-hint">자유글은 제목과 내용으로 작성할 수 있어요.</p></>}
            </div>
          )}
        </div>
        <button className="community-write-button" type="button" onClick={handleWriteClick}>
          <PenLine size={16} />
          글쓰기
        </button>
      </div>

      {dateFilter && !gameFilter ? (
        <div className="match-talk-context-header">
          <strong>{dateFilter}</strong>
          <span> · 날짜 필터</span>
        </div>
      ) : null}

      {selectedGameContext ? (() => {
        const homeName = selectedGameContext.homeTeamId
          ? getTeam(selectedGameContext.homeTeamId).shortName
          : selectedGameContext.homeTeamId;
        const awayName = selectedGameContext.awayTeamId
          ? getTeam(selectedGameContext.awayTeamId).shortName
          : selectedGameContext.awayTeamId;
        return (
          <div className="match-talk-context-header">
            <strong>{selectedGameContext.date}</strong>
            <span> · </span>
            <span>{selectedGameContext.stadium || "구장 미정"}</span>
            <span> · </span>
            <span>{awayName} vs {homeName}</span>
          </div>
        );
      })() : null}

      <div className="review-feed">
        {viewMode === "timeline" && isFiltered ? (
          <MatchTalkTimeline
            posts={feed}
            currentUserId={currentUserId}
            mode={gameFilter ? "game" : "date"}
            onToggleLike={handleToggleLike}
            onDeleted={handlePostDeleted}
            onAuthorClick={profileModal.openProfile}
          />
        ) : (
          feed.map((post) => (
            <MatchPostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              onToggleLike={() => handleToggleLike(post.id)}
              onClickGameFilter={isMatchTalk && post.gameId ? () => handleGameFilter(post.gameId!) : undefined}
              onDeleted={handlePostDeleted}
              onAuthorClick={profileModal.openProfile}
            />
          ))
        )}

        {feed.length === 0 ? <p className="empty-inline">{emptyMessage}</p> : null}
        {hasMore ? (
          <div ref={sentinelRef} className="feed-sentinel" aria-hidden="true">
            {loadingMore ? <span className="feed-loading">불러오는 중...</span> : null}
          </div>
        ) : null}
      </div>

      {isMatchTalk ? <MatchTalkComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={handlePostCreated}
        initialGameId={gameFilter}
      /> : <FreePostComposerModal open={composerOpen} onClose={() => setComposerOpen(false)} onCreated={handlePostCreated} />}
      <ProfileModal {...profileModal.modalProps} />
    </>
  );
}
