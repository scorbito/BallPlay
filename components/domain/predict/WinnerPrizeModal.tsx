"use client";

import { useEffect, useState } from "react";
import { ModalShell } from "@/components/common/ModalShell";

const SUPPORT_EMAIL = "daedanbiz@gmail.com";

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

  const mailtoHref = (() => {
    if (!info) return "#";
    const subject = `[야구놀이터] 이벤트 경품 수령 - ${info.nickname ?? ""}`;
    const body = [
      "안녕하세요, 야구놀이터 이벤트 당첨 경품 수령을 신청합니다.",
      "",
      `1) 야구놀이터 닉네임: ${info.nickname ?? ""}`,
      "2) 카카오톡 프로필 이름: ",
      "3) 경품 받을 이메일 주소 또는 카카오톡 ID: ",
    ].join("\n");
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  })();

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
            카카오 로그인 회원은 등록된 이메일이 없어, 경품 발송을 위해 아래 정보를 메일로 보내주세요.
          </p>
          <ul className="winner-prize-list">
            <li>야구놀이터 닉네임</li>
            <li>카카오톡 프로필 이름 (본인 확인용)</li>
            <li>경품 받을 이메일 또는 카카오톡 ID</li>
          </ul>
          <a className="winner-prize-mail" href={mailtoHref} onClick={close}>
            문의 메일 보내기
          </a>
          <button type="button" className="winner-prize-later" onClick={close}>
            나중에
          </button>
        </div>
      ) : null}
    </ModalShell>
  );
}
