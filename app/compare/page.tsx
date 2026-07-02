import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { CompareClient } from "@/components/domain/compare/CompareClient";

// 정적 셸 — 팀 데이터는 클라이언트가 /api/compare 로 로드. auth/user 미참조라 전체 캐시 가능.
export const metadata: Metadata = {
  title: "팀 전력비교",
  description: "두 팀의 시즌 전적·선발·타선을 비교하고 전력지수를 확인하세요.",
};

export default function ComparePage() {
  return (
    <AppShell activeTab="home" title="팀 전력비교" theme="light" backHref="/" wide>
      <CompareClient />
    </AppShell>
  );
}
