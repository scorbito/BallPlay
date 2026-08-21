import type { Game, Team, TeamStanding } from "@/lib/types/domain";

export type Id = string;

export type PublicScope = "public" | "friends" | "private";
export type GameStatus = "scheduled" | "in_progress" | "finished" | "canceled";

export type UserProfileRecord = {
  id: Id;
  nickname: string;
  mainTeamId: Team["id"];
  mainTeamChangedAt: string | null;
  interestTeamIds: Team["id"][];
  notificationsEnabled: boolean;
  defaultPublicScope: PublicScope;
  avatarImageUrl: string | null;
  /** 자기소개 (최대 150자, 한 줄). null이면 미입력 상태. */
  bio: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GameRecord = Omit<Game, "date" | "time" | "status"> & {
  date: string;
  time: string | null;
  status: GameStatus;
  innings: number | null;
  /** 진행 중 경기의 초(top)/말(bottom). 예정·종료엔 null. */
  inningHalf?: "top" | "bottom" | null;
  /** 선발 투수 이름 — KBO 미발표 시 null */
  homeStarter?: string | null;
  awayStarter?: string | null;
};

export type UpdateProfileInput = {
  nickname?: string;
  mainTeamId?: Team["id"];
  interestTeamIds?: Team["id"][];
  notificationsEnabled?: boolean;
  defaultPublicScope?: PublicScope;
  avatarImageFile?: File;
  /** 자기소개 (최대 150자, 한 줄). null/빈 문자열이면 비움. */
  bio?: string | null;
};

export type ApiContracts = {
  listGames: (params: { from: string; to: string; teamId?: Team["id"] }) => Promise<GameRecord[]>;
  updateProfile: (input: UpdateProfileInput) => Promise<UserProfileRecord>;
  listStandings: (year: number) => Promise<TeamStanding[]>;
};
