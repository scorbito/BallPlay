// 경기 취소 사유·취소 확정 기간 — games 테이블에 사유 컬럼이 없고(운영 공유 DB 스키마 변경 금지),
// KBO 공식 응답도 취소 여부만 준다. 게다가 폭염 휴장처럼 사전에 발표된 취소는
// KBO 데이터에 당일까지 반영되지 않아 status 가 scheduled 로 남는다.
// 그래서 대량 취소 기간만 운영에서 여기 등록하고, 등록되지 않은 날짜는 우천으로 본다.

export type CancellationIcon = "rain" | "heat";

export type CancellationReason = {
  /** "우천취소" / "폭염취소" 처럼 뒤에 '취소'를 붙여 쓰는 짧은 라벨. */
  label: string;
  icon: CancellationIcon;
};

const RAIN: CancellationReason = { label: "우천", icon: "rain" };

type CancellationPeriod = {
  /** 시작일(포함) */
  from: string;
  /** 종료일(포함) */
  to: string;
  reason: CancellationReason;
  /**
   * 이 기간 전 경기의 취소가 확정됐는지.
   * true 면 KBO 공식 데이터가 아직 scheduled 여도 앱에서는 취소로 취급한다.
   * (동기화가 status 를 덮어써도 표기가 되돌아가지 않는다.)
   */
  allGamesCanceled: boolean;
};

const PERIODS: CancellationPeriod[] = [
  // 2026년 8월 폭염 휴장 — 08-05에서 08-09까지 전 경기 취소.
  //   08-05·08-06 은 KBO 데이터에도 canceled 로 들어왔고, 08-07 이후는 아직 scheduled 라 여기서 보정한다.
  {
    from: "2026-08-05",
    to: "2026-08-09",
    reason: { label: "폭염", icon: "heat" },
    allGamesCanceled: true
  }
];

/** 해당 날짜의 취소 사유. 등록된 기간이 없으면 우천. */
export function cancellationReasonFor(dateISO: string): CancellationReason {
  const hit = PERIODS.find((p) => dateISO >= p.from && dateISO <= p.to);
  return hit ? hit.reason : RAIN;
}

/** 해당 날짜가 "전 경기 취소 확정" 기간인지. games.status 보정에 쓴다. */
export function isAllGamesCanceledDate(dateISO: string): boolean {
  return PERIODS.some((p) => p.allGamesCanceled && dateISO >= p.from && dateISO <= p.to);
}
