"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Play, Pause, Trophy, Volume2, VolumeX } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ModalShell } from "@/components/common/ModalShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import { simulateGame } from "@/lib/sim/engine";
import {
  loadMatchSession,
  saveMatchSession,
  type MatchSession
} from "@/lib/sim/matchSession";
import { SIM_ENGINE_VERSION } from "@/lib/sim/version";
import type { AtBatLog, AtBatOutcome, BaseState, InningLog, SimPitcher } from "@/lib/sim/types";
import {
  getSituationText,
  getBatterText,
  getOutcomeText,
  getHomerunText,
  getScoreText
} from "@/lib/sim/narration";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getServerTimeOffsetMs, serverNow } from "@/lib/sim/serverClock";
import { createRecord, type BpRecordSource } from "@/lib/supabase/query-parts/bpRecords";
import { useAppState } from "@/lib/state/AppState";
import { getMatchSoundMuted, playMatchSound, preloadMatchSounds, setMatchSoundMuted } from "@/lib/sound/matchSounds";

const OUTCOME_LABEL: Record<AtBatOutcome, string> = {
  K: "삼진",
  GO: "땅볼아웃",
  FO: "외야플라이",
  PO: "내야플라이",
  LO: "직선타",
  SF: "희생플라이",
  DP: "병살타",
  BB: "볼넷",
  HBP: "사구",
  "1B": "안타",
  "2B": "2루타",
  "3B": "3루타",
  HR: "홈런!",
  E: "실책 출루"
};

const EMPTY_BASE: BaseState = { first: null, second: null, third: null };

type FlatEvent = {
  inning: number;
  half: "top" | "bottom";
  index: number;
  ab: AtBatLog;
  scoreSnapshot: { home: number; away: number };
};

function flatten(innings: InningLog[]): FlatEvent[] {
  const out: FlatEvent[] = [];
  let home = 0;
  let away = 0;
  for (const ing of innings) {
    let halfIdx = 0;
    for (const ab of ing.top.atBats) {
      away += ab.runsScored;
      out.push({ inning: ing.inning, half: "top", index: halfIdx++, ab, scoreSnapshot: { home, away } });
    }
    if (ing.bottom) {
      halfIdx = 0;
      for (const ab of ing.bottom.atBats) {
        home += ab.runsScored;
        out.push({ inning: ing.inning, half: "bottom", index: halfIdx++, ab, scoreSnapshot: { home, away } });
      }
    }
  }
  return out;
}

function buildLinescore(innings: InningLog[], visibleCount: number, events: FlatEvent[]) {
  const visibleEvents = events.slice(0, visibleCount);
  const seenInning = new Map<string, number>();

  for (const ev of visibleEvents) {
    const key = `${ev.inning}|${ev.half}`;
    seenInning.set(key, (seenInning.get(key) ?? 0) + ev.ab.runsScored);
  }

  const totalInnings = Math.max(9, ...innings.map((i) => i.inning));

  const lastEvent = visibleEvents[visibleEvents.length - 1];
  const currentInning = lastEvent?.inning ?? 1;
  const currentHalf = lastEvent?.half ?? "top";

  type Cell = { runs: number | null };
  const away: Cell[] = [];
  const home: Cell[] = [];

  for (let i = 1; i <= totalInnings; i++) {
    const topKey = `${i}|top`;
    const botKey = `${i}|bottom`;

    away.push({ runs: seenInning.has(topKey) ? seenInning.get(topKey)! : null });

    const inningData = innings.find((x) => x.inning === i);
    if (inningData && inningData.bottom === null) {
      home.push({ runs: null });
    } else if (seenInning.has(botKey)) {
      home.push({ runs: seenInning.get(botKey)! });
    } else {
      home.push({ runs: null });
    }
  }

  return { away, home, currentInning, currentHalf, totalInnings };
}

// 다이아몬드 컴포넌트 — 1·2·3루 점등 + 홈베이스
function Diamond({ base }: { base: BaseState }) {
  return (
    <div className="stadium-diamond" aria-label="베이스 상황">
      <div className={`stadium-base stadium-base-2nd ${base.second ? "is-on" : ""}`} />
      <div className={`stadium-base stadium-base-3rd ${base.third ? "is-on" : ""}`} />
      <div className={`stadium-base stadium-base-1st ${base.first ? "is-on" : ""}`} />
      <div className="stadium-base stadium-base-home" />
    </div>
  );
}

function OutDots({ outs }: { outs: 0 | 1 | 2 | 3 }) {
  return (
    <div className="stadium-outs" aria-label={`아웃 ${outs}`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < outs ? "is-out" : ""} />
      ))}
    </div>
  );
}

// 안타/홈런 시 화면 위로 폭죽·반짝이 이펙트. key prop으로 매 타석마다 재실행.
function HitEffect({ kind }: { kind: "hr" | "hit" }) {
  const particles = kind === "hr" ? 24 : 12;
  return (
    <div className={`stadium-fx stadium-fx-${kind}`} aria-hidden>
      {kind === "hr" ? <div className="stadium-fx-burst" /> : null}
      {Array.from({ length: particles }).map((_, i) => (
        <span
          key={i}
          className="stadium-fx-particle"
          style={{
            // 균등 분포 + 약간의 랜덤 — i 기반이라 결정적
            ["--angle" as string]: `${(360 / particles) * i + (i % 3) * 7}deg`,
            ["--delay" as string]: `${(i % 6) * 30}ms`,
            ["--dist" as string]: `${kind === "hr" ? 160 + (i % 5) * 20 : 90 + (i % 4) * 15}px`,
            ["--hue" as string]: `${(i * 47) % 360}`
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

// 안타 발사 이펙트 — fromX,fromY 에서 dx,dy 방향으로 durationMs 동안 날아가는 공.
// CSS variable 로 좌표 전달, transition end 시 부모가 setFlyingBall(null) 로 제거.
function FlyingBall({
  fromX,
  fromY,
  dx,
  dy,
  durationMs,
  maxScale,
  onEnd
}: {
  fromX: number;
  fromY: number;
  dx: number;
  dy: number;
  durationMs: number;
  maxScale: number;
  onEnd: () => void;
}) {
  // animation 안 도는 케이스 대비 — 명시적 timeout 으로 onEnd 보장.
  useEffect(() => {
    const t = window.setTimeout(onEnd, durationMs + 100);
    console.log("[ball] mount", { fromX, fromY, dx, dy, durationMs, maxScale });
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style: CSSProperties = {
    left: `${fromX}px`,
    top: `${fromY}px`,
    // CSS variable — keyframes 에서 --ball-dx / --ball-dy / --ball-max-scale 로 읽음.
    ["--ball-dx" as string]: `${dx}px`,
    ["--ball-dy" as string]: `${dy}px`,
    ["--ball-max-scale" as string]: String(maxScale),
    // longhand 로 명확하게 — shorthand 가 다른 CSS 와 충돌하는 경우 회피.
    animationName: "stadium-ball-fly",
    animationDuration: `${durationMs}ms`,
    // linear — keyframes 의 % 단계가 그대로 시간에 대응. 천천히 시작/가속이 keyframes 로직에 위임.
    animationTimingFunction: "linear",
    animationFillMode: "forwards"
  };
  return (
    <div
      className="stadium-flying-ball"
      style={style}
      onAnimationEnd={() => {
        console.log("[ball] animation end");
        onEnd();
      }}
    >
      {/* 야구공 SVG — 흰 배경 + 빨간 stitching 두 곡선 (dashed) */}
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#ffffff" stroke="#475569" strokeWidth="0.6" />
        <path
          d="M6 5.5 C 7.3 7.5, 8 9.7, 8 12 S 7.3 16.5, 6 18.5"
          fill="none"
          stroke="#dc2626"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeDasharray="1.6 1.6"
        />
        <path
          d="M18 5.5 C 16.7 7.5, 16 9.7, 16 12 S 16.7 16.5, 18 18.5"
          fill="none"
          stroke="#dc2626"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeDasharray="1.6 1.6"
        />
      </svg>
    </div>
  );
}

// 안타/홈런/타점 이펙트 portal — 타자 row 위치(centerX, centerY) 에 폭죽.
// HitEffect 자체는 이미 absolute 기준 자식이라 fixed wrapper 안에 배치.
function HitEffectAtPosition({
  centerX,
  centerY,
  kind,
  onEnd
}: {
  centerX: number;
  centerY: number;
  kind: "hit" | "hr";
  onEnd: () => void;
}) {
  // particle animation 이 약 900ms 안에 끝남 — 안전한 fallback timer.
  useEffect(() => {
    const t = window.setTimeout(onEnd, 1200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    // phone-frame-light 클래스 — 기존 .stadium-fx CSS 가 모두 .phone-frame-light prefix 라
    // portal 로 body 에 띄울 때 부모에 명시해야 스타일 적용됨.
    <div
      className="phone-frame-light stadium-fx-portal"
      style={{ position: "fixed", left: `${centerX}px`, top: `${centerY}px`, pointerEvents: "none", zIndex: 9998 }}
    >
      <HitEffect kind={kind} />
    </div>
  );
}

// 삼진 K 효과 — 중계 텍스트(narration) 위치에 큰 빨간 K 가 슬램.
function StrikeoutEffect({
  centerX,
  centerY,
  durationMs,
  onEnd
}: {
  centerX: number;
  centerY: number;
  durationMs: number;
  onEnd: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onEnd, durationMs + 100);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style: CSSProperties = {
    left: `${centerX}px`,
    top: `${centerY}px`,
    animationName: "stadium-strikeout-slam",
    animationDuration: `${durationMs}ms`,
    animationTimingFunction: "linear",
    animationFillMode: "forwards"
  };
  return (
    <span className="stadium-strikeout-k" style={style} onAnimationEnd={onEnd}>K</span>
  );
}

export function PlayScreen() {
  const router = useRouter();
  const { showToast, profile } = useAppState();
  const [session, setSession] = useState<MatchSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(true);
  // 효과음 음소거 — localStorage 동기. 초기엔 false(들림)로 SSR/CSR 안전, mount 시 보정.
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    setMuted(getMatchSoundMuted());
    // 4종 사운드 사전 decode → 첫 안타/홈런/삼진/득점부터 지연 없이 즉시 재생.
    // (이전엔 매 호출마다 new Audio() 라 모바일에서 1초가량 늦게 들리는 문제 있었음.)
    void preloadMatchSounds();
  }, []);
  const toggleMuted = () => {
    setMuted((m) => {
      const next = !m;
      setMatchSoundMuted(next);
      return next;
    });
  };
  // 경기 종료 시 자동 저장 — 한 번만 실행하도록 추적.
  // useState는 비동기 업데이트라 두 번째 effect 실행에서 stale 값이 보일 수 있음 →
  // useRef로 동기 가드. StrictMode/의존성 변경으로 effect가 두 번 실행돼도 INSERT 1회만.
  const recordSaveAttemptedRef = useRef(false);
  const [recordSaving, setRecordSaving] = useState(false);
  const [recordSavedId, setRecordSavedId] = useState<string | null>(null);
  // 6회 전에 건너뛰기 시도 시 안내 모달. 5회까지 진행해야 전적 누적되는 정식경기 인정.
  const [skipBlockedOpen, setSkipBlockedOpen] = useState(false);
  // 진행 모드 — fast(기본) / normal / superfast / live(실시간 중계, SITUATION phase + 단계 narration)
  const [mode, setMode] = useState<"normal" | "fast" | "superfast" | "live">("fast");
  // 진행 단계 — live에선 SITUATION → BATTER → OUTCOME → … / normal·fast는 SITUATION 스킵
  const [phase, setPhase] = useState<
    "SITUATION" | "BATTER" | "OUTCOME" | "INNING_END" | "PITCHER_CHANGE" | "GAME_END"
  >("BATTER");
  // live 모드의 OUTCOME 안에서 단계적 narration 진행: 0=결과 / 1=홈인 / 2=점수보드.
  // 점수 없는 결과는 0에서 바로 다음 타자로 진행.
  const [outcomeStep, setOutcomeStep] = useState<0 | 1 | 2>(0);
  // 라인업·다이아몬드 상태에서 결과 반영 여부.
  // SITUATION/BATTER phase에선 아직 결과 발표 전이라 라인업에 결과 표시 안 함 (스포 방지).
  const showOutcome = phase !== "BATTER" && phase !== "SITUATION";
  // 안타 발사 이펙트 — 타자 row 위치 → 위쪽 + 좌우 랜덤 각도로 공이 날아감.
  // 1B < 2B < 3B < HR(화면 밖). OUTCOME phase 진입 시 trigger.
  const [flyingBall, setFlyingBall] = useState<{
    fromX: number;
    fromY: number;
    dx: number;
    dy: number;
    durationMs: number;
    maxScale: number;
    key: number;
  } | null>(null);
  // 이벤트별로 한 번만 발사 — phase 변경 시 cursor 가 같으면 중복 발동 방지.
  const ballFiredForCursorRef = useRef<number>(-1);
  // 삼진 K 효과 — 중계 텍스트(.stadium-play-narration) 위치에 큰 빨간 K 가 슬램.
  const [strikeoutEffect, setStrikeoutEffect] = useState<{
    centerX: number;
    centerY: number;
    durationMs: number;
    key: number;
  } | null>(null);
  const strikeoutFiredForCursorRef = useRef<number>(-1);
  // 안타/홈런/타점 폭죽 이펙트 — 공 출발 위치(타자 row) 에 표시.
  const [hitFx, setHitFx] = useState<{
    centerX: number;
    centerY: number;
    kind: "hit" | "hr";
    key: number;
  } | null>(null);
  const hitFxFiredForCursorRef = useRef<number>(-1);

  // 라이브 매치 모드 — liveStartAt까지 대기 후 진행. 속도/일시정지 컨트롤 잠금.
  const isLive = !!session?.liveMatchId;
  const [liveCountdown, setLiveCountdown] = useState<number | null>(null);

  useEffect(() => {
    const s = loadMatchSession();
    if (!s || !s.input) {
      router.replace("/stadium/lobby");
      return;
    }
    let next = s;
    if (!s.result) {
      const result = simulateGame(s.input, s.seed);
      next = { ...s, result };
      saveMatchSession(next);
    }
    setSession(next);
    setHydrated(true);

    // 친구 대결(라이브 매치) — 방장이 선택한 진행 속도(liveMode)로 진행.
    // 구버전 세션은 liveMode 없을 수 있으므로 기본 'fast'로 폴백.
    if (next.liveMatchId) {
      setMode(next.liveMode ?? "fast");
    }

    // 카운트다운: startAt이 미래면 그때까지 playing=false.
    // 비교는 server-equivalent time 기준(serverNow) — 양쪽 클라이언트 wall-clock 이 어긋나도
    // 같은 server time 에 동시에 시작되도록.
    if (next.liveMatchId && next.liveStartAt) {
      // 친구 매치면 server time offset 미리 fetch (countdown effect 가 사용).
      void getServerTimeOffsetMs(createSupabaseBrowserClient());
      const startMs = new Date(next.liveStartAt).getTime();
      if (serverNow() < startMs) {
        setPlaying(false);
      }
    }
  }, [router]);

  // 라이브 카운트다운 — startAt 도달 시 자동 play.
  // server-equivalent time 기준 비교(serverNow) → 클라 wall-clock drift 무관하게 양쪽 동시 시작.
  useEffect(() => {
    if (!isLive || !session?.liveStartAt) return;
    const startMs = new Date(session.liveStartAt).getTime();
    const client = createSupabaseBrowserClient();
    // offset 아직 미캐시면 한 번 fetch 후 tick 시작. 캐시 있으면 즉시.
    let cancelled = false;
    let intervalId = 0;
    void getServerTimeOffsetMs(client).then(() => {
      if (cancelled) return;
      const tick = () => {
        const remain = Math.max(0, Math.ceil((startMs - serverNow()) / 1000));
        setLiveCountdown(remain);
        if (remain <= 0) {
          setPlaying(true);
          setLiveCountdown(null);
          return false;
        }
        return true;
      };
      if (!tick()) return;
      intervalId = window.setInterval(() => {
        if (!tick()) window.clearInterval(intervalId);
      }, 200);
    });
    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [isLive, session?.liveStartAt]);

  const events = useMemo(() => {
    if (!session?.result) return [];
    return flatten(session.result.innings);
  }, [session]);

  const currentInningEvents = useMemo(() => {
    if (cursor === 0) return [];
    const visible = events.slice(0, cursor);
    const tail = visible[visible.length - 1];
    if (!tail) return [];
    return visible.filter((ev) => ev.inning === tail.inning && ev.half === tail.half);
  }, [events, cursor]);

  // 전체 투수 lookup (playerId → SimPitcher) — 이름 표시에 사용
  const pitcherById = useMemo(() => {
    const m = new Map<string, SimPitcher>();
    if (!session?.input) return m;
    const all = [
      session.input.home.starter,
      ...session.input.home.bullpen,
      session.input.away.starter,
      ...session.input.away.bullpen
    ];
    for (const p of all) m.set(p.playerId, p);
    return m;
  }, [session]);

  // 이번 경기 누적 타격 (cursor까지) — 타자별 AB / Hits.
  // 진행 중인 마지막 타석은 결과 발표 페이즈일 때만 합산 (스포 방지).
  // 이번 경기 타자별 누적 (AB, hits) — "(안타수/타수)" 형식 표시.
  // 진행 중 타석은 showOutcome일 때만 포함 (스포 방지).
  const todayStats = useMemo(() => {
    const m = new Map<string, { ab: number; hits: number }>();
    const visible = events.slice(0, cursor);
    for (let i = 0; i < visible.length; i++) {
      const ev = visible[i];
      const isCurrent = i === visible.length - 1;
      if (isCurrent && !showOutcome) continue;
      const o = ev.ab.outcome;
      // PA 중 AB 제외: BB, HBP, SF
      const countsAsAB = o !== "BB" && o !== "HBP" && o !== "SF";
      const isHit = o === "1B" || o === "2B" || o === "3B" || o === "HR";
      const cur = m.get(ev.ab.batterId) ?? { ab: 0, hits: 0 };
      if (countsAsAB) cur.ab += 1;
      if (isHit) cur.hits += 1;
      m.set(ev.ab.batterId, cur);
    }
    return m;
  }, [events, cursor, showOutcome]);

  // 현재 이닝의 각 타자별 마지막 결과 — 공수교대 시 자동으로 비워짐 (currentInningEvents가 새 이닝의 것으로 교체됨)
  const inningOutcomes = useMemo(() => {
    // isHit는 뱃지 색상용(=출루) — 안타뿐 아니라 볼넷·사구도 출루이므로 녹색 표시.
    const map = new Map<string, { label: string; isHit: boolean; isHr: boolean }>();
    for (let i = 0; i < currentInningEvents.length; i++) {
      const ev = currentInningEvents[i];
      const isLast = i === currentInningEvents.length - 1;
      // 마지막 타석은 결과 표시 페이즈일 때만 Map에 반영 (그 전엔 진행 중 ··· 상태)
      if (isLast && !showOutcome) continue;
      const label =
        OUTCOME_LABEL[ev.ab.outcome] +
        (ev.ab.runsScored > 0 ? ` (+${ev.ab.runsScored})` : "");
      map.set(ev.ab.batterId, {
        label,
        isHit: ["1B", "2B", "3B", "HR", "BB", "HBP"].includes(ev.ab.outcome),
        isHr: ev.ab.outcome === "HR"
      });
    }
    return map;
  }, [currentInningEvents, showOutcome]);

  useEffect(() => {
    if (!playing || !hydrated) return;
    if (phase === "GAME_END") return; // 게임 종료 페이즈에선 진행 멈춤
    if (cursor > events.length) return;

    // 모드별 시간 배수 — normal=기본, fast=절반, live=느림(중계 호흡)
    const modeMul =
      mode === "superfast" ? 0.28 : mode === "fast" ? 0.5 : mode === "live" ? 1.6 : 1;

    // OUTCOME phase 시간은 타구 결과에 따라 달라짐 — 득점 발생/안타/홈런은 더 길게.
    const currentEvt = cursor > 0 ? events[cursor - 1] : null;
    // 안타류면 공 날아가는 시간만큼 OUTCOME phase 연장. ballMs 도 modeMul 적용 →
    // normal 기준의 (1400/1900/2400/2800) 가 fast 에선 절반, superfast 더 짧아짐.
    const ballMs = (() => {
      if (!currentEvt || phase !== "OUTCOME") return 0;
      const o = currentEvt.ab.outcome;
      if (o === "1B") return 1400;
      if (o === "2B") return 1900;
      if (o === "3B") return 2400;
      if (o === "HR") return 2800;
      return 0;
    })();
    // 삼진 K 효과 시간 — 안타 ball 과 동일하게 modeMul 적용.
    const strikeoutMs = currentEvt && phase === "OUTCOME" && currentEvt.ab.outcome === "K" ? 1500 : 0;
    const outcomeMs = (() => {
      if (!currentEvt) return 1100;
      const o = currentEvt.ab.outcome;
      // 홈런 or 득점 발생 (적시타 / SF / 땅볼 RBI 등) — 모두 가장 길게
      if (o === "HR" || currentEvt.ab.runsScored > 0) return 2400;
      if (o === "3B") return 1900;
      if (o === "2B") return 1800;
      if (o === "1B") return 1500;
      return 1100; // 아웃/볼넷류
    })();

    // 페이즈별 base 시간 (ms). live 모드의 OUTCOME sub-step도 같은 시간 단위.
    const intervalByPhase: Record<
      "SITUATION" | "BATTER" | "OUTCOME" | "INNING_END" | "PITCHER_CHANGE",
      number
    > = {
      SITUATION: 1500 * modeMul,
      BATTER: 800 * modeMul,
      OUTCOME: (outcomeMs + ballMs + strikeoutMs) * modeMul,
      INNING_END: 1200 * modeMul,
      PITCHER_CHANGE: 1200 * modeMul
    };

    const handle = window.setTimeout(() => {
      // cursor=0: 게임 시작 직전 → 첫 타자 진입. live는 SITUATION부터.
      if (cursor === 0) {
        setCursor(1);
        setPhase(mode === "live" ? "SITUATION" : "BATTER");
        setOutcomeStep(0);
        return;
      }

      const current = events[cursor - 1];
      const next = events[cursor];
      const inningEnded =
        !!next && (next.inning !== current.inning || next.half !== current.half);
      const pitcherChanged =
        !!next && !inningEnded && next.ab.pitcherId !== current.ab.pitcherId;

      if (phase === "SITUATION") {
        setPhase("BATTER");
        return;
      }
      if (phase === "BATTER") {
        setPhase("OUTCOME");
        setOutcomeStep(0);
        return;
      }
      if (phase === "OUTCOME") {
        // live 모드 + 점수 들어옴 + 아직 sub-step 남음 → 단계적 진행
        if (mode === "live" && current.ab.runsScored > 0 && outcomeStep < 2) {
          setOutcomeStep((s) => (s + 1) as 0 | 1 | 2);
          return;
        }
        // 다음 타자/이닝/투수교체 분기
        if (!next) {
          setPhase("GAME_END");
          return;
        }
        if (inningEnded) {
          setPhase("INNING_END");
          return;
        }
        if (pitcherChanged) {
          setPhase("PITCHER_CHANGE");
          return;
        }
        setCursor((c) => c + 1);
        setPhase(mode === "live" ? "SITUATION" : "BATTER");
        setOutcomeStep(0);
        return;
      }
      if (phase === "INNING_END") {
        if (pitcherChanged) {
          setPhase("PITCHER_CHANGE");
          return;
        }
        setCursor((c) => c + 1);
        setPhase(mode === "live" ? "SITUATION" : "BATTER");
        setOutcomeStep(0);
        return;
      }
      if (phase === "PITCHER_CHANGE") {
        setCursor((c) => c + 1);
        setPhase(mode === "live" ? "SITUATION" : "BATTER");
        setOutcomeStep(0);
        return;
      }
    }, intervalByPhase[phase as keyof typeof intervalByPhase]);

    return () => window.clearTimeout(handle);
  }, [playing, cursor, events, events.length, mode, hydrated, phase, outcomeStep]);

  // OUTCOME phase 진입 + 안타류일 때 1회 ball 발사 trigger.
  // 같은 cursor 에서 outcomeStep 변경 등으로 useEffect 가 다시 도는 경우 중복 발사 방지.
  useEffect(() => {
    if (!hydrated) return;
    if (phase !== "OUTCOME") return;
    if (ballFiredForCursorRef.current === cursor) return;
    const evt = cursor > 0 ? events[cursor - 1] : null;
    if (!evt) {
      console.log("[ball] no event for cursor", cursor);
      return;
    }
    const o = evt.ab.outcome;
    if (o !== "1B" && o !== "2B" && o !== "3B" && o !== "HR") {
      console.log("[ball] not hit:", o);
      return;
    }

    // 타자 row DOM 위치 측정
    const selector = `[data-batter-id="${evt.ab.batterId}"]`;
    const row = typeof document !== "undefined"
      ? (document.querySelector(selector) as HTMLElement | null)
      : null;
    if (!row) {
      console.log("[ball] row not found", { batterId: evt.ab.batterId, selector });
      return;
    }
    const rect = row.getBoundingClientRect();
    const fromX = rect.left + rect.width / 2;
    const fromY = rect.top + rect.height / 2;

    // 거리: 1B/2B/3B 2배. HR 은 이미 화면 밖이라 그대로. 각도: ±20° 랜덤.
    const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
    const distance = o === "1B" ? 280 : o === "2B" ? 460 : o === "3B" ? 720 : viewportH + 200;
    // duration 도 진행 모드 따라가도록 modeMul 적용. normal 기준 1400~2800.
    const ballModeMul =
      mode === "superfast" ? 0.28 : mode === "fast" ? 0.5 : mode === "live" ? 1.6 : 1;
    const baseDurationMs = o === "1B" ? 1400 : o === "2B" ? 1900 : o === "3B" ? 2400 : 2800;
    const durationMs = baseDurationMs * ballModeMul;
    // 정점 scale — 안타 3배, 홈런 4배.
    const maxScale = o === "HR" ? 4 : 3;
    const angleDeg = (Math.random() - 0.5) * 40;
    const rad = (angleDeg * Math.PI) / 180;
    const dx = Math.sin(rad) * distance;
    const dy = -Math.cos(rad) * distance;

    console.log("[ball] fire", { outcome: o, fromX, fromY, dx, dy, durationMs, maxScale, mode });
    ballFiredForCursorRef.current = cursor;
    setFlyingBall({ fromX, fromY, dx, dy, durationMs, maxScale, key: cursor });
    playMatchSound(o === "HR" ? "homerun" : "hit");

    // 폭죽 이펙트도 같은 위치에 — HR/타점이면 hr 변형, 일반 안타면 hit.
    if (hitFxFiredForCursorRef.current !== cursor) {
      hitFxFiredForCursorRef.current = cursor;
      const fxKind: "hit" | "hr" = o === "HR" || evt.ab.runsScored > 0 ? "hr" : "hit";
      setHitFx({ centerX: fromX, centerY: fromY, kind: fxKind, key: cursor });
    }
  }, [phase, cursor, events, hydrated, mode]);

  // HR / 타점 이펙트가 안타 외 케이스 (땅볼 RBI / SF 등) 에도 발동해야 함.
  // ball trigger 는 안타류만 발사하니, 그 외 득점 케이스를 별도로 잡음.
  useEffect(() => {
    if (!hydrated) return;
    if (phase !== "OUTCOME") return;
    if (hitFxFiredForCursorRef.current === cursor) return;
    const evt = cursor > 0 ? events[cursor - 1] : null;
    if (!evt) return;
    const o = evt.ab.outcome;
    // 안타류는 위의 useEffect 에서 처리. 여기는 안타 아닌데 득점만 있는 케이스.
    if (o === "1B" || o === "2B" || o === "3B" || o === "HR") return;
    if (evt.ab.runsScored <= 0) return;

    // 타자 row 위치
    const row = typeof document !== "undefined"
      ? (document.querySelector(`[data-batter-id="${evt.ab.batterId}"]`) as HTMLElement | null)
      : null;
    if (!row) return;
    const rect = row.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    hitFxFiredForCursorRef.current = cursor;
    setHitFx({ centerX, centerY, kind: "hr", key: cursor });
  }, [phase, cursor, events, hydrated]);

  // 득점 효과음 trigger — OUTCOME 진입 + runsScored > 0. 안타/홈런 사운드와 별개로 1회 추가 재생.
  // 다득점(1타석 2점+) 이어도 1회만 — 환호성이라 중첩 안 어울림.
  const scoreFiredForCursorRef = useRef<number>(-1);
  useEffect(() => {
    if (!hydrated) return;
    if (phase !== "OUTCOME") return;
    if (scoreFiredForCursorRef.current === cursor) return;
    const evt = cursor > 0 ? events[cursor - 1] : null;
    if (!evt || evt.ab.runsScored <= 0) return;
    scoreFiredForCursorRef.current = cursor;
    playMatchSound("score");
  }, [phase, cursor, events, hydrated]);

  // 삼진 K 효과 trigger — OUTCOME 진입 + outcome === "K". 위치는 중계 텍스트(narration) 중심.
  useEffect(() => {
    if (!hydrated) return;
    if (phase !== "OUTCOME") return;
    if (strikeoutFiredForCursorRef.current === cursor) return;
    const evt = cursor > 0 ? events[cursor - 1] : null;
    if (!evt || evt.ab.outcome !== "K") return;
    const narrationEl = typeof document !== "undefined"
      ? (document.querySelector(".stadium-play-narration") as HTMLElement | null)
      : null;
    if (!narrationEl) return;
    const rect = narrationEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const ballModeMul =
      mode === "superfast" ? 0.28 : mode === "fast" ? 0.5 : mode === "live" ? 1.6 : 1;
    const durationMs = 1500 * ballModeMul;
    strikeoutFiredForCursorRef.current = cursor;
    setStrikeoutEffect({ centerX, centerY, durationMs, key: cursor });
    playMatchSound("strikeout");
  }, [phase, cursor, events, hydrated, mode]);

  // 경기 종료 시 자동 저장 — public/friend 매치만, 정식 계정만, 재생 모드 제외.
  // ResultScreen에 들어가지 않아도(예: 도중 이탈) 결과는 DB에 남음.
  useEffect(() => {
    if (phase !== "GAME_END") return;
    if (!session?.input || !session.result) return;
    if (session.replayOfRecordId) return;
    const canSave = session.source === "public" || session.source === "friend";
    if (!canSave) return;
    if (recordSavedId || recordSaving) return;
    // 동기 ref 가드 — useEffect가 어떤 이유로든 두 번 실행돼도 INSERT 1회로 제한.
    if (recordSaveAttemptedRef.current) return;
    // sessionStorage 기준 추가 가드 — 이미 다른 마운트에서 저장했거나 진행 중이면 skip.
    const sessionFresh = loadMatchSession();
    if (sessionFresh?.savedRecordId) return;
    recordSaveAttemptedRef.current = true;

    let cancelled = false;
    (async () => {
      setRecordSaving(true);
      // race condition 차단: 저장 시작 시점에 즉시 matchSession에 placeholder 세팅.
      // ResultScreen이 그 사이 마운트되어 stale session으로 또 저장하는 케이스 차단.
      // 저장 완료 시 실제 id로 교체. 실패하면 finally에서 다시 비움.
      const before = loadMatchSession();
      if (before) saveMatchSession({ ...before, savedRecordId: "saving" });
      try {
        const client = createSupabaseBrowserClient();
        const { data: { user } } = await client.auth.getUser();
        if (!user) return;

        const { home, away } = session.input!;
        const { finalScore, mvp, innings } = session.result!;
        const totalInnings = Math.max(9, ...innings.map((i) => i.inning));
        const lastInning = innings[innings.length - 1];
        const isWalkOff =
          !!lastInning &&
          lastInning.inning >= 9 &&
          !!lastInning.bottom &&
          finalScore.home > finalScore.away;

        // MVP 이름 lookup
        const allBatters = [...home.batters, ...away.batters];
        const allPitchers = [
          home.starter, ...home.bullpen,
          away.starter, ...away.bullpen
        ];
        const mvpEntity =
          allBatters.find((b) => b.playerId === mvp.playerId) ??
          allPitchers.find((p) => p.playerId === mvp.playerId) ??
          null;

        const result = await createRecord(client, {
          ownerUserId: user.id,
          source: session.source as BpRecordSource,
          bpMatchId: session.liveMatchId ?? null,
          userSide: session.userSide ?? "home",
          engineVersion: SIM_ENGINE_VERSION,
          seed: session.seed,
          input: session.input!,
          result: session.result!,
          homeTeamId: home.teamId,
          awayTeamId: away.teamId,
          homeLabel: home.displayName?.trim() || null,
          awayLabel: away.displayName?.trim() || null,
          finalScore,
          mvpPlayerId: mvp.playerId,
          mvpName: mvpEntity?.name ?? null,
          isWalkoff: isWalkOff,
          totalInnings,
          // 라인업 전적 집계용 — source 무관, 양쪽 lineup_id 둘 다 NOT NULL 이면 정식 매치로 view 집계.
          // 친구 대전이라도 양쪽 공개 라인업이면 정식 매치. 한쪽이라도 비등록이면 연습 매치.
          homeLineupId: session.userSide === "home"
            ? (session.myLineupId ?? null)
            : (session.opponentLineupId ?? null),
          awayLineupId: session.userSide === "home"
            ? (session.opponentLineupId ?? null)
            : (session.myLineupId ?? null),
          opponentNickname: session.opponentNickname ?? null
        });

        if (!result.ok) {
          if (!cancelled) showToast(`기록 자동 저장 실패: ${result.error}`);
          return;
        }
        // alreadyExists: 친구 대전 race로 상대 trigger가 이미 mirror row 만든 경우 → row.id 없음.
        // "saved" placeholder로 마킹해 ResultScreen 중복 INSERT만 차단.
        const recordId = result.row?.id ?? "mirrored";
        const cur = loadMatchSession();
        if (cur) saveMatchSession({ ...cur, savedRecordId: recordId });
        if (cancelled) return;
        setRecordSavedId(recordId);
      } catch {
        if (!cancelled) showToast("기록 저장 중 오류가 발생했어요.");
      } finally {
        if (!cancelled) setRecordSaving(false);
        // placeholder가 실제 id로 교체 안 됐으면 — 비로그인/실패/예외 — 정리.
        // ResultScreen이 fallback으로 저장을 시도할 수 있게 함.
        const fin = loadMatchSession();
        if (fin?.savedRecordId === "saving") {
          saveMatchSession({ ...fin, savedRecordId: undefined });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, session, recordSavedId, recordSaving, showToast]);

  if (!hydrated || !session?.result) {
    return (
      <AppShell activeTab="stadium" title="시뮬레이션" backHref="/stadium/lobby" theme="light" wide hideBottomTabs>
        <p className="stadium-loading">경기 준비 중...</p>
      </AppShell>
    );
  }

  const input = session.input!;
  const homeTeam = getTeam(input.home.teamId);
  const awayTeam = getTeam(input.away.teamId);
  // 사용자 지정 팀명(라인업 이름) 우선, 없으면 KBO 정식 팀명 폴백
  const homeLabel = input.home.displayName?.trim() || homeTeam.shortName;
  const awayLabel = input.away.displayName?.trim() || awayTeam.shortName;
  // 닉네임 표시 — 친구/공개 매치에서 양쪽 사람 닉네임을 팀뱃지 위에 노출.
  // AI/self 매치는 닉네임 자체가 의미 없어 표시 안 함.
  const showNicknames = session.source === "friend" || session.source === "public";
  const myNickname = profile?.nickname?.trim() || "나";
  const oppNickname = session.opponentNickname?.trim() || "상대";
  const homeNickname = showNicknames
    ? (session.userSide === "home" ? myNickname : oppNickname)
    : null;
  const awayNickname = showNicknames
    ? (session.userSide === "away" ? myNickname : oppNickname)
    : null;
  const linescore = buildLinescore(session.result.innings, cursor, events);
  const latest = events[Math.max(0, cursor - 1)];
  const isDone = phase === "GAME_END";

  const totalAway = linescore.away.reduce((s, c) => s + (c.runs ?? 0), 0);
  const totalHome = linescore.home.reduce((s, c) => s + (c.runs ?? 0), 0);

  const battingSide: "home" | "away" = latest?.half === "bottom" ? "home" : "away";

  const visible = events.slice(0, cursor);
  const lastAwayBatterId = [...visible].reverse().find((ev) => ev.half === "top")?.ab.batterId ?? null;
  const lastHomeBatterId = [...visible].reverse().find((ev) => ev.half === "bottom")?.ab.batterId ?? null;
  const awayCurrentIdx = lastAwayBatterId ? input.away.batters.findIndex((b) => b.playerId === lastAwayBatterId) : -1;
  const homeCurrentIdx = lastHomeBatterId ? input.home.batters.findIndex((b) => b.playerId === lastHomeBatterId) : -1;

  // 현재 등판 투수 — 그 팀이 수비할 때(상대 공격) 가장 최근 던진 투수.
  // away팀 수비 = home 공격 = bottom half / home팀 수비 = away 공격 = top half
  const lastAwayPitcherId =
    [...visible].reverse().find((ev) => ev.half === "bottom")?.ab.pitcherId ?? null;
  const lastHomePitcherId =
    [...visible].reverse().find((ev) => ev.half === "top")?.ab.pitcherId ?? null;
  const awayCurrentPitcher = lastAwayPitcherId
    ? pitcherById.get(lastAwayPitcherId) ?? input.away.starter
    : input.away.starter;
  const homeCurrentPitcher = lastHomePitcherId
    ? pitcherById.get(lastHomePitcherId) ?? input.home.starter
    : input.home.starter;

  // 다이아몬드/아웃카운트 — 현재 이닝의 visible 마지막 타석에서 가져옴. 비었으면 0 outs/empty.
  const lastInInning = currentInningEvents[currentInningEvents.length - 1];
  // showOutcome이 false면 "타석 진행 중" 상태 — 이전 타석의 baseStateAfter 사용 (이 타석 결과는 아직 미반영)
  const stateRefAb =
    !showOutcome && currentInningEvents.length >= 2
      ? currentInningEvents[currentInningEvents.length - 2].ab
      : lastInInning?.ab;
  const baseState: BaseState =
    !showOutcome && currentInningEvents.length === 1
      ? EMPTY_BASE
      : stateRefAb?.baseStateAfter ?? EMPTY_BASE;
  const outsValue =
    !showOutcome && currentInningEvents.length === 1
      ? 0
      : stateRefAb?.outsAfter ?? 0;
  const outs = Math.min(3, outsValue) as 0 | 1 | 2 | 3;

  // 1줄 상황판 텍스트 + variant 결정
  const narration: { text: string; variant: "default" | "inning" | "pitcher" | "walkoff" } = (() => {
    if (cursor === 0) return { text: "플레이볼!", variant: "default" };
    const current = events[cursor - 1];
    const battingTeamBatters = current.half === "top" ? input.away.batters : input.home.batters;
    const orderIdx = battingTeamBatters.findIndex((b) => b.playerId === current.ab.batterId);
    const orderPrefix = orderIdx >= 0 ? `${orderIdx + 1}번 타자 ` : "";
    const batter = battingTeamBatters.find((b) => b.playerId === current.ab.batterId);
    const batterName = batter?.name ?? "타자";
    const outcomeLabel =
      OUTCOME_LABEL[current.ab.outcome] +
      (current.ab.runsScored > 0 ? ` (+${current.ab.runsScored})` : "");

    // ───────── SITUATION: 풍부한 멘트 풀 (live 모드만) ─────────
    if (phase === "SITUATION") {
      return {
        text: getSituationText({
          cursor,
          inning: current.inning,
          half: current.half,
          outsBefore: current.ab.outsBefore,
          baseStateBefore: current.ab.baseStateBefore,
          scoreBefore: current.scoreSnapshot,
          totalInnings: linescore.totalInnings
        }),
        variant: "default"
      };
    }

    // ───────── BATTER: 타순·이름 (+ live면 스탯) ─────────
    if (phase === "BATTER") {
      return {
        text: getBatterText({
          cursor,
          orderIdx,
          batter: batter ?? null,
          withStats: mode === "live"
        }),
        variant: "default"
      };
    }

    // ───────── OUTCOME: 결과 / live 단계 narration ─────────
    if (phase === "OUTCOME") {
      // live 모드 + 점수 들어옴 → outcomeStep에 따라 단계 narration
      if (mode === "live" && current.ab.runsScored > 0) {
        if (outcomeStep === 0) {
          return {
            text: `${orderPrefix}${batterName} — ${getOutcomeText(current.ab.outcome, cursor)}`,
            variant: "default"
          };
        }
        if (outcomeStep === 1) {
          // 홈인 주자 식별
          const homedRunners: string[] = [];
          const before = current.ab.baseStateBefore;
          const after = current.ab.baseStateAfter;
          const isHR = current.ab.outcome === "HR";
          if (isHR) {
            if (before.third) homedRunners.push(playerNameById(before.third) ?? "3루주자");
            if (before.second) homedRunners.push(playerNameById(before.second) ?? "2루주자");
            if (before.first) homedRunners.push(playerNameById(before.first) ?? "1루주자");
            homedRunners.push(batterName);
          } else {
            if (before.third && before.third !== after.first && before.third !== after.second && before.third !== after.third) {
              homedRunners.push(playerNameById(before.third) ?? "3루주자");
            }
            if (before.second && before.second !== after.first && before.second !== after.second && before.second !== after.third) {
              homedRunners.push(playerNameById(before.second) ?? "2루주자");
            }
            if (before.first && before.first !== after.first && before.first !== after.second && before.first !== after.third) {
              homedRunners.push(playerNameById(before.first) ?? "1루주자");
            }
          }
          const isBasesLoadedHR =
            isHR && !!before.first && !!before.second && !!before.third;
          return {
            text: getHomerunText({
              cursor,
              outcome: current.ab.outcome,
              runners: homedRunners,
              runsScored: current.ab.runsScored,
              isBasesLoadedHR
            }),
            variant: "default"
          };
        }
        if (outcomeStep === 2) {
          const after = {
            home: current.scoreSnapshot.home + (current.half === "bottom" ? current.ab.runsScored : 0),
            away: current.scoreSnapshot.away + (current.half === "top" ? current.ab.runsScored : 0)
          };
          return {
            text: getScoreText({ cursor, scoreBefore: current.scoreSnapshot, scoreAfter: after }),
            variant: "default"
          };
        }
      }
      // 일반/빠른 모드 또는 점수 없는 결과 — 풍부한 결과 멘트 + 점수 정보 + 주자 진루
      const outcomeNarr = getOutcomeText(current.ab.outcome, cursor);
      // 주자 진루 — before/after 비교로 같은 playerId가 어느 베이스로 이동했는지 추적.
      // 홈인은 +N으로 이미 표시되므로 진루(2루/3루)만 모음.
      const before = current.ab.baseStateBefore;
      const after = current.ab.baseStateAfter;
      const movements: string[] = [];
      if (before.first) {
        if (after.second === before.first) movements.push("1루주자 2루로");
        else if (after.third === before.first) movements.push("1루주자 3루까지");
      }
      if (before.second) {
        if (after.third === before.second) movements.push("2루주자 3루로");
      }
      const movementText = movements.length > 0 ? ` · ${movements.join(", ")}` : "";
      const runsText = current.ab.runsScored > 0 ? ` (+${current.ab.runsScored})` : "";
      return {
        text: `${orderPrefix}${batterName} — ${outcomeNarr}${runsText}${movementText}`,
        variant: "default"
      };
    }

    if (phase === "INNING_END") {
      return { text: "쓰리아웃 · 공수교대", variant: "inning" };
    }
    if (phase === "GAME_END") {
      const isWalkOff =
        current.inning >= 9 &&
        current.half === "bottom" &&
        current.ab.outsAfter < 3;
      if (isWalkOff) return { text: "🏆 끝내기!", variant: "walkoff" };
      return { text: "경기 종료", variant: "walkoff" };
    }
    if (phase === "PITCHER_CHANGE") {
      const next = events[cursor];
      const prevName =
        pitcherById.get(current.ab.pitcherId)?.name ?? "투수";
      const nextName = next ? pitcherById.get(next.ab.pitcherId)?.name ?? "투수" : "투수";
      return { text: `투수 교체: ${prevName} → ${nextName}`, variant: "pitcher" };
    }
    return { text: "", variant: "default" };
  })();

  // playerId → 이름 lookup (홈인 주자 텍스트용)
  function playerNameById(playerId: string): string | null {
    const allBatters = [...input.home.batters, ...input.away.batters];
    return allBatters.find((b) => b.playerId === playerId)?.name ?? null;
  }

  const renderLineupRow = (
    side: "home" | "away",
    batter: { playerId: string; name: string },
    idx: number,
    currentIdx: number
  ) => {
    const isCurrent = battingSide === side && idx === currentIdx;
    const stored = inningOutcomes.get(batter.playerId);

    let outcomeNode: ReactNode = null;
    if (isCurrent && !showOutcome) {
      // 진행 중인 현재 타석 — 이전 결과가 있어도 새 타석이므로 ··· 표시
      outcomeNode = <span className="stadium-play-lineup-outcome is-pending">···</span>;
    } else if (stored) {
      outcomeNode = (
        <span
          className={`stadium-play-lineup-outcome ${stored.isHr ? "is-hr" : ""} ${stored.isHit ? "is-hit" : ""}`}
        >
          {stored.label}
        </span>
      );
    }

    // 이번 경기 누적 — "(안타수/타수)" 형식. AB 0이면 표시 안 함.
    const today = todayStats.get(batter.playerId);

    return (
      <li
        key={batter.playerId}
        className={`stadium-play-lineup-row ${isCurrent ? "is-current" : ""}`}
        data-batter-id={batter.playerId}
      >
        <span className="stadium-play-lineup-order">{idx + 1}</span>
        <span className="stadium-play-lineup-name">
          {batter.name}
          {today && today.ab > 0 ? (
            <em className="stadium-play-lineup-today">
              ({today.hits}/{today.ab})
            </em>
          ) : null}
        </span>
        {outcomeNode}
      </li>
    );
  };

  // 상단 헤더 타이틀 — 진행 중엔 이닝 정보, 종료 시엔 "경기 종료"
  const headerTitle = isDone
    ? "경기 종료"
    : latest
    ? `${latest.inning}회 ${latest.half === "top" ? "초" : "말"}`
    : "경기 시작";

  // 매치 종류 뱃지 — 모든 경기에서 표시. 양쪽 lineup_id 있으면 정식(전적 집계), 아니면 연습.
  // public: 항상 양쪽 lineup_id 있음 → 정식
  // friend: 양쪽 공개 라인업이면 정식, 아니면 연습
  // ai/self: lineup_id 없음 → 연습
  const isOfficial = !!session?.myLineupId && !!session?.opponentLineupId;
  const matchTierBadge = session ? (
    <span className={`stadium-play-tier-badge ${isOfficial ? "is-official" : "is-practice"}`}>
      {isOfficial ? "정식 매치" : "연습 매치"}
    </span>
  ) : null;

  return (
    <AppShell activeTab="stadium" title={headerTitle} titleDecoration={isDone ? undefined : "slashes"} backHref="/stadium/lobby" theme="light" wide hideBottomTabs headerAction={matchTierBadge}>
      {isLive && liveCountdown !== null && liveCountdown > 0 ? (
        <div className="stadium-live-countdown">
          <span>곧 시작합니다</span>
          <strong>{liveCountdown}</strong>
        </div>
      ) : null}
      <section className="stadium-play-v2">
        {/* 1. 라인스코어 */}
        <div className="stadium-linescore">
          <table>
            <thead>
              <tr>
                <th className="team-head">TEAM</th>
                {Array.from({ length: linescore.totalInnings }, (_, i) => (
                  <th key={i + 1} className={i + 1 === linescore.currentInning ? "is-current" : ""}>{i + 1}</th>
                ))}
                <th className="rh">R</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="team-cell"><span>{awayLabel}</span></td>
                {linescore.away.map((cell, i) => (
                  <td key={`a${i}`} className={i + 1 === linescore.currentInning && linescore.currentHalf === "top" ? "is-current" : ""}>
                    {cell.runs === null ? "-" : cell.runs}
                  </td>
                ))}
                <td className="rh"><strong>{totalAway}</strong></td>
              </tr>
              <tr>
                <td className="team-cell"><span>{homeLabel}</span></td>
                {linescore.home.map((cell, i) => (
                  <td key={`h${i}`} className={i + 1 === linescore.currentInning && linescore.currentHalf === "bottom" ? "is-current" : ""}>
                    {cell.runs === null ? "-" : cell.runs}
                  </td>
                ))}
                <td className="rh"><strong>{totalHome}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 2. 스코어보드 + 다이아몬드 + 아웃카운트
            팀별 레이아웃: [큰 팀 배지] [팀명 + 큰 점수] (반대편은 거울) */}
        <header className="stadium-play-scoreboard">
          <div className="stadium-play-team">
            <div className="stadium-play-team-badge-col">
              {awayNickname ? (
                <span className="stadium-play-team-nickname" title={awayNickname}>{awayNickname}</span>
              ) : null}
              <TeamBadge teamId={awayTeam.id} size="lg" />
            </div>
            <div className="stadium-play-team-info">
              <span className="stadium-play-team-name">{awayLabel}</span>
              <strong className="stadium-play-team-score">{totalAway}</strong>
            </div>
          </div>
          <div className="stadium-play-state">
            <Diamond base={baseState} />
            <OutDots outs={outs} />
          </div>
          <div className="stadium-play-team stadium-play-team-right">
            <div className="stadium-play-team-info">
              <span className="stadium-play-team-name">{homeLabel}</span>
              <strong className="stadium-play-team-score">{totalHome}</strong>
            </div>
            <div className="stadium-play-team-badge-col">
              {homeNickname ? (
                <span className="stadium-play-team-nickname" title={homeNickname}>{homeNickname}</span>
              ) : null}
              <TeamBadge teamId={homeTeam.id} size="lg" />
            </div>
          </div>
        </header>

        {/* 3. 1줄 상황판 — 타석 진행/공수교대/투수교체/타석 결과 등 모든 진행 알림.
            타격 이펙트(폭죽)는 공 출발 위치(타자 row) 에 portal 로 표시 — 별도 위치. */}
        <div className={`stadium-play-narration is-${narration.variant}`}>
          <span>{narration.text}</span>
        </div>

        {/* 4. 양 팀 라인업 — 진행 중엔 공격팀이 크게, 종료 시엔 1:1 박스스코어 모드 */}
        <div
          className={`stadium-play-lineups ${
            isDone ? "is-final" : `is-offense-${battingSide}`
          }`}
        >
          <div
            className={`stadium-play-batting-card ${
              !isDone && battingSide === "away" ? "is-offense" : ""
            } ${isDone ? "is-final" : ""}`}
          >
            <div className="stadium-play-batting-head">
              <span className="stadium-play-batting-pitcher">투수 {awayCurrentPitcher.name}</span>
            </div>
            <ol className="stadium-play-lineup">
              {input.away.batters.map((b, idx) => renderLineupRow("away", b, idx, awayCurrentIdx))}
            </ol>
          </div>

          <div
            className={`stadium-play-batting-card ${
              !isDone && battingSide === "home" ? "is-offense" : ""
            } ${isDone ? "is-final" : ""}`}
          >
            <div className="stadium-play-batting-head">
              <span className="stadium-play-batting-pitcher">투수 {homeCurrentPitcher.name}</span>
            </div>
            <ol className="stadium-play-lineup">
              {input.home.batters.map((b, idx) => renderLineupRow("home", b, idx, homeCurrentIdx))}
            </ol>
          </div>
        </div>

        {/* 4. 컨트롤 */}
        <footer className="stadium-play-controls">
          {!isDone ? (
            isLive ? (
              <>
                <div className="stadium-play-live-badge">
                  <span className="stadium-live-dot" /> 실시간 매치 진행 중 — 컨트롤 잠금
                </div>
                <button
                  type="button"
                  className="stadium-play-btn stadium-play-btn-mute"
                  onClick={toggleMuted}
                  aria-label={muted ? "효과음 켜기" : "효과음 끄기"}
                  aria-pressed={muted}
                  title={muted ? "효과음 켜기" : "효과음 끄기"}
                >
                  {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="stadium-play-btn stadium-play-btn-icon"
                  onClick={() => setPlaying((p) => !p)}
                  aria-label={playing ? "일시정지" : "재생"}
                  title={playing ? "일시정지" : "재생"}
                >
                  {playing ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <div className="stadium-play-mode" role="radiogroup" aria-label="진행 모드">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === "normal"}
                    className={`stadium-play-mode-btn ${mode === "normal" ? "is-active" : ""}`}
                    onClick={() => setMode("normal")}
                  >
                    일반
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === "fast"}
                    className={`stadium-play-mode-btn ${mode === "fast" ? "is-active" : ""}`}
                    onClick={() => setMode("fast")}
                  >
                    빠른
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === "superfast"}
                    className={`stadium-play-mode-btn ${mode === "superfast" ? "is-active" : ""}`}
                    onClick={() => setMode("superfast")}
                  >
                    빠른×2
                  </button>
                </div>
                {/* 건너뛰기 — 6회 진입 이후만 동작 (5회 = KBO 정식경기 성립 기준).
                    매치 시작 직후 무한 스킵으로 전적 어뷰징하는 것 방지.
                    6회 전엔 disabled 대신 클릭 받아 안내 모달 노출 (사유 설명). */}
                <button
                  type="button"
                  className="stadium-play-btn stadium-play-btn-skip"
                  onClick={() => {
                    if (linescore.currentInning < 6) {
                      setSkipBlockedOpen(true);
                      return;
                    }
                    setCursor(events.length);
                  }}
                  title="끝까지 건너뛰기"
                >
                  건너뛰기
                </button>
                <button
                  type="button"
                  className="stadium-play-btn stadium-play-btn-mute"
                  onClick={toggleMuted}
                  aria-label={muted ? "효과음 켜기" : "효과음 끄기"}
                  aria-pressed={muted}
                  title={muted ? "효과음 켜기" : "효과음 끄기"}
                >
                  {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              </>
            )
          ) : (
            <button
              type="button"
              className="stadium-cta-primary"
              onClick={() => router.push("/stadium/result")}
            >
              <Trophy size={16} />
              <span>결과 보기</span>
            </button>
          )}
        </footer>
      </section>

      {flyingBall && typeof document !== "undefined"
        ? createPortal(
            <FlyingBall
              key={flyingBall.key}
              fromX={flyingBall.fromX}
              fromY={flyingBall.fromY}
              dx={flyingBall.dx}
              dy={flyingBall.dy}
              durationMs={flyingBall.durationMs}
              maxScale={flyingBall.maxScale}
              onEnd={() => setFlyingBall(null)}
            />,
            document.body
          )
        : null}
      {strikeoutEffect && typeof document !== "undefined"
        ? createPortal(
            <StrikeoutEffect
              key={strikeoutEffect.key}
              centerX={strikeoutEffect.centerX}
              centerY={strikeoutEffect.centerY}
              durationMs={strikeoutEffect.durationMs}
              onEnd={() => setStrikeoutEffect(null)}
            />,
            document.body
          )
        : null}
      {hitFx && typeof document !== "undefined"
        ? createPortal(
            <HitEffectAtPosition
              key={hitFx.key}
              centerX={hitFx.centerX}
              centerY={hitFx.centerY}
              kind={hitFx.kind}
              onEnd={() => setHitFx(null)}
            />,
            document.body
          )
        : null}

      {/* 6회 전 건너뛰기 시도 시 안내 모달. 5회까지 = KBO 정식경기 성립 기준. */}
      <ModalShell
        open={skipBlockedOpen}
        title="건너뛰기 안내"
        onClose={() => setSkipBlockedOpen(false)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">
            전적이 누적되는 경기라 <strong>5회까지 진행한 뒤</strong> 건너뛰기가 가능해요.<br />
            (KBO 정식경기 성립 기준)
          </p>
          <div className="lineup-confirm-actions">
            <button
              type="button"
              className="lineup-confirm-primary"
              onClick={() => setSkipBlockedOpen(false)}
            >
              확인
            </button>
          </div>
        </div>
      </ModalShell>
    </AppShell>
  );
}
