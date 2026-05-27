"use client";

import { useCallback, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { Camera, ExternalLink, Film, MessageSquareText, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";
import type { BpVideoWithOwnerRow } from "@/lib/supabase/query-parts/bpVideos";
import type { ParsedVideo, VideoPlatform } from "@/lib/utils/videoUrl";

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

type PlayerCommand = "mute" | "unMute" | "playVideo";

type Props = {
  openVideo: BpVideoWithOwnerRow | null;
  openParsed: ParsedVideo | null;
  userId: string | null;
  onClose: () => void;
  onNavigate: (delta: 1 | -1) => void;
  onDelete: (video: BpVideoWithOwnerRow) => Promise<void>;
};

export function VideoPlayerModal({
  openVideo,
  openParsed,
  userId,
  onClose,
  onNavigate,
  onDelete
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [muted, setMuted] = useState(true);
  const [userUnmutePref, setUserUnmutePref] = useState(false);

  useEffect(() => {
    try {
      setUserUnmutePref(localStorage.getItem("videos:auto-unmute") === "true");
    } catch {
      // Ignore unavailable storage.
    }
  }, []);

  const sendPlayerCommand = useCallback((func: PlayerCommand) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(JSON.stringify({ event: "command", func, args: "" }), "*");
  }, []);

  const requestPlayback = useCallback(() => {
    sendPlayerCommand("mute");
    sendPlayerCommand("playVideo");
    if (userUnmutePref) {
      sendPlayerCommand("unMute");
      setMuted(false);
    }
  }, [sendPlayerCommand, userUnmutePref]);

  useEffect(() => {
    if (!openVideo) return;
    setMuted(true);

    const timers = [250, 700, 1500].map((delay) =>
      window.setTimeout(requestPlayback, delay)
    );

    return () => {
      timers.forEach(window.clearTimeout);
    };
  }, [openVideo, requestPlayback]);

  const handleTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const t = e.changedTouches[0];
    const dy = t.clientY - start.y;
    const dx = t.clientX - start.x;
    if (Math.abs(dy) < 12 && Math.abs(dx) < 12) {
      requestPlayback();
      return;
    }
    if (Math.abs(dy) < 50 || Math.abs(dy) < Math.abs(dx)) return;
    onNavigate(dy < 0 ? 1 : -1);
  };

  const toggleMute = () => {
    if (muted) {
      sendPlayerCommand("unMute");
      sendPlayerCommand("playVideo");
      setMuted(false);
      setUserUnmutePref(true);
      try {
        localStorage.setItem("videos:auto-unmute", "true");
      } catch {
        // Ignore unavailable storage.
      }
    } else {
      sendPlayerCommand("mute");
      setMuted(true);
      setUserUnmutePref(false);
      try {
        localStorage.setItem("videos:auto-unmute", "false");
      } catch {
        // Ignore unavailable storage.
      }
    }
  };

  return (
    <ModalShell
      open={openVideo !== null}
      title={
        openVideo
          ? `@${openVideo.is_auto_curated ? "놀이터봇" : (openVideo.owner_nickname?.trim() || "익명")}`
          : ""
      }
      onClose={onClose}
      panelClassName={`video-player-panel video-player-panel-${openParsed?.orientation ?? "horizontal"}`}
      closeOnBackdrop
    >
      {openVideo && openParsed ? (
        <div className="video-player-body">
          <button type="button" className="video-player-close" onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
          {openParsed.platform === "youtube" && openParsed.embedUrl ? (
            <>
              <div className="video-player-iframe-wrap">
                <iframe
                  key={`${openVideo.id}-${openParsed.externalId ?? openParsed.embedUrl}`}
                  ref={iframeRef}
                  src={openParsed.embedUrl}
                  title="영상 재생"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  onLoad={requestPlayback}
                />
                <div
                  className="video-player-swipe-capture"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  aria-hidden="true"
                />
              </div>
              <button
                type="button"
                className="video-player-mute-toggle"
                onClick={toggleMute}
                aria-label={muted ? "소리 켜기" : "소리 끄기"}
                title={muted ? "소리 켜기" : "소리 끄기"}
              >
                {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <div className="video-player-fallback">
                재생 안 되면{" "}
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
              <p>이 플랫폼은 페이지 안 재생을 지원하지 않아요.</p>
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
                  await onDelete(openVideo);
                  onClose();
                })();
              }}
              aria-label="영상 삭제"
            >
              <Trash2 size={14} />
              삭제
            </button>
          ) : null}
        </div>
      ) : null}
    </ModalShell>
  );
}
