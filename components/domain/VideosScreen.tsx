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

// 행 단위 그룹핑 — 시간순 유지하면서 쇼츠 그리드가 꽉 차는 시점(% 3 == 0)에서만
// 가로 영상을 끼워 넣음. 쇼츠 1~2개만 사이에 있으면 가로 영상을 잠시 대기시켰다가
// 다음 쇼츠가 행을 채우면 한꺼번에 노출.
// 모바일 한 줄 3개 기준으로 break 결정 (PC wide는 CSS가 5열로 wrap).
//
// 예: [H1, S1, S2, H2, S3, S4, S5] (모두 같은 날)
//   → [H1] (쇼츠 0개, 바로 노출)
//   → S1,S2 누적, H2 대기
//   → S3로 쇼츠 3개 됨 → 쇼츠 행 + 대기중 H2 flush
//   → S4, S5 누적
//   → 끝: 쇼츠 [S4, S5] (마지막 부분 행만 partial OK)
// 결과: H1 / [S1 S2 S3] / H2 / [S4 S5 _]
//
// 봇이 매일 12쇼츠 + 3가로 같은 분에 INSERT → 같은 created_at 내에서 위 로직이
// 시간순 유지 + 가로/쇼츠 자연스러운 interleave를 만들어줌.
type VideoRow =
  | { kind: "shorts"; items: Array<{ video: BpVideoWithOwnerRow; parsed: ParsedVideo }> }
  | { kind: "horizontal"; item: { video: BpVideoWithOwnerRow; parsed: ParsedVideo } };

const SHORTS_PER_ROW_MOBILE = 3;

function groupIntoRows(videos: BpVideoWithOwnerRow[]): VideoRow[] {
  const rows: VideoRow[] = [];
  let shortsBuf: Array<{ video: BpVideoWithOwnerRow; parsed: ParsedVideo }> = [];
  const pendingHorizontals: Array<{ video: BpVideoWithOwnerRow; parsed: ParsedVideo }> = [];

  const flushShorts = () => {
    if (shortsBuf.length > 0) {
      rows.push({ kind: "shorts", items: shortsBuf });
      shortsBuf = [];
    }
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
      // 쇼츠가 한 행을 채우면 대기중 가로 영상도 함께 노출
      if (shortsBuf.length % SHORTS_PER_ROW_MOBILE === 0 && pendingHorizontals.length > 0) {
        flushShorts();
        flushPendingHorizontals();
      }
    } else {
      // 가로 영상: 현재까지 쇼츠 수가 행에 딱 맞으면 바로 flush + 노출,
      // 아니면 대기열에 추가하고 다음 쇼츠가 행을 채울 때까지 기다림.
      if (shortsBuf.length % SHORTS_PER_ROW_MOBILE === 0) {
        flushShorts();
        rows.push({ kind: "horizontal", item: { video: v, parsed } });
      } else {
        pendingHorizontals.push({ video: v, parsed });
      }
    }
  }
  // 마지막 partial 쇼츠 행 + 남은 대기 가로 영상은 끝에 그대로 표시
  flushShorts();
  flushPendingHorizontals();
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
