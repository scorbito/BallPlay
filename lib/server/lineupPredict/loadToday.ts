// 오늘의 라인업 예측 — 화면에 필요한 데이터를 한 번에 모은다.
//
// 예측 화면은 빈 상태에서 9명을 고르게 하면 이탈한다. 직전 경기 라인업을 미리 채워두고
// 바꾸고 싶은 자리만 손대는 흐름이라, 팀별 최신 타순을 기본값으로 함께 내려준다.

import type { SupabaseClient } from "@supabase/supabase-js";
import { listLatestBattingLineupsByTeam } from "@/lib/supabase/query-parts/bpRecentLineups";
import type { LineupPick } from "@/lib/lineupPredict/scoring";

export type PredictableTeam = {
  gameId: string;
  teamId: string;
  opponentId: string;
  isHome: boolean;
  /** "19:00" — 이 시각이 마감이다. */
  gameTime: string;
  stadium: string | null;
  /** 상대 선발투수. 라인업을 예상할 때 좌/우 매치업이 핵심 단서다. */
  opponentStarter: string | null;
  /** 직전 경기 선발 타순. 없으면 빈 배열(신규 시즌 초 등).
   *  position 은 다이아몬드 초기 배치에 쓴다 — 채점 대상은 아니다. */
  defaultPicks: Array<LineupPick & { position: string | null }>;
  /** defaultPicks 를 가져온 경기 날짜 — "8/14 라인업 기준"처럼 표기한다. */
  defaultFromDate: string | null;
};

type GameRow = {
  id: string;
  game_date: string;
  game_time: string | null;
  stadium: string | null;
  home_team_id: string;
  away_team_id: string;
  status: string;
  home_starter: string | null;
  away_starter: string | null;
};

/**
 * 해당 날짜의 예측 가능한 팀 목록. 경기 하나당 홈·원정 두 항목이 나온다.
 * status 가 scheduled 인 경기만 — 이미 시작했거나 취소된 경기는 예측 대상이 아니다.
 */
export async function loadPredictableTeams(
  client: SupabaseClient,
  dateISO: string
): Promise<{ ok: true; teams: PredictableTeam[] } | { ok: false; error: string }> {
  const { data, error } = await client
    .from("games")
    .select("id,game_date,game_time,stadium,home_team_id,away_team_id,status,home_starter,away_starter")
    .eq("game_date", dateISO)
    .order("game_time", { ascending: true });
  if (error) return { ok: false, error: error.message };

  const games = ((data ?? []) as GameRow[]).filter((g) => g.status === "scheduled");
  if (games.length === 0) return { ok: true, teams: [] };

  // 기본값용 최신 타순 — 팀별 한 번씩만 읽으면 되므로 한 번에 가져온다.
  const lineupsResult = await listLatestBattingLineupsByTeam(client, { withinDays: 14 });
  const byTeam = lineupsResult.ok ? lineupsResult.byTeam : {};

  const teams: PredictableTeam[] = [];
  for (const game of games) {
    const time = (game.game_time ?? "18:30:00").slice(0, 5);
    for (const isHome of [true, false]) {
      const teamId = isHome ? game.home_team_id : game.away_team_id;
      const recent = byTeam[teamId];
      teams.push({
        gameId: game.id,
        teamId,
        opponentId: isHome ? game.away_team_id : game.home_team_id,
        isHome,
        gameTime: time,
        stadium: game.stadium,
        opponentStarter: isHome ? game.away_starter : game.home_starter,
        defaultPicks: (recent?.batting ?? [])
          .slice(0, 9)
          .map((b) => ({ order: b.order, name: b.name, rosterId: b.rosterId, position: b.position })),
        defaultFromDate: recent?.game_date ?? null
      });
    }
  }
  return { ok: true, teams };
}

/**
 * 마감 시각 — 경기 시작 3시간 전.
 *
 * KBO 라인업은 대체로 경기 1~2시간 전에 공개되고 구단 SNS 는 더 이르기도 하다.
 * 마감이 그보다 늦으면 발표된 라인업을 그대로 베끼는 구간이 열려 예측이 무의미해진다.
 * 3시간이면 안전 마진이 충분하다.
 *
 * 이르게 잡아도 참여 기회는 줄지 않는다 — 오늘 경기가 전부 마감되면 API 가 다음 날로
 * 넘겨주므로, 저녁에 들어온 유저는 자연스럽게 내일 경기를 예측하게 된다.
 */
const LOCK_MINUTES_BEFORE = 180;

export function isLocked(dateISO: string, gameTime: string, now = new Date()): boolean {
  const [h, m] = gameTime.split(":").map(Number);
  // KST 기준으로 해석한다. 서버 타임존에 좌우되지 않도록 UTC 오프셋을 직접 더한다.
  const startUtcMs = Date.UTC(
    Number(dateISO.slice(0, 4)),
    Number(dateISO.slice(5, 7)) - 1,
    Number(dateISO.slice(8, 10)),
    h - 9,
    m
  );
  return now.getTime() >= startUtcMs - LOCK_MINUTES_BEFORE * 60 * 1000;
}
