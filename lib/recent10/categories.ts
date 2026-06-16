export type Recent10CategoryId =
  | "avg"
  | "obp"
  | "slg"
  | "ops"
  | "hr"
  | "sb"
  | "era"
  | "strikeouts"
  | "saves"
  | "holds";

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
    description: "요즘 가장 정교하게 치는 타자",
    kind: "batter",
    sort: "desc"
  },
  {
    id: "obp",
    label: "출루율",
    title: "출루율 TOP",
    description: "최근 가장 꾸준히 살아나가는 타자",
    kind: "batter",
    sort: "desc"
  },
  {
    id: "slg",
    label: "장타율",
    title: "장타율 TOP",
    description: "최근 장타 감각이 좋은 타자",
    kind: "batter",
    sort: "desc"
  },
  {
    id: "ops",
    label: "OPS",
    title: "OPS TOP",
    description: "출루와 장타를 함께 만든 타자",
    kind: "batter",
    sort: "desc"
  },
  {
    id: "hr",
    label: "홈런",
    title: "홈런 TOP",
    description: "최근 담장을 가장 많이 넘긴 타자",
    kind: "batter",
    sort: "desc"
  },
  {
    id: "sb",
    label: "도루",
    title: "도루 TOP",
    description: "최근 가장 많이 뛴 선수",
    kind: "batter",
    sort: "desc"
  },
  {
    id: "era",
    label: "ERA",
    title: "ERA TOP",
    description: "최근 가장 안정적으로 막은 투수",
    kind: "pitcher",
    sort: "asc"
  },
  {
    id: "strikeouts",
    label: "탈삼진",
    title: "탈삼진 TOP",
    description: "최근 가장 많은 삼진을 잡은 투수",
    kind: "pitcher",
    sort: "desc"
  },
  {
    id: "saves",
    label: "세이브",
    title: "세이브 TOP",
    description: "최근 뒷문을 책임진 마무리 투수",
    kind: "pitcher",
    sort: "desc"
  },
  {
    id: "holds",
    label: "홀드",
    title: "홀드 TOP",
    description: "최근 리드를 지켜낸 불펜 투수",
    kind: "pitcher",
    sort: "desc"
  }
];
