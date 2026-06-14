export const POINT_LABEL = "BP";

export const POINT_CONTENT_REWARD_START_AT = "2026-06-13T00:00:00+09:00";

export const POINT_REWARDS = {
  dailyCheckin: 20,
  checkinStreakStep: 5,
  checkinStreakMaxBonus: 30,
  predictionSubmittedPerGame: 20,
  predictionCorrectPerGame: 10,
  aiBattleVotePerGame: 20,
  stadiumOfficialFirstFive: 20,
  stadiumOfficialAfterFive: 10,
  stadiumOfficialFirstFiveCount: 5,
  stadiumOfficialExtraMax: 100,
  playoffChampion: 1000,
  contentClaimByType: {
    daily_report: 20,
    daily_report_game: 10,
    ai_prediction: 20
  },
  quizComplete: 20,
  quizPerfectBonus: 10
} as const;

export const POINT_COSTS = {
  prizeEntry: 200
} as const;

export type ContentPointType = "daily_report" | "daily_report_game" | "ai_prediction";

export const CONTENT_POINT_TYPES: Record<ContentPointType, { label: string }> = {
  daily_report: { label: "일일리포트 종합" },
  daily_report_game: { label: "일일리포트 경기별" },
  ai_prediction: { label: "AI 승리팀 예측" }
};

export function getContentPointAmount(contentType: ContentPointType): number {
  return POINT_REWARDS.contentClaimByType[contentType];
}
