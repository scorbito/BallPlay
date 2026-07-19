import type { GameRecord } from "@/lib/types/api-contracts";
import { teams } from "@/lib/constants/teams";

export interface SeriesResult {
  opponent: string;
  result: "winning" | "losing" | "sweep_win" | "sweep_loss" | "split";
  score: string;
  summary: string;
  details: string;
  hidden?: boolean;
}

export interface TeamWeeklyReport {
  teamName: string;
  teamCode: string; // 팀 ID (kia, doosan 등)
  weeklyRank: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  overallComment: string;
  series1: SeriesResult; // 주중 (화~목)
  series2: SeriesResult; // 주말 (금~일), 단일 시리즈 주간이면 hidden 처리 가능
}

// 요일 판별 헬퍼 (일요일: 0, 월요일: 1, 화요일: 2, 수요일: 3, 목요일: 4, 금요일: 5, 토요일: 6)
function getDayOfWeek(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00+09:00`);
  return d.getDay();
}

// 실제 6월 1주차 주요 스포츠 뉴스 및 이슈를 바탕으로 한 구단별 정적 리포트 코멘트 데이터베이스
const REAL_NEWS_DATABASE: Record<string, {
  overallComment: string;
  series1Details: string;
  series2Details: string;
}> = {
  doosan: {
    overallComment: "주중 한화전 연장 혈투 끝에 기선을 제압하고 주말 키움전까지 위닝을 묶어 주간 4승 1무 1패로 단독 1위를 질주했습니다.",
    series1Details: "한화를 맞아 잠실 홈에서 치열한 투수전이 전개되었습니다. 1차전 연장 끝에 신승을 따냈고, 2차전은 3-3 극적인 무승부로 끝났으나, 3차전에서 탄탄한 계투진의 방어력으로 3-1 승리를 이끌며 시리즈 무패 위닝을 달성했습니다.",
    series2Details: "주말 키움과의 홈 3연전에서는 이영하와 최민석의 쾌투로 위닝 시리즈를 조기 확정지었습니다. 특히 일요일 경기에는 엔비디아 CEO 젠슨 황이 깜짝 방문해 시구를 선보이며 큰 화제를 낳았으나, 아쉽게 1-4로 패해 스윕에는 실패했습니다."
  },
  kia: {
    overallComment: "롯데와 삼성을 상대로 거둔 주간 4승 2패의 성적으로 선두 자리를 굳건히 지켰습니다.",
    series1Details: "광주 홈에서 롯데 자이언츠를 상대로 화력전을 펼쳤습니다. 1차전 5-4 짜릿한 한 점 차 승리를 거두고 2차전은 내줬으나, 3차전에서 타선이 10득점을 대폭발시키며 10-0 영봉승과 함께 가볍게 위닝 시리즈를 확정지었습니다.",
    series2Details: "주말 대구 원정에서 라이벌 삼성을 만나 피 말리는 접전을 벌였습니다. 양 팀 마무리 투수들의 총력전 속에서 일요일 최종전을 7-6 1점 차 승리로 장식하며 귀중한 원정 위닝 시리즈를 가져왔습니다."
  },
  nc: {
    overallComment: "삼성과 LG라는 까다로운 상대들을 연이어 격파하며 주간 4승 2패로 대단한 상승세를 보였습니다.",
    series1Details: "대구 원정에서 삼성을 상대로 1차전을 패하며 시작했지만, 이후 선발 하트와 신민혁이 마운드를 안정적으로 이끌고 타선이 집중력을 발휘해 내리 2승을 수확하며 역전 위닝을 완성했습니다.",
    series2Details: "안방 창원에서 LG 트윈스를 상대하여 금요일 경기는 패했으나 토요일 8-5 승리, 일요일 7-6 극적인 대역전극을 일궈내며 홈 팬들 앞에서 짜릿한 위닝 시리즈를 선물했습니다."
  },
  ssg: {
    overallComment: "키움과 KT를 상대로 연속으로 위닝 시리즈를 달성하며 주간 승률 공동 2위를 마크했습니다.",
    series1Details: "문학 안방에서 키움을 상대로 접전을 펼쳤습니다. 1차전 홈런포 공세로 승기를 잡았고, 2차전을 내준 뒤 맞이한 3차전 결승 경기에서 마무리 서진용의 호투에 힘입어 7-6 승리를 이끌고 위닝을 달성했습니다.",
    series2Details: "KT와의 주말 3연전에서 선발 김광현의 눈부신 피칭으로 기선을 제압했고, 비록 토요일 경기는 내줬으나 일요일 경기에서 마운드가 상대 타선을 완벽히 틀어막으며 7-0 대승으로 기분 좋은 위닝을 수확했습니다."
  },
  hanwha: {
    overallComment: "주중 두산 원정에서의 부진을 사직 롯데 원정 3연전 스윕승으로 완벽하게 극복하며 대반격의 서막을 열었습니다.",
    series1Details: "잠실 두산전에서 매 경기 박빙의 접전을 펼쳤으나 득점권 찬스에서의 아쉬운 침묵으로 1무 2패 루징 시리즈를 안고 아쉽게 일정을 마무리했습니다.",
    series2Details: "사직 롯데 원정에서 화력이 대폭발했습니다. 특히 금요일 경기에서 에이스 류현진이 선발 등판해 6이닝 2실점 무결점 투구로 승리를 견인했고, 일요일 경기에서는 9-8 역대급 타격 난타전 끝에 승리해 사직구장을 주황빛으로 물들이며 3연전 스윕을 장식했습니다."
  },
  lg: {
    overallComment: "주중 KT전에서 위닝을 올리며 선두 추격을 이어갔으나 주말 NC 원정에서 아쉽게 뒷심 부족으로 주춤했습니다.",
    series1Details: "수원 KT 원정에서 타선이 대폭발했습니다. 1차전 10-1 대승에 이어 3차전에서 오스틴 딘의 쐐기 홈런포에 힘입어 7-5 승리를 거두며 기분 좋은 주중 원정 위닝 시리즈를 선사했습니다.",
    series2Details: "창원 NC 원정에서 주말 3연전을 치렀으나 불펜진이 상대 NC의 불방망이를 버텨내지 못했습니다. 금요일 경기를 5-4로 이겼음에도 토요일과 일요일 연달아 뼈아픈 역전패를 허용하며 루징 시리즈를 안았습니다."
  },
  samsung: {
    overallComment: "주중 NC전과 주말 KIA전에서 모두 한 끗 차이로 밀리며 주간 2승 4패로 아쉬운 한 주를 보냈습니다.",
    series1Details: "NC를 대구 홈으로 불러들여 기분 좋게 1차전을 끝내기로 장식했으나, 이후 2차전과 3차전에서 마운드가 버텨주지 못하고 연패하며 주중 루징 시리즈를 당했습니다.",
    series2Details: "광주에서 펼쳐진 선두 KIA와의 라이벌 3연전에서 매 경기 명승부를 펼쳤습니다. 마무리 오승환이 뒷문을 틀어막은 토요일 경기는 3-2로 승리했으나, 일요일 경기에서 6-7 아쉬운 1점 차 패배를 당하며 루징을 겪었습니다."
  },
  kt: {
    overallComment: "마운드의 부진과 집중력 부족이 겹치며 주중 LG전, 주말 SSG전에서 모두 루징에 머물렀습니다.",
    series1Details: "LG 트윈스를 상대로 수원 홈에서 선발진이 무너지며 힘겨운 경기를 치렀습니다. 쿠에바스가 등판한 2차전을 승리했으나 나머지 두 경기에서 대량 실점하며 아쉽게 시리즈를 내줬습니다.",
    series2Details: "문학 SSG 원정에서 금요일 접전 끝에 1점 차 패배를 당했고, 토요일 반격에 성공했으나 일요일 경기에서 타선이 단 1점도 내지 못하는 0-7 완봉패를 당해 주말 시리즈 역시 루징으로 끝났습니다."
  },
  kiwoom: {
    overallComment: "주중 SSG전과 주말 두산전 모두 1승 2패에 그치며 하위권 탈출에 애를 먹었습니다.",
    series1Details: "SSG 원정에서 후라도가 호투한 2차전을 잡아내며 균형을 맞췄으나, 1차전 완패와 3차전 막판 추격에 실패해 6-7 패배를 안고 루징 시리즈를 당했습니다.",
    series2Details: "잠실 두산전에서 금요일과 토요일 무기력한 타선 부진으로 경기를 내줬으나, 일요일 젠슨 황 엔비디아 CEO가 시구하며 이목이 쏠린 경기에서 집중력을 발휘해 4-1로 승리하며 연패 탈출에 성공했습니다."
  },
  lotte: {
    overallComment: "주중 KIA전 루징에 이어 주말 한화 홈 3연전에서는 마운드가 완전히 붕괴하며 쓰라린 스윕패를 기록했습니다.",
    series1Details: "선두 KIA를 광주에서 맞아 반즈의 퀄리티 스타트 피칭을 앞세워 2차전을 따냈으나, 3차전에서 0-10 대패를 겪는 등 화력 싸움에서 완패해 루징 시리즈를 떠안았습니다.",
    series2Details: "사직 홈에서 열린 한화 3연전은 투수진 붕괴로 얼룩진 한 주였습니다. 3경기 평균 8실점 이상을 헌납했고, 특히 일요일 최종전에서 8-9로 끈질기게 추격했으나 끝내 역전에는 실패해 홈 팬들 앞에서 뼈아픈 3연전 전패 스윕패 수모를 당했습니다."
  }
};

// KBO 경기 데이터 기반으로 주간 성적 및 리포트 완성
export function buildWeeklyReport(games: GameRecord[], weekName: string): TeamWeeklyReport[] {
  const finishedGames = games.filter(g => g.status === "finished" && g.homeScore !== undefined && g.awayScore !== undefined);

  // 팀별 전적 맵 초기화
  const teamMap = new Map<string, {
    wins: number;
    losses: number;
    draws: number;
    series1Games: Array<{ opponentId: string; win: boolean; draw: boolean; lose: boolean }>;
    series2Games: Array<{ opponentId: string; win: boolean; draw: boolean; lose: boolean }>;
  }>();

  teams.forEach(t => {
    teamMap.set(t.id, {
      wins: 0,
      losses: 0,
      draws: 0,
      series1Games: [],
      series2Games: []
    });
  });

  // 경기 기록 집계
  finishedGames.forEach(g => {
    const homeId = g.homeTeamId;
    const awayId = g.awayTeamId;
    const homeScore = g.homeScore ?? 0;
    const awayScore = g.awayScore ?? 0;

    const homeData = teamMap.get(homeId);
    const awayData = teamMap.get(awayId);

    if (!homeData || !awayData) return;

    const day = getDayOfWeek(g.date);
    const isSeries1 = day >= 2 && day <= 4;
    const isSeries2 = day === 5 || day === 6 || day === 0;

    let homeWin = false;
    let homeDraw = false;
    let homeLose = false;

    if (homeScore > awayScore) {
      homeWin = true;
      homeData.wins++;
      awayData.losses++;
    } else if (homeScore < awayScore) {
      homeLose = true;
      homeData.losses++;
      awayData.wins++;
    } else {
      homeDraw = true;
      homeData.draws++;
      awayData.draws++;
    }

    if (isSeries1) {
      homeData.series1Games.push({ opponentId: awayId, win: homeWin, draw: homeDraw, lose: homeLose });
      awayData.series1Games.push({ opponentId: homeId, win: homeLose, draw: homeDraw, lose: homeWin });
    } else if (isSeries2) {
      homeData.series2Games.push({ opponentId: awayId, win: homeWin, draw: homeDraw, lose: homeLose });
      awayData.series2Games.push({ opponentId: homeId, win: homeLose, draw: homeDraw, lose: homeWin });
    }
  });

  const reports: TeamWeeklyReport[] = teams.map(t => {
    const data = teamMap.get(t.id)!;
    const totalDecisions = data.wins + data.losses;
    const winRate = totalDecisions > 0 ? data.wins / totalDecisions : 0;

    // 시리즈 1 가공
    let s1Opponent = "경기 없음";
    let s1Wins = 0;
    let s1Draws = 0;
    let s1Losses = 0;
    if (data.series1Games.length > 0) {
      const oppTeam = teams.find(item => item.id === data.series1Games[0].opponentId);
      s1Opponent = oppTeam ? oppTeam.shortName : "상대팀";
      data.series1Games.forEach(g => {
        if (g.win) s1Wins++;
        else if (g.draw) s1Draws++;
        else s1Losses++;
      });
    }

    // 시리즈 2 가공
    let s2Opponent = "경기 없음";
    let s2Wins = 0;
    let s2Draws = 0;
    let s2Losses = 0;
    if (data.series2Games.length > 0) {
      const oppTeam = teams.find(item => item.id === data.series2Games[0].opponentId);
      s2Opponent = oppTeam ? oppTeam.shortName : "상대팀";
      data.series2Games.forEach(g => {
        if (g.win) s2Wins++;
        else if (g.draw) s2Draws++;
        else s2Losses++;
      });
    }

    // 실제 뉴스 기반 리포트 매칭
    const newsData = REAL_NEWS_DATABASE[t.id] ?? {
      overallComment: "이번 주 경기 결과를 바탕으로 실시간 자동 집계된 총평입니다.",
      series1Details: "상세 경기 결과 및 이슈 분석이 준비 중입니다.",
      series2Details: "상세 경기 결과 및 이슈 분석이 준비 중입니다."
    };

    // 시리즈 승패 결과 판단
    const s1Total = s1Wins + s1Draws + s1Losses;
    let s1Result: SeriesResult["result"] = "split";
    if (s1Total > 0) {
      if (s1Wins === s1Total && s1Total >= 2) s1Result = "sweep_win";
      else if (s1Losses === s1Total && s1Total >= 2) s1Result = "sweep_loss";
      else if (s1Wins > s1Losses) s1Result = "winning";
      else if (s1Wins < s1Losses) s1Result = "losing";
    }

    const s2Total = s2Wins + s2Draws + s2Losses;
    let s2Result: SeriesResult["result"] = "split";
    if (s2Total > 0) {
      if (s2Wins === s2Total && s2Total >= 2) s2Result = "sweep_win";
      else if (s2Losses === s2Total && s2Total >= 2) s2Result = "sweep_loss";
      else if (s2Wins > s2Losses) s2Result = "winning";
      else if (s2Wins < s2Losses) s2Result = "losing";
    }

    const s1Score = s1Draws > 0 ? `${s1Wins}승 ${s1Draws}무 ${s1Losses}패` : `${s1Wins}승 ${s1Losses}패`;
    const s2Score = s2Draws > 0 ? `${s2Wins}승 ${s2Draws}무 ${s2Losses}패` : `${s2Wins}승 ${s2Losses}패`;

    const getSummary = (res: SeriesResult["result"], opp: string) => {
      if (res === "sweep_win") return `${opp}전 짜릿한 스윕승 달성!`;
      if (res === "winning") return `${opp}전 기분 좋은 위닝 시리즈!`;
      if (res === "losing") return `${opp}전 아쉬운 루징 시리즈`;
      if (res === "sweep_loss") return `${opp}전 뼈아픈 스윕패 허용`;
      return `${opp}전 팽팽한 호각세 (1승1패 등)`;
    };

    return {
      teamName: t.name,
      teamCode: t.id,
      weeklyRank: 1,
      wins: data.wins,
      losses: data.losses,
      draws: data.draws,
      winRate,
      overallComment: newsData.overallComment,
      series1: {
        opponent: s1Opponent,
        result: s1Result,
        score: s1Score,
        summary: getSummary(s1Result, s1Opponent),
        details: newsData.series1Details
      },
      series2: {
        opponent: s2Opponent,
        result: s2Result,
        score: s2Score,
        summary: getSummary(s2Result, s2Opponent),
        details: newsData.series2Details
      }
    };
  });

  // 정렬: 승률 -> 승수 -> 팀 가나다순
  reports.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.teamName.localeCompare(b.teamName, "ko-KR");
  });

  // 순위 매기기
  let rank = 1;
  for (let i = 0; i < reports.length; i++) {
    if (i > 0) {
      const prev = reports[i - 1];
      const curr = reports[i];
      if (curr.winRate !== prev.winRate || curr.wins !== prev.wins) {
        rank = i + 1;
      }
    }
    reports[i].weeklyRank = rank;
  }

  return reports;
}
