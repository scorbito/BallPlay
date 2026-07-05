"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ModalShell } from "@/components/common/ModalShell";

type PrizeInfo = {
  role: "main" | "coupon";
  prize: string;
  nickname: string | null;
  weekStart: string;
};

/**
 * 승부예측 이벤트 당첨자 중 "등록 이메일이 없는(카카오)" 본인에게만 뜨는 개별 모달.
 * 판별은 /api/predict-event/my-prize (세션 기준). 구글 당첨자는 대상 아님.
 */
export function WinnerPrizeModal() {
  const [info, setInfo] = useState<PrizeInfo | null>(null);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch("/api/predict-event/my-prize", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (canceled || !data?.show) return;
        try {
          if (window.localStorage.getItem(`ballplay:prize-modal:${data.weekStart}`) === "1") return;
        } catch {
          /* localStorage 는 최적화용 */
        }
        setInfo({ role: data.role, prize: data.prize, nickname: data.nickname, weekStart: data.weekStart });
      } catch {
        /* 실패해도 화면 사용엔 지장 없음 */
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const close = () => {
    if (info) {
      try {
        window.localStorage.setItem(`ballplay:prize-modal:${info.weekStart}`, "1");
      } catch {
        /* ignore */
      }
    }
    setInfo(null);
  };

  return (
    <ModalShell
      open={info !== null}
      title="🎉 이벤트 당첨을 축하해요!"
      ariaLabel="이벤트 당첨 안내"
      onClose={close}
      panelClassName="winner-prize-panel"
    >
      {info ? (
        <div className="winner-prize-body">
          <p className="winner-prize-lead">
            <strong>{info.nickname ?? "회원"}</strong>님, 승부예측 이벤트{" "}
            <strong>{info.role === "main" ? "메인" : "쿠폰"} 당첨</strong>!
            <br />
            경품: <strong>{info.prize}</strong>
          </p>
          <p className="winner-prize-guide">
            경품 발송을 위해 <strong>받으실 이메일 또는 카카오톡 ID</strong>를 문의로 남겨주세요.
            <br />
            로그인 계정으로 확인되니 별도 신원 확인은 필요 없어요.
          </p>
          <Link className="winner-prize-mail" href="/my/contact?category=prize" onClick={close}>
            문의 남기러 가기
          </Link>
          <button type="button" className="winner-prize-later" onClick={close}>
            나중에
          </button>
        </div>
      ) : null}
    </ModalShell>
  );
}
