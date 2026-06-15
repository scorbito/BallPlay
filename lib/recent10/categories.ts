export type Recent10CategoryId =
  | "avg"
  | "hr"
  | "ops"
  | "sb"
  | "era"
  | "strikeouts"
  | "hbp";

export type Recent10TopPlayer = {
  category: Recent10CategoryId;
  rank: number;
  playerId: string;
  playerName: string;
  teamId: string;
  kind: "batter" | "pitcher";
  value: number;
  displayValue: string;
  subText: string;
  stats: Record<string, number>;
};

export type Recent10Category = {
  id: Recent10CategoryId;
  label: string;
  title: string;
  description: string;
  kind: "batter" | "pitcher";
  sort: "asc" | "desc";
};

export const RECENT10_CATEGORIES: Recent10Category[] = [
  {
    id: "avg",
    label: "타율",
    title: "타율 TOP",
    description: "최근 경기에서 가장 정교했던 타자",
    kind: "batter",
    sort: "desc"
  },
  {
    id: "hr",
    label: "홈런",
    title: "홈런 TOP",
    description: "최근 경기에서 가장 강한 한 방을 보여준 타자",
    kind: "batter",
    sort: "desc"
  },
  {
    id: "ops",
    label: "OPS",
    title: "OPS TOP",
    description: "최근 경기에서 출루와 장타를 동시에 만든 타자",
    kind: "batter",
    sort: "desc"
  },
  {
    id: "sb",
    label: "도루",
    title: "도루 TOP",
    description: "최근 경기에서 가장 많이 뛴 선수",
    kind: "batter",
    sort: "desc"
  },
  {
    id: "era",
    label: "ERA",
    title: "평균자책 TOP",
    description: "최근 경기에서 가장 적게 실점한 투수",
    kind: "pitcher",
    sort: "asc"
  },
  {
    id: "strikeouts",
    label: "탈삼진",
    title: "탈삼진 TOP",
    description: "최근 경기에서 가장 많은 삼진을 잡은 투수",
    kind: "pitcher",
    sort: "desc"
  },
  {
    id: "hbp",
    label: "몸으로 출루",
    title: "몸으로 출루 TOP",
    description: "최근 경기에서 몸에 맞는 공으로 가장 많이 출루한 타자",
    kind: "batter",
    sort: "desc"
  }
];
