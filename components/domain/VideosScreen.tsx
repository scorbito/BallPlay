"use client";

// 재밌는 야구 영상 — 사용자 등록 풀 (Supabase bp_videos).
// 모든 인증 사용자가 SELECT, 본인만 INSERT/DELETE.

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Bot, Camera, ExternalLink, Film, MessageSquareText, Play, Plus, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ModalShell } from "@/components/common/ModalShell";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createVideo,
  deleteVideo,
  listVideos,
  type BpVideoWithOwnerRow
} from "@/lib/supabase/query-parts/bpVideos";
import { parseVideoUrl, type VideoPlatform, type ParsedVideo } from "@/lib/utils/videoUrl";

const PLATFORM_ICON: Record<VideoPlatform, typeof Film> = {
  youtube: Film,
  instagram: Camera,
  threads: MessageSquareText,
  other: ExternalLink
};

const PLATFORM_LABEL: Record<VideoPlatform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  threads: "Threads",
  other: "외부"
};

function renderCard(
  video: BpVideoWithOwnerRow,
  parsed: ParsedVideo,
  onOpen: (v: BpVideoWithOwnerRow) => void
) {
  const Icon = PLATFORM_ICON[parsed.platform];
  const author = video.is_auto_curated
    ? "놀이터봇"
    : (video.owner_nickname?.trim() || "익명");
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

// 행 단위 그룹핑 — 쇼츠를 먼저 한 grid 블록으로 모두 모은 다음, 가로 영상을
// 단독 행으로 줄줄이 표시. 시간 순으로 섞여 들어와도 화면 상단부터 빈 칸 없이 채워짐.
// 한 줄에 몇 개를 보여줄지는 CSS grid가 결정 (모바일 3, PC wide 5).
// JS에서 N개로 자르지 않음 — 자르면 PC에서 오른쪽 빈 칸 생김.
type VideoRow =
  | { kind: "shorts"; items: Array<{ video: BpVideoWithOwnerRow; parsed: ParsedVideo }> }
  | { kind: "horizontal"; item: { video: BpVideoWithOwnerRow; parsed: ParsedVideo } };

function groupIntoRows(videos: BpVideoWithOwnerRow[]): VideoRow[] {
  const shorts: Array<{ video: BpVideoWithOwnerRow; parsed: ParsedVideo }> = [];
  const horizontals: Array<{ video: BpVideoWithOwnerRow; parsed: ParsedVideo }> = [];

  for (const v of videos) {
    const parsed = parseVideoUrl(v.url);
    if (parsed.orientation === "vertical") {
      shorts.push({ video: v, parsed });
    } else {
      horizontals.push({ video: v, parsed });
    }
  }

  const rows: VideoRow[] = [];
  if (shorts.length > 0) {
    rows.push({ kind: "shorts", items: shorts });
  }
  for (const h of horizontals) {
    rows.push({ kind: "horizontal", item: h });
  }
  return rows;
}

export function VideosScreen() {
  const [videos, setVideos] = useState<BpVideoWithOwnerRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [openVideo, setOpenVideo] = useState<BpVideoWithOwnerRow | null>(null);
  const closeModal = () => setOpenVideo(null);

  // 음소거 상태 — 브라우저 정책상 첫 재생은 무조건 muted.
  // 사용자가 한 번 unmute하면 localStorage에 저장 → 다음 영상부터 자동 unmute 시도.
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [userUnmutePref, setUserUnmutePref] = useState(false);

  useEffect(() => {
    try {
      setUserUnmutePref(localStorage.getItem("videos:auto-unmute") === "true");
    } catch {
      // localStorage 접근 불가 (시크릿 모드 등) — 기본값 유지
    }
  }, []);

  // YouTube IFrame Player API — postMessage로 명령 전송
  const sendPlayerCommand = useCallback((func: "mute" | "unMute") => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(JSON.stringify({ event: "command", func, args: "" }), "*");
  }, []);

  // 모달 열릴 때마다 muted 상태 리셋 (브라우저 정책) + 자동 unmute 시도
  useEffect(() => {
    if (!openVideo) return;
    setMuted(true);
    if (!userUnmutePref) return;
    // iframe이 ready되기 전에 명령 보내면 무시되므로 약간 지연 + 여러 번 시도.
    // 첫 시도가 빠르면 ready 전이라 실패할 수 있어 500/1500ms 2회 보냄.
    const t1 = window.setTimeout(() => {
      sendPlayerCommand("unMute");
      setMuted(false);
    }, 500);
    const t2 = window.setTimeout(() => {
      sendPlayerCommand("unMute");
    }, 1500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [openVideo, userUnmutePref, sendPlayerCommand]);

  const toggleMute = () => {
    if (muted) {
      sendPlayerCommand("unMute");
      setMuted(false);
      setUserUnmutePref(true);
      try {
        localStorage.setItem("videos:auto-unmute", "true");
      } catch {
        // 무시
      }
    } else {
      sendPlayerCommand("mute");
      setMuted(true);
      setUserUnmutePref(false);
      try {
        localStorage.setItem("videos:auto-unmute", "false");
      } catch {
        // 무시
      }
    }
  };

  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerUrl, setRegisterUrl] = useState("");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSubmitting, setRegisterSubmitting] = useState(false);

  const loadVideos = useCallback(async () => {
    const client = createSupabaseBrowserClient();
    setLoading(true);
    setError(null);
    const res = await listVideos(client, 100);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setVideos(res.rows);
  }, []);

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

  const openParsed = openVideo ? parseVideoUrl(openVideo.url) : null;
  const rows = videos ? groupIntoRows(videos) : [];

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
        끝내기 홈런 · 호수비 · 응원가 · 짤방 · 직캠 등 재밌는 야구 영상을 함께 모아봐요.
        누구나 유튜브 링크를 등록하고 같이 즐길 수 있어요.
      </p>

      {loading && videos === null ? (
        <p className="stadium-loading">불러오는 중...</p>
      ) : null}

      {error ? <p className="stadium-error">{error}</p> : null}

      {videos !== null && videos.length === 0 ? (
        <section className="stadium-discover-empty">
          <strong>아직 등록된 영상이 없어요</strong>
          <p>우측 상단 &lsquo;영상 등록&rsquo;으로 첫 영상을 올려보세요.</p>
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

      <ModalShell
        open={openVideo !== null}
        title={
          openVideo
            ? `@${openVideo.is_auto_curated ? "놀이터봇" : (openVideo.owner_nickname?.trim() || "익명")}`
            : ""
        }
        onClose={closeModal}
        panelClassName={`video-player-panel video-player-panel-${openParsed?.orientation ?? "horizontal"}`}
        closeOnBackdrop
      >
        {openVideo && openParsed ? (
          <div className="video-player-body">
            <button
              type="button"
              className="video-player-close"
              onClick={closeModal}
              aria-label="닫기"
            >
              <X size={20} />
            </button>
            {openParsed.platform === "youtube" && openParsed.embedUrl ? (
              <>
                <div className="video-player-iframe-wrap">
                  <iframe
                    ref={iframeRef}
                    src={openParsed.embedUrl}
                    title="영상 재생"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
                <button
                  type="button"
                  className="video-player-mute-toggle"
                  onClick={toggleMute}
                  aria-label={muted ? "음소거 해제" : "음소거"}
                  title={muted ? "음소거 해제" : "음소거"}
                >
                  {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <div className="video-player-fallback">
                  재생 안 되면 ▶
                  <a href={openParsed.watchUrl} target="_blank" rel="noopener noreferrer">
                    유튜브에서 보기 <ExternalLink size={11} />
                  </a>
                </div>
              </>
            ) : (
              <div className="video-player-external">
                <div className="video-player-external-icon">
                  {(() => {
                    const Icon = PLATFORM_ICON[openParsed.platform];
                    return <Icon size={32} />;
                  })()}
                </div>
                <p>이 플랫폼은 페이지 내 재생을 지원하지 않아요.</p>
                <a
                  href={openParsed.watchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="video-player-external-cta"
                >
                  <ExternalLink size={14} />
                  {PLATFORM_LABEL[openParsed.platform]}에서 보기
                </a>
              </div>
            )}
            {userId && openVideo.owner_user_id === userId ? (
              <button
                type="button"
                className="video-player-delete"
                onClick={() => {
                  void (async () => {
                    await handleDelete(openVideo);
                    closeModal();
                  })();
                }}
                aria-label="내 영상 삭제"
              >
                <Trash2 size={14} />
                삭제
              </button>
            ) : null}
          </div>
        ) : null}
      </ModalShell>

      {/* 영상 등록 모달 */}
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
          <p className="videos-register-hint">
            유튜브 URL만 지원 (쇼츠 / 일반 영상)
          </p>
          {registerError ? (
            <p className="videos-register-error">{registerError}</p>
          ) : null}
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
