// 그리드 게임의 팀 축.
//
// 순서 = data/grid/players.json 의 팀 비트마스크 순서다. 바꾸면 저장된 데이터가
// 통째로 어긋나므로 절대 재정렬하지 않는다 (scripts/build-grid-data.mjs 와 쌍).

export const GRID_TEAMS = [
  "lg",
  "doosan",
  "kt",
  "samsung",
  "ssg",
  "nc",
  "kia",
  "hanwha",
  "kiwoom",
  "lotte"
] as const;

export type GridTeamId = (typeof GRID_TEAMS)[number];

/** 팀 id → 비트 위치. 마스크 검사에 쓴다. */
export const TEAM_BIT: Record<GridTeamId, number> = GRID_TEAMS.reduce(
  (acc, id, index) => {
    acc[id] = 1 << index;
    return acc;
  },
  {} as Record<GridTeamId, number>
);

/**
 * 축 라벨에 쓰는 과거 팀명 병기.
 *
 * "LG에서 뛴 선수"에는 MBC 청룡 시절도 포함되는데, 라벨이 "LG"뿐이면 올드팬이
 * 정답을 알면서도 넣지 않는다. 프랜차이즈 승계를 축 라벨에서 미리 알려준다.
 */
export const FRANCHISE_NOTE: Partial<Record<GridTeamId, string>> = {
  lg: "MBC 포함",
  doosan: "OB 포함",
  ssg: "SK 포함",
  kia: "해태 포함",
  hanwha: "빙그레 포함",
  kiwoom: "히어로즈·넥센 포함"
};
