"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Bot, Camera, ExternalLink, Film, MessageSquareText, Play, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ModalShell } from "@/components/common/ModalShell";
import { VideoPlayerModal } from "@/components/domain/videos/VideoPlayerModal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createVideo,
  deleteVideo,
  listVideos,
  type BpVideoWithOwnerRow
} from "@/lib/supabase/query-parts/bpVideos";
import { parseVideoUrl, type ParsedVideo, type VideoPlatform } from "@/lib/utils/videoUrl";
import { trackEvent } from "@/lib/analytics/events";

const PLATFORM_ICON: Record<VideoPlatform, typeof Film> = {
  youtube: Film,
  instagram: Camera,
  threads: MessageSquareText,
  other: ExternalLink
};

type VideoRow =
  | { kind: "shorts"; items: Array<{ video: BpVideoWithOwnerRow; parsed: ParsedVideo }> }
  | { kind: "horizontal"; item: { video: BpVideoWithOwnerRow; parsed: ParsedVideo } };

const SHORTS_PER_ROW_MOBILE = 3;

function renderCard(
  video: BpVideoWithOwnerRow,
  parsed: ParsedVideo,
  onOpen: (v: BpVideoWithOwnerRow) => void
) {
  const Icon = PLATFORM_ICON[parsed.platform];
  const author = video.is_auto_curated ? "놀이터봇" : (video.owner_nickname?.trim() || "익명");

  return (
    <button
      key={video.id}
      type="button"
      className={`videos-card videos-card-${parsed.orientation}`}
      onClick={() => onOpen(video)}
    >
      <div className="videos-card-thumb">
        {parsed.thumbnailUrl ? (
          <Image
            src={parsed.thumbnailUrl}
            alt=""
            fill
            sizes="(min-width: 1025px) 220px, 33vw"
            style={{ objectFit: "cover" }}
            unoptimized
          />
        ) : (
          <div className="videos-card-thumb-fallback">
            <Icon size={28} />
          </div>
        )}
        <span className="videos-card-platform">
          <Icon size={10} />
        </span>
        {video.is_auto_curated ? (
          <span className="videos-card-bot" title="놀이터봇이 자동 등록한 영상">
            <Bot size={11} />
          </span>
        ) : null}
        {parsed.platform === "youtube" ? (
          <span className="videos-card-play">
            <Play size={16} fill="currentColor" />
          </span>
        ) : null}
        <div className="videos-card-overlay">
          <span className="videos-card-author">@{author}</span>
        </div>
      </div>
    </button>
  );
}

function groupIntoRows(videos: BpVideoWithOwnerRow[]): VideoRow[] {
  const rows: VideoRow[] = [];
  let shortsBuf: Array<{ video: BpVideoWithOwnerRow; parsed: ParsedVideo }> = [];
  const pendingHorizontals: Array<{ video: BpVideoWithOwnerRow; parsed: ParsedVideo }> = [];

  const flushShorts = () => {
    if (shortsBuf.length === 0) return;
    rows.push({ kind: "shorts", items: shortsBuf });
    shortsBuf = [];
  };

  const flushPendingHorizontals = () => {
    while (pendingHorizontals.length > 0) {
      const h = pendingHorizontals.shift()!;
      rows.push({ kind: "horizontal", item: h });
    }
  };

  for (const v of videos) {
    const parsed = parseVideoUrl(v.url);
    if (parsed.orientation === "vertical") {
      shortsBuf.push({ video: v, parsed });
      if (shortsBuf.length % SHORTS_PER_ROW_MOBILE === 0 && pendingHorizontals.length > 0) {
        flushShorts();
        flushPendingHorizontals();
      }
      continue;
    }

    if (shortsBuf.length % SHORTS_PER_ROW_MOBILE === 0) {
      flushShorts();
      rows.push({ kind: "horizontal", item: { video: v, parsed } });
    } else {
      pendingHorizontals.push({ video: v, parsed });
    }
  }

  flushShorts();
  flushPendingHorizontals();
  return rows;
}

// 첫 로드 및 "더보기" 1회 증가 단위. 링크라 오래된 영상도 계속 볼 수 있게 늘려간다.
const VIDEOS_PAGE = 60;

export function VideosScreen() {
  const [videos, setVideos] = useState<BpVideoWithOwnerRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [openVideo, setOpenVideo] = useState<BpVideoWithOwnerRow | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerUrl, setRegisterUrl] = useState("");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  // 더보기 — limit 을 늘리면 이전(오래된) 영상까지 노출. 링크라 DB엔 계속 남아 있음.
  const [limit, setLimit] = useState(VIDEOS_PAGE);
  const [hasMore, setHasMore] = useState(false);

  const flatVideos = useMemo(() => videos ?? [], [videos]);
  const currentIndex = openVideo ? flatVideos.findIndex((v) => v.id === openVideo.id) : -1;
  const openParsed = openVideo ? parseVideoUrl(openVideo.url) : null;
  const rows = useMemo(() => (videos ? groupIntoRows(videos) : []), [videos]);

  const navigate = useCallback(
    (delta: 1 | -1) => {
      if (currentIndex < 0 || flatVideos.length === 0) return;
      const len = flatVideos.length;
      const next = (currentIndex + delta + len) % len;
      setOpenVideo(flatVideos[next]);
    },
    [currentIndex, flatVideos]
  );

  useEffect(() => {
    if (!openVideo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        navigate(1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        navigate(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openVideo, navigate]);

  const loadVideos = useCallback(async () => {
    const client = createSupabaseBrowserClient();
    setLoading(true);
    setError(null);
    const res = await listVideos(client, limit);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setVideos(res.rows);
    // 요청한 limit 만큼 꽉 채워 왔으면 더 있을 가능성 → "더보기" 노출.
    setHasMore(res.rows.length >= limit);
    // 홈 펄스 뱃지용 — 페이지 진입 시점 기준으로 viewed 마킹.
    // 이후 추가된 영상의 created_at > 이 시각 ⇒ 다시 뱃지 표시.
    try {
      window.localStorage.setItem("ballplay:videos:lastViewedAt", new Date().toISOString());
    } catch {
      // ignore storage errors
    }
  }, [limit]);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    void (async () => {
      const { data } = await client.auth.getUser();
      const user = data.user;
      setUserId(user && !user.is_anonymous ? user.id : null);
      await loadVideos();
    })();
  }, [loadVideos]);

  const handleRegisterSubmit = async () => {
    if (registerSubmitting) return;
    if (!userId) {
      setRegisterError("로그인이 필요해요");
      return;
    }
    const url = registerUrl.trim();
    if (!url) {
      setRegisterError("URL을 입력해주세요");
      return;
    }

    setRegisterSubmitting(true);
    const client = createSupabaseBrowserClient();
    const res = await createVideo(client, { userId, url });
    setRegisterSubmitting(false);
    if (!res.ok) {
      setRegisterError(res.error);
      return;
    }

    const parsed = parseVideoUrl(url);
    void trackEvent("video_submitted", {
      platform: parsed.platform,
      orientation: parsed.orientation
    });
    setRegisterUrl("");
    setRegisterError(null);
    setRegisterOpen(false);
    await loadVideos();
  };

  const handleDelete = async (video: BpVideoWithOwnerRow) => {
    if (!userId || video.owner_user_id !== userId) return;
    if (!confirm("이 영상을 삭제할까요?")) return;
    const client = createSupabaseBrowserClient();
    const res = await deleteVideo(client, video.id);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await loadVideos();
  };

  return (
    <AppShell
      activeTab="home"
      title="재밌는 야구 영상"
      theme="light"
      backHref="/"
      wide
      headerAction={
        <button
          type="button"
          className="videos-register-btn videos-register-btn-header"
          onClick={() => setRegisterOpen(true)}
        >
          <Plus size={14} />
          등록
        </button>
      }
    >
      <p className="videos-intro">
        끝내기, 명수비, 응원가, 직캠 등 재밌는 야구 영상을 함께 모아봐요.
        누구나 유튜브 링크를 등록하고 같이 즐길 수 있어요.
      </p>

      {loading && videos === null ? <p className="stadium-loading">불러오는 중...</p> : null}
      {error ? <p className="stadium-error">{error}</p> : null}
      {videos !== null && videos.length === 0 ? (
        <section className="stadium-discover-empty">
          <strong>아직 등록된 영상이 없어요</strong>
          <p>우측 상단 영상 등록으로 첫 영상을 올려보세요.</p>
        </section>
      ) : null}

      <section className="videos-list">
        {rows.map((row, idx) => {
          if (row.kind === "shorts") {
            return (
              <div key={`row-${idx}`} className="videos-row videos-row-shorts">
                {row.items.map(({ video, parsed }) => renderCard(video, parsed, setOpenVideo))}
              </div>
            );
          }
          return (
            <div key={`row-${idx}`} className="videos-row videos-row-horizontal">
              {renderCard(row.item.video, row.item.parsed, setOpenVideo)}
            </div>
          );
        })}
      </section>

      {/* 더보기 — 이전(오래된) 영상까지 노출 */}
      {videos !== null && videos.length > 0 && hasMore ? (
        <div className="videos-more">
          <button
            type="button"
            className="videos-more-btn"
            onClick={() => setLimit((l) => l + VIDEOS_PAGE)}
            disabled={loading}
          >
            {loading ? "불러오는 중..." : "이전 영상 더보기"}
          </button>
        </div>
      ) : null}

      <VideoPlayerModal
        openVideo={openVideo}
        openParsed={openParsed}
        userId={userId}
        onClose={() => setOpenVideo(null)}
        onNavigate={navigate}
        onDelete={handleDelete}
      />

      <ModalShell
        open={registerOpen}
        title="영상 등록"
        onClose={() => {
          setRegisterOpen(false);
          setRegisterError(null);
        }}
        panelClassName="videos-register-panel"
        closeOnBackdrop
      >
        <div className="videos-register-body">
          <label className="videos-register-field">
            <span className="videos-register-label">영상 URL</span>
            <input
              type="url"
              className="videos-register-input"
              placeholder="https://www.youtube.com/shorts/... 또는 watch?v=..."
              value={registerUrl}
              onChange={(e) => {
                setRegisterUrl(e.target.value);
                if (registerError) setRegisterError(null);
              }}
              autoFocus
            />
          </label>
          <p className="videos-register-hint">유튜브 URL만 지원해요. 쇼츠와 일반 영상 모두 가능해요.</p>
          {registerError ? <p className="videos-register-error">{registerError}</p> : null}
          <button
            type="button"
            className="videos-register-submit"
            onClick={handleRegisterSubmit}
            disabled={registerSubmitting}
          >
            {registerSubmitting ? "등록 중..." : "등록하기"}
          </button>
        </div>
      </ModalShell>
    </AppShell>
  );
}
