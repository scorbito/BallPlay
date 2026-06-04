"use client";

// 홈 카드 우상단의 작은 펄스 점 — 메뉴 사용을 유도하는 CTA 인디케이터.
// 표시 대상: lineup, stadium, winner-predict, ai-predict, today-results, videos, news.
// stadium 만 "soft"(상시 녹색) — 항상 라이브 신호.
// 나머지는 사용자 상태가 비어있거나 새 콘텐츠 미열람일 때 핑크 펄스.

import { useEffect, useState } from "react";
import type { HomeBadgeServerData } from "@/lib/server/homeBadges";
import {
  LINEUP_ENTRIES_CHANGED_EVENT,
  loadLineupEntries
} from "@/lib/storage/lineupEntries";

export const AI_PREDICT_VIEWED_KEY = "ballplay:ai-predict:lastViewedDate";
export const SIM_1000_VIEWED_KEY = "ballplay:sim-1000:lastViewedDate";
export const VIDEOS_VIEWED_KEY = "ballplay:videos:lastViewedAt";
export const NEWS_VIEWED_KEY = "ballplay:news:lastViewedAt";
export const TODAY_RESULTS_VIEWED_KEY = "ballplay:today-results:lastViewedDate";

type Props = {
  cardId: string;
  data: HomeBadgeServerData;
};

export function HomeCardPulse({ cardId, data }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const compute = () => {
      if (cardId === "stadium") return true;
      if (cardId === "winner-predict") {
        return data.todayGamesTotal > 0 && data.userPredictionsToday < data.todayGamesTotal;
      }
      if (cardId === "ai-predict") {
        if (data.aiPredictionsToday === 0) return false;
        const lastViewed = window.localStorage.getItem(AI_PREDICT_VIEWED_KEY);
        return lastViewed !== data.todayDate;
      }
      if (cardId === "sim-1000") {
        if (data.simResultsToday === 0) return false;
        const lastViewed = window.localStorage.getItem(SIM_1000_VIEWED_KEY);
        return lastViewed !== data.todayDate;
      }
      if (cardId === "lineup") {
        const entries = loadLineupEntries();
        if (entries.length === 0) return true;
        return entries.some((e) => e.batting.slots.length < 9);
      }
      if (cardId === "today-results") {
        if (data.todayGamesFinished === 0) return false;
        const lastViewed = window.localStorage.getItem(TODAY_RESULTS_VIEWED_KEY);
        return lastViewed !== data.todayDate;
      }
      if (cardId === "videos") {
        if (!data.latestVideoAt) return false;
        const lastViewed = window.localStorage.getItem(VIDEOS_VIEWED_KEY);
        if (!lastViewed) return true;
        return new Date(data.latestVideoAt).getTime() > new Date(lastViewed).getTime();
      }
      if (cardId === "news") {
        if (!data.latestNewsAt) return false;
        const lastViewed = window.localStorage.getItem(NEWS_VIEWED_KEY);
        if (!lastViewed) return true;
        return new Date(data.latestNewsAt).getTime() > new Date(lastViewed).getTime();
      }
      return false;
    };
    setShow(compute());

    // 다른 탭/같은 탭에서 라인업 변경 시 lineup 카드 재평가
    if (cardId !== "lineup" && cardId !== "ai-predict" && cardId !== "sim-1000") return;
    const recompute = () => setShow(compute());
    window.addEventListener("storage", recompute);
    window.addEventListener(LINEUP_ENTRIES_CHANGED_EVENT, recompute);
    return () => {
      window.removeEventListener("storage", recompute);
      window.removeEventListener(LINEUP_ENTRIES_CHANGED_EVENT, recompute);
    };
  }, [cardId, data]);

  if (!show) return null;
  const className =
    cardId === "stadium" ? "play-hub-card-pulse play-hub-card-pulse-soft" : "play-hub-card-pulse";
  return <span className={className} aria-hidden="true" />;
}
