"use client";

// 홈 카드 우상단 코너 — external(↗) / badge(준비중) 표시.
// 변경 이력:
//   - 2026-05-27: ! 정보 아이콘 + 설명 툴팁 제거 (메뉴명이 자명).
//   - 2026-05-30: ★추천 뱃지 제거 (featured 카드 자체가 핑크 강조라 뱃지 중복).
//   - featured prop은 호출부 호환 위해 유지 (현재 사용 X).

import { ExternalLink } from "lucide-react";

type Props = {
  cardId: string;
  title: string;
  description: string;
  available: boolean;
  featured?: boolean;
  external?: boolean;
  badge?: string;
};

export function HomeCardCorner({ available, external, badge }: Props) {
  if (external) {
    return (
      <span className="play-hub-card-external-mark" aria-hidden="true">
        <ExternalLink size={14} />
      </span>
    );
  }
  if (badge) {
    if (!available) {
      return <span className="play-hub-card-badge is-disabled">{badge}</span>;
    }
    const upper = badge.toUpperCase();
    const badgeType =
      upper === "HOT" ? "is-hot" : upper === "NEW" ? "is-new" : upper === "EVENT" ? "is-event" : "";
    return <span className={`play-hub-card-badge ${badgeType}`}>{badge}</span>;
  }
  return null;
}
