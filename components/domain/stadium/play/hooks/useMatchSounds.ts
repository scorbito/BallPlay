"use client";

import { useEffect, useState } from "react";
import {
  getBgmMuted,
  getMatchSoundMuted,
  playBgm,
  preloadBgm,
  preloadMatchSounds,
  setBgmMuted,
  setMatchSoundMuted,
  stopBgm
} from "@/lib/sound/matchSounds";

export function useMatchSounds() {
  // 효과음 음소거 — localStorage 동기. 초기엔 false(들림)로 SSR/CSR 안전, mount 시 보정.
  const [muted, setMuted] = useState(false);
  // 배경음악 음소거 — 효과음과 별도 토글.
  const [bgmMuted, setBgmMutedState] = useState(false);

  useEffect(() => {
    setMuted(getMatchSoundMuted());
    setBgmMutedState(getBgmMuted());
    // 4종 사운드 사전 decode → 첫 안타/홈런/삼진/득점부터 지연 없이 즉시 재생.
    // (이전엔 매 호출마다 new Audio() 라 모바일에서 1초가량 늦게 들리는 문제 있었음.)
    void preloadMatchSounds();
    // BGM Audio 인스턴스 + fetch 사전 시작 — 토글 켜는 시점에 이미 준비돼 즉시 재생.
    preloadBgm();
    // BGM 시작 — bgmMuted=false 이면 자동 재생 (자동재생 차단 시 silent fail).
    playBgm();
    // 언마운트 시 정지
    return () => {
      stopBgm();
    };
  }, []);

  const toggleMuted = () => {
    setMuted((m) => {
      const next = !m;
      setMatchSoundMuted(next);
      return next;
    });
  };
  const toggleBgmMuted = () => {
    setBgmMutedState((m) => {
      const next = !m;
      setBgmMuted(next); // 함수 내부에서 즉시 play/stop 처리
      return next;
    });
  };

  return { muted, bgmMuted, toggleMuted, toggleBgmMuted };
}
