export const POINT_LABEL = "BP";

// BP(포인트) 기능 노출 플래그.
//   false = 지금은 BP를 안 쓰므로 UI 전부 숨김(잔액·획득 버튼/토스트·경품 응모).
//   백엔드(지급/차감 API, awardPoints)는 그대로 둬도 무해 — 조용히 쌓일 뿐 화면엔 안 보임.
//   되살릴 땐 true 로만 바꾸면 됨.
export const SHOW_BP: boolean = false;

export const POINT_CONTENT_REWARD_START_AT = "2026-06-13T00:00:00+09:00";

export const POINT_REWARDS = {
  dailyCheckin: 20,
  checkinStreakStep: 5,
  checkinStreakMaxBonus: 30,
  predictionSubmittedPerGame: 20,
  predictionCorrectPerGame: 10,
  aiBattleVotePerGame: 20,
  playoffChampion: 1000,
  contentClaimByType: {
    daily_report: 20,
    daily_report_game: 10,
    ai_prediction: 20,
    weekly_report_team: 20
  },
  quizComplete: 20,
  quizPerfectBonus: 10
} as const;

export const POINT_COSTS = {
  prizeEntry: 200
} as const;

export type ContentPointType = "daily_report" | "daily_report_game" | "ai_prediction" | "weekly_report_team";

export const CONTENT_POINT_TYPES: Record<ContentPointType, { label: string }> = {
  daily_report: { label: "일일리포트 종합" },
  daily_report_game: { label: "일일리포트 경기별" },
  ai_prediction: { label: "AI 승리팀 예측" },
  weekly_report_team: { label: "주간 리포트 팀별" }
};

export function getContentPointAmount(contentType: ContentPointType): number {
  return POINT_REWARDS.contentClaimByType[contentType];
}
