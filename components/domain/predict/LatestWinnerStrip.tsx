"use client";

// 홈 "지난주 예측왕" 스트립 — 텍스트 한 줄. 누르면 명예의 전당으로.
// 홈은 정적 캐시라 서버 fetch 대신 공개 API를 클라에서 조회(캐시됨).

import { useEffect, useState } from "react";
import Link from "next/link";

type Winners = {
  show: boolean;
  weekStart?: string;
  weekEnd?: string;
  winnerNickname?: string | null;
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

  const period = `${mmdd(data.weekStart)}~${mmdd(data.weekEnd)}`;

  return (
    <Link href="/event/hall-of-fame" className="home-winner-strip" prefetch={false}>
      <span className="home-winner-strip-main">
        🏆 지난주 예측왕 <strong>{data.winnerNickname ?? "익명"}</strong>
      </span>
      <span className="home-winner-strip-more">
        {period} 자세히 &rsaquo;
      </span>
    </Link>
  );
}
