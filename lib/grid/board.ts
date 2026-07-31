// 3x3 격자 생성과 정답 판정.
//
// v1 축은 팀 × 팀 하나뿐이다. 실측상 45개 팀 조합 전부 정답 5명 이상(최소 9명·평균 32명)
// 이라 조건 축 없이도 4200개 판이 전부 성립한다. 조건 축(좌완·데뷔연도 등)은
// 나중에 CellAxis 를 확장해 얹는다.

import { GRID_TEAMS, TEAM_BIT, type GridTeamId } from "./teams";
import { getAllPlayers, findPlayersByName, type GridPlayer } from "./pool";

export type GridAxis = { kind: "team"; teamId: GridTeamId };

export type GridBoard = {
  rows: [GridAxis, GridAxis, GridAxis];
  cols: [GridAxis, GridAxis, GridAxis];
};

/** 셀 인덱스 0~8 (행 우선). */
export type CellIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const CELL_COUNT = 9;
/** 총 시도 횟수 — 정답 9칸에 오답 여유 없이 딱 9번(원작과 동일). */
export const MAX_GUESSES = 9;

/** 하루 격자의 셀당 최소 정답 수. 이 밑으로 내려가면 "아는 사람만 아는" 칸이 된다. */
const MIN_ANSWERS_PER_CELL = 10;

// ── 팀 조합별 정답 수 사전 계산 ──
// 3408명을 한 번만 훑는다. 판 생성 때마다 다시 세면 리롤마다 전체 스캔이 된다.
const pairCounts = new Map<string, number>();
{
  const players = getAllPlayers();
  for (const player of players) {
    const owned: number[] = [];
    for (let i = 0; i < GRID_TEAMS.length; i++) {
      if (player.mask & (1 << i)) owned.push(i);
    }
    for (let i = 0; i < owned.length; i++) {
      for (let j = i + 1; j < owned.length; j++) {
        const key = `${owned[i]}|${owned[j]}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }
}

function pairKey(a: GridTeamId, b: GridTeamId): string {
  const ia = GRID_TEAMS.indexOf(a);
  const ib = GRID_TEAMS.indexOf(b);
  return ia < ib ? `${ia}|${ib}` : `${ib}|${ia}`;
}

/** 해당 셀의 정답 후보 수. 판 생성 검증과 정답 공개 시 "N명 중 1명" 표시에 쓴다. */
export function countAnswers(row: GridAxis, col: GridAxis): number {
  if (row.teamId === col.teamId) return 0;
  return pairCounts.get(pairKey(row.teamId, col.teamId)) ?? 0;
}

/** 선수가 이 셀의 정답인지. */
export function playerSatisfies(player: GridPlayer, row: GridAxis, col: GridAxis): boolean {
  return (player.mask & TEAM_BIT[row.teamId]) !== 0 && (player.mask & TEAM_BIT[col.teamId]) !== 0;
}

/**
 * 이름으로 셀 정답 판정.
 *
 * 동명이인은 사람 단위로 평가한다 — 한 명이라도 두 조건을 모두 만족하면 정답이고,
 * 그 사람을 돌려준다. 조건을 나눠 만족하는 다른 사람은 통과시키지 않는다.
 */
export function judgeName(
  name: string,
  row: GridAxis,
  col: GridAxis
): { correct: boolean; player: GridPlayer | null } {
  const candidates = findPlayersByName(name);
  const hit = candidates.find((p) => playerSatisfies(p, row, col));
  return { correct: Boolean(hit), player: hit ?? null };
}

export function cellAxes(board: GridBoard, index: CellIndex): { row: GridAxis; col: GridAxis } {
  return { row: board.rows[Math.floor(index / 3)], col: board.cols[index % 3] };
}

// ── 결정론적 난수 (mulberry32) ──
// Math.random 을 쓰면 기기마다 다른 판이 나온다. 날짜에서 시드를 만들어
// 서버 호출 없이 모두가 같은 격자를 받게 한다.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 3개 뽑기 조합 — 항상 같은 순서로 생성된다(판 순열의 재현성 근거). */
function combinations3<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      for (let k = j + 1; k < items.length; k++) out.push([items[i], items[j], items[k]]);
    }
  }
  return out;
}

/**
 * 성립하는 모든 격자.
 *
 * 무작위 리롤이 아니라 전체를 열거해 순열로 돌리는 이유는 중복 때문이다.
 * 리롤 방식은 매일 4200개 중 하나를 독립적으로 뽑으므로 두 달 안에 같은 판이 두 번
 * 나온다(실측: 60일 중 2회). 열거해두면 목록을 한 바퀴 돌 때까지 절대 겹치지 않는다.
 *
 * 조합 수가 120 × 35 = 4200 개뿐이라 모듈 로드 시 한 번 계산해도 부담이 없다.
 */
function enumerateBoards(minAnswers: number): GridBoard[] {
  const boards: GridBoard[] = [];
  for (const rowTeams of combinations3(GRID_TEAMS)) {
    const rest = GRID_TEAMS.filter((t) => !rowTeams.includes(t));
    for (const colTeams of combinations3(rest)) {
      let ok = true;
      for (const r of rowTeams) {
        for (const c of colTeams) {
          if (countAnswers({ kind: "team", teamId: r }, { kind: "team", teamId: c }) < minAnswers) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
      }
      if (!ok) continue;
      boards.push({
        rows: rowTeams.map((teamId) => ({ kind: "team", teamId })) as GridBoard["rows"],
        cols: colTeams.map((teamId) => ({ kind: "team", teamId })) as GridBoard["cols"]
      });
    }
  }
  return boards;
}

/**
 * 출제 순서가 고정된 격자 목록.
 *
 * 고정 시드로 한 번 섞어 "무작위처럼 보이지만 매번 같은" 순서를 만든다.
 * 시드를 바꾸면 전체 순서가 밀리므로 운영 중에는 건드리지 않는다.
 *
 * 주의: players.json 이 갱신되면(새 시즌 반영) 경계에 있던 판이 목록에 들고나며
 * 이후 인덱스가 한 칸씩 밀릴 수 있다. 과거 날짜의 격자가 달라질 뿐 진행 중인
 * 오늘 판에는 영향이 없다(진행 상태는 날짜별로 따로 저장한다).
 */
const BOARD_SEQUENCE: GridBoard[] = (() => {
  const rand = mulberry32(0x5eed_9c41);
  // 기준을 통과하는 판이 없을 리 없지만, 데이터가 깨져도 화면은 띄워야 한다.
  for (const threshold of [MIN_ANSWERS_PER_CELL, Math.floor(MIN_ANSWERS_PER_CELL / 2), 1]) {
    const boards = enumerateBoards(threshold);
    if (boards.length > 0) return shuffled(boards, rand);
  }
  return [];
})();

export function getBoardSequenceLength(): number {
  return BOARD_SEQUENCE.length;
}

/** 순열에서 index 번째 격자. 음수·초과 인덱스는 접어서 항상 유효한 판을 준다. */
export function boardAt(index: number): GridBoard | null {
  if (BOARD_SEQUENCE.length === 0) return null;
  const normalized = ((index % BOARD_SEQUENCE.length) + BOARD_SEQUENCE.length) % BOARD_SEQUENCE.length;
  return BOARD_SEQUENCE[normalized];
}

/** 임의의 판 하나. 연습 모드용 — 클라이언트 이벤트 핸들러에서만 호출한다. */
export function randomBoard(): GridBoard | null {
  if (BOARD_SEQUENCE.length === 0) return null;
  return BOARD_SEQUENCE[Math.floor(Math.random() * BOARD_SEQUENCE.length)];
}
