// 경기 진행 중 효과음 재생.
// public/sounds/{hit,homerun,strikeout,score}.mp3 를 Web Audio API 로 사전 decode →
// 호출 시 즉시 재생(지연 없음). HTMLAudioElement(new Audio()) 방식은 첫 호출 시
// fetch + decode 비용 + 모바일 브라우저 보수적 정책으로 인해 매번 지연 발생했음.
//
// localStorage "ballplay:sound:muted" === "1" 이면 무음.

export type MatchSoundKey = "hit" | "homerun" | "strikeout" | "score" | "walk" | "out" | "double_play";

const SRC: Record<MatchSoundKey, string> = {
  hit: "/sounds/hit.mp3",
  homerun: "/sounds/homerun.mp3",
  strikeout: "/sounds/strikeout.mp3",
  score: "/sounds/score.mp3",
  walk: "/sounds/walk.mp3",
  out: "/sounds/out.mp3",
  double_play: "/sounds/double_play.mp3"
};

const VOLUME: Record<MatchSoundKey, number> = {
  hit: 0.7,
  homerun: 0.85,
  strikeout: 0.7,
  score: 0.8,
  walk: 0.7,
  out: 0.7,
  double_play: 0.8
};

const MUTED_KEY = "ballplay:sound:muted";
const BGM_MUTED_KEY = "ballplay:bgm:muted";
const BGM_SRC = "/sounds/bgm.mp3";
const BGM_VOLUME = 0.08;

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

// ============================================================
// Web Audio API — 사전 decode 캐시
// ============================================================

let ctx: AudioContext | null = null;
const buffers = new Map<MatchSoundKey, AudioBuffer>();
let preloadPromise: Promise<void> | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  // iOS Safari 는 사용자 제스처 직후에만 resume 됨. suspended 상태여도 호출은 안전.
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }
  return ctx;
}

/**
 * 모든 효과음을 fetch + decode 해서 메모리에 캐시. idempotent — 여러 번 호출해도
 * 최초 1회만 실제 작업. PlayScreen mount 시 호출 권장 (게임 시작 전에 buffer 준비).
 */
export function preloadMatchSounds(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (preloadPromise) return preloadPromise;
  const c = ensureCtx();
  if (!c) return Promise.resolve();
  const keys = Object.keys(SRC) as MatchSoundKey[];
  preloadPromise = (async () => {
    await Promise.all(
      keys.map(async (key) => {
        try {
          const res = await fetch(SRC[key]);
          if (!res.ok) return;
          const arr = await res.arrayBuffer();
          // decodeAudioData 는 callback / promise 두 형태 모두 지원. Safari 호환 위해 promise 폴백 처리.
          const decoded = await new Promise<AudioBuffer>((resolve, reject) => {
            const p = c.decodeAudioData(arr, resolve, reject);
            if (p && typeof (p as Promise<AudioBuffer>).then === "function") {
              (p as Promise<AudioBuffer>).then(resolve, reject);
            }
          });
          buffers.set(key, decoded);
        } catch {
          // 한 사운드 실패해도 다른 사운드는 계속 진행. 폴백 재생은 playMatchSound 에서 처리.
        }
      })
    );
  })();
  return preloadPromise;
}

/**
 * 효과음 즉시 재생. 사전 decode 된 buffer 있으면 Web Audio 로 (지연 없음),
 * 없으면 HTMLAudioElement 폴백.
 *
 * 연속 호출(빠른 모드 K 연발 등) 시 BufferSource 매번 새로 만들어 자연스럽게 겹쳐 들림.
 */
export function playMatchSound(key: MatchSoundKey): void {
  if (typeof window === "undefined") return;
  if (isMuted()) return;

  // 아직 preload 안 됐으면 백그라운드 시작 (다음 호출부터 즉시 재생되게).
  void preloadMatchSounds();

  const c = ctx;
  const buf = buffers.get(key);
  if (c && buf) {
    try {
      if (c.state === "suspended") void c.resume().catch(() => {});
      const source = c.createBufferSource();
      source.buffer = buf;
      const gain = c.createGain();
      gain.gain.value = VOLUME[key];
      source.connect(gain);
      gain.connect(c.destination);
      source.start(0);
      return;
    } catch {
      // 폴백
    }
  }

  // 폴백 — buffer 아직 안 준비됐거나 Web Audio 실패. 옛 방식.
  try {
    const audio = new Audio(SRC[key]);
    audio.volume = VOLUME[key];
    void audio.play().catch(() => {});
  } catch {
    // ignore
  }
}

// ============================================================
// 배경음악 (BGM) — 효과음과 분리된 음소거 토글.
// 단일 HTMLAudioElement 인스턴스 + loop. PlayScreen mount/unmount 따라 start/stop.
// ============================================================

let bgmEl: HTMLAudioElement | null = null;

/** BGM Audio 인스턴스 생성 + load() 호출로 fetch 시작.
 *  PlayScreen mount 시 호출 → 사용자가 토글 켜는 시점엔 이미 캐시돼 즉시 재생.
 *  muted 여부와 무관 (재생은 안 함, fetch만 warmup). idempotent. */
export function preloadBgm(): void {
  if (typeof window === "undefined") return;
  if (bgmEl) return;
  try {
    bgmEl = new Audio(BGM_SRC);
    bgmEl.loop = true;
    bgmEl.volume = BGM_VOLUME;
    bgmEl.preload = "auto";
    bgmEl.load();
  } catch {
    // ignore
  }
}

export function getBgmMuted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(BGM_MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setBgmMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BGM_MUTED_KEY, muted ? "1" : "0");
  } catch {
    // ignore
  }
  // 토글 즉시 반영 — 켜면 재생, 끄면 정지.
  if (muted) {
    stopBgm();
  } else {
    void playBgm();
  }
}

export function playBgm(): void {
  if (typeof window === "undefined") return;
  if (getBgmMuted()) return;
  try {
    if (!bgmEl) {
      bgmEl = new Audio(BGM_SRC);
      bgmEl.loop = true;
      bgmEl.volume = BGM_VOLUME;
    }
    if (bgmEl.paused) {
      void bgmEl.play().catch(() => {
        // 자동재생 정책 위반 — 사용자 제스처 후 다시 시도되도록 무시.
      });
    }
  } catch {
    // ignore
  }
}

export function stopBgm(): void {
  if (!bgmEl) return;
  try {
    bgmEl.pause();
    bgmEl.currentTime = 0;
  } catch {
    // ignore
  }
}
