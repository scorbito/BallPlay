"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/lib/state/AppState";
import { startSpectatorMatch, type SpectatorMatchGame } from "@/lib/sim/spectatorMatch";

type Props = {
  /** 대전 팀 2개(+선택 선발). 어떤 경기 row 든 이 형태로만 맞춰 넘기면 된다. */
  game: SpectatorMatchGame;
  className?: string;
  /** 평상시 라벨. 기본 "가상 경기". */
  idleLabel?: string;
  /** 준비 중 라벨. 기본 "준비". */
  busyLabel?: string;
  title?: string;
  /** 매치 세션 저장 성공 직후, 경기장으로 이동하기 전에 호출(분석 트래킹 등). */
  onStarted?: () => void;
};

/**
 * 팀 2개로 관전형 가상경기를 시작하는 공용 버튼.
 * 로딩 상태·실패 토스트·경기장 이동까지 자체 처리하므로,
 * 경기가 노출되는 어떤 화면에서든 game prop 만 맞춰 꽂으면 된다.
 */
export function VirtualMatchButton({
  game,
  className,
  idleLabel = "가상 경기",
  busyLabel = "준비",
  title = "최신 라인업과 오늘 선발로 가상 경기를 시작",
  onStarted
}: Props) {
  const router = useRouter();
  const { showToast } = useAppState();
  const [starting, setStarting] = useState(false);

  const handleClick = async () => {
    if (starting) return;
    setStarting(true);
    const res = await startSpectatorMatch(game);
    if (!res.ok) {
      showToast(res.reason);
      setStarting(false);
      return;
    }
    onStarted?.();
    router.push("/stadium/play");
  };

  return (
    <button
      type="button"
      className={className}
      onClick={() => void handleClick()}
      disabled={starting}
      title={title}
    >
      {starting ? busyLabel : idleLabel}
    </button>
  );
}
