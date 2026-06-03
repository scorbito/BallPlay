"use client";

// 승급 감지 hook.
// localStorage 에 "마지막으로 본 rank" 저장 → 현재 wins 의 rank 가 더 높으면 모달 노출용
// tier 객체 반환. 처음 접속(키 없음)에는 모달 X — 현재 rank 만 silently 저장.

import { useEffect, useState } from "react";
import { getAccountTierByWins, type AccountTier } from "./accountTier";

const LAST_SEEN_KEY = "ballplay:account-tier:last-seen";

function readLastSeen(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_SEEN_KEY);
    if (raw === null) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeLastSeen(rank: number | null): void {
  if (typeof window === "undefined") return;
  try {
    if (rank === null) {
      window.localStorage.removeItem(LAST_SEEN_KEY);
    } else {
      window.localStorage.setItem(LAST_SEEN_KEY, String(rank));
    }
  } catch {
    // ignore
  }
}

export type TierUpDetectorResult = {
  newlyUnlockedTier: AccountTier | null;
  acknowledge: () => void;
};

export function useTierUpDetector(currentWins: number): TierUpDetectorResult {
  const [newlyUnlocked, setNewlyUnlocked] = useState<AccountTier | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const current = getAccountTierByWins(currentWins);
    const lastSeen = readLastSeen();

    if (current === null) {
      // 등급 없음 — 저장된 게 있어도 굳이 지우지 않음 (히스토리 보존).
      return;
    }
    if (lastSeen === null) {
      // 처음 접속 — silently 저장만, 모달 X.
      writeLastSeen(current.rank);
      return;
    }
    if (current.rank > lastSeen) {
      // 점프해도 최종 등급 하나만 노출.
      setNewlyUnlocked(current);
    }
  }, [currentWins]);

  const acknowledge = () => {
    if (newlyUnlocked) {
      writeLastSeen(newlyUnlocked.rank);
    } else {
      // 안전망 — 현재 wins 기준으로라도 저장.
      const tier = getAccountTierByWins(currentWins);
      if (tier) writeLastSeen(tier.rank);
    }
    setNewlyUnlocked(null);
  };

  return { newlyUnlockedTier: newlyUnlocked, acknowledge };
}
