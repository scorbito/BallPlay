// 그리드 게임의 진행 상태·통계 저장.
//
// 미니게임은 localStorage 우선 원칙이라 DB를 쓰지 않는다. 키 접두사는 "ballplay:".

const PROGRESS_KEY = "ballplay:grid:progress";
const STATS_KEY = "ballplay:grid:stats";

export type GridFilled = {
  /** 셀 인덱스 0~8 */
  cell: number;
  /** 입력한 이름 */
  name: string;
  /** 그 셀의 전체 정답 후보 수 — 희소성 표시용 */
  poolSize: number;
};

export type GridProgress = {
  /** KST 날짜. 다르면 폐기하고 새 판을 시작한다. */
  date: string;
  /**
   * 그날 격자의 지문(행·열 팀 id).
   *
   * 격자 생성 기준을 바꾸면 같은 날짜라도 판이 달라진다. filled 는 칸 번호로만
   * 기록되므로, 지문을 확인하지 않으면 예전 판에서 채운 칸이 새 판의 엉뚱한 자리에
   * 붙는다. 다르면 진행 상태를 폐기한다.
   */
  boardKey: string;
  /** 맞힌 칸 */
  filled: GridFilled[];
  /** 사용한 시도 수(오답 포함) */
  used: number;
  /** 이미 쓴 이름 — 같은 선수 재사용 금지 */
  usedNames: string[];
  /** 초성 힌트를 연 셀 인덱스 */
  hintedCells: number[];
  done: boolean;
};

export type GridStats = {
  played: number;
  /** 9칸 전부 채운 횟수 */
  perfect: number;
  /** 맞힌 칸 누적 — 평균 산출용 */
  totalFilled: number;
  bestFilled: number;
  lastPlayedDate: string | null;
};

const EMPTY_STATS: GridStats = {
  played: 0,
  perfect: 0,
  totalFilled: 0,
  bestFilled: 0,
  lastPlayedDate: null
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

/** 해당 날짜·해당 격자의 진행 상태. 날짜나 격자가 다르면 null(새 판). */
export function loadProgress(dateISO: string, boardKey: string): GridProgress | null {
  const saved = readJson<GridProgress>(PROGRESS_KEY);
  if (!saved || saved.date !== dateISO) return null;
  // boardKey 가 없는 예전 저장본은 어느 판이었는지 알 수 없으므로 폐기한다.
  if (saved.boardKey !== boardKey) return null;
  if (!Array.isArray(saved.filled) || !Array.isArray(saved.usedNames)) return null;
  // hintedCells 는 나중에 추가된 필드 — 이전 판이 남아 있어도 깨지지 않게 보정한다.
  return { ...saved, hintedCells: Array.isArray(saved.hintedCells) ? saved.hintedCells : [] };
}

export function saveProgress(progress: GridProgress): void {
  writeJson(PROGRESS_KEY, progress);
}

export function loadStats(): GridStats {
  return readJson<GridStats>(STATS_KEY) ?? EMPTY_STATS;
}

/** 판이 끝났을 때 1회만 호출. 같은 날 중복 반영을 lastPlayedDate 로 막는다. */
export function recordResult(dateISO: string, filledCount: number): GridStats {
  const prev = loadStats();
  if (prev.lastPlayedDate === dateISO) return prev;
  const next: GridStats = {
    played: prev.played + 1,
    perfect: prev.perfect + (filledCount === 9 ? 1 : 0),
    totalFilled: prev.totalFilled + filledCount,
    bestFilled: Math.max(prev.bestFilled, filledCount),
    lastPlayedDate: dateISO
  };
  writeJson(STATS_KEY, next);
  return next;
}
