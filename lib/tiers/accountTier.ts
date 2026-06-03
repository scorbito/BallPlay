// 계정 누적 승수에 따른 마일스톤 등급 시스템.
// 정의된 11단계 + 영구결번 II/III/... 무한 확장. 뱃지 파일은 public/assets/badges/Xw.png.
//
// 규칙:
//   wins < 1 → null (등급 없음, "첫 매치 도전!" 상태)
//   1 <= wins < 5 → 신인 (rank 1)
//   ... (TIERS 표 참조)
//   2000 <= wins < 3000 → 영구결번 (rank 11, suffix 없음)
//   3000 <= wins < 4000 → 영구결번 II (rank 12)
//   N000 <= wins < (N+1)000 (N >= 2) → 영구결번 + roman[N-1]
// 뱃지 파일은 rank <= 11 에서는 해당 파일, rank >= 12 에서는 "2000w.png" 재사용.

export type AccountTier = {
  /** 1부터 시작. 11 = 영구결번. 12+ = 영구결번 II, III, ... */
  rank: number;
  /** 한국어 등급 이름 (suffix 미포함). 예: "신인", "베테랑", "영구결번". */
  name: string;
  /** "II", "III", ... (rank >= 12 일 때만). */
  nameSuffix?: string;
  /** 이 등급에 도달하는 승수 threshold. */
  threshold: number;
  /** /assets/badges/Xw.png 경로. */
  badgePath: string;
  /** 등급별 모자 일러스트 경로 — /assets/tier-caps/cap-{rank}.png. rank 12+ 는 11 재사용. */
  capPath: string;
};

const TIERS = [
  { wins: 1, name: "신인", file: "1w.png" },
  { wins: 5, name: "후보", file: "5w.png" },
  { wins: 10, name: "백업", file: "10w.png" },
  { wins: 50, name: "주전", file: "50w.png" },
  { wins: 100, name: "베테랑", file: "100w.png" },
  { wins: 300, name: "4번타자", file: "300w.png" },
  { wins: 500, name: "올스타", file: "500w.png" },
  { wins: 700, name: "골든글러브", file: "700w.png" },
  { wins: 1000, name: "MVP", file: "1000w.png" },
  { wins: 1500, name: "명예의 전당", file: "1500w.png" },
  { wins: 2000, name: "영구결번", file: "2000w.png" }
] as const;

const ROMAN = ["II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

function romanFor(idx: number): string {
  // idx >= 0. 표를 넘으면 단순 "N+1" 표시(예외적인 거대 승수 케이스).
  return ROMAN[idx] ?? `${idx + 2}`;
}

function badgePathFor(file: string): string {
  return `/assets/badges/${file}`;
}

function capPathFor(rank: number): string {
  // rank 1~11 은 해당 cap, 12+ 는 영구결번(11) 재사용.
  const safeRank = rank >= 11 ? 11 : rank;
  return `/assets/tier-caps/cap-${safeRank}.png`;
}

/** 현재 wins 에 해당하는 등급. wins < 1 이면 null. */
export function getAccountTierByWins(wins: number): AccountTier | null {
  if (!Number.isFinite(wins) || wins < 1) return null;
  const w = Math.floor(wins);

  // 2000 이상 — 영구결번 + roman suffix (1000승 단위로 추가 단계).
  if (w >= 2000) {
    // 2000~2999 → rank 11, suffix 없음
    // 3000~3999 → rank 12, suffix "II"
    // N000 ~ (N+1)000-1 → rank 11 + (N - 2), suffix roman[N-3] (N >= 3)
    const thousands = Math.floor(w / 1000); // 2,3,4,...
    if (thousands === 2) {
      const tier = TIERS[10];
      return {
        rank: 11,
        name: tier.name,
        threshold: 2000,
        badgePath: badgePathFor(tier.file),
        capPath: capPathFor(11)
      };
    }
    // thousands >= 3
    const extraRank = thousands - 2; // 3→1, 4→2, ...
    return {
      rank: 11 + extraRank,
      name: "영구결번",
      nameSuffix: romanFor(extraRank - 1),
      threshold: thousands * 1000,
      // 2000w.png 재사용 — 별도 뱃지 자원 없음.
      badgePath: badgePathFor("2000w.png"),
      capPath: capPathFor(11 + extraRank)
    };
  }

  // 일반 단계 — 가장 높은 매칭 threshold 찾기.
  let matchedIdx = -1;
  for (let i = 0; i < TIERS.length; i += 1) {
    if (w >= TIERS[i].wins) matchedIdx = i;
    else break;
  }
  if (matchedIdx < 0) return null;
  const tier = TIERS[matchedIdx];
  const rank = matchedIdx + 1;
  return {
    rank,
    name: tier.name,
    threshold: tier.wins,
    badgePath: badgePathFor(tier.file),
    capPath: capPathFor(rank)
  };
}

/** 표시용 — "베테랑" 또는 "영구결번 II". */
export function formatTierName(tier: AccountTier): string {
  return tier.nameSuffix ? `${tier.name} ${tier.nameSuffix}` : tier.name;
}
