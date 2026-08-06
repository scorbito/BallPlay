// 선수명 워들의 진행 상태·통계 저장.
//
// 미니게임은 localStorage 우선 원칙이라 DB를 쓰지 않는다. 키 접두사는 기존 관례인
// "ballplay:" 를 따른다.

import { MAX_ATTEMPTS, type WordleDifficulty } from "@/lib/wordle/daily";

const PROGRESS_KEY = "ballplay:wordle:progress";
const STATS_KEY = "ballplay:wordle:stats";

// 난이도별 진행 분리 — 초급은 기존 키 그대로(하위호환), 고급만 접미사.
function progressKey(difficulty: WordleDifficulty): string {
  return difficulty === "advanced" ? `${PROGRESS_KEY}:advanced` : PROGRESS_KEY;
}

export type WordleStatus = "playing" | "won" | "lost";

export type WordleProgress = {
  /** KST 날짜. 다르면 폐기하고 새 판을 시작한다. */
  date: string;
  /** 추측한 선수 이름 순서대로 */
  guesses: string[];
  status: WordleStatus;
};

export type WordleStats = {
  played: number;
  won: number;
  streak: number;
  maxStreak: number;
  lastPlayedDate: string | null;
  /** 1~6시도 성공 횟수 */
  distribution: number[];
};

const EMPTY_STATS: WordleStats = {
  played: 0,
  won: 0,
  streak: 0,
  maxStreak: 0,
  lastPlayedDate: null,
  distribution: Array.from({ length: MAX_ATTEMPTS }, () => 0)
};

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패(사파리 프라이빗 모드 등)로 게임이 막히지는 않게 한다.
  }
}

/** 해당 날짜·난이도의 진행 상태. 날짜가 다르면 null(새 판). */
export function loadProgress(dateISO: string, difficulty: WordleDifficulty = "beginner"): WordleProgress | null {
  const saved = readJson<WordleProgress>(progressKey(difficulty));
  if (!saved || saved.date !== dateISO) return null;
  if (!Array.isArray(saved.guesses)) return null;
  return saved;
}

export function saveProgress(progress: WordleProgress, difficulty: WordleDifficulty = "beginner"): void {
  writeJson(progressKey(difficulty), progress);
}

export function loadStats(): WordleStats {
  const saved = readJson<WordleStats>(STATS_KEY);
  if (!saved) return EMPTY_STATS;
  return {
    played: saved.played ?? 0,
    won: saved.won ?? 0,
    streak: saved.streak ?? 0,
    maxStreak: saved.maxStreak ?? 0,
    lastPlayedDate: saved.lastPlayedDate ?? null,
    distribution:
      Array.isArray(saved.distribution) && saved.distribution.length === MAX_ATTEMPTS
        ? saved.distribution
        : EMPTY_STATS.distribution
  };
}

function yesterdayOf(dateISO: string): string {
  const ms = Date.parse(`${dateISO}T00:00:00+09:00`);
  const prev = new Date(ms - 86_400_000);
  const y = prev.getUTCFullYear();
  const m = String(prev.getUTCMonth() + 1).padStart(2, "0");
  const d = String(prev.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 판이 끝났을 때 1회만 호출. 같은 날짜로 중복 호출되면 무시한다
 * (새로고침으로 결과 화면이 다시 그려질 때 통계가 두 번 쌓이는 것 방지).
 */
export function recordFinishedGame(params: {
  dateISO: string;
  solved: boolean;
  attempts: number;
}): WordleStats {
  const { dateISO, solved, attempts } = params;
  const stats = loadStats();
  if (stats.lastPlayedDate === dateISO) return stats;

  // 어제도 풀었으면 연속, 아니면 리셋. 실패한 판은 streak 를 끊는다.
  const continued = stats.lastPlayedDate === yesterdayOf(dateISO);
  const streak = solved ? (continued ? stats.streak + 1 : 1) : 0;
  const distribution = stats.distribution.slice();
  if (solved && attempts >= 1 && attempts <= MAX_ATTEMPTS) {
    distribution[attempts - 1] += 1;
  }

  const next: WordleStats = {
    played: stats.played + 1,
    won: stats.won + (solved ? 1 : 0),
    streak,
    maxStreak: Math.max(stats.maxStreak, streak),
    lastPlayedDate: dateISO,
    distribution
  };
  writeJson(STATS_KEY, next);
  return next;
}
