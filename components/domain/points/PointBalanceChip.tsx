"use client";

import { useCallback, useEffect, useState } from "react";
import { POINT_LABEL } from "@/lib/points/config";
import { POINT_BALANCE_UPDATED_EVENT } from "./pointEvents";
import { PointBaseballIcon } from "./PointBaseballIcon";

type BalanceResponse = {
  balance: number;
  authenticated: boolean;
};

export function PointBalanceChip() {
  const [balance, setBalance] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/points/balance", { cache: "no-store" });
      const data = (await res.json()) as BalanceResponse;
      setBalance(Number(data.balance ?? 0));
    } catch {
      setBalance(0);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ balance?: number }>).detail;
      if (typeof detail?.balance === "number") setBalance(detail.balance);
      else void refresh();
    };
    window.addEventListener(POINT_BALANCE_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(POINT_BALANCE_UPDATED_EVENT, onUpdated);
  }, [refresh]);

  return (
    <div className="point-chip" aria-label={`보유 ${POINT_LABEL}`}>
      <span className="point-chip-balance">
        <PointBaseballIcon size={14} />
        <strong>{balance === null ? "..." : balance.toLocaleString()}</strong>
        <span>{POINT_LABEL}</span>
      </span>
    </div>
  );
}
