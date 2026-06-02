"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getTeam } from "@/lib/constants/teams";
import { loadMatchSession, saveMatchSession } from "@/lib/sim/matchSession";
import { SIM_ENGINE_VERSION } from "@/lib/sim/version";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createRecord, type BpRecordSource } from "@/lib/supabase/query-parts/bpRecords";
import { useAppState } from "@/lib/state/AppState";
import { playMatchSound } from "@/lib/sound/matchSounds";
import { OUTCOME_LABEL } from "./play/types";
import { buildLinescore } from "./play/eventHelpers";
import { FlyingBall } from "./play/effects/FlyingBall";
import { BatSwing } from "./play/effects/BatSwing";
import { HitEffectAtPosition } from "./play/effects/HitEffect";
import { StrikeoutEffect } from "./play/effects/StrikeoutEffect";
import { Linescore } from "./play/Linescore";
import { Scoreboard } from "./play/Scoreboard";
import { LineupCard } from "./play/LineupCard";
import { PlayControls } from "./play/PlayControls";
import { SkipBlockedModal } from "./play/SkipBlockedModal";
import { MatchOpeningSequence } from "./play/MatchOpeningSequence";
import { PitcherChangeBanner } from "./play/PitcherChangeBanner";
import { buildNarration } from "./play/narration";
import {
  deriveBaseState,
  deriveCurrentBatterIdx,
  deriveCurrentPitcher,
  deriveHeaderTitle,
  deriveIsOfficial,
  deriveTeamLabel,
  formatNickname
} from "./play/derived";
import { useMatchSounds } from "./play/hooks/useMatchSounds";
import { useLiveCountdown } from "./play/hooks/useLiveCountdown";
import { useMatchSession } from "./play/hooks/useMatchSession";
import type { SimPitcher } from "@/lib/sim/types";

export function PlayScreen() {
  const router = useRouter();
  const { showToast, profile } = useAppState();
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(true);
  // 경기 시작 전 오프닝 시퀀스(타이틀/라인업/카운트다운/PLAY BALL).
  // 완료 또는 스킵 전엔 시뮬레이션 tick 중단(playing과 별개로 게이트).
  // 라이브(친구) 매치는 자체 카운트다운/start 동기화가 있어 오프닝 스킵.
  // 리플레이는 우선 기본 노출 — 후속에서 분리 가능.
  const [openingDone, setOpeningDone] = useState(false);
  const { muted, bgmMuted, toggleMuted, toggleBgmMuted } = useMatchSounds();
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
  // 배트 스윙 이펙트 — 안타 발사 시 타자 row 위치에 0.5초 회전 SVG 배트.
  // FlyingBall 과 같은 cursor 에서 sibling 으로 동시 발사.
  const [batSwing, setBatSwing] = useState<{
    centerX: number;
    centerY: number;
    battingHand: "L" | "R";
    key: number;
  } | null>(null);

  // 세션 hydrate + events 도출 (라이브 매치면 mode/playing도 세팅)
  const { session, events, hydrated, isLive, liveStartAt } = useMatchSession({
    router,
    setMode,
    setPlaying
  });

  // 라이브 카운트다운 — startAt 도달 시 자동 play.
  const { countdownMs: liveCountdown } = useLiveCountdown({
    isLive,
    liveStartAt,
    setPlaying
  });

  // 라이브(친구) 매치는 양 클라이언트 동기 카운트다운이 있어 오프닝 시퀀스 스킵.
  // hydrate 직후 1회 openingDone=true 처리. 일반 매치는 오프닝이 onComplete 시 true.
  useEffect(() => {
    if (!hydrated) return;
    if (isLive) setOpeningDone(true);
  }, [hydrated, isLive]);

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
    if (!openingDone) return; // 오프닝 시퀀스 진행 중이면 시뮬 tick 멈춤
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
      // 투수 교체는 중요 정보라 mode별 명시 (modeMul 미적용).
      PITCHER_CHANGE:
        mode === "live" ? 1800 : mode === "fast" ? 1200 : mode === "superfast" ? 700 : 1500
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
  }, [playing, cursor, events, events.length, mode, hydrated, phase, outcomeStep, openingDone]);

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
    // 배트 스윙도 같이 발사 — battingHand 결정:
    // 1) input.batters 에서 batterId 매칭으로 SimBatter 의 battingHand 사용 (정식 소스).
    // 2) 실패 시 lineup row DOM 의 data-batting-hand attribute fallback.
    // 3) 그래도 없으면 우타("R") 가정. 스위치("S")는 단순화로 우타 취급.
    const allBatters = session?.input
      ? [...session.input.home.batters, ...session.input.away.batters]
      : [];
    const batterEntity = allBatters.find((b) => b.playerId === evt.ab.batterId);
    let rawHand: string | null = batterEntity?.battingHand ?? null;
    if (!rawHand) {
      const attr = row.getAttribute("data-batting-hand");
      if (attr) rawHand = attr;
    }
    const battingHand: "L" | "R" = rawHand === "L" ? "L" : "R";
    setBatSwing({ centerX: fromX, centerY: fromY, battingHand, key: cursor });
    setFlyingBall({ fromX, fromY, dx, dy, durationMs, maxScale, key: cursor });
    playMatchSound(o === "HR" ? "homerun" : "hit");

    // 폭죽 이펙트도 같은 위치에 — HR/타점이면 hr 변형, 일반 안타면 hit.
    if (hitFxFiredForCursorRef.current !== cursor) {
      hitFxFiredForCursorRef.current = cursor;
      const fxKind: "hit" | "hr" = o === "HR" || evt.ab.runsScored > 0 ? "hr" : "hit";
      setHitFx({ centerX: fromX, centerY: fromY, kind: fxKind, key: cursor });
    }
  }, [phase, cursor, events, hydrated, mode, session]);

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

  // 투수 교체 효과음 trigger — PITCHER_CHANGE phase 진입 시 1회.
  const pitcherChangeFiredForCursorRef = useRef<number>(-1);
  useEffect(() => {
    if (!hydrated) return;
    if (phase !== "PITCHER_CHANGE") return;
    if (pitcherChangeFiredForCursorRef.current === cursor) return;
    pitcherChangeFiredForCursorRef.current = cursor;
    playMatchSound("pitcher_change");
  }, [phase, cursor, hydrated]);

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

  // 볼넷/사구 → walk, 병살 → double_play, 나머지 아웃류(GO/FO/PO/LO/SF) → out.
  // 안타/홈런/삼진은 위 useEffect들에서 별도 처리. 실책(E)은 사운드 X.
  const auxSoundFiredForCursorRef = useRef<number>(-1);
  useEffect(() => {
    if (!hydrated) return;
    if (phase !== "OUTCOME") return;
    if (auxSoundFiredForCursorRef.current === cursor) return;
    const evt = cursor > 0 ? events[cursor - 1] : null;
    if (!evt) return;
    const o = evt.ab.outcome;
    let key: "walk" | "out" | "double_play" | null = null;
    if (o === "BB" || o === "HBP") key = "walk";
    else if (o === "DP") key = "double_play";
    else if (o === "GO" || o === "FO" || o === "PO" || o === "LO" || o === "SF") key = "out";
    if (!key) return;
    auxSoundFiredForCursorRef.current = cursor;
    playMatchSound(key);
  }, [phase, cursor, events, hydrated]);

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
  const homeLabel = deriveTeamLabel(input.home.displayName, homeTeam.shortName);
  const awayLabel = deriveTeamLabel(input.away.displayName, awayTeam.shortName);
  const myNickname = profile?.nickname?.trim() || "나";
  const oppNickname = session.opponentNickname?.trim() || "상대";
  const homeNickname = formatNickname("home", session, myNickname, oppNickname);
  const awayNickname = formatNickname("away", session, myNickname, oppNickname);
  const linescore = buildLinescore(session.result.innings, cursor, events);
  const latest = events[Math.max(0, cursor - 1)];
  const isDone = phase === "GAME_END";

  const totalAway = linescore.away.reduce((s, c) => s + (c.runs ?? 0), 0);
  const totalHome = linescore.home.reduce((s, c) => s + (c.runs ?? 0), 0);

  const battingSide: "home" | "away" = latest?.half === "bottom" ? "home" : "away";

  const awayCurrentIdx = deriveCurrentBatterIdx(events, cursor, "top", input.away.batters);
  const homeCurrentIdx = deriveCurrentBatterIdx(events, cursor, "bottom", input.home.batters);

  const awayCurrentPitcher = deriveCurrentPitcher(events, cursor, "bottom", pitcherById, input.away.starter);
  const homeCurrentPitcher = deriveCurrentPitcher(events, cursor, "top", pitcherById, input.home.starter);

  const { baseState, outs } = deriveBaseState(currentInningEvents, showOutcome);

  // 1줄 상황판 텍스트 + variant 결정
  const narration = buildNarration({
    phase,
    cursor,
    events,
    mode,
    outcomeStep,
    input,
    pitcherById,
    linescore
  });

  // 상단 헤더 타이틀 — 진행 중엔 이닝 정보, 종료 시엔 "경기 종료"
  const headerTitle = deriveHeaderTitle(isDone, latest);

  // 매치 종류 뱃지
  const isOfficial = deriveIsOfficial(session);
  const matchTierBadge = session ? (
    <span className={`stadium-play-tier-badge ${isOfficial ? "is-official" : "is-practice"}`}>
      {isOfficial ? "정식 매치" : "연습 매치"}
    </span>
  ) : null;

  // 오프닝 시퀀스용 — 라인업명 폴백: displayName > 팀 shortName.
  // SimBatter 엔 orderIdx 필드가 없고 batters 배열 자체가 1~9 타순. 인덱스+1을 orderIdx로 매핑.
  const openingHome = {
    teamId: input.home.teamId,
    lineupName: (input.home.displayName?.trim() || homeTeam.shortName) ?? "",
    starterName: input.home.starter.name,
    starterHand: input.home.starter.throwingHand,
    batters: input.home.batters.map((b, i) => ({
      name: b.name,
      orderIdx: i + 1,
      position: b.position,
      battingHand: b.battingHand
    }))
  };
  const openingAway = {
    teamId: input.away.teamId,
    lineupName: (input.away.displayName?.trim() || awayTeam.shortName) ?? "",
    starterName: input.away.starter.name,
    starterHand: input.away.starter.throwingHand,
    batters: input.away.batters.map((b, i) => ({
      name: b.name,
      orderIdx: i + 1,
      position: b.position,
      battingHand: b.battingHand
    }))
  };
  const showOpening = !openingDone && !isLive;

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
        <Linescore
          linescore={linescore}
          awayLabel={awayLabel}
          homeLabel={homeLabel}
          totalAway={totalAway}
          totalHome={totalHome}
        />

        {/* 2. 스코어보드 + 다이아몬드 + 아웃카운트
            팀별 레이아웃: [큰 팀 배지] [팀명 + 큰 점수] (반대편은 거울) */}
        <Scoreboard
          awayTeamId={awayTeam.id}
          homeTeamId={homeTeam.id}
          awayLabel={awayLabel}
          homeLabel={homeLabel}
          totalAway={totalAway}
          totalHome={totalHome}
          awayNickname={awayNickname}
          homeNickname={homeNickname}
          baseState={baseState}
          outs={outs}
        />

        {/* 3. 1줄 상황판 — 타석 진행/공수교대/투수교체/타석 결과 등 모든 진행 알림.
            PITCHER_CHANGE phase 일 땐 narration 대신 카드형 강조 배너로 노출.
            타격 이펙트(폭죽)는 공 출발 위치(타자 row) 에 portal 로 표시 — 별도 위치. */}
        {phase === "PITCHER_CHANGE" ? (
          (() => {
            const prevEvt = cursor > 0 ? events[cursor - 1] : null;
            const nextEvt = events[cursor] ?? null;
            const prevPitcher = prevEvt ? pitcherById.get(prevEvt.ab.pitcherId) : null;
            const nextPitcher = nextEvt ? pitcherById.get(nextEvt.ab.pitcherId) : null;
            return (
              <PitcherChangeBanner
                prev={prevPitcher ? { name: prevPitcher.name, role: prevPitcher.role } : null}
                next={nextPitcher ? { name: nextPitcher.name, role: nextPitcher.role } : null}
              />
            );
          })()
        ) : (
          <div className={`stadium-play-narration is-${narration.variant}`}>
            <span>{narration.text}</span>
          </div>
        )}

        {/* 4. 양 팀 라인업 — 진행 중엔 공격팀이 크게, 종료 시엔 1:1 박스스코어 모드 */}
        <div
          className={`stadium-play-lineups ${
            isDone ? "is-final" : `is-offense-${battingSide}`
          }`}
        >
          <LineupCard
            side="away"
            pitcherName={awayCurrentPitcher.name}
            batters={input.away.batters}
            currentIdx={awayCurrentIdx}
            battingSide={battingSide}
            showOutcome={showOutcome}
            isDone={isDone}
            inningOutcomes={inningOutcomes}
            todayStats={todayStats}
          />
          <LineupCard
            side="home"
            pitcherName={homeCurrentPitcher.name}
            batters={input.home.batters}
            currentIdx={homeCurrentIdx}
            battingSide={battingSide}
            showOutcome={showOutcome}
            isDone={isDone}
            inningOutcomes={inningOutcomes}
            todayStats={todayStats}
          />
        </div>

        {/* 4. 컨트롤 */}
        <PlayControls
          isDone={isDone}
          isLive={isLive}
          playing={playing}
          mode={mode}
          muted={muted}
          bgmMuted={bgmMuted}
          onTogglePlaying={() => setPlaying((p) => !p)}
          onChangeMode={setMode}
          onSkip={() => {
            if (linescore.currentInning < 6) {
              setSkipBlockedOpen(true);
              return;
            }
            setCursor(events.length);
          }}
          onToggleMuted={toggleMuted}
          onToggleBgmMuted={toggleBgmMuted}
          onGoResult={() => router.push("/stadium/result")}
        />
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
      {batSwing && typeof document !== "undefined"
        ? createPortal(
            <BatSwing
              key={batSwing.key}
              centerX={batSwing.centerX}
              centerY={batSwing.centerY}
              battingHand={batSwing.battingHand}
              onEnd={() => setBatSwing(null)}
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

      <SkipBlockedModal open={skipBlockedOpen} onClose={() => setSkipBlockedOpen(false)} />

      {/* 경기 시작 전 오프닝 오버레이 — fixed inset:0 풀스크린.
          라이브(친구) 매치는 위 effect에서 openingDone=true로 즉시 스킵.
          NOTE: portal이 아니라 인라인 렌더 — CSS rule(`.phone-frame-light .match-opening`)
          이 ancestor 매칭을 요구하므로 portal로 body에 띄우면 스타일이 안 먹음. */}
      {showOpening ? (
        <MatchOpeningSequence
          home={openingHome}
          away={openingAway}
          onComplete={() => setOpeningDone(true)}
        />
      ) : null}
    </AppShell>
  );
}
