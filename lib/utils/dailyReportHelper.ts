import type { GameRecord } from "@/lib/types/api-contracts";
import { teams } from "@/lib/constants/teams";

export interface GameReport {
  gameId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  summary: string;
  winningFactors: string[];
  losingFactors: string[];
  gameHeroName: string;
  gameHeroComment: string;
  oneLiner: string;
}

export interface KboDailyReport {
  reportDate: string; // YYYY-MM-DD
  headlines: string[]; // 오늘의 3줄 요약
  hotTopics: Array<{ title: string; desc: string }>; // 주요 토픽
  dailyMvpName: string; // 오늘의 KBO MVP
  dailyMvpComment: string;
  standingsSummary: string; // 순위 변동 상황 요약
  gameReports: GameReport[]; // 개별 경기 리포트
}

// 기본 뼈대 스켈레톤 생성 (AI 분석 전 기본 데이터 세팅용)
export function buildDailyReportSkeleton(games: GameRecord[], dateStr: string): KboDailyReport {
  const finishedGames = games.filter(
    g => g.date === dateStr && 
    (g.status === "finished" || g.status === "canceled")
  );

  const gameReports: GameReport[] = finishedGames.map(g => {
    const homeTeam = teams.find(t => t.id === g.homeTeamId);
    const awayTeam = teams.find(t => t.id === g.awayTeamId);
    const homeName = homeTeam?.shortName ?? g.homeTeamId;
    const awayName = awayTeam?.shortName ?? g.awayTeamId;

    const homeScore = g.homeScore ?? 0;
    const awayScore = g.awayScore ?? 0;

    let summary = "";
    let winningFactors: string[] = [];
    let losingFactors: string[] = [];
    let gameHeroName = "-";
    let gameHeroComment = "-";
    let oneLiner = "";

    if (g.status === "canceled") {
      summary = `우천 등의 사유로 인해 ${homeName}와 ${awayName}의 경기가 취소되었습니다.`;
      oneLiner = "비로 인해 쉬어가는 하루였습니다.";
    } else {
      const winner = homeScore > awayScore ? homeName : awayName;
      const loser = homeScore > awayScore ? awayName : homeName;
      summary = `${winner}가 ${loser}를 상대로 ${Math.max(homeScore, awayScore)} 대 ${Math.min(homeScore, awayScore)}로 승리를 거두었습니다.`;
      oneLiner = `${winner}의 짜릿한 승리!`;
      winningFactors = ["집중력 높은 타선", "안정적인 마운드 운영"];
      losingFactors = ["결정적인 득점 기회 무산", "아쉬운 뒷문 불안"];
    }

    return {
      gameId: g.id,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      homeScore,
      awayScore,
      summary,
      winningFactors,
      losingFactors,
      gameHeroName,
      gameHeroComment,
      oneLiner
    };
  });

  return {
    reportDate: dateStr,
    headlines: [
      "오늘의 KBO 리그 경기가 성황리에 마무리되었습니다.",
      "각 구장에서 치열한 순위 싸움이 계속되었습니다.",
      "선수들의 돋보이는 활약이 야구팬들을 즐겁게 했습니다."
    ],
    hotTopics: [
      { title: "KBO 리그 순위 다툼", desc: "순위표가 요동치며 포스트시즌을 향한 열기가 더해가고 있습니다." }
    ],
    dailyMvpName: "-",
    dailyMvpComment: "오늘의 KBO MVP 선정 예정입니다.",
    standingsSummary: "오늘 경기 결과에 따라 상하위권 팀들 간의 격차가 미세하게 요동쳤습니다.",
    gameReports
  };
}

// 해당 리포트 데이터가 실제 AI에 의해 작성되지 않은 기본 스켈레톤인지 여부 판별
export function isSkeletonReport(report: KboDailyReport | null | undefined): boolean {
  if (!report) return true;
  
  // 3줄 요약의 첫 문장이나 MVP 코멘트가 기본 뼈대 멘트와 동일한지 확인
  const isDefaultHeadline = report.headlines?.[0] === "오늘의 KBO 리그 경기가 성황리에 마무리되었습니다.";
  const isDefaultMvp = report.dailyMvpComment === "오늘의 KBO MVP 선정 예정입니다.";
  
  return isDefaultHeadline || isDefaultMvp;
}
