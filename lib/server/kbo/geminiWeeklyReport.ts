import { GoogleGenAI, Type } from "@google/genai";
import type { TeamWeeklyReport } from "@/lib/utils/weeklyReportHelper";

interface GeminiReportOutput {
  teamCode: string;
  overallComment: string;
  series1Details: string;
  series2Details: string;
}

const SYSTEM_INSTRUCTION = `당신은 대한민국 프로야구(KBO) 전문 기자이자 냉철한 야구 분석가입니다.
제공된 구단별 주간 성적(실제 팩트)과 그 주의 뉴스 헤드라인들을 바탕으로, 10개 구단 각각의 독자적인 주간 분석 리포트를 작성해야 합니다.

[작성 조건]:
1. 제공된 경기 정보의 승-무-패 전적 및 시리즈 매치업 상대(상대팀 명칭)를 절대 왜곡하지 마십시오.
2. 각 구단별 'overallComment'는 해당 주차의 활약상을 요약한 주간 총평으로 2-3문장 내외로 깊이 있게 작성하십시오.
3. 각 시리즈의 상세 분석('series1Details', 'series2Details')은 뉴스 헤드라인에 나오는 주요 선수 활약상(예: 류현진의 호투, 양의지의 활약 등)이나 주요 화제(예: 젠슨 황 엔비디아 CEO의 시구 등)를 경기 흐름과 엮어서 **공백 제외 최소 450자 이상으로, 3~4문장 내외의 풍성하고 상세한 단락으로 서술**하십시오. 기존보다 1~2줄을 더 작성하여 디테일한 흐름을 살려주십시오.
4. 가짜 스코어나 거짓 경기 결과를 지어내지 말고, 제공된 실제 정보에 기재된 스코어와 상대팀을 철저히 따라야 합니다.
5. 어조는 독자에게 신뢰감을 주는 격조 높은 스포츠 분석 기사 스타일(해요체 또는 하십시오체)로 일관되게 작성하십시오.`;

export async function generateWeeklyReportWithGemini(
  rankings: TeamWeeklyReport[],
  newsTitles: string[],
  weekName: string
): Promise<TeamWeeklyReport[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[Gemini Weekly Report] GEMINI_API_KEY가 존재하지 않아 기본 텍스트 템플릿으로 렌더링합니다.");
    return rankings; // API 키가 없으면 기본 생성 텍스트를 그대로 반환
  }

  const ai = new GoogleGenAI({ apiKey });

  // 프롬프트에 넘길 경기 결과 요약
  const matchSummary = rankings.map(r => ({
    teamId: r.teamCode,
    teamName: r.teamName,
    weeklyRank: r.weeklyRank,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    winRate: r.winRate.toFixed(3),
    series1: {
      opponent: r.series1.opponent,
      score: r.series1.score,
      result: r.series1.result
    },
    series2: {
      opponent: r.series2.opponent,
      score: r.series2.score,
      result: r.series2.result
    }
  }));

  const userPrompt = `다음 데이터를 바탕으로 10개 구단의 주간 리포트 코멘트를 작성해 주세요.
주차명: ${weekName}

[실제 구단별 주간 경기 결과]:
${JSON.stringify(matchSummary, null, 2)}

[이번 주 KBO 뉴스 헤드라인]:
${newsTitles.slice(0, 150).join("\n")} -- 프롬프트 토큰 조절을 위해 최대 150개로 제한

각 구단별로 teamCode(소문자 id, 예: 'kia', 'doosan', 'samsung'), overallComment, series1Details, series2Details를 포함한 리스트로 응답해 주세요.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro", // 고성능 대형 모델 사용
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }]
        }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reports: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  teamCode: { type: Type.STRING, description: "구단의 소문자 고유 ID (예: kia, doosan, samsung 등)" },
                  overallComment: { type: Type.STRING, description: "구단의 주간 총평 요약 코멘트" },
                  series1Details: { type: Type.STRING, description: "주중 시리즈의 상세 분석 리포트 (최소 450자 이상, 3~4문장 이상의 아주 상세한 서술)" },
                  series2Details: { type: Type.STRING, description: "주말 시리즈의 상세 분석 리포트 (최소 450자 이상, 3~4문장 이상의 아주 상세한 서술)" }
                },
                required: ["teamCode", "overallComment", "series1Details", "series2Details"]
              }
            }
          },
          required: ["reports"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini AI의 응답 결과 텍스트가 비어있습니다.");
    }

    const parsed = JSON.parse(text) as { reports: GeminiReportOutput[] };
    const reportsMap = new Map<string, GeminiReportOutput>();
    parsed.reports.forEach(r => {
      reportsMap.set(r.teamCode.toLowerCase(), r);
    });

    // 기존 rankings 배열에 AI 요약 텍스트 바인딩
    return rankings.map(team => {
      const aiReport = reportsMap.get(team.teamCode.toLowerCase());
      if (aiReport) {
        return {
          ...team,
          overallComment: aiReport.overallComment,
          series1: {
            ...team.series1,
            details: aiReport.series1Details
          },
          series2: {
            ...team.series2,
            details: aiReport.series2Details
          }
        };
      }
      return team; // 매핑 실패 시 기존의 룰 기반 텍스트 보존
    });

  } catch (err) {
    console.error("[Gemini Weekly Report Error]:", (err as Error).message);
    return rankings; // 에러 발생 시 기존 룰 기반 리포트 반환
  }
}
