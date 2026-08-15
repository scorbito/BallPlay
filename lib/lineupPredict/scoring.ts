// 라인업 예측 채점 — 예측 9명과 실제 선발 9명을 대조한다.
//
// 9명을 타순까지 전부 맞히는 건 사실상 불가능하다. 실제로는 라인업이 매일 한두 자리씩
// 바뀌므로, 다 맞히거나 다 틀리는 이분법이면 결과가 늘 "실패"로만 보인다.
// 그래서 부분 점수로 센다.
//
//   hit   — 실제 선발 명단에 든 수 (타순 무관, 0~9)
//   exact — 타순 자리까지 맞은 수 (0~9, 항상 hit 이하)
//
// 선수 동일성은 rosterId 를 우선 쓰고, 없으면 이름으로 떨어진다.
// 로스터 갱신 전 신규 등록 선수는 rosterId 가 비어 올 수 있다.

export type LineupPick = {
  order: number;
  name: string;
  rosterId?: string | null;
  /** 수비 위치. 채점에는 쓰지 않고 화면 복원(다이아몬드 배치)에만 쓴다.
   *  저장하지 않으면 다시 불러올 때 선수 기본 포지션으로 떨어져 배치가 뭉갠다. */
  position?: string | null;
};

export type LineupScore = {
  hitCount: number;
  exactCount: number;
  /**
   * 수비 위치까지 맞은 수(0~9) — 보너스 지표다.
   * 지명타자나 좌익/우익 같은 자리는 감독이 상대 선발에 따라 수시로 바꿔서
   * 맞히기가 매우 어렵다. 그래서 메인 지표(적중)와 분리해 덤으로 둔다.
   */
  positionCount: number;
  /** 타순별 판정 — 결과 화면에서 자리마다 표시한다. */
  detail: Array<{
    order: number;
    name: string;
    /** "exact" 타순까지 정답 · "hit" 명단에는 있음 · "miss" 선발 아님 */
    result: "exact" | "hit" | "miss";
    /** 실제 그 타순에 나온 선수 (틀렸을 때 보여준다) */
    actualName: string | null;
    /** 수비 위치까지 맞았는지. 명단에 없는 선수(miss)는 항상 false. */
    positionCorrect: boolean;
  }>;
};

/** 같은 선수인지 — rosterId 우선, 없으면 이름. */
function isSamePlayer(a: LineupPick, b: LineupPick): boolean {
  if (a.rosterId && b.rosterId) return a.rosterId === b.rosterId;
  return a.name === b.name;
}

/**
 * @param picks 유저 예측 (타순 1~9)
 * @param actual 실제 선발 라인업 (bp_team_recent_lineups.batting)
 */
export function scoreLineupPrediction(picks: LineupPick[], actual: LineupPick[]): LineupScore {
  const actualByOrder = new Map<number, LineupPick>();
  for (const a of actual) actualByOrder.set(a.order, a);

  /** 실제 라인업에서 그 선수가 맡은 수비 위치 — 타순과 무관하게 비교한다. */
  const actualPositionOf = (pick: LineupPick): string | null => {
    const found = actual.find((a) => isSamePlayer(a, pick));
    return found?.position ?? null;
  };

  // 명단 포함 여부는 "한 번만" 인정한다. 같은 선수를 두 자리에 넣어 hit 를
  // 부풀리는 걸 막으려면 매칭된 실제 선수를 소진시켜야 한다.
  const unmatched = [...actual];

  const detail: LineupScore["detail"] = [];
  let hitCount = 0;
  let exactCount = 0;
  let positionCount = 0;

  // 1차: 타순까지 일치하는 자리를 먼저 확정한다. 순서를 뒤로 미루면
  // 같은 선수가 다른 자리에서 hit 로 먼저 소진돼 exact 를 놓칠 수 있다.
  const exactAt = new Set<number>();
  for (const pick of picks) {
    const sameOrder = actualByOrder.get(pick.order);
    if (sameOrder && isSamePlayer(pick, sameOrder)) {
      exactAt.add(pick.order);
      const idx = unmatched.findIndex((u) => isSamePlayer(u, pick));
      if (idx > -1) unmatched.splice(idx, 1);
    }
  }

  for (const pick of picks) {
    const actualHere = actualByOrder.get(pick.order) ?? null;
    // 선발에 든 선수만 수비 위치를 따진다. 명단에 없으면 비교할 대상이 없다.
    const actualPosition = actualPositionOf(pick);
    const positionCorrect = Boolean(actualPosition && pick.position && actualPosition === pick.position);

    if (exactAt.has(pick.order)) {
      exactCount += 1;
      hitCount += 1;
      if (positionCorrect) positionCount += 1;
      detail.push({
        order: pick.order,
        name: pick.name,
        result: "exact",
        actualName: actualHere?.name ?? null,
        positionCorrect
      });
      continue;
    }

    const idx = unmatched.findIndex((u) => isSamePlayer(u, pick));
    if (idx > -1) {
      unmatched.splice(idx, 1);
      hitCount += 1;
      if (positionCorrect) positionCount += 1;
      detail.push({
        order: pick.order,
        name: pick.name,
        result: "hit",
        actualName: actualHere?.name ?? null,
        positionCorrect
      });
      continue;
    }

    detail.push({
      order: pick.order,
      name: pick.name,
      result: "miss",
      actualName: actualHere?.name ?? null,
      positionCorrect: false
    });
  }

  detail.sort((a, b) => a.order - b.order);
  return { hitCount, exactCount, positionCount, detail };
}

/** 결과 한 줄 요약 — 공유 문구와 결과 화면 헤드라인에 함께 쓴다. */
export function describeLineupScore(score: LineupScore): string {
  if (score.exactCount === 9) return "완벽한 라인업 적중!";
  if (score.hitCount === 9) return "선발 9명 전원 적중!";
  if (score.hitCount >= 7) return "감독급 예측!";
  if (score.hitCount >= 5) return "절반 이상 적중";
  if (score.hitCount >= 3) return "아쉬운 한 판";
  return "다음 경기에 다시 도전!";
}
