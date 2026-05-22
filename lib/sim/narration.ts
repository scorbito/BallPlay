// 시뮬레이션 중계 멘트 풀.
// 시드(cursor + outcomeStep) 기반 deterministic 선택 → 같은 시뮬은 같은 멘트.
// 친구 대결 양쪽 클라이언트 sync 보장.
//
// 구조:
//   - getSituationText:  상황 안내 (이닝·점수·주자·아웃 조합)
//   - getBatterText:     타자 소개 (타순·이름·시즌 스탯)
//   - getOutcomeText:    타격 결과 (outcome별 풀)
//   - getHomerunText:    주자 홈인 안내
//   - getScoreText:      스코어 변동 (역전·동점·리드 등)

import type { AtBatOutcome, SimBatter } from "./types";

// ============================================================
// 시드 선택 — cursor 기반 32-bit hash
// ============================================================
function pickByCursor<T>(pool: readonly T[], cursor: number, salt = 0): T {
  if (pool.length === 0) throw new Error("empty narration pool");
  const h = ((cursor * 2654435761) ^ (salt * 0x9e3779b1)) >>> 0;
  return pool[h % pool.length];
}

// ============================================================
// 상황 SITUATION — 이닝·점수차·주자·아웃 조합으로 톤 결정
// ============================================================

/** "9회말 2아웃 · 주자 1·3루 · 5-4" 같은 기본 골격 + 톤 멘트 */
export function getSituationText(args: {
  cursor: number;
  inning: number;
  half: "top" | "bottom";
  outsBefore: 0 | 1 | 2;
  baseStateBefore: { first: string | null; second: string | null; third: string | null };
  scoreBefore: { home: number; away: number };
  totalInnings: number;
}): string {
  const { cursor, inning, half, outsBefore, baseStateBefore: bs, scoreBefore: sc } = args;

  // 베이스 라벨
  const onBases = [bs.first && "1루", bs.second && "2루", bs.third && "3루"].filter(Boolean) as string[];
  const baseLabel = onBases.length === 0 ? "주자 없음" : `주자 ${onBases.join("·")}`;
  const isBasesLoaded = !!bs.first && !!bs.second && !!bs.third;
  const isScoringPosition = !!bs.second || !!bs.third;

  // 스코어 라벨
  const diff = Math.abs(sc.home - sc.away);
  const scoreLabel =
    sc.home === sc.away ? `${sc.home}-${sc.away} 동점` : `${Math.max(sc.home, sc.away)}-${Math.min(sc.home, sc.away)}`;

  // 이닝 톤
  const isLate = inning >= 7;
  const isFinal = inning >= 9;
  const isExtra = inning >= 10;
  const isClose = diff <= 2;

  const halfLabel = half === "top" ? "초" : "말";
  const base = `${inning}회${halfLabel} ${outsBefore}아웃 · ${baseLabel} · ${scoreLabel}`;

  // 강조 멘트 (드물게)
  const dramaPool: string[] = [];
  if (isBasesLoaded) {
    dramaPool.push(
      `${base} — 만루 찬스!`,
      `${base}. 만루의 기회입니다`,
      `${base}. 한 방이면 분위기가 달라집니다`
    );
  } else if (isFinal && isClose) {
    dramaPool.push(
      `${base}. 박빙의 종반전`,
      `${base} — 손에 땀이 나는 ${inning}회`,
      `${base}. 한 점이 절실합니다`,
      `${base}. 결정적인 순간이 옵니다`
    );
  } else if (isLate && isScoringPosition) {
    dramaPool.push(
      `${base} — 득점권 찬스`,
      `${base}. 추가점 노립니다`,
      `${base}. 좋은 기회를 잡았습니다`
    );
  } else if (isExtra) {
    dramaPool.push(
      `${base} — 연장 ${inning}회까지 이어집니다`,
      `${base}. 승부는 아직`
    );
  } else if (inning === 1 && half === "top" && sc.home === 0 && sc.away === 0) {
    dramaPool.push(
      `경기 시작! ${base}`,
      `${base}. 플레이볼`,
      `${base} — 첫 타석부터 시작합니다`
    );
  }

  if (dramaPool.length > 0) {
    return pickByCursor(dramaPool, cursor, 1);
  }

  // 평범 톤 — 같은 베이스 라벨에 변형 멘트
  const calmPool = [
    base,
    `${base}.`,
    base.replace("·", "·")
  ];
  return pickByCursor(calmPool, cursor, 1);
}

// ============================================================
// 타자 BATTER — 타순·이름·간단 스탯
// ============================================================

export function getBatterText(args: {
  cursor: number;
  orderIdx: number; // 0-based
  batter: SimBatter | null;
  withStats: boolean; // live 모드에선 타율 표시
}): string {
  const { cursor, orderIdx, batter, withStats } = args;
  const orderPrefix = orderIdx >= 0 ? `${orderIdx + 1}번 타자` : "타자";
  const name = batter?.name ?? "선수";

  const variations = [
    `${orderPrefix} ${name}`,
    `${orderPrefix}, ${name}`,
    `${orderPrefix} ${name} 타석에 들어섭니다`,
    `타석에 들어서는 ${orderPrefix} ${name}`
  ];

  if (!withStats || !batter) {
    return pickByCursor(variations, cursor, 2);
  }

  // 스탯 포함 — 타율 또는 HR
  const avg = formatAvg(batter.avg);
  const hr = batter.homers;
  const statsVariations = [
    `${orderPrefix} ${name} · 타율 ${avg}`,
    `${orderPrefix} ${name}, 시즌 타율 ${avg}`,
    `${orderPrefix} ${name} (${avg})`,
    hr >= 10 ? `${orderPrefix} ${name} · 시즌 ${hr}홈런` : null,
    avg >= "0.300" ? `${orderPrefix} ${name} · 타격감 좋은 ${avg}의 타자` : null,
    `타석으로 들어서는 ${orderPrefix} ${name}, 타율 ${avg}`
  ].filter((s): s is string => s !== null);

  return pickByCursor(statsVariations, cursor, 2);
}

function formatAvg(avg: number): string {
  // 0.310 → ".310"
  return avg.toFixed(3).replace(/^0/, "");
}

// ============================================================
// 결과 OUTCOME — outcome별 풀
// ============================================================

const OUTCOME_POOLS: Record<AtBatOutcome, readonly string[]> = {
  K: [
    "삼진!",
    "헛스윙 삼진!",
    "삼진으로 물러납니다",
    "공을 못 따라갑니다, 삼진",
    "스트라이크 아웃!",
    "타이밍이 어긋났습니다, 삼진",
    "결국 삼진으로 끝납니다",
    "헛스윙! 삼진!"
  ],
  BB: [
    "볼넷으로 출루합니다",
    "볼넷, 1루로 걸어 나갑니다",
    "포볼! 1루 출루",
    "공을 골라 나갑니다, 볼넷",
    "신중한 선구안, 볼넷"
  ],
  HBP: [
    "사구! 1루로 진루",
    "몸에 맞는 공, 1루 출루",
    "공이 몸을 맞춥니다, 사구",
    "사구로 살아갑니다"
  ],
  "1B": [
    "안타!",
    "안타로 출루합니다",
    "공이 빠집니다, 안타!",
    "정확한 타격, 안타",
    "1루타!",
    "안타로 살아갑니다",
    "깔끔한 안타가 나옵니다",
    "공을 받아 쳐 안타!"
  ],
  "2B": [
    "2루타!",
    "외야로 빠지는 2루타!",
    "쳤습니다, 펜스 앞에서 잡힙니다... 2루타!",
    "큰 타구! 2루까지 들어갑니다",
    "라인 따라 빠지는 2루타",
    "장타로 이어집니다, 2루타!"
  ],
  "3B": [
    "3루타!",
    "쳤습니다! 외야 깊숙이... 3루까지!",
    "코너 깊숙이 굴러갑니다, 3루타!",
    "엄청난 장타, 3루타가 됩니다",
    "발 빠른 주자, 3루까지 들어갑니다"
  ],
  HR: [
    "홈런!!! 넘어갔습니다!",
    "쳤습니다... 외야 멀리... 넘어갑니다, 홈런!",
    "큰 타구! 그대로 담장을 넘어갑니다!",
    "홈런! 멋진 한 방이 터집니다!",
    "쳤습니다... 갑니다, 갑니다... 홈런!!",
    "담장을 훌쩍 넘어가는 홈런!",
    "한 방이 터집니다, 홈런!",
    "관중석으로 빨려 들어가는 홈런!"
  ],
  GO: [
    "땅볼 아웃",
    "내야 땅볼, 1루 송구... 아웃!",
    "내야로 굴러갑니다, 잡아 1루로... 아웃",
    "땅볼, 처리하고 1루 아웃",
    "발 빠른 처리, 땅볼 아웃"
  ],
  FO: [
    "외야 플라이 아웃",
    "외야로 떠오릅니다... 잡혔습니다",
    "외야 깊은 플라이, 잡아냅니다",
    "공이 외야로... 캐치, 아웃",
    "잘 쳤지만 외야 정면, 아웃"
  ],
  PO: [
    "내야 플라이 아웃",
    "공이 떠오릅니다... 내야 플라이 아웃",
    "쉽게 잡아냅니다, 내야 플라이",
    "가까운 거리, 내야 플라이로 아웃"
  ],
  LO: [
    "직선타 아웃!",
    "잘 맞았지만 정면, 직선타 아웃",
    "라이너 캐치, 아웃!",
    "강한 타구! 그대로 잡힙니다"
  ],
  SF: [
    "희생플라이! 1점이 들어옵니다",
    "외야 플라이로 희생타, 1점 추가",
    "타자는 아웃되지만 점수가 들어옵니다",
    "희생플라이로 점수를 만들어냅니다"
  ],
  DP: [
    "병살타!",
    "땅볼... 더블 플레이!",
    "공이 굴러갑니다, 2루-1루로... 병살!",
    "최악의 결과, 병살타로 두 아웃",
    "병살! 한 타석에 두 명을 잡아냅니다"
  ],
  E: [
    "실책! 살아갑니다",
    "수비 실수, 출루합니다",
    "공을 놓칩니다, 실책 출루"
  ]
};

export function getOutcomeText(outcome: AtBatOutcome, cursor: number): string {
  const pool = OUTCOME_POOLS[outcome];
  return pickByCursor(pool, cursor, 3);
}

// ============================================================
// 홈인 HOMERUN — 누가 홈인했는지 + 몇 점
// ============================================================

export function getHomerunText(args: {
  cursor: number;
  outcome: AtBatOutcome;
  runners: string[]; // 홈인한 선수 이름들
  runsScored: number;
  isBasesLoadedHR?: boolean;
}): string {
  const { cursor, outcome, runners, runsScored, isBasesLoadedHR } = args;

  // 만루 홈런 특별 멘트
  if (isBasesLoadedHR) {
    const pool = [
      `만루 홈런! ${runners.join("·")} 모두 홈인! 4점!`,
      `그랜드 슬램! ${runners.join("·")} 4명이 홈을 밟습니다`,
      `최고의 한 방! 만루 홈런으로 4점이 한꺼번에!`
    ];
    return pickByCursor(pool, cursor, 4);
  }

  // HR (만루 아님)
  if (outcome === "HR") {
    if (runners.length === 1) {
      const pool = [
        `${runners[0]} 솔로 홈런! 1점`,
        `${runners[0]}의 솔로포! 1점`,
        `${runners[0]} 혼자 홈을 밟습니다`
      ];
      return pickByCursor(pool, cursor, 4);
    }
    const pool = [
      `${runners.join("·")} 모두 홈인! ${runsScored}점`,
      `${runsScored}점 홈런! ${runners.join("·")} 들어옵니다`,
      `${runsScored}런 홈런!`
    ];
    return pickByCursor(pool, cursor, 4);
  }

  // 일반 안타·SF·BB로 인한 홈인
  if (runsScored === 1 && runners.length === 1) {
    const pool = [
      `${runners[0]} 홈인! 1점 추가`,
      `${runners[0]}이 들어옵니다, 1점`,
      `1점 추가! ${runners[0]} 홈인`,
      `${runners[0]} 홈을 밟습니다`
    ];
    return pickByCursor(pool, cursor, 4);
  }

  // 다점 (장타로 여러 명)
  const joinedRunners = runners.length > 0 ? runners.join("·") : `${runsScored}명`;
  const pool = [
    `${joinedRunners} 연속 홈인! ${runsScored}점 추가`,
    `${runsScored}점이 한꺼번에 들어옵니다`,
    `${joinedRunners} 모두 홈! ${runsScored}점`
  ];
  return pickByCursor(pool, cursor, 4);
}

// ============================================================
// 스코어 SCORE — 역전·동점·리드·추가점
// ============================================================

export function getScoreText(args: {
  cursor: number;
  scoreBefore: { home: number; away: number };
  scoreAfter: { home: number; away: number };
}): string {
  const { cursor, scoreBefore: b, scoreAfter: a } = args;
  const diffBefore = a.home === a.away ? 0 : Math.abs(b.home - b.away);
  const diffAfter = Math.abs(a.home - a.away);
  const finalScore = `${a.away}-${a.home}`;

  // 동점 만들기
  if (b.home !== b.away && a.home === a.away) {
    const pool = [
      `동점! ${finalScore}`,
      `따라잡습니다! ${finalScore} 동점`,
      `경기를 원점으로! ${finalScore}`,
      `${finalScore}, 동점이 됩니다`
    ];
    return pickByCursor(pool, cursor, 5);
  }

  // 역전
  const wasHomeLeading = b.home > b.away;
  const isHomeLeading = a.home > a.away;
  if (b.home !== b.away && wasHomeLeading !== isHomeLeading && a.home !== a.away) {
    const pool = [
      `역전! ${finalScore}`,
      `경기를 뒤집습니다! ${finalScore}`,
      `리드를 빼앗아옵니다, ${finalScore}`,
      `역전 점수! ${finalScore}`
    ];
    return pickByCursor(pool, cursor, 5);
  }

  // 선취점 (0-0에서 점수)
  if (b.home === 0 && b.away === 0 && (a.home > 0 || a.away > 0)) {
    const pool = [
      `선취점! ${finalScore}`,
      `${finalScore}, 먼저 점수를 만듭니다`,
      `첫 득점! ${finalScore}`
    ];
    return pickByCursor(pool, cursor, 5);
  }

  // 리드 확대
  if (diffAfter > diffBefore && diffAfter >= 2) {
    const pool = [
      `리드 확대, ${finalScore}`,
      `${finalScore}, 점수차를 벌립니다`,
      `${diffAfter}점차, ${finalScore}`,
      `격차를 벌립니다, ${finalScore}`
    ];
    return pickByCursor(pool, cursor, 5);
  }

  // 추격
  if (diffAfter < diffBefore && diffAfter >= 1) {
    const pool = [
      `한 점 차! ${finalScore}`,
      `${finalScore}, 따라붙습니다`,
      `점수차를 좁힙니다, ${finalScore}`
    ];
    return pickByCursor(pool, cursor, 5);
  }

  // 평범 (점수만)
  const pool = [
    `${finalScore}`,
    `현재 ${finalScore}`,
    `스코어 ${finalScore}`
  ];
  return pickByCursor(pool, cursor, 5);
}
