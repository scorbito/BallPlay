// 매치업을 URL로 인코딩/디코딩. 시뮬 엔진이 결정론적이라 같은 매치업+시드면
// 받는 쪽도 동일한 결과를 시뮬할 수 있다.
//
// 인코딩 전략:
//   - playerId 기반 (stats는 클라이언트 번들의 data/kbo_players_2026.json 재활용)
//   - JSON → base64url (URL-safe)
//   - URL param: ?m=<token>
//
// 호환성:
//   - engine version + snapshotDate를 함께 담아 받는 쪽에서 검증

import { SIM_ENGINE_VERSION } from "./version";
import { getStatsSnapshotDate, buildStatsDirectory } from "./statsLoader";
import { buildSimTeamInput } from "./lineupAdapter";
import { autoFillPitcherLineup } from "./autoPitcherLineup";
import type {
  LineupEntry,
  Position,
  SavedLineup,
  SavedPitcherLineup
} from "@/lib/types/lineup";
import type { SimGameInput, SimTeamInput } from "./types";
import { PITCHER_SLOTS_COUNT } from "@/lib/types/lineup";

export type SharedBatter = {
  p: string;        // playerId
  o: number;        // 타순 1~9
  pos: Position;
};

export type SharedTeam = {
  t: string;        // teamId
  n?: string;       // displayName (사용자 지정 팀명; 빈 값이면 수신 측이 KBO 팀명으로 폴백)
  b: SharedBatter[];// batters
  ps: (string | null)[]; // pitcher slots (0..8)
};

export type SharedMatch = {
  v: string;        // engine version
  s: string;        // snapshot date
  seed: number;
  home: SharedTeam;
  away: SharedTeam;
};

// ============================================================
// Encode
// ============================================================

export function encodeMatchToToken(input: SimGameInput, seed: number): string {
  const shared: SharedMatch = {
    v: SIM_ENGINE_VERSION,
    s: getStatsSnapshotDate(),
    seed,
    home: encodeTeam(input.home),
    away: encodeTeam(input.away)
  };
  const json = JSON.stringify(shared);
  return base64UrlEncode(json);
}

export function encodeTeam(team: SimTeamInput): SharedTeam {
  // 타순은 배열 순서를 그대로 사용. position은 SimBatter에 보존된 사용자 지정값 사용 (없으면 DH 폴백).
  const batters: SharedBatter[] = team.batters.map((b, idx) => ({
    p: b.playerId,
    o: idx + 1,
    pos: (b.position ?? "DH") as Position
  }));
  const ps: (string | null)[] = Array.from({ length: PITCHER_SLOTS_COUNT }, () => null);
  ps[0] = team.starter.playerId;
  team.bullpen.forEach((p, i) => {
    if (i + 1 < PITCHER_SLOTS_COUNT) ps[i + 1] = p.playerId;
  });
  return { t: team.teamId, n: team.displayName, b: batters, ps };
}

// ============================================================
// Decode
// ============================================================

export type DecodeResult =
  | { ok: true; input: SimGameInput; seed: number; meta: { v: string; s: string } }
  | { ok: false; reason: string };

export function decodeTokenToMatch(token: string): DecodeResult {
  let parsed: SharedMatch;
  try {
    const json = base64UrlDecode(token);
    parsed = JSON.parse(json) as SharedMatch;
  } catch {
    return { ok: false, reason: "잘못된 공유 링크입니다." };
  }
  if (!parsed || typeof parsed !== "object" || !parsed.home || !parsed.away) {
    return { ok: false, reason: "공유 링크가 손상됐습니다." };
  }

  // 호환성 체크 — 엔진 버전이 같아야 결정성 보장
  if (parsed.v !== SIM_ENGINE_VERSION) {
    return {
      ok: false,
      reason: `엔진 버전이 다릅니다 (링크 ${parsed.v} ≠ 현재 ${SIM_ENGINE_VERSION}). 같은 결과를 재생할 수 없어요.`
    };
  }
  const currentSnapshot = getStatsSnapshotDate();
  if (parsed.s !== currentSnapshot) {
    return {
      ok: false,
      reason: `선수 데이터 스냅샷이 다릅니다 (링크 ${parsed.s} ≠ 현재 ${currentSnapshot}).`
    };
  }

  // 양 팀 데이터 stats 디렉토리 구성
  const stats = buildStatsDirectory([parsed.home.t, parsed.away.t]);

  const home = restoreTeam(parsed.home, stats);
  const away = restoreTeam(parsed.away, stats);
  if (!home.ok) return { ok: false, reason: `홈팀 ${home.reason}` };
  if (!away.ok) return { ok: false, reason: `원정팀 ${away.reason}` };

  return {
    ok: true,
    seed: parsed.seed,
    meta: { v: parsed.v, s: parsed.s },
    input: { home: home.team, away: away.team, context: {} }
  };
}

function restoreTeam(
  shared: SharedTeam,
  stats: ReturnType<typeof buildStatsDirectory>
): { ok: true; team: SimTeamInput } | { ok: false; reason: string } {
  // SavedLineup 모양 재구성
  const battingSlots = shared.b.map((b) => ({
    order: b.o as SavedLineup["slots"][number]["order"],
    playerId: b.p,
    position: b.pos
  }));
  const batting: SavedLineup = {
    teamId: shared.t,
    slots: battingSlots,
    useDH: true,
    updatedAt: new Date().toISOString()
  };
  const pitching: SavedPitcherLineup = {
    teamId: shared.t,
    slots: shared.ps.slice(0, PITCHER_SLOTS_COUNT),
    updatedAt: new Date().toISOString()
  };

  const adapt = buildSimTeamInput(shared.t, batting, pitching, stats, shared.n);
  if (!adapt.ok) {
    const kinds = adapt.issues.map((i) => i.kind).join(", ");
    return { ok: false, reason: `라인업 변환 실패 (${kinds})` };
  }
  return { ok: true, team: adapt.team };
}

// ============================================================
// base64url (URL-safe base64)
// ============================================================

function base64UrlEncode(s: string): string {
  // btoa는 latin1만 받음 → UTF-8 안전을 위해 encodeURIComponent로 우회
  const utf8 = unescape(encodeURIComponent(s));
  return btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const utf8 = atob(padded);
  return decodeURIComponent(escape(utf8));
}

// ============================================================
// 공유 URL 빌더
// ============================================================

export function buildShareUrl(input: SimGameInput, seed: number): string {
  const token = encodeMatchToToken(input, seed);
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/stadium/replay?m=${token}`;
}

// ============================================================
// LineupEntry → SharedTeam (Realtime 매치 전송용)
//   - 투수 라인업이 없으면 팀 stats에서 자동 보강
// ============================================================

export function buildSharedTeamFromEntry(
  entry: LineupEntry
): { ok: true; team: SharedTeam } | { ok: false; error: string } {
  if (entry.batting.slots.length !== 9) {
    return { ok: false, error: "타순 9명이 모두 채워져 있지 않습니다." };
  }

  const pitching = entry.pitching ?? autoFillPitcherLineup(entry.teamId);
  if (!pitching) {
    return { ok: false, error: "투수 라인업을 자동 생성하지 못했습니다." };
  }

  const stats = buildStatsDirectory([entry.teamId]);
  const adapt = buildSimTeamInput(entry.teamId, entry.batting, pitching, stats, entry.name);
  if (!adapt.ok) {
    const kinds = adapt.issues.map((i) => i.kind).join(", ");
    return { ok: false, error: `라인업 변환 실패 (${kinds})` };
  }
  return { ok: true, team: encodeTeam(adapt.team) };
}

// ============================================================
// SharedTeam → SimTeamInput (Realtime 매치 수신용)
//   - bp_matches.{home,away}_lineup_snapshot에서 꺼낸 SharedTeam을
//     PlayScreen 시뮬레이션 인풋으로 복원
// ============================================================

export function restoreSimTeamFromShared(
  shared: SharedTeam
): { ok: true; team: SimTeamInput } | { ok: false; reason: string } {
  const stats = buildStatsDirectory([shared.t]);
  return restoreTeam(shared, stats);
}
