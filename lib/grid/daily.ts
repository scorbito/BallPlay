// 오늘의 격자 — 서버 호출 없이 결정론적으로.
//
// 워들과 같은 방식이다. 날짜에서 시드를 만들어 buildBoard 로 돌리므로 API 도 DB 도
// 필요 없고 페이지를 정적으로 유지할 수 있다(Vercel Hobby 의 Fluid Active CPU 를
// 태우지 않는 게 이 프로젝트의 기본 제약).

import { boardAt, getBoardSequenceLength, randomBoard, type GridBoard } from "./board";

/** 서비스 시작일(KST) = 0일차. 운영 중에는 고정한다 — 바꾸면 전 날짜의 격자가 밀린다. */
export const GRID_DAY0 = "2026-08-01";

/** KST 기준 YYYY-MM-DD. */
export function kstDateString(now: Date = new Date()): string {
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const d = String(kst.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** DAY0 기준 경과 일수. 시작 전 날짜면 음수가 나올 수 있다. */
export function dayIndexFor(dateISO: string): number {
  const target = Date.parse(`${dateISO}T00:00:00+09:00`);
  const base = Date.parse(`${GRID_DAY0}T00:00:00+09:00`);
  if (Number.isNaN(target) || Number.isNaN(base)) return 0;
  return Math.floor((target - base) / 86_400_000);
}

/**
 * 그날의 격자. 미리 섞어둔 순열을 dayIndex 로 순환하므로 모든 유저·모든 기기에서
 * 같은 판이 나오고, 목록을 한 바퀴 돌기 전까지는 같은 판이 다시 나오지 않는다.
 */
export function getBoardForDate(dateISO: string): GridBoard | null {
  return boardAt(dayIndexFor(dateISO));
}

/** 며칠치 문제가 준비돼 있는지 — 안내용. */
export function getBoardPoolSize(): number {
  return getBoardSequenceLength();
}

/** 연습 모드용 임의 격자. 클라이언트 이벤트 핸들러에서만 호출한다(SSR 불일치 방지). */
export function getRandomBoard(): GridBoard | null {
  return randomBoard();
}
