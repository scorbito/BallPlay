// 경기 진행 중 효과음 재생.
// public/sounds/{hit,homerun,strikeout}.mp3 를 lazy 로딩 후 재생.
// localStorage "ballplay:sound:muted" === "1" 이면 무음.

export type MatchSoundKey = "hit" | "homerun" | "strikeout" | "score";

const SRC: Record<MatchSoundKey, string> = {
  hit: "/sounds/hit.mp3",
  homerun: "/sounds/homerun.mp3",
  strikeout: "/sounds/strikeout.mp3",
  score: "/sounds/score.mp3"
};

const VOLUME: Record<MatchSoundKey, number> = {
  hit: 0.7,
  homerun: 0.85,
  strikeout: 0.7,
  score: 0.8
};

const MUTED_KEY = "ballplay:sound:muted";

export function getMatchSoundMuted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

function isMuted(): boolean {
  return getMatchSoundMuted();
}

export function setMatchSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
  } catch {
    // ignore
  }
}

export function playMatchSound(key: MatchSoundKey): void {
  if (typeof window === "undefined") return;
  if (isMuted()) return;
  try {
    // 새 Audio 인스턴스 — 연속 호출(예: 빠른 모드 K 연발) 시 겹쳐 들림.
    // 파일은 브라우저 HTTP 캐시에 남아 재요청 없음.
    const audio = new Audio(SRC[key]);
    audio.volume = VOLUME[key];
    void audio.play().catch(() => {
      // 자동재생 정책 / 사용자 제스처 미발생 — 무시.
    });
  } catch {
    // ignore
  }
}
