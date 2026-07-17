"use client";

import { useEffect, useState } from "react";
import { ModalShell } from "@/components/common/ModalShell";
import { POINT_LABEL, SHOW_BP } from "@/lib/points/config";
import { PointBaseballIcon } from "./PointBaseballIcon";
import { emitPointBalanceUpdated } from "./pointEvents";

type PredictionCorrectResponse = {
  ok: boolean;
  awarded?: number;
  awardedCount?: number;
  balance?: number;
};

type BonusState = {
  amount: number;
  count: number;
};

const CHECKED_DATE_KEY = "ballplay:points:prediction-correct:lastCheckedDate";

function kstDateKey(): string {
  return new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function PredictionCorrectBonusModal() {
  const [bonus, setBonus] = useState<BonusState | null>(null);

  useEffect(() => {
    let canceled = false;

    async function settleCorrectPredictions() {
      const today = kstDateKey();
      try {
        if (window.localStorage.getItem(CHECKED_DATE_KEY) === today) return;
        window.localStorage.setItem(CHECKED_DATE_KEY, today);
      } catch {
        // localStorage is an optimization only.
      }

      try {
        const res = await fetch("/api/points/prediction-correct", {
          method: "POST",
          cache: "no-store"
        });
        if (!res.ok) {
          try {
            window.localStorage.removeItem(CHECKED_DATE_KEY);
          } catch {
            // localStorage is an optimization only.
          }
          return;
        }
        const data = (await res.json()) as PredictionCorrectResponse;
        const amount = Number(data.awarded ?? 0);
        const count = Number(data.awardedCount ?? 0);
        if (!data.ok || amount <= 0 || count <= 0 || canceled) return;
        if (typeof data.balance === "number") emitPointBalanceUpdated(data.balance);
        setBonus({ amount, count });
      } catch {
        try {
          window.localStorage.removeItem(CHECKED_DATE_KEY);
        } catch {
          // localStorage is an optimization only.
        }
        // 적중 보너스 확인 실패는 화면 사용을 막지 않는다.
      }
    }

    void settleCorrectPredictions();
    return () => {
      canceled = true;
    };
  }, []);

  if (!SHOW_BP) return null; // BP 숨김

  return (
    <ModalShell
      open={bonus !== null}
      title="승리팀 예측 적중!"
      ariaLabel="승리팀 예측 적중 보너스 안내"
      onClose={() => setBonus(null)}
      panelClassName="prediction-correct-bonus-panel"
    >
      {bonus ? (
        <div className="prediction-correct-bonus-body">
          <div className="prediction-correct-bonus-icon" aria-hidden="true">
            <PointBaseballIcon size={28} />
          </div>
          <p>
            맞춘 경기 <strong>{bonus.count}개</strong>의 적중 보너스로
            <br />
            <strong>{bonus.amount.toLocaleString()}{POINT_LABEL}</strong>가 지급됐어요.
          </p>
          <button type="button" onClick={() => setBonus(null)}>
            확인
          </button>
        </div>
      ) : null}
    </ModalShell>
  );
}
