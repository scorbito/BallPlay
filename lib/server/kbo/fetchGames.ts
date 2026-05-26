import * as cheerio from "cheerio";
import { parseTeamCode } from "./teamCode";

export type RawGame = {
  externalId: string;
  gameDate: string;        // YYYY-MM-DD
  gameTime: string | null; // HH:mm
  stadium: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "scheduled" | "in_progress" | "finished" | "canceled";
  innings: number | null;
  // KBO 공식 응답에 같이 오는 선발 투수 이름. 미발표 시 null.
  // 필드명은 KBO ASMX 응답 컨벤션 따라 여러 candidate를 fallback으로 try.
  homeStarter: string | null;
  awayStarter: string | null;
};

type KboDateInput = Date | string;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function toExternalId(dateStr: string, awayTeamId: string, homeTeamId: string) {
  return `kbo-${dateStr.replaceAll("-", "")}-${awayTeamId}-${homeTeamId}`;
}

function formatKboDate(input: KboDateInput) {
  if (typeof input === "string") {
    return { yyyymmdd: input.replaceAll("-", ""), dateStr: input };
  }

  const yyyy = input.getFullYear();
  const mm = String(input.getMonth() + 1).padStart(2, "0");
  const dd = String(input.getDate()).padStart(2, "0");
  return { yyyymmdd: `${yyyy}${mm}${dd}`, dateStr: `${yyyy}-${mm}-${dd}` };
}

function mapStatus(stateCode: string, stateName: string, isCancelled: boolean): RawGame["status"] {
  if (isCancelled) return "canceled";
  if (stateCode === "2" || stateName.includes("중") || stateName.includes("진행")) return "in_progress";
  if (stateCode === "3" || stateName.includes("종료")) return "finished";
  return "scheduled";
}

/** KBO 공식 API 1순위 조회 */
export async function fetchKboApiGames(date: KboDateInput): Promise<RawGame[]> {
  const { yyyymmdd, dateStr } = formatKboDate(date);

  // KBO ASMX 웹서비스는 GET 거부 → POST + form-encoded만 응답.
  // GET으로 호출하면 IE 호환성 주석이 포함된 도움말 HTML이 반환됨.
  const url = "https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList";
  const body = new URLSearchParams({
    leId: "1",
    srId: "0",
    date: yyyymmdd
  });
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Referer": "https://www.koreabaseball.com/Schedule/Schedule.aspx",
      "X-Requested-With": "XMLHttpRequest",
      "Origin": "https://www.koreabaseball.com"
    },
    body: body.toString()
  });
  if (!response.ok) throw new Error(`KBO API ${response.status}`);

  // 응답이 JSON인지 확인 — HTML이 오면 명확한 에러 던짐 (이전엔 silently 0건 되었음)
  const text = await response.text();
  if (text.trim().startsWith("<")) {
    throw new Error(`KBO API returned HTML (endpoint changed or auth required)`);
  }
  let data: { game?: unknown[] };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`KBO API invalid JSON: ${text.slice(0, 60)}`);
  }
  if (!data?.game || !Array.isArray(data.game)) return [];

  const games: RawGame[] = [];
  for (const g of data.game as Array<Record<string, unknown>>) {
    const isCancelled = g.CANCEL_SC_ID !== "0" && g.CANCEL_SC_ID !== undefined;
    const awayTeamId = parseTeamCode(String(g.AWAY_NM ?? ""));
    const homeTeamId = parseTeamCode(String(g.HOME_NM ?? ""));
    if (!awayTeamId || !homeTeamId) continue;

    const stateCode = String(g.GAME_STATE_SC ?? "");
    const stateName = String(g.GAME_STATE_NM ?? "");
    const status = mapStatus(stateCode, stateName, Boolean(isCancelled));
    const homeScoreRaw = String(g.B_SCORE_CN ?? "");
    const awayScoreRaw = String(g.T_SCORE_CN ?? "");
    const homeScore = status === "finished" || status === "in_progress" ? parseInt(homeScoreRaw || "0", 10) : null;
    const awayScore = status === "finished" || status === "in_progress" ? parseInt(awayScoreRaw || "0", 10) : null;
    const inningRaw = parseInt(String(g.GAME_INN_NO ?? "0"), 10);

    // 선발 투수 이름 — KBO API 필드명이 정확치 않아 several candidates 시도.
    // 흔한 컨벤션: T_PIT_P_NM (away), B_PIT_P_NM (home). T_S_PIT_NM(starter)도 가능.
    // 미발표면 빈 문자열로 옴 → null로 정규화.
    const homeStarterRaw = String(g.B_PIT_P_NM ?? g.B_S_PIT_NM ?? g.HOME_STARTER_NM ?? "").trim();
    const awayStarterRaw = String(g.T_PIT_P_NM ?? g.T_S_PIT_NM ?? g.AWAY_STARTER_NM ?? "").trim();

    games.push({
      externalId: toExternalId(dateStr, awayTeamId, homeTeamId),
      gameDate: dateStr,
      gameTime: g.G_TM ? String(g.G_TM) : null,
      stadium: String(g.S_NM ?? "미정"),
      homeTeamId,
      awayTeamId,
      homeScore,
      awayScore,
      status,
      innings:
        status === "finished"
          ? (inningRaw > 0 ? inningRaw : 9)
          : status === "in_progress" && inningRaw > 0
            ? inningRaw
            : null,
      homeStarter: homeStarterRaw || null,
      awayStarter: awayStarterRaw || null
    });
  }

  return games;
}

/** 네이버 스포츠 HTML 폴백 */
export async function fetchNaverGames(date: KboDateInput): Promise<RawGame[]> {
  const { yyyymmdd, dateStr } = formatKboDate(date);

  const url = `https://sports.news.naver.com/kbaseball/schedule/index?date=${yyyymmdd}`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": USER_AGENT }
  });
  if (!response.ok) throw new Error(`Naver ${response.status}`);

  const html = await response.text();
  const $ = cheerio.load(html);
  const games: RawGame[] = [];

  $(".sch_tb tbody tr").each((_, element) => {
    const $row = $(element);
    const timeStr = $row.find(".time").text().trim();
    if (!timeStr || timeStr === "-") return;

    const teamA = $row.find(".team_lft").text().trim();
    const teamB = $row.find(".team_rgt").text().trim();
    const awayTeamId = parseTeamCode(teamA);
    const homeTeamId = parseTeamCode(teamB);
    if (!awayTeamId || !homeTeamId) return;

    const stateText = $row.find(".state").text().trim();
    let status: RawGame["status"] = "scheduled";
    if (stateText.includes("종료")) status = "finished";
    else if (stateText.includes("취소")) status = "canceled";
    else if (stateText.includes("회") || stateText.includes("중계")) status = "in_progress";

    const homeScore = status === "finished" || status === "in_progress"
      ? parseInt($row.find(".num_rgt").text().trim() || "0", 10)
      : null;
    const awayScore = status === "finished" || status === "in_progress"
      ? parseInt($row.find(".num_lft").text().trim() || "0", 10)
      : null;

    // "3회초", "5회말" 등에서 회차 추출
    let liveInnings: number | null = null;
    if (status === "in_progress") {
      const inningMatch = stateText.match(/(\d+)\s*회/);
      if (inningMatch) liveInnings = parseInt(inningMatch[1], 10);
    }

    games.push({
      externalId: toExternalId(dateStr, awayTeamId, homeTeamId),
      gameDate: dateStr,
      gameTime: timeStr,
      stadium: $row.find(".place").text().trim() || "미정",
      homeTeamId,
      awayTeamId,
      homeScore,
      awayScore,
      status,
      innings: status === "finished" ? 9 : liveInnings,
      // Naver HTML엔 선발 안 노출. KBO API 폴백으로만 가능 → null.
      homeStarter: null,
      awayStarter: null
    });
  });

  return games;
}

/** KBO API 우선, 실패 시 네이버 폴백 */
export async function fetchGamesForDate(date: KboDateInput): Promise<{
  games: RawGame[];
  source: "kbo" | "naver" | "none";
  kboError?: string;
  naverError?: string;
}> {
  let kboError: string | undefined;
  try {
    const games = await fetchKboApiGames(date);
    return { games, source: "kbo" };
  } catch (kboErr) {
    kboError = (kboErr as Error).message;
    console.warn("[KBO] fetch failed, falling back to Naver:", kboError);
  }
  try {
    const games = await fetchNaverGames(date);
    return { games, source: "naver", kboError };
  } catch (naverErr) {
    const naverError = (naverErr as Error).message;
    console.error("[KBO] all sources failed:", naverError);
    return { games: [], source: "none", kboError, naverError };
  }
}
