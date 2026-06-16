import { GoogleGenAI } from "@google/genai";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { listGamesFromDb } from "@/lib/supabase/query-parts/core";
import { listAiPredictionResultsForDate } from "@/lib/supabase/query-parts/bpAiPredictions";
import { getAllRosters } from "@/lib/rosters";
import { computeBatterDelta, computePitcherDelta } from "@/lib/sim/recentFormLoader";
import type { SimBatter, SimPitcher } from "@/lib/sim/types";

export type AiChatAction = {
  label: string;
  href: string;
};

export type AiChatHistoryMessage = {
  role: "assistant" | "user";
  text: string;
};

export type AiChatResult = {
  answer: string;
  actions: AiChatAction[];
  intent: "ai_prediction" | "daily_report" | "game_schedule" | "player_stats" | "unknown";
};

type TeamInfo = {
  id: string;
  shortName: string;
  fullName: string;
  aliases: string[];
};

const TEAM_INFOS: TeamInfo[] = [
  { id: "doosan", shortName: "두산", fullName: "두산 베어스", aliases: ["두산", "베어스", "doosan"] },
  { id: "lg", shortName: "LG", fullName: "LG 트윈스", aliases: ["lg", "엘지", "트윈스"] },
  { id: "kt", shortName: "KT", fullName: "KT 위즈", aliases: ["kt", "케이티", "위즈"] },
  { id: "ssg", shortName: "SSG", fullName: "SSG 랜더스", aliases: ["ssg", "랜더스"] },
  { id: "nc", shortName: "NC", fullName: "NC 다이노스", aliases: ["nc", "엔씨", "다이노스"] },
  { id: "kiwoom", shortName: "키움", fullName: "키움 히어로즈", aliases: ["키움", "히어로즈", "kiwoom"] },
  { id: "samsung", shortName: "삼성", fullName: "삼성 라이온즈", aliases: ["삼성", "라이온즈", "samsung"] },
  { id: "lotte", shortName: "롯데", fullName: "롯데 자이언츠", aliases: ["롯데", "자이언츠", "lotte"] },
  { id: "kia", shortName: "KIA", fullName: "KIA 타이거즈", aliases: ["kia", "기아", "타이거즈"] },
  { id: "hanwha", shortName: "한화", fullName: "한화 이글스", aliases: ["한화", "이글스", "hanwha"] }
];

const AI_LABEL: Record<string, string> = {
  gpt: "GPT",
  gemini: "Gemini",
  claude: "Claude"
};

const DEFAULT_GEMINI_TIMEOUT_MS = 8000;

export async function answerAiChat(question: string, history: AiChatHistoryMessage[] = []): Promise<AiChatResult> {
  const trimmed = question.trim();
  if (!trimmed) {
    return {
      intent: "unknown",
      answer: "궁금한 경기, 팀, 선수 이름을 함께 물어봐 주세요.",
      actions: []
    };
  }

  const contextText = buildContextText(trimmed, history);
  const dateISO = parseDateFromQuestion(trimmed) ?? parseDateFromQuestion(contextText) ?? kstToday();
  const team = detectTeam(trimmed) ?? detectTeam(contextText);
  const player = detectPlayer(trimmed, team?.id) ?? detectPlayer(contextText, team?.id);

  if (player) {
    return answerPlayerStats(trimmed, player, history);
  }

  if (isDailyReportQuestion(trimmed)) {
    return answerDailyReport(trimmed, dateISO, history);
  }

  if (isScheduleQuestion(trimmed) && !isPredictionQuestion(trimmed)) {
    return answerGameSchedule(trimmed, dateISO, team, history);
  }

  if (isPredictionQuestion(trimmed) || team) {
    return answerAiPrediction(trimmed, dateISO, team, history);
  }

  return {
    intent: "unknown",
    answer: "지금은 AI 승리팀 예측, 경기 일정/결과, 일일 리포트, 선수 스탯 질문에 답변할 수 있습니다.",
    actions: [
      { label: "오늘 AI 예측 보기", href: `/predict/ai-winner?date=${dateISO}` },
      { label: "일일 리포트 보기", href: `/daily-report?date=${dateISO}` }
    ]
  };
}

async function answerAiPrediction(
  question: string,
  dateISO: string,
  team: TeamInfo | null,
  history: AiChatHistoryMessage[]
): Promise<AiChatResult> {
  const games = await listGamesFromDb({ from: dateISO, to: dateISO, teamId: team?.id });
  if (games.length === 0) {
    return {
      intent: "ai_prediction",
      answer: `${dateISO}에는 ${team ? `${team.shortName} 관련 ` : ""}경기 일정이 없습니다.`,
      actions: [{ label: "AI 예측 목록 보기", href: `/predict/ai-winner?date=${dateISO}` }]
    };
  }

  const admin = createSupabaseAdminClient();
  const predictionsRes = await listAiPredictionResultsForDate(admin, dateISO);
  const predictions = predictionsRes.ok ? predictionsRes.rows : [];
  const gameIds = new Set(games.map((game) => game.id));
  const rows = predictions.filter((row) => gameIds.has(row.game_id));

  if (rows.length === 0) {
    return {
      intent: "ai_prediction",
      answer: `${dateISO} ${team ? `${team.shortName} 경기의 ` : ""}AI 예측 데이터가 아직 준비되지 않았습니다.`,
      actions: [{ label: "AI 예측 목록 보기", href: `/predict/ai-winner?date=${dateISO}` }]
    };
  }

  const dataSummary = games.map((game) => {
    const home = teamName(game.homeTeamId);
    const away = teamName(game.awayTeamId);
    const gamePredictions = rows.filter((row) => row.game_id === game.id);
    const picks = gamePredictions.map((row) => ({
      ai: AI_LABEL[row.ai_provider] ?? row.ai_provider,
      winner: teamName(row.predicted_winner_team_id),
      confidence: row.confidence,
      keyFactor: row.key_factor,
      oneLiner: row.one_liner
    }));
    return {
      gameId: game.id,
      date: game.date,
      matchup: `${away} vs ${home}`,
      stadium: game.stadium,
      status: game.status,
      score: game.homeScore != null && game.awayScore != null ? `${away} ${game.awayScore} : ${game.homeScore} ${home}` : null,
      picks
    };
  });

  const fallback = buildPredictionFallback(dataSummary);
  const answer = await polishWithGemini(question, "AI 승리팀 예측", dataSummary, fallback, history);
  const firstGame = games[0];
  const actions: AiChatAction[] = [
    {
      label: games.length === 1 ? `${teamName(firstGame.awayTeamId)} vs ${teamName(firstGame.homeTeamId)} 예측 자세히 보기` : "AI 예측 목록 보기",
      href: games.length === 1 ? `/predict/ai-winner/${firstGame.id}?date=${dateISO}` : `/predict/ai-winner?date=${dateISO}`
    }
  ];

  return { intent: "ai_prediction", answer, actions };
}

async function answerDailyReport(question: string, dateISO: string, history: AiChatHistoryMessage[]): Promise<AiChatResult> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("daily_ai_reports")
    .select("report_date, report_json, created_at")
    .lte("report_date", dateISO)
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10);

  const reportRow = (data ?? []).find((row) => row.report_json && Array.isArray((row.report_json as any).headlines));
  if (!reportRow) {
    return {
      intent: "daily_report",
      answer: `${dateISO} 기준으로 발행된 일일 리포트를 찾지 못했습니다.`,
      actions: [{ label: "일일 리포트 보기", href: `/daily-report?date=${dateISO}` }]
    };
  }

  const report = reportRow.report_json as any;
  const dataSummary = {
    reportDate: reportRow.report_date,
    headlines: report.headlines ?? [],
    hotTopics: report.hotTopics ?? [],
    dailyMvpName: report.dailyMvpName ?? null,
    dailyMvpComment: report.dailyMvpComment ?? null,
    standingsSummary: report.standingsSummary ?? null
  };
  const fallback = [
    `${reportRow.report_date} 일일 리포트 요약입니다.`,
    ...(dataSummary.headlines as string[]).slice(0, 3).map((line) => `- ${line}`),
    dataSummary.dailyMvpName ? `오늘의 MVP는 ${dataSummary.dailyMvpName}입니다. ${dataSummary.dailyMvpComment ?? ""}` : ""
  ].filter(Boolean).join("\n");

  const answer = await polishWithGemini(question, "일일 리포트", dataSummary, fallback, history);
  return {
    intent: "daily_report",
    answer,
    actions: [{ label: "일일 리포트 자세히 보기", href: `/daily-report?date=${reportRow.report_date}` }]
  };
}

async function answerGameSchedule(
  question: string,
  dateISO: string,
  team: TeamInfo | null,
  history: AiChatHistoryMessage[]
): Promise<AiChatResult> {
  const games = await listGamesFromDb({ from: dateISO, to: dateISO, teamId: team?.id });
  if (games.length === 0) {
    return {
      intent: "game_schedule",
      answer: `${dateISO}에는 ${team ? `${team.shortName} 관련 ` : ""}경기 일정이 없습니다.`,
      actions: [{ label: "일정 보기", href: `/schedule?date=${dateISO}` }]
    };
  }

  const dataSummary = games.map((game) => ({
    date: game.date,
    time: game.time,
    matchup: `${teamName(game.awayTeamId)} vs ${teamName(game.homeTeamId)}`,
    stadium: game.stadium,
    status: game.status,
    starters: {
      home: game.homeStarter ?? null,
      away: game.awayStarter ?? null
    },
    score: game.homeScore != null && game.awayScore != null
      ? `${teamName(game.awayTeamId)} ${game.awayScore} : ${game.homeScore} ${teamName(game.homeTeamId)}`
      : null
  }));
  const scheduleFallback = [
    `${dateISO} 경기 일정입니다.`,
    "",
    ...dataSummary.map((game) => {
      const score = game.score ? ` · ${game.score}` : "";
      return `- ${game.time ?? "시간 미정"} ${game.matchup} · ${game.stadium}${score}`;
    }),
    "",
    "선발투수",
    ...dataSummary.map((game) => {
      const [awayName, homeName] = game.matchup.split(" vs ");
      return `- ${awayName}: ${game.starters.away ?? "미정"} / ${homeName}: ${game.starters.home ?? "미정"}`;
    })
  ].join("\n");
  const answer = await polishWithGemini(question, "경기 일정/결과", dataSummary, scheduleFallback, history);

  return {
    intent: "game_schedule",
    answer,
    actions: [
      { label: "일정 자세히 보기", href: `/schedule?date=${dateISO}` },
      { label: "AI 예측 보기", href: `/predict/ai-winner?date=${dateISO}` }
    ]
  };
}

async function answerPlayerStats(
  question: string,
  player: ReturnType<typeof detectPlayer> extends infer T ? NonNullable<T> : never,
  history: AiChatHistoryMessage[]
): Promise<AiChatResult> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("bp_player_stats_snapshots")
    .select("snapshot_date, player_id, team_id, kind, sim_payload")
    .eq("player_id", player.id)
    .order("snapshot_date", { ascending: false })
    .limit(12);

  if (error || !data || data.length === 0) {
    return {
      intent: "player_stats",
      answer: `${player.name} 선수의 스탯 스냅샷을 찾지 못했습니다.`,
      actions: []
    };
  }

  const latest = data[0] as any;
  const previous = data.find((row: any) => row.kind === latest.kind && row.snapshot_date < latest.snapshot_date) as any | undefined;
  const payload = latest.sim_payload as SimBatter | SimPitcher;
  const recent = previous
    ? latest.kind === "batter"
      ? computeBatterDelta(payload as SimBatter, previous.sim_payload as SimBatter)
      : computePitcherDelta(payload as SimPitcher, previous.sim_payload as SimPitcher)
    : null;

  const dataSummary = {
    player: player.name,
    team: teamName(player.teamId),
    position: player.primaryPosition,
    snapshotDate: latest.snapshot_date,
    kind: latest.kind,
    season: formatPlayerPayload(latest.kind, payload),
    recent: recent ? formatPlayerPayload(latest.kind, recent) : null
  };
  const fallback = buildPlayerFallback(dataSummary);
  const answer = await polishWithGemini(question, "선수 스탯", dataSummary, fallback, history);
  return { intent: "player_stats", answer, actions: [] };
}

async function polishWithGemini(
  question: string,
  intentLabel: string,
  data: unknown,
  fallback: string,
  history: AiChatHistoryMessage[] = []
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const timeoutMs = Number(process.env.BALLPLAY_CHAT_TIMEOUT_MS) || DEFAULT_GEMINI_TIMEOUT_MS;
    const response = await withTimeout(
      ai.models.generateContent({
        model: process.env.BALLPLAY_CHAT_MODEL ?? "gemini-2.5-flash-lite",
        contents: [
          {
            role: "user",
            parts: [{
              text: [
                history.length > 0
                  ? `최근 대화:\n${history.map((message) => `${message.role === "user" ? "사용자" : "챗봇"}: ${message.text}`).join("\n")}`
                  : "",
                `사용자 질문: ${question}`,
                `질문 유형: ${intentLabel}`,
                "아래 DB 조회 결과만 근거로 한국어 답변을 작성해 주세요.",
                "현재 질문이 '그럼', '선발은', '그 선수'처럼 이전 대화를 참조하면 최근 대화의 팀/날짜/선수 맥락을 반영해 주세요.",
                "경기 일정, 경기 결과, 선발투수처럼 여러 항목을 나열해야 할 때는 긴 문단 대신 제목과 줄바꿈 리스트로 정리해 주세요.",
                "마크다운 문법은 쓰지 마세요. 굵게 표시용 **, 리스트용 *, 제목용 # 기호를 사용하지 마세요. 필요한 목록은 '- '만 사용해 주세요.",
                "없는 정보는 추측하지 말고, 기준 날짜나 스탯 기준을 자연스럽게 포함해 주세요.",
                "답변은 3~6문장으로 간결하게 작성해 주세요.",
                "",
                JSON.stringify(data, null, 2)
              ].join("\n")
            }]
          }
        ],
        config: {
          temperature: 0.25,
          maxOutputTokens: 420
        }
      }),
      timeoutMs,
      "Gemini response timed out"
    );

    const text = response.text?.trim();
    return text || fallback;
  } catch (err) {
    console.warn("[ai-chat] Gemini answer failed:", (err as Error).message);
    return fallback;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function buildPredictionFallback(games: Array<{ matchup: string; picks: Array<{ ai: string; winner: string; confidence: number; keyFactor: string }> }>): string {
  return games.map((game) => {
    const picks = game.picks
      .map((pick) => `${pick.ai}: ${pick.winner} 승 ${pick.confidence}% (${pick.keyFactor})`)
      .join("\n");
    return `${game.matchup} AI 예측입니다.\n${picks}`;
  }).join("\n\n");
}

function buildPlayerFallback(data: any): string {
  const recentLine = data.recent ? ` 최근 반영 구간은 ${data.recent}입니다.` : "";
  return `${data.player}(${data.team}) 선수의 ${data.snapshotDate} 최신 스냅샷 기준 성적은 ${data.season}입니다.${recentLine}`;
}

function formatPlayerPayload(kind: string, payload: SimBatter | SimPitcher): string {
  if (kind === "batter") {
    const batter = payload as SimBatter;
    return `타율 ${formatRate(batter.avg)}, 출루율 ${formatRate(batter.obp)}, 장타율 ${formatRate(batter.slg)}, OPS ${formatRate(batter.obp + batter.slg)}, 홈런 ${batter.homers}개, 볼넷 ${batter.walks}개, 삼진 ${batter.strikeouts}개`;
  }

  const pitcher = payload as SimPitcher;
  return `ERA ${pitcher.era.toFixed(2)}, WHIP ${pitcher.whip.toFixed(2)}, ${pitcher.wins ?? 0}승 ${pitcher.losses ?? 0}패, ${pitcher.ip}이닝, K/9 ${pitcher.k9.toFixed(2)}, BB/9 ${pitcher.bb9.toFixed(2)}`;
}

function detectPlayer(question: string, preferredTeamId?: string) {
  const normalizedQuestion = normalize(question);
  const candidates = getAllRosters().filter((player) => normalize(player.name).length >= 2 && normalizedQuestion.includes(normalize(player.name)));
  if (candidates.length === 0) return null;
  if (preferredTeamId) {
    const sameTeam = candidates.find((player) => player.teamId === preferredTeamId);
    if (sameTeam) return sameTeam;
  }
  return candidates[0];
}

function detectTeam(question: string): TeamInfo | null {
  const normalized = normalize(question);
  return TEAM_INFOS.find((team) => team.aliases.some((alias) => normalized.includes(normalize(alias)))) ?? null;
}

function isPredictionQuestion(question: string): boolean {
  return /예측|승리|이길|승률|확률|전망|분석/.test(question);
}

function isScheduleQuestion(question: string): boolean {
  return /일정|경기|결과|스코어|몇\s*시|끝났|오늘|어제|선발|투수/.test(question);
}

function isDailyReportQuestion(question: string): boolean {
  return /리포트|브리핑|종합|요약/.test(question);
}

function parseDateFromQuestion(question: string): string | null {
  const explicit = question.match(/20\d{2}-\d{2}-\d{2}/)?.[0];
  if (explicit) return explicit;

  const today = kstToday();
  if (/그제|그저께/.test(question)) return addDays(today, -2);
  if (/어제/.test(question)) return addDays(today, -1);
  if (/내일/.test(question)) return addDays(today, 1);
  if (/오늘/.test(question)) return today;

  const monthDay = question.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (monthDay) {
    const year = new Date(`${today}T00:00:00+09:00`).getFullYear();
    return `${year}-${monthDay[1].padStart(2, "0")}-${monthDay[2].padStart(2, "0")}`;
  }

  return null;
}

function kstToday(): string {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function addDays(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T00:00:00+09:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function teamName(teamId: string): string {
  return TEAM_INFOS.find((team) => team.id === teamId)?.shortName ?? teamId;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function formatRate(value: number): string {
  if (!Number.isFinite(value)) return ".000";
  return value.toFixed(3).replace(/^0/, "");
}

function buildContextText(question: string, history: AiChatHistoryMessage[]): string {
  return [...history.slice(-6).map((message) => message.text), question].join("\n");
}
