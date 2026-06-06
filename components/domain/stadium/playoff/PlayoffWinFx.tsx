"use client";

// 가을야구 승리/우승 축하 연출 — 결과 화면 위 풀스크린 오버레이.
// variant="win": 라운드 승리(컨페티만, 가볍게 — 폭죽 없음).
// variant="champion": 한국시리즈 우승(컨페티 진하게 + 방사형 폭죽 반복).
// pointer-events:none 라 "대진표로" 버튼 클릭을 막지 않음. aria-hidden 장식.

import { useEffect, useMemo } from "react";
import { playMatchSound } from "@/lib/sound/matchSounds";

// 컨페티 입자 색상 — BallPlay 핑크 + 보조 톤들 (TierUpModal 과 톤 일치).
const CONFETTI_COLORS = [
  "#e84a8a", // BP pink
  "#f4b400", // gold
  "#5b8def", // blue
  "#4ade80", // green
  "#a855f7", // purple
  "#fb923c", // orange
  "#ffffff" // white sparkle
];

// 폭죽 색상 — 화려하게.
const FIREWORK_COLORS = [
  "#f4b400",
  "#e84a8a",
  "#5b8def",
  "#4ade80",
  "#a855f7",
  "#fb923c",
  "#22d3ee"
];

// 폭죽 burst 발사 지점 — champion 전용. 화면 상단 곳곳에 시간/위치/색을 달리해 staggered.
// (반복은 CSS animation-iteration-count: infinite 가 담당, delay 로 발마다 시점 어긋남.)
const FIREWORKS = [
  { left: 22, top: 26, delay: 0 },
  { left: 70, top: 20, delay: 520 },
  { left: 48, top: 14, delay: 1040 },
  { left: 16, top: 40, delay: 1560 },
  { left: 82, top: 36, delay: 2080 },
  { left: 58, top: 30, delay: 2600 }
];

// 한 발의 폭죽에서 사방으로 퍼지는 불꽃 입자 개수.
const SPARKS_PER_FIREWORK = 16;

type Props = {
  variant: "win" | "champion";
};

export function PlayoffWinFx({ variant }: Props) {
  const isChampion = variant === "champion";
  const confettiCount = isChampion ? 70 : 36;

  // 마운트 시 1회 — champion 이면 효과음 한 번.
  useEffect(() => {
    if (isChampion) {
      playMatchSound("score");
    }
  }, [isChampion]);

  // 컨페티 입자 — 각 입자마다 랜덤 위치/크기/색/회전/좌우 drift/delay/duration.
  // 클라이언트 전용 컴포넌트라 Math.random 사용 OK(hydration 영향 없음).
  // useMemo 로 리렌더 시 입자가 튀지 않게 고정.
  const confetti = useMemo(() => {
    const fallBase = isChampion ? 2600 : 2200; // 낙하 기본 시간(ms)
    const delaySpread = isChampion ? 4200 : 3200; // delay 분산 폭(ms) — 줄지어 안 떨어지게
    return Array.from({ length: confettiCount }, (_, i) => {
      const color =
        CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      const left = Math.random() * 100; // 가로 랜덤 분산
      const size = 6 + Math.random() * 8; // 6~14px
      const ratio = 1.1 + Math.random() * 0.8; // 세로 비율(직사각 조각)
      const delay = Math.random() * delaySpread; // 제각각 시작 → 끊임없는 스트림
      const duration = fallBase + Math.random() * 1800; // 낙하 속도 분산
      const rotateStart = Math.random() * 360;
      const spin = (Math.random() < 0.5 ? -1 : 1) * (540 + Math.random() * 720);
      // 좌우 흔들림(drift) — 낙하 중 흔들리며 내려오게. 양수/음수 둘 다.
      const drift = (Math.random() - 0.5) * 160; // px
      const drift2 = (Math.random() - 0.5) * 120; // px (두 번째 흔들림 지점)
      const round = Math.random() < 0.35; // 일부는 둥근 조각
      return (
        <span
          key={i}
          className="playoff-fx-confetti-piece"
          style={{
            left: `${left}%`,
            width: `${size}px`,
            height: `${size * ratio}px`,
            background: color,
            borderRadius: round ? "50%" : "2px",
            animationDelay: `${delay}ms`,
            animationDuration: `${duration}ms`,
            ["--cf-rot-start" as string]: `${rotateStart}deg`,
            ["--cf-spin" as string]: `${spin}deg`,
            ["--cf-drift1" as string]: `${drift}px`,
            ["--cf-drift2" as string]: `${drift2}px`
          }}
        />
      );
    });
  }, [confettiCount, isChampion]);

  // 폭죽 — 발마다 방사형 spark + 중심 플래시. champion 전용.
  const fireworks = useMemo(() => {
    if (!isChampion) return null;
    return FIREWORKS.map((f, fi) => {
      const color = FIREWORK_COLORS[fi % FIREWORK_COLORS.length];
      const sparks = Array.from({ length: SPARKS_PER_FIREWORK }, (_, si) => {
        // 사방 각도 + 약간의 랜덤 흔들림.
        const angle =
          (360 / SPARKS_PER_FIREWORK) * si + (Math.random() - 0.5) * 14;
        const dist = 70 + Math.random() * 60; // 바깥으로 날아가는 거리(px)
        const sparkColor =
          Math.random() < 0.3
            ? FIREWORK_COLORS[(fi + si) % FIREWORK_COLORS.length]
            : color;
        return (
          <span
            key={si}
            className="playoff-fx-spark"
            style={{
              background: sparkColor,
              ["--fw-angle" as string]: `${angle}deg`,
              ["--fw-dist" as string]: `${dist}px`
            }}
          />
        );
      });
      return (
        <span
          key={fi}
          className="playoff-fx-firework"
          style={{
            left: `${f.left}%`,
            top: `${f.top}%`,
            color,
            animationDelay: `${f.delay}ms`,
            // burst 전체 주기를 발마다 살짝 다르게 → 동기화 깨기.
            ["--fw-cycle" as string]: `${2800 + fi * 180}ms`
          }}
        >
          <span className="playoff-fx-flash" />
          {sparks}
        </span>
      );
    });
  }, [isChampion]);

  return (
    <div
      className={`playoff-fx${isChampion ? " is-champion" : ""}`}
      aria-hidden="true"
    >
      <div className="playoff-fx-confetti">{confetti}</div>

      {isChampion ? (
        <div className="playoff-fx-fireworks">{fireworks}</div>
      ) : null}
    </div>
  );
}
