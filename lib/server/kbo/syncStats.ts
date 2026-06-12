// KBO 시즌 누적 스탯 스크래핑 → bp_player_stats_snapshots upsert.
// scripts/scrape-kbo-stats.mjs의 1군 로직을 서버 모듈로 이식 (cron route에서 사용).
//
// 흐름:
//   각 팀 × {hitter Basic1+Basic2, pitcher Basic1+Basic2} 4페이지 fetch (1.5s 딜레이)
//   → 행 파싱 → roster 이름 매칭 → SimBatter/SimPitcher 변환
//   → (snapshot_date, player_id, kind) 기준 upsert.
//
// 2군은 cron에선 제외(시간/요청 부담). 시즌 baseline JSON 재생성 때만 스크립트로.

import { load as cheerioLoad } from "cheerio";
import type { CheerioAPI } from "cheerio";
import { getRoster } from "@/lib/rosters";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { SimBatter, SimPitcher } from "@/lib/sim/types";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 BallPlay-Cron/0.1 (contact: dev@ballnori.com)";

const FETCH_DELAY_MS = 800;

type TeamSpec = { id: string; kboCode: string; shortName: string; name: string };

const TEAMS: TeamSpec[] = [
  { id: "lg", kboCode: "LG", shortName: "LG", name: "LG 트윈스" },
  { id: "doosan", kboCode: "OB", shortName: "두산", name: "두산 베어스" },
  { id: "kt", kboCode: "KT", shortName: "KT", name: "KT 위즈" },
  { id: "samsung", kboCode: "SS", shortName: "삼성", name: "삼성 라이온즈" },
  { id: "ssg", kboCode: "SK", shortName: "SSG", name: "SSG 랜더스" },
  { id: "nc", kboCode: "NC", shortName: "NC", name: "NC 다이노스" },
  { id: "kia", kboCode: "HT", shortName: "KIA", name: "KIA 타이거즈" },
  { id: "hanwha", kboCode: "HH", shortName: "한화", name: "한화 이글스" },
  { id: "kiwoom", kboCode: "WO", shortName: "키움", name: "키움 히어로즈" },
  { id: "lotte", kboCode: "LT", shortName: "롯데", name: "롯데 자이언츠" }
];

const PAGES = {
  hitterBasic1: "https://www.koreabaseball.com/Record/Player/HitterBasic/Basic1.aspx",
  hitterBasic2: "https://www.koreabaseball.com/Record/Player/HitterBasic/Basic2.aspx",
  runnerBasic: "https://www.koreabaseball.com/Record/Player/Runner/Basic.aspx",
  pitcherBasic1: "https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx",
  pitcherBasic2: "https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic2.aspx"
};

export type SyncStatsResult = {
  snapshotDate: string;
  year: number;
  teamsProcessed: number;
  battersUpserted: number;
  pitchersUpserted: number;
  unmatched: number;
  errors: string[];
};

export type SyncStatsOpts = {
  /** 시즌. 기본값: snapshotDate의 연도. */
  year?: number;
  /** 대상 팀 id 목록. 기본값: 전체 10팀. */
  teams?: string[];
};

/** 시즌 누적 스탯을 받아 snapshot_date 기준으로 upsert. */
export async function syncStatsSnapshot(
  snapshotDate: string,
  opts?: SyncStatsOpts
): Promise<SyncStatsResult> {
  const year = opts?.year ?? Number(snapshotDate.slice(0, 4));
  const targetTeams = opts?.teams
    ? TEAMS.filter((t) => opts.teams!.includes(t.id))
    : TEAMS;

  const errors: string[] = [];
  const supabase = createSupabaseAdminClient();
  let battersUpserted = 0;
  let pitchersUpserted = 0;
  let unmatched = 0;
  let teamsProcessed = 0;

  for (const team of targetTeams) {
    const roster = getRoster(team.id);
    if (roster.length === 0) {
      errors.push(`${team.id}: no roster`);
      continue;
    }
    const nameMap = buildNameMap(roster);

    try {
      const hit1 = await scrapeStatsPage(PAGES.hitterBasic1, team.kboCode, year, parseHitterBasic1Row);
      await sleep(FETCH_DELAY_MS);
      const hit2 = await scrapeStatsPage(PAGES.hitterBasic2, team.kboCode, year, parseHitterBasic2Row);
      await sleep(FETCH_DELAY_MS);
      const runner = await scrapeStatsPage(PAGES.runnerBasic, team.kboCode, year, parseRunnerBasicRow);
      await sleep(FETCH_DELAY_MS);
      const pit1 = await scrapeStatsPage(PAGES.pitcherBasic1, team.kboCode, year, parsePitcherBasic1Row);
      await sleep(FETCH_DELAY_MS);
      const pit2 = await scrapeStatsPage(PAGES.pitcherBasic2, team.kboCode, year, parsePitcherBasic2Row);

      const mergedBatters = mergeRowsByName(hit1, hit2, runner);
      const mergedPitchers = mergeRowsByName(pit1, pit2);

      const batterRows: SnapshotRow[] = [];
      for (const row of mergedBatters) {
        const pid = nameMap.get(normalizeName(row.name as string));
        if (!pid) {
          unmatched++;
          continue;
        }
        const sim = makeSimBatter(row, pid, roster);
        if (sim) {
          batterRows.push({
            snapshot_date: snapshotDate,
            player_id: pid,
            team_id: team.id,
            kind: "batter",
            sim_payload: sim,
            source: "kbo-record"
          });
        }
      }

      const pitcherRows: SnapshotRow[] = [];
      for (const row of mergedPitchers) {
        const pid = nameMap.get(normalizeName(row.name as string));
        if (!pid) {
          unmatched++;
          continue;
        }
        const sim = makeSimPitcher(row, pid, roster);
        if (sim) {
          pitcherRows.push({
            snapshot_date: snapshotDate,
            player_id: pid,
            team_id: team.id,
            kind: "pitcher",
            sim_payload: sim,
            source: "kbo-record"
          });
        }
      }

      const allRows = [...batterRows, ...pitcherRows];
      if (allRows.length > 0) {
        const { error } = await supabase
          .from("bp_player_stats_snapshots")
          .upsert(allRows, { onConflict: "snapshot_date,player_id,kind" });
        if (error) {
          errors.push(`${team.id}: upsert ${error.message}`);
          continue;
        }
        battersUpserted += batterRows.length;
        pitchersUpserted += pitcherRows.length;
      }
      teamsProcessed++;
      await sleep(FETCH_DELAY_MS);
    } catch (e) {
      errors.push(`${team.id}: ${(e as Error).message}`);
    }
  }

  return {
    snapshotDate,
    year,
    teamsProcessed,
    battersUpserted,
    pitchersUpserted,
    unmatched,
    errors
  };
}

// ============================================================
// 내부 — 스크래핑 (ASP.NET WebForms ddlTeam postback)
// ============================================================

type SnapshotRow = {
  snapshot_date: string;
  player_id: string;
  team_id: string;
  kind: "batter" | "pitcher";
  sim_payload: SimBatter | SimPitcher;
  source: string;
};

function findFormFieldName($: CheerioAPI, candidates: string[]): string | null {
  for (const cand of candidates) {
    const el = $(`select[name$="${cand}"], input[name$="${cand}"]`).first();
    if (el.length > 0) return el.attr("name") ?? null;
  }
  return null;
}

function collectFormFields($: CheerioAPI): URLSearchParams {
  const form = new URLSearchParams();
  $("form input").each((_, el) => {
    const name = $(el).attr("name");
    if (!name) return;
    const type = ($(el).attr("type") || "").toLowerCase();
    if (type === "submit" || type === "button" || type === "image") return;
    if (type === "checkbox" || type === "radio") {
      if ($(el).attr("checked") != null) form.set(name, $(el).attr("value") ?? "");
      return;
    }
    form.set(name, $(el).attr("value") ?? "");
  });
  $("form select").each((_, el) => {
    const name = $(el).attr("name");
    if (!name) return;
    const selected =
      $(el).find("option[selected]").attr("value") ??
      $(el).find("option").first().attr("value") ??
      "";
    form.set(name, selected);
  });
  return form;
}

type RawRow = Record<string, string | number>;
type RowParser = (cells: string[]) => RawRow | null;

async function scrapeStatsPage(
  url: string,
  kboTeamCode: string,
  year: number,
  parseRow: RowParser
): Promise<RawRow[]> {
  const initRes = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko" },
    cache: "no-store"
  });
  if (!initRes.ok) throw new Error(`GET ${url} → ${initRes.status}`);

  const cookie = (initRes.headers.get("set-cookie") || "").split(";")[0];
  const initHtml = await initRes.text();
  const $init = cheerioLoad(initHtml);

  const teamSelectName = findFormFieldName($init, ["ddlTeam$ddlTeam", "ddlTeam"]);
  if (!teamSelectName) throw new Error(`no ddlTeam on ${url}`);

  const form = collectFormFields($init);
  form.set("__EVENTTARGET", teamSelectName);
  form.set("__EVENTARGUMENT", "");
  form.set(teamSelectName, kboTeamCode);
  const seasonName = findFormFieldName($init, ["ddlSeason$ddlSeason", "ddlSeason"]);
  if (seasonName) form.set(seasonName, String(year));

  const postRes = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      "User-Agent": UA,
      "Accept-Language": "ko-KR,ko",
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: url,
      ...(cookie && { Cookie: cookie })
    },
    body: form.toString()
  });
  if (!postRes.ok) throw new Error(`POST ${url} → ${postRes.status}`);

  const $ = cheerioLoad(await postRes.text());
  const rows: RawRow[] = [];
  $('table[class*="tData"] tbody tr, table.tEx tbody tr, table.tbl tbody tr').each((_, el) => {
    const cells = $(el).find("td").map((__, td) => $(td).text().trim()).get();
    if (cells.length < 3) return;
    const parsed = parseRow(cells);
    if (parsed) rows.push(parsed);
  });
  return rows;
}

// ============================================================
// 행 파서 (scrape-kbo-stats.mjs 1군 파서와 동일)
// ============================================================

function parseHitterBasic1Row(c: string[]): RawRow | null {
  if (c.length < 16) return null;
  return {
    name: c[1],
    avg: numOr0(c[3]),
    g: numOr0(c[4]),
    pa: numOr0(c[5]),
    ab: numOr0(c[6]),
    r: numOr0(c[7]),
    h: numOr0(c[8]),
    doubles: numOr0(c[9]),
    triples: numOr0(c[10]),
    hr: numOr0(c[11]),
    tb: numOr0(c[12]),
    rbi: numOr0(c[13]),
    sac: numOr0(c[14]),
    sf: numOr0(c[15])
  };
}

function parseHitterBasic2Row(c: string[]): RawRow | null {
  if (c.length < 11) return null;
  return {
    name: c[1],
    avg: numOr0(c[3]),
    bb: numOr0(c[4]),
    ibb: numOr0(c[5]),
    hbp: numOr0(c[6]),
    so: numOr0(c[7]),
    gdp: numOr0(c[8]),
    slg: numOr0(c[9]),
    obp: numOr0(c[10])
  };
}

function parseRunnerBasicRow(c: string[]): RawRow | null {
  if (c.length < 8) return null;
  return {
    name: c[1],
    g: numOr0(c[3]),
    sba: numOr0(c[4]),
    sb: numOr0(c[5]),
    cs: numOr0(c[6]),
    sbPct: numOr0(c[7])
  };
}

function parsePitcherBasic1Row(c: string[]): RawRow | null {
  if (c.length < 19) return null;
  return {
    name: c[1],
    era: numOr0(c[3]),
    g: numOr0(c[4]),
    w: numOr0(c[5]),
    l: numOr0(c[6]),
    sv: numOr0(c[7]),
    hld: numOr0(c[8]),
    wpct: numOr0(c[9]),
    ip: parseIp(c[10]),
    h: numOr0(c[11]),
    hr: numOr0(c[12]),
    bb: numOr0(c[13]),
    hbp: numOr0(c[14]),
    so: numOr0(c[15]),
    r: numOr0(c[16]),
    er: numOr0(c[17]),
    whip: numOr0(c[18])
  };
}

function parsePitcherBasic2Row(c: string[]): RawRow | null {
  if (c.length < 11) return null;
  return {
    name: c[1],
    era: numOr0(c[3]),
    cg: numOr0(c[4]),
    sho: numOr0(c[5]),
    qs: numOr0(c[6]),
    bsv: numOr0(c[7]),
    tbf: numOr0(c[8]),
    np: numOr0(c[9]),
    oavg: numOr0(c[10])
  };
}

function numOr0(s: string | null | undefined): number {
  if (s == null) return 0;
  const cleaned = String(s).replace(/[^\d.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseIp(s: string | null | undefined): number {
  if (!s) return 0;
  const m = String(s).trim().match(/^(\d+)(?:\s+(\d)\/3)?$/);
  if (!m) return numOr0(s);
  const whole = parseInt(m[1], 10);
  const frac = m[2] ? parseInt(m[2], 10) / 3 : 0;
  return Math.round((whole + frac) * 10) / 10;
}

function mergeRowsByName(...rowGroups: RawRow[][]): RawRow[] {
  const keyOf = (r: RawRow) => String(r.name);
  const map = new Map<string, RawRow>();
  for (const rows of rowGroups) {
    for (const r of rows) {
      const k = keyOf(r);
      const prev = map.get(k);
      if (prev) Object.assign(prev, r);
      else map.set(k, { ...r });
    }
  }
  return Array.from(map.values());
}

// ============================================================
// 이름 매칭 + SimBatter/SimPitcher 변환
// ============================================================

type RosterPlayer = ReturnType<typeof getRoster>[number];

function normalizeName(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, "").trim();
}

function buildNameMap(roster: RosterPlayer[]): Map<string, string> {
  // 동명이인 처리는 단순화: 1군 출장 우선, 없으면 첫 번째.
  // (cron 단계에선 정밀도 살짝 양보, baseline JSON 재생성 시 스크립트 쪽이 더 정밀.)
  const byName = new Map<string, RosterPlayer[]>();
  for (const p of roster) {
    const k = normalizeName(p.name);
    const list = byName.get(k);
    if (list) list.push(p);
    else byName.set(k, [p]);
  }
  const map = new Map<string, string>();
  byName.forEach((list, k) => {
    if (list.length === 1) {
      map.set(k, list[0].id);
      return;
    }
    const active = list.find((p: RosterPlayer) => (p.seasonGames ?? 0) > 0);
    map.set(k, (active ?? list[0]).id);
  });
  return map;
}

function makeSimBatter(row: RawRow, playerId: string, roster: RosterPlayer[]): SimBatter | null {
  const player = roster.find((p) => p.id === playerId);
  if (!player) return null;
  const pa = num(row.pa);
  const ab = num(row.ab);
  const h = num(row.h);
  const doubles = num(row.doubles);
  const triples = num(row.triples);
  const homers = num(row.hr);
  const bb = num(row.bb);
  const hbp = num(row.hbp);
  const so = num(row.so);
  const sb = num(row.sb);
  const cs = num(row.cs);
  const sba = Math.max(num(row.sba), sb + cs);

  const avg = num(row.avg) || (ab > 0 ? h / ab : 0);
  const obp = num(row.obp) || (pa > 0 ? (h + bb + hbp) / pa : 0);
  const slg =
    num(row.slg) ||
    (ab > 0
      ? (h - doubles - triples - homers + doubles * 2 + triples * 3 + homers * 4) / ab
      : 0);
  const iso = slg - avg;
  const babip = (h - homers) / Math.max(1, ab - so - homers);
  const bbRate = pa > 0 ? bb / pa : 0;
  const kRate = pa > 0 ? so / pa : 0;
  const contactScore = 1 - kRate;

  return {
    playerId,
    name: player.name,
    battingHand: (player.battingHand as SimBatter["battingHand"]) ?? "R",
    pa,
    ab,
    hits: h,
    doubles,
    triples,
    homers,
    walks: bb,
    hbp,
    strikeouts: so,
    sb,
    cs,
    sba,
    avg: round3(avg),
    obp: round3(obp),
    slg: round3(slg),
    iso: round3(iso),
    babip: round3(babip),
    bbRate: round3(bbRate),
    kRate: round3(kRate),
    contactScore: round3(contactScore)
  };
}

function makeSimPitcher(row: RawRow, playerId: string, roster: RosterPlayer[]): SimPitcher | null {
  const player = roster.find((p) => p.id === playerId);
  if (!player) return null;
  const ip = num(row.ip);
  const k = num(row.so);
  const bb = num(row.bb);
  const hr = num(row.hr);
  const hitsAllowed = num(row.h);
  const earnedRuns = num(row.er);
  const saves = num(row.sv);
  const holds = num(row.hld);
  const wins = num(row.w);
  const losses = num(row.l);

  const era = num(row.era) || (ip > 0 ? (earnedRuns * 9) / ip : 0);
  const whip = num(row.whip) || (ip > 0 ? (hitsAllowed + bb) / ip : 0);
  const k9 = ip > 0 ? (k * 9) / ip : 0;
  const bb9 = ip > 0 ? (bb * 9) / ip : 0;
  const hr9 = ip > 0 ? (hr * 9) / ip : 0;

  const g = num(row.g);
  const ipPerGame = g > 0 ? ip / g : 0;
  const role: SimPitcher["role"] = ipPerGame >= 4 ? "SP" : "RP";
  const staminaPitches =
    role === "SP"
      ? Math.max(80, Math.round(ipPerGame * 18))
      : Math.max(20, Math.round(ipPerGame * 18));

  return {
    playerId,
    name: player.name,
    throwingHand: (player.throwingHand as SimPitcher["throwingHand"]) ?? "R",
    role,
    ip: Math.round(ip * 10) / 10,
    k,
    bb,
    hr,
    hitsAllowed,
    earnedRuns,
    saves,
    holds,
    wins,
    losses,
    era: round2(era),
    whip: round2(whip),
    k9: round2(k9),
    bb9: round2(bb9),
    hr9: round2(hr9),
    staminaPitches
  };
}

function num(v: string | number | undefined | null): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  return numOr0(v ?? undefined);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
