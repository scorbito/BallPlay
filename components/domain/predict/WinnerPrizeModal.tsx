"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ModalShell } from "@/components/common/ModalShell";

const DISMISS_KEY = "ballplay:coupon-arrived-dismissed";

/**
 * 쿠폰 도착 알림 — 로그인 사용자에게 "안 본 쿠폰"이 있으면 홈에서 1회 안내.
 * 외부 연락처 없이 사이트 내 쿠폰함으로 유도. 쿠폰 수가 늘면 다시 뜬다.
 */
export function WinnerPrizeModal() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch("/api/coupons/unseen", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const n = Number(data?.count ?? 0);
        if (canceled || n <= 0) return;
        // 이전에 이 수(또는 그 이상)를 이미 확인했으면 다시 띄우지 않음.
        let dismissed = 0;
        try {
          dismissed = Number(window.localStorage.getItem(DISMISS_KEY) ?? "0");
        } catch {
          /* localStorage 는 최적화용 */
        }
        if (n <= dismissed) return;
        setCount(n);
        setOpen(true);
      } catch {
        /* 실패해도 화면 사용엔 지장 없음 */
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const close = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(count));
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <ModalShell
      open={open}
      title="🎟 쿠폰이 도착했어요!"
      ariaLabel="쿠폰 도착 안내"
      onClose={close}
      panelClassName="winner-prize-panel"
    >
      <div className="winner-prize-body">
        <p className="winner-prize-lead">
          받으실 쿠폰 <strong>{count}장</strong>이 도착했어요.
          <br />
          <strong>내 쿠폰함</strong>에서 확인하고 저장하세요.
        </p>
        <p className="winner-prize-guide">
          쿠폰은 로그인 계정에 안전하게 보관돼요. 별도 연락처 없이 언제든 다시 볼 수 있어요.
        </p>
        <Link className="winner-prize-mail" href="/my/coupons" onClick={close}>
          쿠폰함 열기
        </Link>
        <button type="button" className="winner-prize-later" onClick={close}>
          나중에
        </button>
      </div>
    </ModalShell>
  );
}
