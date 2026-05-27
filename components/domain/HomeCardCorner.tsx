"use client";

// 홈 카드 우상단 코너 — featured(★추천) / external(↗) / badge(준비중) 표시.
// ! 정보 아이콘 + 설명 툴팁은 제거됨 (2026-05-27).
//   - 이유: 메뉴명이 자명해 카드별 ! 가 시각 노이즈 + "설명 필요한 앱" 인상.
//   - 메뉴 설명은 각 페이지 내부 제목 아래로 이동 예정.
//   - description prop은 호출부 호환 위해 유지 (현재 미사용).

import { ExternalLink, Star } from "lucide-react";

type Props = {
  cardId: string;
  title: string;
  description: string;
  available: boolean;
  featured?: boolean;
  external?: boolean;
  badge?: string;
};

export function HomeCardCorner({ available, featured, external, badge }: Props) {
  if (featured) {
    return (
      <span className="play-hub-card-featured">
        <Star size={10} fill="currentColor" strokeWidth={0} />
        추천
      </span>
    );
  }
  if (external) {
    return (
      <span className="play-hub-card-external-mark" aria-hidden="true">
        <ExternalLink size={14} />
      </span>
    );
  }
  if (!available && badge) {
    return <span className="play-hub-card-badge">{badge}</span>;
  }
  return null;
}
