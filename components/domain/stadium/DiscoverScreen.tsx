"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { RegisteredLineupList } from "./RegisteredLineupList";

// 익명도 본인 라인업 공개·도전 가능하도록 정책 변경(2026-05-26~27) 후
// 로그인 게이트 제거. 도전 버튼 클릭 시 본인 공개 라인업 없으면 안내 모달이 별도 작동.
export function DiscoverScreen() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AppShell activeTab="stadium" title="출전 팀 도전" backHref="/stadium" theme="light" wide>
      <header className="stadium-discover-head">
        <p className="stadium-discover-sub">다른 플레이어가 출전 등록한 팀과 매칭해서 시뮬</p>
        <button
          type="button"
          className="stadium-discover-refresh"
          onClick={() => setRefreshKey((k) => k + 1)}
          aria-label="새로고침"
        >
          <RefreshCw size={12} />
          새로고침
        </button>
      </header>

      {/* 전체보기는 본인 카드도 포함해서 표시 (도전 대신 삭제 버튼 노출).
          key 변경으로 컴포넌트 재마운트 → 데이터 재조회. */}
      <RegisteredLineupList key={refreshKey} maxItems={50} sortBy="recent" includeMine showHeader={false} />
    </AppShell>
  );
}
