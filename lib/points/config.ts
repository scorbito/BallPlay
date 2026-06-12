export const POINT_LABEL = "BP";

export const POINT_REWARDS = {
  dailyCheckin: 20,
  checkinStreakStep: 5,
  checkinStreakMaxBonus: 50,
  predictionSubmittedPerGame: 10,
  predictionSubmittedDailyMax: 50,
  predictionCorrectPerGame: 20,
  aiBattleVotePerGame: 10,
  aiBattleVoteDailyMax: 50,
  stadiumOfficialFirstFive: 20,
  stadiumOfficialAfterFive: 10,
  stadiumOfficialFirstFiveCount: 5,
  stadiumOfficialExtraMax: 100,
  playoffChampion: 1000,
  contentClaim: 10,
  contentClaimDailyMaxByType: 50,
  quizComplete: 20,
  quizPerfectBonus: 10
} as const;

export const POINT_COSTS = {
  prizeEntry: 200
} as const;

export type ContentPointType = "daily_report" | "ai_prediction";

export const CONTENT_POINT_TYPES: Record<ContentPointType, { label: string }> = {
  daily_report: { label: "일일리포트" },
  ai_prediction: { label: "AI 승리팀 예측" }
};
