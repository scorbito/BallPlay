export type Team = {
  id: string;
  name: string;
  shortName: string;
  initial: string;
  color: string;
  accent?: string;
};

export type TeamStanding = {
  teamId: string;
  rank: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: string;
  gamesBehind: string;
  form: Array<"W" | "L" | "D">;
};

export type Game = {
  id: string;
  date: string;
  time: string;
  stadium: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore?: number;
  awayScore?: number;
  status: "scheduled" | "finished" | "canceled";
};

export type UserProfile = {
  nickname: string;
  mainTeamId: string;
  interestTeamIds: string[];
  avatarUrl?: string | null;
  /** 자기소개 (최대 150자, 한 줄). null이면 미입력 상태. */
  bio: string | null;
};

export type Notice = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
};

export type MatchPostEmotionTag = "cheer" | "support" | "anger" | "anxiety";
export type MatchPostStatusSnapshot = "scheduled" | "in_progress" | "finished";
export type CommunityPostType = "free" | "match_talk";

export type MatchPost = {
  id: string;
  userId: string;
  postType: CommunityPostType;
  title: string | null;
  gameId: string | null;
  body: string;
  photoUrl: string | null;
  emotionTag: MatchPostEmotionTag;
  scoreHomeAtPost: number | null;
  scoreAwayAtPost: number | null;
  inningAtPost: number | null;
  statusAtPost: MatchPostStatusSnapshot;
  createdAt: string;
  timeAgo: string;
  // 작성자 정보 (조인)
  authorNickname: string;
  authorTeamId: string;
  authorAvatarUrl?: string | null;
  // 경기 정보 (조인) — 글 카드 헤더에 필요
  game: {
    date: string;
    homeTeamId: string;
    awayTeamId: string;
    stadium: string;
    currentStatus: "scheduled" | "in_progress" | "finished" | "canceled";
  };
  // 집계
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

export type MatchPostComment = {
  id: string;
  matchPostId: string;
  userId: string;
  authorNickname: string;
  authorTeamId: string;
  authorAvatarUrl?: string | null;
  body: string;
  createdAt: string;
  timeAgo: string;
};
