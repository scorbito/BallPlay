"use client";

// 가을야구 승리/우승 축하 연출 — 결과 화면 위 풀스크린 오버레이.
// variant="win": 라운드 승리(컨페티 버스트, 중간 강도).
// variant="champion": 한국시리즈 우승(컨페티 풀 + CSS 폭죽 여러 발).
// pointer-events:none 라 "대진표로" 버튼 클릭을 막지 않음. aria-hidden 장식.

import { useEffect } from "react";
import { playMatchSound } from "@/lib/sound/matchSounds";

// 컨페티 입자 색상 — BallPlay 핑크 + 보조 톤들 (TierUpModal 과 톤 일치).
const CONFETTI_COLORS = [
  "#e84a8a", // BP pink
  "#f4b400", // gold
  "#5b8def", // blue
  "#4ade80", // green
  "#a855f7", // purple
  "#fb923c" // orange
];

// 폭죽 burst 발사 지점 — champion 전용. left/top(%) + delay(ms) + 색상.
const FIREWORKS = [
  { left: 24, top: 30, delay: 0, color: "#f4b400" },
  { left: 72, top: 24, delay: 260, color: "#e84a8a" },
  { left: 48, top: 18, delay: 520, color: "#5b8def" },
  { left: 18, top: 46, delay: 820, color: "#4ade80" },
  { left: 80, top: 44, delay: 1100, color: "#a855f7" }
];

type Props = {
  variant: "win" | "champion";
};

export function PlayoffWinFx({ variant }: Props) {
  const isChampion = variant === "champion";
  const confettiCount = isChampion ? 48 : 24;

  // 마운트 시 1회 — champion 이면 효과음 한 번.
  useEffect(() => {
    if (isChampion) {
      playMatchSound("score");
    }
  }, [isChampion]);

  // 컨페티 입자 — 절대위치 + 의사 random offset/delay/duration. CSS keyframes 로 낙하+회전.
  const confetti = Array.from({ length: confettiCount }, (_, i) => {
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const left = (i * 97) % 100;
    const delay = (i * 53) % (isChampion ? 1400 : 900);
    const duration = (isChampion ? 1900 : 1600) + ((i * 71) % 1300);
    const rotateStart = (i * 113) % 360;
    return (
      <span
        key={i}
        className="playoff-fx-confetti-piece"
        style={{
          left: `${left}%`,
          background: color,
          animationDelay: `${delay}ms`,
          animationDuration: `${duration}ms`,
          ["--playoff-fx-rotate-start" as string]: `${rotateStart}deg`
        }}
      />
    );
  });

  return (
    <div
      className={`playoff-fx${isChampion ? " is-champion" : ""}`}
      aria-hidden="true"
    >
      <div className="playoff-fx-confetti">{confetti}</div>

      {isChampion ? (
        <div className="playoff-fx-fireworks">
          {FIREWORKS.map((f, i) => (
            <span
              key={i}
              className="playoff-fx-firework"
              style={{
                left: `${f.left}%`,
                top: `${f.top}%`,
                color: f.color,
                animationDelay: `${f.delay}ms`
              }}
            >
              <span className="playoff-fx-firework-ring" />
              <span className="playoff-fx-firework-star" />
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
