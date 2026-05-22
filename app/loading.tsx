import { AppShell } from "@/components/layout/AppShell";
import { SkeletonBox, SkeletonLine } from "@/components/common/Skeleton";

export default function HomeLoading() {
  return (
    <AppShell activeTab="home" theme="dark" wide>
      <div className="skeleton-page">
        {/* HERO */}
        <SkeletonBox height={200} radius={16} />
        {/* 다음 직관 카드 */}
        <SkeletonBox height={86} radius={14} />
        {/* 최근 직관 섹션 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SkeletonLine width="40%" height={14} />
          <SkeletonBox height={92} radius={12} />
        </div>
        {/* 이번주 일정 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SkeletonLine width="38%" height={14} />
          <SkeletonBox height={120} radius={12} />
        </div>
      </div>
    </AppShell>
  );
}
