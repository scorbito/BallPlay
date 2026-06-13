"use client";

import { useEffect, useRef, useState } from "react";
import { SkipForward } from "lucide-react";
import { TeamLogo } from "@/components/common/TeamLogo";
import { playBgm, playMatchSound, preloadBgm, preloadMatchSounds } from "@/lib/sound/matchSounds";

type Batter = {
  name: string;
  orderIdx: number;
  position?: string;
  battingHand: "L" | "R" | "S";
};

type TeamSide = {
  teamId: string;
  lineupName: string;
  initials?: string;
  color?: string;
  badgeStyle?: "circle" | "shield";
  starterName: string;
  starterHand: "L" | "R";
  batters: Batter[];
};

// 포지션 영문 코드 → 한글 라벨 (표시용)
const POSITION_LABEL: Record<string, string> = {
  C: "포수",
  "1B": "1루",
  "2B": "2루",
  "3B": "3루",
  SS: "유격",
  LF: "좌익",
  CF: "중견",
  RF: "우익",
  DH: "지명",
  P: "투수"
};

function formatPosition(pos?: string): string | null {
  if (!pos) return null;
  return POSITION_LABEL[pos] ?? pos;
}

type Props = {
  home: TeamSide;
  away: TeamSide;
  /** 시퀀스 완료 시 호출 (정상 종료 or 스킵 둘 다) */
  onComplete: () => void;
  /** 스킵 버튼 표시 여부 (기본 true). */
  showSkip?: boolean;
  /** 본인이 스킵 버튼을 눌렀을 때 추가 호출 — 친구 매치에서 상대에게 broadcast. */
  onSkip?: () => void;
};

type Phase = "title" | "lineups" | "countdown" | "playball" | "done";

// 페이즈별 지속 시간 (ms)
const TITLE_MS = 1500;
const LINEUP_ROW_INTERVAL_MS = 200; // 0.2s 간격
// idx 0 = 선발 투수, idx 1..9 = 타순 1~9번. 0ms 부터 9*200=1800ms, fade-in 완료.
// 이후 ~1.2s 동안 전체 라인업을 그대로 hold하고 countdown 으로 전환.
const LINEUP_TOTAL_MS = 3000;
const COUNTDOWN_STEP_MS = 600;
const COUNTDOWN_TOTAL_MS = 1800;
const PLAYBALL_MS = 1000;

export function MatchOpeningSequence({ home, away, onComplete, showSkip = true, onSkip }: Props) {
  const [phase, setPhase] = useState<Phase>("title");
  const [lineupRowIdx, setLineupRowIdx] = useState<number>(-1);
  const [countdownN, setCountdownN] = useState<number>(3);

  // 모든 pending timeout 추적 → 언마운트/스킵 시 일괄 해제
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completedRef = useRef<boolean>(false);

  const schedule = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timeoutsRef.current.push(id);
    return id;
  };

  const clearAllTimeouts = () => {
    for (const id of timeoutsRef.current) clearTimeout(id);
    timeoutsRef.current = [];
  };

  const safeComplete = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    clearAllTimeouts();
    onComplete();
  };

  useEffect(() => {
    // Phase 1 mount: BGM + SFX 사전 로드 + BGM 재생 시작.
    // playBgm/playMatchSound 내부에서 muted 체크하므로 여기서는 그냥 호출만.
    void preloadMatchSounds();
    preloadBgm();
    playBgm();

    // Phase 1: Title (1.5s) → Phase 2: Lineups
    schedule(() => {
      setPhase("lineups");
      // idx 0 = 선발 투수가 먼저 보이고, idx 1..9 = 1~9번 타자 순차 fade-in.
      setLineupRowIdx(0);

      // 선발 + 9 타자, 총 10 row. 0.4s 간격 (총 9 * 0.4 = 3.6s, 패딩 후 4s)
      for (let i = 1; i <= 9; i++) {
        schedule(() => setLineupRowIdx(i), i * LINEUP_ROW_INTERVAL_MS);
      }

      // Phase 2 → Phase 3: Countdown
      schedule(() => {
        setPhase("countdown");
        setCountdownN(3);
        // 카운트다운 — 3, 2 는 out SFX, 마지막 1 은 strikeout SFX(가장 강조).
        playMatchSound("out");
        schedule(() => {
          setCountdownN(2);
          playMatchSound("out");
        }, COUNTDOWN_STEP_MS);
        schedule(() => {
          setCountdownN(1);
          playMatchSound("strikeout");
        }, COUNTDOWN_STEP_MS * 2);

        // Phase 3 → Phase 4: PLAY BALL
        schedule(() => {
          setPhase("playball");
          // PLAY BALL — homerun SFX 재사용 (가장 드라마틱한 기존 사운드)
          playMatchSound("homerun");

          // Phase 4 → done → onComplete
          schedule(() => {
            setPhase("done");
            safeComplete();
          }, PLAYBALL_MS);
        }, COUNTDOWN_TOTAL_MS);
      }, LINEUP_TOTAL_MS);
    }, TITLE_MS);

    return () => {
      clearAllTimeouts();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSkip = () => {
    onSkip?.();
    safeComplete();
  };

  // 배터리오더 정렬 (orderIdx asc)
  const homeBatters = [...home.batters].sort((a, b) => a.orderIdx - b.orderIdx);
  const awayBatters = [...away.batters].sort((a, b) => a.orderIdx - b.orderIdx);

  if (process.env.NODE_ENV !== "production") {
    // 가시성 디버깅용 — 페이즈 전환 추적
    console.log("[MatchOpening] mounted, phase=", phase);
  }

  return (
    <div className="match-opening" data-phase={phase} role="dialog" aria-label="경기 오프닝">
      {showSkip ? (
        <button
          type="button"
          className="match-opening-skip"
          aria-label="오프닝 스킵"
          onClick={handleSkip}
        >
          <SkipForward size={16} aria-hidden />
          <span>스킵</span>
        </button>
      ) : null}

      {phase === "title" && (
        <div className="match-opening-title">
          <p className="match-opening-title-eyebrow">대결 시작</p>
          <div className="match-opening-title-teams">
            <div className="match-opening-title-side match-opening-title-side--away">
              <TeamLogo
                teamId={away.teamId}
                size="lg"
                fallbackName={away.lineupName}
                fallbackInitial={away.initials}
                fallbackColor={away.color}
                fallbackBadgeStyle={away.badgeStyle}
              />
              <strong className="match-opening-title-name">{away.lineupName}</strong>
            </div>
            <span className="match-opening-title-vs" aria-hidden>
              VS
            </span>
            <div className="match-opening-title-side match-opening-title-side--home">
              <TeamLogo
                teamId={home.teamId}
                size="lg"
                fallbackName={home.lineupName}
                fallbackInitial={home.initials}
                fallbackColor={home.color}
                fallbackBadgeStyle={home.badgeStyle}
              />
              <strong className="match-opening-title-name">{home.lineupName}</strong>
            </div>
          </div>
        </div>
      )}

      {phase === "lineups" && (
        <div className="match-opening-lineups">
          <div className="match-opening-lineups-col match-opening-lineups-col--away">
            <header className="match-opening-lineups-head">
              <TeamLogo
                teamId={away.teamId}
                size="md"
                fallbackName={away.lineupName}
                fallbackInitial={away.initials}
                fallbackColor={away.color}
                fallbackBadgeStyle={away.badgeStyle}
              />
              <strong>{away.lineupName}</strong>
            </header>
            <div
              className="match-opening-starter"
              data-visible={0 <= lineupRowIdx ? "true" : "false"}
            >
              <span className="match-opening-starter-label">선발 투수</span>
              <span className="match-opening-starter-name" title={away.starterName}>
                {away.starterName}
              </span>
            </div>
            <ol className="match-opening-lineups-list">
              {awayBatters.map((b, i) => {
                const posLabel = formatPosition(b.position);
                return (
                  <li
                    key={`away-${b.orderIdx}-${i}`}
                    className="match-opening-lineups-row"
                    data-visible={i + 1 <= lineupRowIdx ? "true" : "false"}
                    style={{ transitionDelay: `${i * 20}ms` }}
                  >
                    <span className="match-opening-lineups-order">{b.orderIdx}</span>
                    <span className="match-opening-lineups-name" title={b.name}>
                      {b.name}
                    </span>
                    {posLabel ? (
                      <span className="match-opening-lineups-position">{posLabel}</span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="match-opening-lineups-col match-opening-lineups-col--home">
            <header className="match-opening-lineups-head">
              <TeamLogo
                teamId={home.teamId}
                size="md"
                fallbackName={home.lineupName}
                fallbackInitial={home.initials}
                fallbackColor={home.color}
                fallbackBadgeStyle={home.badgeStyle}
              />
              <strong>{home.lineupName}</strong>
            </header>
            <div
              className="match-opening-starter"
              data-visible={0 <= lineupRowIdx ? "true" : "false"}
            >
              <span className="match-opening-starter-label">선발 투수</span>
              <span className="match-opening-starter-name" title={home.starterName}>
                {home.starterName}
              </span>
            </div>
            <ol className="match-opening-lineups-list">
              {homeBatters.map((b, i) => {
                const posLabel = formatPosition(b.position);
                return (
                  <li
                    key={`home-${b.orderIdx}-${i}`}
                    className="match-opening-lineups-row"
                    data-visible={i + 1 <= lineupRowIdx ? "true" : "false"}
                    style={{ transitionDelay: `${i * 20}ms` }}
                  >
                    <span className="match-opening-lineups-order">{b.orderIdx}</span>
                    <span className="match-opening-lineups-name" title={b.name}>
                      {b.name}
                    </span>
                    {posLabel ? (
                      <span className="match-opening-lineups-position">{posLabel}</span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}

      {phase === "countdown" && (
        <div className="match-opening-countdown" aria-live="polite">
          <span
            key={countdownN}
            className="match-opening-countdown-num"
          >
            {countdownN}
          </span>
        </div>
      )}

      {phase === "playball" && (
        <div className="match-opening-playball" aria-live="assertive">
          <span className="match-opening-playball-text">PLAY BALL!</span>
        </div>
      )}
    </div>
  );
}
