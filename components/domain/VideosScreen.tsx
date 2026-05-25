"use client";

// 재밌는 야구 영상 모아 보기 — 프로토타입 (하드코딩 샘플).
// v1.1+에서 DB로 옮기고 사용자 등록 + 자동 큐레이션 붙임.

import { useState } from "react";
import Image from "next/image";
import { Camera, ExternalLink, Film, MessageSquareText, Play, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ModalShell } from "@/components/common/ModalShell";
import { parseVideoUrl, type VideoPlatform, type ParsedVideo } from "@/lib/utils/videoUrl";

type SampleVideo = {
  id: string;
  url: string;
  title: string;
  description: string;
  author: string;
};

// 샘플 데이터 — 실제 KBO 관련 YouTube 쇼츠/영상.
// 시간순(최신 → 오래된) 정렬을 가정해서 일부러 가로/세로 섞어 놨음.
const SAMPLE_VIDEOS: SampleVideo[] = [
  {
    id: "s1",
    url: "https://www.youtube.com/shorts/QXbSR5Hfj0k",
    title: "대타 이대호 끝내기 홈런",
    description: "대타로 나와서 끝내기 홈런 치는 이대호.",
    author: "롯빠"
  },
  {
    id: "s2",
    url: "https://www.youtube.com/shorts/I4PRwqtp_ik",
    title: "역대 29번째 백투백투백 홈런",
    description: "덕아웃의 순간까지 다 잡힌 명장면.",
    author: "KBO 공식"
  },
  // 가로 — 중간에 끼어듦
  {
    id: "h1",
    url: "https://www.youtube.com/watch?v=g84qCkc8zEI",
    title: "끝내기 홈런 두 방 모음",
    description: "한 경기에 끝내기 홈런이 두 번? 호쾌한 홈런 모음.ZIP",
    author: "KBO 모음집"
  },
  {
    id: "s3",
    url: "https://www.youtube.com/shorts/xsz3vFDCT8s",
    title: "김하성 연장 끝내기 홈런",
    description: "김민성 9회말 동점 → 김하성 연장 끝내기.",
    author: "야구하이라이트"
  },
  {
    id: "s4",
    url: "https://www.youtube.com/shorts/hyGfVnKaLXg",
    title: "LG 아웃송 홀리몰리",
    description: "잠실 직관 가서 찍은 LG 아웃송.",
    author: "트윈스러버"
  },
  {
    id: "s5",
    url: "https://www.youtube.com/shorts/EyKI34abBpE",
    title: "KBO 치어리더 인기 TOP5",
    description: "올 시즌 가장 핫한 치어리더 5명 모음.",
    author: "야구놀이터 운영자"
  },
  // 가로 — 한 번 더
  {
    id: "h2",
    url: "https://www.youtube.com/watch?v=tAntXQxnS-M",
    title: "디아즈 끝내기 홈런 인터뷰",
    description: "\"영원히 한국에 남고 싶어\" — 디아즈 단독 인터뷰.",
    author: "스포츠채널"
  },
  {
    id: "s6",
    url: "https://www.instagram.com/reel/Cxxxxxxxxx/",
    title: "잠실 직관 브이로그",
    description: "야간 경기 후기 + 푸드트럭 추천.",
    author: "야구덕후"
  },
  {
    id: "s7",
    url: "https://www.threads.net/@username/post/AbcDefGhi",
    title: "오늘 경기 짤방",
    description: "캐스터 멘트 보고 빵 터졌어요 ㅋㅋ",
    author: "야빠123"
  },
  {
    id: "s8",
    url: "https://www.youtube.com/shorts/af-tXNiExjo",
    title: "끝내기 안타 + 멀티홈런",
    description: "퓨처스리그 헤이 걸~ 유로결 다이렉트 안타.",
    author: "퓨처스팬"
  },
  {
    id: "s9",
    url: "https://www.youtube.com/shorts/Aas8ZiWDh5E",
    title: "니케 AT BAT 끝내기 홈런",
    description: "승리의 여신 NIKKE 콜라보 영상.",
    author: "겜덕야빠"
  }
];

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
  video: SampleVideo,
  parsed: ParsedVideo,
  onOpen: (v: SampleVideo) => void
) {
  const Icon = PLATFORM_ICON[parsed.platform];
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
        {parsed.platform === "youtube" ? (
          <span className="videos-card-play">
            <Play size={16} fill="currentColor" />
          </span>
        ) : null}
        <div className="videos-card-overlay">
          <strong>{video.title}</strong>
          <span className="videos-card-author">@{video.author}</span>
        </div>
      </div>
    </button>
  );
}

// 행 단위 그룹핑:
// - 쇼츠(세로)는 무조건 3개 모이면 한 행으로 묶음 — 가로 영상 만나도 끊지 않음
// - 가로 영상은 일단 대기열에 쌓아뒀다가 쇼츠 행이 완성될 때 그 뒤에 push
// - 결과: 쇼츠 행은 항상 3개로 가득 참(마지막 행만 예외), 가로는 쇼츠 행 사이사이에 등장
type VideoRow =
  | { kind: "shorts"; items: Array<{ video: SampleVideo; parsed: ParsedVideo }> }
  | { kind: "horizontal"; item: { video: SampleVideo; parsed: ParsedVideo } };

function groupIntoRows(videos: SampleVideo[]): VideoRow[] {
  const rows: VideoRow[] = [];
  let shortsBuf: Array<{ video: SampleVideo; parsed: ParsedVideo }> = [];
  const pendingHorizontals: Array<{ video: SampleVideo; parsed: ParsedVideo }> = [];

  const flushPendingHorizontals = () => {
    while (pendingHorizontals.length > 0) {
      const h = pendingHorizontals.shift()!;
      rows.push({ kind: "horizontal", item: h });
    }
  };
  const flushShorts = () => {
    if (shortsBuf.length > 0) {
      rows.push({ kind: "shorts", items: shortsBuf });
      shortsBuf = [];
    }
  };

  for (const v of videos) {
    const parsed = parseVideoUrl(v.url);
    if (parsed.orientation === "vertical") {
      shortsBuf.push({ video: v, parsed });
      if (shortsBuf.length === 3) {
        flushShorts();
        flushPendingHorizontals();
      }
    } else {
      pendingHorizontals.push({ video: v, parsed });
    }
  }
  // 끝까지 못 채운 쇼츠 1~2개는 그대로 마지막 행으로, 남은 가로도 그 뒤로
  flushShorts();
  flushPendingHorizontals();
  return rows;
}

export function VideosScreen() {
  const [openVideo, setOpenVideo] = useState<SampleVideo | null>(null);

  const closeModal = () => setOpenVideo(null);

  const openParsed = openVideo ? parseVideoUrl(openVideo.url) : null;
  const rows = groupIntoRows(SAMPLE_VIDEOS);

  return (
    <AppShell activeTab="home" title="재밌는 야구 영상" theme="light" backHref="/" wide>
      <header className="videos-header">
        <h1>재밌는 야구 영상</h1>
        <p>모아 보고, 같이 즐겨요. (테스트 화면 — 샘플 데이터)</p>
      </header>

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
        title={openVideo?.title ?? ""}
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
                    src={openParsed.embedUrl}
                    title={openVideo.title}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
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
            <div className="video-player-meta">
              <p className="video-player-desc">{openVideo.description}</p>
              <span className="video-player-author">— {openVideo.author}</span>
            </div>
          </div>
        ) : null}
      </ModalShell>
    </AppShell>
  );
}
