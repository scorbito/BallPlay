"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import {
  adjustMyBpForAdminAction,
  resetMyBpForAdminAction
} from "@/lib/actions/adminPoints";
import { POINT_LABEL } from "@/lib/points/config";
import { POINT_BALANCE_UPDATED_EVENT } from "@/components/domain/points/pointEvents";

type Props = {
  initialBalance: number;
};

const QUICK_AMOUNTS = [100, 1000, -100, -1000];

export function AdminBpAdjustPanel({ initialBalance }: Props) {
  const [balance, setBalance] = useState(initialBalance);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const updateBalance = (nextBalance: number) => {
    setBalance(nextBalance);
    window.dispatchEvent(
      new CustomEvent(POINT_BALANCE_UPDATED_EVENT, {
        detail: { balance: nextBalance }
      })
    );
  };

  const adjust = (amount: number) => {
    if (!Number.isFinite(amount) || amount === 0) return;
    setMessage(null);
    startTransition(async () => {
      const result = await adjustMyBpForAdminAction(amount);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      updateBalance(result.balance);
      setMessage(`${result.adjusted > 0 ? "+" : ""}${result.adjusted.toLocaleString()} ${POINT_LABEL} 조정 완료`);
    });
  };

  const reset = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await resetMyBpForAdminAction();
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      updateBalance(result.balance);
      setMessage("BP를 0으로 초기화했습니다.");
    });
  };

  const submitCustom = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(customAmount.replaceAll(",", "").trim());
    if (!Number.isFinite(amount) || amount === 0) {
      setMessage("조정할 BP를 숫자로 입력해주세요.");
      return;
    }
    setCustomAmount("");
    adjust(amount);
  };

  return (
    <section className="admin-bp-panel" aria-label="운영자 BP 조정">
      <div className="admin-bp-panel-head">
        <div>
          <span className="admin-bp-kicker">운영자 테스트</span>
          <h2>내 {POINT_LABEL} 조정</h2>
        </div>
        <strong>{balance.toLocaleString()} {POINT_LABEL}</strong>
      </div>

      <div className="admin-bp-actions">
        {QUICK_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            disabled={pending}
            className={amount > 0 ? "is-plus" : "is-minus"}
            onClick={() => adjust(amount)}
          >
            {amount > 0 ? "+" : ""}{amount.toLocaleString()}
          </button>
        ))}
        <button type="button" className="is-reset" disabled={pending} onClick={reset}>
          <RotateCcw size={13} />
          0으로
        </button>
      </div>

      <form className="admin-bp-custom" onSubmit={submitCustom}>
        <input
          inputMode="numeric"
          placeholder="+5000 또는 -500"
          value={customAmount}
          onChange={(event) => setCustomAmount(event.target.value)}
          disabled={pending}
        />
        <button type="submit" disabled={pending}>
          적용
        </button>
      </form>

      {message ? <p className="admin-bp-message">{message}</p> : null}
    </section>
  );
}
