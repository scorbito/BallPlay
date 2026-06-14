"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { POINT_LABEL } from "@/lib/points/config";
import { POINT_BALANCE_UPDATED_EVENT } from "./pointEvents";
import { PointBaseballIcon } from "./PointBaseballIcon";

type BalanceResponse = {
  balance: number;
  authenticated: boolean;
};

const earnGuides = [
  { title: "출석", detail: "첫 방문 시 출석 보상" },
  { title: "승리팀 예측", detail: "예측 참여와 적중 보너스" },
  { title: "AI 배틀", detail: "응원하는 주장에 투표" },
  { title: "경기장", detail: "공식 경기 완료 후 결과 확인" },
  { title: "일일리포트", detail: "종합/경기별 리포트 하단 버튼" },
  { title: "AI 승리팀 예측", detail: "경기별 예측 콘텐츠 하단 버튼" },
  { title: "퀴즈", detail: "퀴즈 완료와 만점 보너스" },
];

export function PointBalanceChip() {
  const [balance, setBalance] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="point-chip-wrap" ref={rootRef}>
      <button
        type="button"
        className="point-chip"
        aria-label={`보유 ${POINT_LABEL}, 획득처 안내 열기`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="point-chip-balance">
          <PointBaseballIcon size={14} />
          <strong>{balance === null ? "..." : balance.toLocaleString()}</strong>
          <span>{POINT_LABEL}</span>
        </span>
      </button>

      {open ? (
        <div className="point-earn-popover" role="dialog" aria-label={`${POINT_LABEL} 획득처 안내`}>
          <div className="point-earn-popover-arrow" />
          <strong className="point-earn-popover-title">{POINT_LABEL} 받을 수 있는 곳</strong>
          <div className="point-earn-popover-list">
            {earnGuides.map((guide) => (
              <div className="point-earn-popover-item" key={guide.title}>
                <span>{guide.title}</span>
                <small>{guide.detail}</small>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
