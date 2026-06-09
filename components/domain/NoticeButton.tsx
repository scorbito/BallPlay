"use client";

// 홈 헤더 공지 아이콘 + 신규 공지 빨간점.
//   - 서버에서 받은 최신 공지 published_at 과 localStorage의 "마지막 확인 시각"을 비교.
//   - 안 본 공지가 있으면 빨간점 표시. 아이콘 클릭 시 본 것으로 기록(빨간점 제거).
//   - 비교는 ISO 문자열 사전순(=시간순)으로 안전하게 동작.

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { fetchHomeBadges } from "@/lib/client/clientBadges";

const LAST_SEEN_KEY = "bp:notices-last-seen";

export function NoticeButton({ latestPublishedAt: propLatestNoticeAt }: { latestPublishedAt?: string | null }) {
  const [unread, setUnread] = useState(false);
  const [latestPublishedAt, setLatestPublishedAt] = useState<string | null>(propLatestNoticeAt ?? null);

  useEffect(() => {
    if (latestPublishedAt) return;
    fetchHomeBadges()
      .then((data) => {
        if (data.ok && data.latestNoticeAt) {
          setLatestPublishedAt(data.latestNoticeAt);
        }
      })
      .catch(() => {});
  }, [latestPublishedAt]);

  useEffect(() => {
    if (!latestPublishedAt) return;
    let lastSeen: string | null = null;
    try {
      lastSeen = window.localStorage.getItem(LAST_SEEN_KEY);
    } catch {
      // localStorage 접근 불가(사파리 프라이빗 등) — 배지 미표시로 폴백
    }
    // 마지막 확인 기록이 없거나, 최신 공지가 그보다 나중이면 신규로 간주
    if (!lastSeen || latestPublishedAt > lastSeen) {
      setUnread(true);
    }
  }, [latestPublishedAt]);

  const markSeen = () => {
    if (!latestPublishedAt) return;
    try {
      window.localStorage.setItem(LAST_SEEN_KEY, latestPublishedAt);
    } catch {
      // 무시 — 다음에 또 빨간점 떠도 무해
    }
    setUnread(false);
  };

  return (
    <Link
      href="/my/notices"
      className="play-hub-settings play-hub-notice"
      prefetch
      aria-label={unread ? "공지사항 (새 공지 있음)" : "공지사항"}
      onClick={markSeen}
    >
      <Image
        src="/icons/header/notice.png"
        alt=""
        width={36}
        height={36}
        className="play-hub-header-icon"
      />
      {unread ? <span className="play-hub-notice-dot" aria-hidden /> : null}
    </Link>
  );
}
