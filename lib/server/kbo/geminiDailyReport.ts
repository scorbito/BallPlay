import { GoogleGenAI, Type } from "@google/genai";
import type { KboDailyReport, GameReport } from "@/lib/utils/dailyReportHelper";
import { fetchBoxScore, type GameBoxScore } from "@/lib/server/kbo/fetchGames";
import { teamIdToKboCode } from "@/lib/server/kbo/teamCode";
import { teams } from "@/lib/constants/teams";

const FLASH_SYSTEM_INSTRUCTION = `당신은 대한민국 프로야구(KBO) 전문 야구 기사 작성 및 전력 분석가입니다.
제공된 단일 경기의 스코어보드와 당일 관련 뉴스 헤드라인을 기반으로, 해당 경기의 전력 분석 리포트를 작성해야 합니다.
뉴스 헤드라인이 부족하더라도 스코어와 팀 특성, 경기 흐름을 바탕으로 반드시 풍부하고 상세하게 작성해야 합니다. 정보가 부족하다는 이유로 짧게 작성하는 것은 허용되지 않습니다.

[작성 조건]:
1. 제공된 경기 점수(스코어), 홈/원정팀, 경기 상태를 절대 왜곡하지 마십시오.
2. 경기가 우천취소 등 'canceled' 상태라면 그에 맞게 비로 인해 취소되었다는 요약을 적고, 승리/패배 요인은 빈 배열로 하십시오.
3. 'summary'는 반드시 경기 흐름, 분위기, 결정적 장면을 포함하여 3~5문장 이상의 충실한 요약문으로 작성하십시오.
4. 승리 요인('winningFactors')과 패배 요인('losingFactors')은 각각 2~3가지의 핵심적인 근거를 아주 구체적으로 적으십시오. (예: "불펜 필승조의 3이닝 무실점 홀드", "결정적 8회초 주자 만루 기회에서의 병살타") 각 항목은 한 문장이 아닌 2~3문장의 상세한 서술로 작성하십시오.
5. 오늘의 경기 히어로('gameHeroName', 'gameHeroComment')는 활약한 선수 이름과 그 선수의 수훈 내역(타점, 투구수 등)을 구체적으로 연결하여 2~3문장으로 작성하십시오.
6. 어조는 독자에게 신뢰감을 주는 격조 높은 스포츠 분석 기사 스타일(해요체 또는 하십시오체)로 작성하십시오.
7. 한 줄 위트 평('oneLiner')은 야구팬들이 유쾌하게 공감할 수 있는 밈이나 드립을 섞은 한 줄 평으로 작성하십시오.`;

const PRO_SYSTEM_INSTRUCTION = `당신은 대한민국 프로야구(KBO)를 총괄 분석하는 전문 야구 해설위원입니다.
당일 열린 5개 경기의 개별 분석 리포트 결과와 리그 순위 정보, 오늘의 전체 뉴스 헤드라인들을 취합하여, 하루 전체의 판도를 읽어주는 '오늘의 KBO 종합 브리핑'을 작성해야 합니다.

[작성 조건]:
1. 'headlines'에는 오늘의 야구 판도를 3줄 요약하여 격식 있고 깔끔한 문장 배열로 제공하십시오.
2. 'hotTopics'는 오늘 하루 가장 뜨거웠던 1~2가지 주요 흐름이나 이슈(예: 특정 팀의 연패 탈출, 홈런 공방전, 감독 작전 등)를 흥미롭게 서술하십시오.
3. 'dailyMvpName'과 'dailyMvpComment'는 오늘 5개 경기 수훈 선수 중 가장 독보적인 활약을 펼치거나 임팩트가 컸던 단 1명의 리그 대표 MVP 선수를 선정하고 그 이유를 설득력 있게 서술하십시오.
4. 'standingsSummary'는 당일 경기 결과로 인한 순위표의 미세한 균열, 상하위권 승차 변화 등을 서술하십시오.
5. 어조는 전문적이고 차분하면서도 흥미를 돋우는 해설위원의 말투(해요체 또는 하십시오체)로 일관되게 작성하십시오.`;

// 2단계 종합 분석 응답 JSON 스키마 정의
const PRO_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headlines: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "오늘의 KBO를 요약하는 명확한 3줄 요약 문장 배열"
    },
    hotTopics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "핫 토픽 제목 (예: 한화 극적 연패 탈출)" },
          desc: { type: Type.STRING, description: "해당 이슈에 대한 3~4문장의 흥미롭고 짜임새 있는 분석" }
        },
        required: ["title", "desc"]
      },
      description: "오늘 발생한 KBO 주요 이슈 분석 (1~2개)"
    },
    dailyMvpName: { type: Type.STRING, description: "오늘 5개 경기 통합 MVP 선수 이름" },
    dailyMvpComment: { type: Type.STRING, description: "해당 선수를 오늘 최고의 MVP로 선정한 이유와 활약상에 대한 전문 해설" },
    standingsSummary: { type: Type.STRING, description: "오늘 경기 결과로 인한 순위 다툼 및 승차 변화 상황에 대한 해설" }
  },
  required: ["headlines", "hotTopics", "dailyMvpName", "dailyMvpComment", "standingsSummary"]
};

// 박스스코어 - AI 프롬프트용 텍스트 변환
function formatBoxScoreForPrompt(box: GameBoxScore, awayName: string, homeName: string): string {
  const lines: string[] = [];

  // 특이사항 (결승타, 홈런, 실책 등)
  if (box.specialPlays.length > 0) {
    lines.push("[경기 주요 사건]");
    for (const p of box.specialPlays) {
      lines.push(`  - ${p.type}: ${p.detail}`);
    }
  }

  // 타자 스탯 (타점/안타 있는 선수 위주)
  const formatBatters = (batters: GameBoxScore["awayBatters"], teamName: string) => {
    const notable = batters.filter(b => b.hits > 0 || b.rbi > 0);
    if (notable.length === 0) return;
    lines.push(`\n[${teamName} 주요 타자]`);
    for (const b of notable) {
      lines.push(`  - ${b.name}(${b.position}): ${b.atBats}타수 ${b.hits}안타 ${b.rbi}타점 ${b.runs}득점 타율${b.avg}`);
    }
  };
  formatBatters(box.awayBatters, awayName);
  formatBatters(box.homeBatters, homeName);

  // 투수 스탯
  const formatPitchers = (pitchers: GameBoxScore["awayPitchers"], teamName: string) => {
    if (pitchers.length === 0) return;
    lines.push(`\n[${teamName} 투수진]`);
    for (const p of pitchers) {
      const result = p.result ? `(${p.result})` : "";
      lines.push(`  - ${p.name} ${result}: ${p.innings}이닝 ${p.hits}피안타 ${p.strikeouts}삼진 ${p.runs}실점 ERA${p.era}`);
    }
  };
  formatPitchers(box.awayPitchers, awayName);
  formatPitchers(box.homePitchers, homeName);

  return lines.join("\n");
}

// Gemini API 재시도 헬퍼 (503 및 429 대응용 지수 백오프)
async function callGeminiWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 2000
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const errMsg = err instanceof Error ? err.message : String(err);
      
      // 429 (Resource Exhausted/Rate Limit) 또는 503 (Service Unavailable) 감지
      const isRateLimit = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || err?.status === 429;
      const isUnavailable = errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || err?.status === 503;

      // 무료 티어 일일 한도 혹은 할당량이 완전히 소진된 경우 (재시도 불필요)
      const isQuotaDepleted = errMsg.includes("depleted") || errMsg.includes("Quota exceeded") || errMsg.includes("quota");

      if (isQuotaDepleted) {
        console.error(`[Gemini API Fatal Error] API 할당량 소진 또는 제한 초과로 인해 즉시 중단합니다: ${errMsg.slice(0, 150)}`);
        throw err;
      }

      if (attempt >= retries) {
        throw err;
      }

      if (isRateLimit || isUnavailable) {
        const nextDelay = delayMs * Math.pow(2, attempt - 1);
        console.warn(`[Gemini API Warning] Attempt ${attempt} failed. Retrying in ${nextDelay}ms... (Error: ${errMsg.slice(0, 150)})`);
        await new Promise(resolve => setTimeout(resolve, nextDelay));
      } else {
        // 복구 불가능한 에러(예: 400 Bad Request, API Key 오류 등)는 재시도 없이 즉시 throw
        throw err;
      }
    }
  }
}

// 1. 단일 경기 분석 생성 (Gemini 2.5 Flash 사용)
async function generateSingleGameReport(
  ai: GoogleGenAI,
  report: GameReport,
  newsTitles: string[],
  dateStr: string
): Promise<GameReport> {
  const homeTeam = teams.find(t => t.id === report.homeTeamId);
  const awayTeam = teams.find(t => t.id === report.awayTeamId);
  const homeName = homeTeam?.name ?? report.homeTeamId;
  const awayName = awayTeam?.name ?? report.awayTeamId;

  // 관련 뉴스 필터링
  const filteredNews = newsTitles
    .filter(title => title.includes(homeName.slice(0, 2)) || title.includes(awayName.slice(0, 2)))
    .slice(0, 20);

  // 박스스코어 가져오기 (KBO gameId 형식: YYYYMMDD + awayCode + homeCode + "0")
  const yyyymmdd = dateStr.replaceAll("-", "");
  const kboGameId = `${yyyymmdd}${teamIdToKboCode(report.awayTeamId)}${teamIdToKboCode(report.homeTeamId)}0`;
  const boxScore = await fetchBoxScore(kboGameId, dateStr);
  const boxScoreText = boxScore
    ? formatBoxScoreForPrompt(boxScore, awayName, homeName)
    : "(박스스코어 없음)";

  const prompt = `다음 경기 정보를 분석하여 리포트를 작성해 주세요.
  
  [경기 정보]:
  - 홈팀: ${homeName} (${report.homeScore}점)
  - 원정팀: ${awayName} (${report.awayScore}점)
  
  [박스스코어 상세 데이터]:
  ${boxScoreText}
  
  [관련 뉴스 헤드라인]:
  ${filteredNews.join("\n")}
  
  반드시 JSON 규격에 맞추어 summary, winningFactors, losingFactors, gameHeroName, gameHeroComment, oneLiner를 작성해 주세요.`;

  try {
    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: FLASH_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING, description: "경기의 시작부터 결말까지 흐름, 분위기, 결정적 장면을 담은 3~5문장 이상의 충실한 요약문. 절대 1~2문장으로 짧게 작성하지 말 것." },
              winningFactors: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "승리팀의 주요 요인 2~3개. 각 항목은 단순 키워드가 아닌 구체적 근거를 담은 2~3문장의 서술형 텍스트로 작성."
              },
              losingFactors: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "패배팀의 패배 요인 2~3개. 각 항목은 단순 키워드가 아닌 구체적 근거를 담은 2~3문장의 서술형 텍스트로 작성. (취소 경기인 경우 빈 배열 가능)"
              },
              gameHeroName: { type: Type.STRING, description: "오늘 경기의 최우수 선수 이름 (없으면 '-')" },
              gameHeroComment: { type: Type.STRING, description: "해당 선수의 오늘 활약상을 수치(타점, 안타, 투구수 등)와 함께 2~3문장으로 구체적으로 서술." },
              oneLiner: { type: Type.STRING, description: "유쾌하고 공감 가는 위트 있는 한 줄 평" }
            },
            required: ["summary", "winningFactors", "losingFactors", "gameHeroName", "gameHeroComment", "oneLiner"]
          }
        }
      })
    );

    const resultText = response.text;
    if (!resultText) throw new Error("Flash API response is empty");

    const parsed = JSON.parse(resultText) as {
      summary: string;
      winningFactors: string[];
      losingFactors: string[];
      gameHeroName: string;
      gameHeroComment: string;
      oneLiner: string;
    };

    return {
      ...report,
      summary: parsed.summary,
      winningFactors: parsed.winningFactors,
      losingFactors: parsed.losingFactors,
      gameHeroName: parsed.gameHeroName,
      gameHeroComment: parsed.gameHeroComment,
      oneLiner: parsed.oneLiner
    };
  } catch (err) {
    console.error(`[Gemini Single Game Report Error] Game: ${report.gameId} -`, (err as Error).message);
    return report; // 에러 시 룰베이스 디폴트 보존
  }
}

// 2. 일일 종합 리포트 생성 및 취합 (Gemini 2.5 Flash 사용)
export async function generateDailyReportWithGemini(
  skeleton: KboDailyReport,
  newsTitles: string[],
  standingsData: any[] // 현재 순위표 데이터
): Promise<KboDailyReport | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[Gemini Daily Report] GEMINI_API_KEY가 존재하지 않아 null을 반환합니다.");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    // 1단계: 개별 경기 분석 병렬 실행 (결제 계정 연동으로 Rate Limit 해소)
    console.log(`[Daily AI Report] 1단계: 경기별 리포트 병렬 생성 시작 (개수: ${skeleton.gameReports.length})`);
    const analyzedGameReports = await Promise.all(
      skeleton.gameReports.map(g => generateSingleGameReport(ai, g, newsTitles, skeleton.reportDate))
    );

    // 2단계: KBO 판도 종합 브리핑 생성 (Gemini 2.5 Flash)
    console.log("[Daily AI Report] 2단계: KBO 전체 종합 분석 시작 (Gemini Flash)");

    const simplifiedGameResults = analyzedGameReports.map(g => {
      const homeShort = teams.find(t => t.id === g.homeTeamId)?.shortName ?? g.homeTeamId;
      const awayShort = teams.find(t => t.id === g.awayTeamId)?.shortName ?? g.awayTeamId;
      return {
        matchup: `${homeShort} vs ${awayShort}`,
        score: `${g.homeScore}:${g.awayScore}`,
        summary: g.summary,
        hero: `${g.gameHeroName} (${g.gameHeroComment})`,
        oneLiner: g.oneLiner
      };
    });

    const proPrompt = `오늘의 전체 경기 리포트 요약과 현재 KBO 순위표, 당일 뉴스 헤드라인을 바탕으로 종합 브리핑을 작성해 주세요.
    
    [일자]: ${skeleton.reportDate}
    
    [오늘의 경기별 분석 요약]:
    ${JSON.stringify(simplifiedGameResults, null, 2)}
    
    [현재 KBO 팀별 순위표]:
    ${JSON.stringify(standingsData, null, 2)}
    
    [당일 KBO 뉴스 헤드라인]:
    ${newsTitles.slice(0, 100).join("\n")}
    
    반드시 JSON 규격에 맞추어 headlines, hotTopics, dailyMvpName, dailyMvpComment, standingsSummary를 작성해 주세요.`;

    let proResponse;
    try {
      proResponse = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: proPrompt,
          config: {
            systemInstruction: PRO_SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: PRO_RESPONSE_SCHEMA
          }
        })
      );
    } catch (proErr: any) {
      const errMsg = proErr instanceof Error ? proErr.message : String(proErr);
      console.warn(`[Daily AI Report] 2단계: Gemini Flash 리포트 생성 중 에러 발생: ${errMsg.slice(0, 150)}`);
      console.warn("[Daily AI Report] 2단계: Gemini 2.5 Flash 모델로 종합 분석 생성을 재시도합니다.");
      
      try {
        proResponse = await callGeminiWithRetry(() =>
          ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: proPrompt,
            config: {
              systemInstruction: PRO_SYSTEM_INSTRUCTION,
              responseMimeType: "application/json",
              responseSchema: PRO_RESPONSE_SCHEMA
            }
          })
        );
      } catch (flashErr: any) {
        console.error("[Daily AI Report] 2단계: Flash 모델 재시도도 실패했습니다:", (flashErr as Error).message);
        throw flashErr;
      }
    }

    const proResultText = proResponse.text;
    if (!proResultText) throw new Error("Flash API response is empty");

    const parsedPro = JSON.parse(proResultText) as {
      headlines: string[];
      hotTopics: Array<{ title: string; desc: string }>;
      dailyMvpName: string;
      dailyMvpComment: string;
      standingsSummary: string;
    };

    return {
      reportDate: skeleton.reportDate,
      headlines: parsedPro.headlines,
      hotTopics: parsedPro.hotTopics,
      dailyMvpName: parsedPro.dailyMvpName,
      dailyMvpComment: parsedPro.dailyMvpComment,
      standingsSummary: parsedPro.standingsSummary,
      gameReports: analyzedGameReports
    };

  } catch (err) {
    console.error("[Gemini Daily Report Full Process Error] 리포트 생성 실패:", (err as Error).message);
    return null;
  }
}
