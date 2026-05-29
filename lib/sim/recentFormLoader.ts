// 주간 델타 계산 + 시즌·최근 블렌드.
// 입력: 한 선수의 시즌 누적 두 스냅샷(latest, previous).
// 출력: 시뮬에서 그대로 쓸 수 있는 SimBatter/SimPitcher (능력치만 블렌드 반영, 카운팅은 시즌값 유지).
//
// 정책:
//   - latest - previous = 그 주 실제 성적
//   - 표본 너무 작으면(타자 pa<8 / 투수 ip<3) 시즌값 그대로 (운빨 변동 흡수)
//   - 블렌드 비중: 시즌 0.7 + 최근 0.3 (기본). 필요 시 weight 조정 가능.
//   - SimBatter/SimPitcher 스키마 변경 X → 시뮬 엔진 코드 무관.

import type { SimBatter, SimPitcher } from "./types";

const DEFAULT_BLEND_WEIGHT = 0.3; // 최근 비중
const MIN_PA_FOR_DELTA = 8;       // 그 주 최소 타석
const MIN_IP_FOR_DELTA = 3;       // 그 주 최소 이닝

// ============================================================
// 타자
// ============================================================

/** 두 시즌 누적 SimBatter에서 주간 델타 계산 → 그 주 실제 성적의 rate stat 반환. */
export function computeBatterDelta(latest: SimBatter, previous: SimBatter): SimBatter | null {
  const pa = latest.pa - previous.pa;
  if (pa < MIN_PA_FOR_DELTA) return null;

  const ab = latest.ab - previous.ab;
  const hits = latest.hits - previous.hits;
  const doubles = latest.doubles - previous.doubles;
  const triples = latest.triples - previous.triples;
  const homers = latest.homers - previous.homers;
  const walks = latest.walks - previous.walks;
  const hbp = latest.hbp - previous.hbp;
  const strikeouts = latest.strikeouts - previous.strikeouts;

  if (pa <= 0 || ab <= 0) return null;

  const singles = hits - doubles - triples - homers;
  const tb = singles + doubles * 2 + triples * 3 + homers * 4;

  const avg = hits / ab;
  const obp = (hits + walks + hbp) / pa;
  const slg = tb / ab;
  const iso = slg - avg;
  const babipDenom = Math.max(1, ab - strikeouts - homers);
  const babip = (hits - homers) / babipDenom;
  const bbRate = walks / pa;
  const kRate = strikeouts / pa;
  const contactScore = 1 - kRate;

  return {
    ...latest,             // playerId, name, battingHand 등 유지
    pa,
    ab,
    hits,
    doubles,
    triples,
    homers,
    walks,
    hbp,
    strikeouts,
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

/** 시즌 + 최근 블렌드한 SimBatter. recent가 null이면 season 그대로. */
export function blendBatter(season: SimBatter, recent: SimBatter | null, weight = DEFAULT_BLEND_WEIGHT): SimBatter {
  if (!recent) return season;
  const w = clamp01(weight);
  const s = 1 - w;
  return {
    ...season, // 카운팅 스탯(pa/ab/hits 등)은 시즌값 유지 (엔진은 rate만 씀)
    avg: round3(season.avg * s + recent.avg * w),
    obp: round3(season.obp * s + recent.obp * w),
    slg: round3(season.slg * s + recent.slg * w),
    iso: round3(season.iso * s + recent.iso * w),
    babip: round3(season.babip * s + recent.babip * w),
    bbRate: round3(season.bbRate * s + recent.bbRate * w),
    kRate: round3(season.kRate * s + recent.kRate * w),
    contactScore: round3(season.contactScore * s + recent.contactScore * w)
  };
}

// ============================================================
// 투수
// ============================================================

/** 두 시즌 누적 SimPitcher에서 주간 델타 계산. */
export function computePitcherDelta(latest: SimPitcher, previous: SimPitcher): SimPitcher | null {
  const ip = round1(latest.ip - previous.ip);
  if (ip < MIN_IP_FOR_DELTA) return null;

  const k = latest.k - previous.k;
  const bb = latest.bb - previous.bb;
  const hr = latest.hr - previous.hr;
  const hitsAllowed = latest.hitsAllowed - previous.hitsAllowed;
  const earnedRuns = latest.earnedRuns - previous.earnedRuns;

  if (ip <= 0) return null;

  const era = (earnedRuns * 9) / ip;
  const whip = (hitsAllowed + bb) / ip;
  const k9 = (k * 9) / ip;
  const bb9 = (bb * 9) / ip;
  const hr9 = (hr * 9) / ip;

  return {
    ...latest,
    ip,
    k,
    bb,
    hr,
    hitsAllowed,
    earnedRuns,
    era: round2(era),
    whip: round2(whip),
    k9: round2(k9),
    bb9: round2(bb9),
    hr9: round2(hr9)
  };
}

/** 시즌 + 최근 블렌드. */
export function blendPitcher(season: SimPitcher, recent: SimPitcher | null, weight = DEFAULT_BLEND_WEIGHT): SimPitcher {
  if (!recent) return season;
  const w = clamp01(weight);
  const s = 1 - w;
  return {
    ...season,
    era: round2(season.era * s + recent.era * w),
    whip: round2(season.whip * s + recent.whip * w),
    k9: round2(season.k9 * s + recent.k9 * w),
    bb9: round2(season.bb9 * s + recent.bb9 * w),
    hr9: round2(season.hr9 * s + recent.hr9 * w)
  };
}

// ============================================================
// 유틸
// ============================================================

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
