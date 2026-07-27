"use client";

// 홈 "지난주 예측왕" 스트립 — 이벤트 배너 아래 텍스트 한 줄. 누르면 당첨자 발표 공지로.
// 홈은 정적 캐시라 서버 fetch 대신 공개 API를 클라에서 조회(캐시됨).

import { useEffect, useState } from "react";
import Link from "next/link";

type Winners = {
  show: boolean;
  weekStart?: string;
  weekEnd?: string;
  winnerNickname?: string | null;
  couponCount?: number;
  noticeId?: string | null;
};

function mmdd(iso?: string): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function LatestWinnerStrip() {
  const [data, setData] = useState<Winners | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/predict-event/latest-winners");
        const json = (await res.json()) as Winners;
        if (!cancelled) setData(json);
      } catch {
        // 실패 시 스트립만 안 보임 — 화면엔 지장 없음.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data?.show) return null;

  const href = data.noticeId ? `/my/notices/${data.noticeId}` : "/my/notices";
  const period = `${mmdd(data.weekStart)}~${mmdd(data.weekEnd)}`;

  return (
    <Link href={href} className="home-winner-strip" prefetch={false}>
      <span className="home-winner-strip-main">
        🏆 지난주 예측왕{" "}
        {data.winnerNickname ? (
          <strong>{data.winnerNickname}</strong>
        ) : (
          <strong className="home-winner-strip-none">아쉽게 없음(AI 승)</strong>
        )}
        {data.couponCount ? <span className="home-winner-strip-sub"> · 참여상 {data.couponCount}명</span> : null}
      </span>
      <span className="home-winner-strip-more">
        {period} 자세히 &rsaquo;
      </span>
    </Link>
  );
}
