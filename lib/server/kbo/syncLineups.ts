// KBO 박스스코어 → 팀별 선발 라인업 수집 → bp_team_recent_lineups upsert.
// 스크립트(scrape-kbo-lineups.mjs)와 동일 로직의 서버 모듈 버전. cron route에서 사용.
//
// 흐름: GetKboGameList(날짜) → 종료경기 → GetBoxScore → 타순 첫 행=선발 → roster 이름 매칭 → upsert

import { getRoster } from "@/lib/rosters";
import { parseTeamCode } from "@/lib/server/kbo/teamCode";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BASE = "https://www.koreabaseball.com";

// 박스스코어 포지션 약어 → 시뮬 포지션 코드 (한자 주의)
const POSITION_MAP: Record<string, string> = {
  "투": "P", "포": "C",
  "一": "1B", "二": "2B", "三": "3B", "유": "SS",
  "좌": "LF", "중": "CF", "우": "RF",
  "지": "DH"
};

export type LineupBatter = {
  order: number;
  name: string;
  position: string | null;
  rosterId: string | null;
};

export type TeamLineupRecord = {
  game_id: string;
  game_date: string;
  team_id: string;
  is_home: boolean;
  batting: LineupBatter[];
  starter_roster_id: string | null;
  starter_name: string | null;
  source: string;
};

function normalizeName(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, "").trim();
}

// 팀별 이름→rosterId 맵 (lib/rosters import 데이터 기반, serverless 호환)
const rosterNameMapCache = new Map<string, Map<string, string>>();
function nameToRosterId(teamId: string): Map<string, string> {
  const cached = rosterNameMapCache.get(teamId);
  if (cached) return cached;
  const map = new Map<string, string>();
  for (const p of getRoster(teamId)) {
    map.set(normalizeName(p.name), p.id);
  }
  rosterNameMapCache.set(teamId, map);
  return map;
}

async function post(path: string, body: Record<string, string>): Promise<{ tables?: unknown[]; game?: unknown[] }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Referer: `${BASE}/Schedule/GameCenter/Main.aspx`,
      "X-Requested-With": "XMLHttpRequest",
      Origin: BASE
    },
    body: new URLSearchParams(body).toString()
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return JSON.parse(await res.text());
}

type BoxCell = { Text?: string };
type BoxRow = { row?: BoxCell[] };
type BoxTable = { rows?: BoxRow[] };

// 타자 테이블 → 선발 9인 (각 타순 첫 행)
function extractStarters(table: BoxTable | undefined, nameMap: Map<string, string>): LineupBatter[] {
  const rows = table?.rows ?? [];
  const seen = new Set<number>();
  const starters: LineupBatter[] = [];
  for (const r of rows) {
    const cells = (r.row ?? []).map((c) => (c.Text ?? "").replace(/&nbsp;/g, "").trim());
    const order = parseInt(cells[0], 10);
    if (!Number.isInteger(order) || order < 1 || order > 9) continue;
    if (seen.has(order)) continue;
    seen.add(order);
    const posAbbr = cells[1];
    const name = cells[2];
    starters.push({
      order,
      name,
      position: POSITION_MAP[posAbbr] ?? posAbbr ?? null,
      rosterId: nameMap.get(normalizeName(name)) ?? null
    });
  }
  starters.sort((a, b) => a.order - b.order);
  return starters;
}

type KboGame = {
  G_ID: string;
  AWAY_ID?: string;
  HOME_ID?: string;
  AWAY_NM?: string;
  HOME_NM?: string;
  GAME_STATE_SC?: string | number;
  CANCEL_SC_ID?: string;
  T_PIT_P_NM?: string;
  B_PIT_P_NM?: string;
};

export type SyncLineupsResult = {
  date: string;
  finished: number;
  upserted: number;
  unmatchedBatters: number;
  errors: string[];
};

/** 특정 날짜의 종료 경기 라인업을 수집해 bp_team_recent_lineups에 upsert. */
export async function syncLineupsForDate(dateStr: string): Promise<SyncLineupsResult> {
  const yyyymmdd = dateStr.replaceAll("-", "");
  const seasonId = dateStr.slice(0, 4);
  const errors: string[] = [];

  const listData = await post("/ws/Main.asmx/GetKboGameList", { leId: "1", srId: "0", date: yyyymmdd });
  const games = (listData?.game ?? []) as KboGame[];
  const finished = games.filter(
    (g) => String(g.GAME_STATE_SC) === "3" && String(g.CANCEL_SC_ID ?? "0") === "0"
  );

  const supabase = createSupabaseAdminClient();
  let upserted = 0;
  let unmatchedBatters = 0;

  for (const g of finished) {
    const awayTeam = parseTeamCode(g.AWAY_ID || g.AWAY_NM || "");
    const homeTeam = parseTeamCode(g.HOME_ID || g.HOME_NM || "");
    if (!awayTeam || !homeTeam) {
      errors.push(`${g.G_ID}: 팀 매칭 실패 (${g.AWAY_ID}/${g.HOME_ID})`);
      continue;
    }

    let box: { tables?: unknown[] };
    try {
      box = await post("/ws/Schedule.asmx/GetBoxScore", { leId: "1", srId: "0", seasonId, gameId: g.G_ID });
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      errors.push(`${g.G_ID}: GetBoxScore ${(e as Error).message}`);
      continue;
    }

    const tables = (box?.tables ?? []) as BoxTable[];
    const awayMap = nameToRosterId(awayTeam);
    const homeMap = nameToRosterId(homeTeam);
    const awayBatters = extractStarters(tables[1], awayMap);
    const homeBatters = extractStarters(tables[2], homeMap);

    unmatchedBatters +=
      awayBatters.filter((b) => !b.rosterId).length + homeBatters.filter((b) => !b.rosterId).length;

    const records: TeamLineupRecord[] = [
      {
        game_id: g.G_ID,
        game_date: dateStr,
        team_id: awayTeam,
        is_home: false,
        batting: awayBatters,
        starter_name: (g.T_PIT_P_NM ?? "").trim() || null,
        starter_roster_id: awayMap.get(normalizeName(g.T_PIT_P_NM)) ?? null,
        source: "kbo-boxscore"
      },
      {
        game_id: g.G_ID,
        game_date: dateStr,
        team_id: homeTeam,
        is_home: true,
        batting: homeBatters,
        starter_name: (g.B_PIT_P_NM ?? "").trim() || null,
        starter_roster_id: homeMap.get(normalizeName(g.B_PIT_P_NM)) ?? null,
        source: "kbo-boxscore"
      }
    ];

    const { error } = await supabase
      .from("bp_team_recent_lineups")
      .upsert(records, { onConflict: "game_id,team_id" });
    if (error) {
      errors.push(`${g.G_ID}: upsert ${error.message}`);
      continue;
    }
    upserted += records.length;
  }

  return { date: dateStr, finished: finished.length, upserted, unmatchedBatters, errors };
}
