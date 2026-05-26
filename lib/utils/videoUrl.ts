// 영상 URL → 플랫폼 + 외부 ID + 썸네일 URL 추출 헬퍼.
// YouTube는 ID 추출해서 임베드/썸네일 가능. IG/Threads는 카드 미리보기만.
// orientation은 카드/모달 비율 결정 — /shorts/, /reel(s)/ 는 세로(9:16).

export type VideoPlatform = "youtube" | "instagram" | "threads" | "other";
export type VideoOrientation = "horizontal" | "vertical";

export type ParsedVideo = {
  platform: VideoPlatform;
  externalId: string | null;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  watchUrl: string;
  orientation: VideoOrientation;
};

// 패턴별로 orientation 분리 — /shorts/ 는 세로.
const YOUTUBE_PATTERNS: Array<{ re: RegExp; orientation: VideoOrientation }> = [
  { re: /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/, orientation: "vertical" },
  { re: /youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/, orientation: "horizontal" },
  { re: /youtu\.be\/([A-Za-z0-9_-]{11})/, orientation: "horizontal" },
  { re: /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/, orientation: "horizontal" }
];

export function parseVideoUrl(url: string): ParsedVideo {
  const trimmed = url.trim();

  // YouTube
  for (const { re, orientation } of YOUTUBE_PATTERNS) {
    const m = trimmed.match(re);
    if (m) {
      const id = m[1];
      // 쇼츠(세로)는 컨트롤 숨김 — 탭으로 일시정지 가능.
      // 가로(긴 영상)는 재생바 필요 — 시킹/볼륨 조작용.
      const controls = orientation === "vertical" ? 0 : 1;
      return {
        platform: "youtube",
        externalId: id,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        // 표준 youtube.com 임베드. nocookie 도메인은 일부 환경에서 더 엄격.
        // autoplay=1 + mute=1: iOS Safari·모바일 Chrome 모두 자동재생 허용.
        //   (iOS는 음소거 아닌 자동재생을 무조건 차단. TikTok·IG Reels 표준 패턴)
        //   사용자가 플레이어 🔊 아이콘으로 unmute 가능.
        // playsinline=1: iOS에서 풀스크린으로 안 빠짐. modestbranding=1: 유튜브 로고 최소화.
        // iv_load_policy=3: 영상 주석 숨김.
        embedUrl: `https://www.youtube.com/embed/${id}?rel=0&autoplay=1&mute=1&controls=${controls}&playsinline=1&modestbranding=1&iv_load_policy=3`,
        watchUrl: trimmed,
        orientation
      };
    }
  }

  // Instagram (Reels, Posts) — 임베드 안정성 낮아 watch link만 제공.
  // reel/reels/tv 는 세로, 일반 p는 가로(square 포함)로 가정.
  const igMatch = trimmed.match(/instagram\.com\/(p|reel|reels|tv)\//);
  if (igMatch) {
    const kind = igMatch[1];
    const orientation: VideoOrientation =
      kind === "reel" || kind === "reels" || kind === "tv" ? "vertical" : "horizontal";
    return {
      platform: "instagram",
      externalId: null,
      thumbnailUrl: null,
      embedUrl: null,
      watchUrl: trimmed,
      orientation
    };
  }

  // Threads — 짧은 영상 위주라 세로로 가정
  if (/threads\.(com|net)\//.test(trimmed)) {
    return {
      platform: "threads",
      externalId: null,
      thumbnailUrl: null,
      embedUrl: null,
      watchUrl: trimmed,
      orientation: "vertical"
    };
  }

  return {
    platform: "other",
    externalId: null,
    thumbnailUrl: null,
    embedUrl: null,
    watchUrl: trimmed,
    orientation: "horizontal"
  };
}
