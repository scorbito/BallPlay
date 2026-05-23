import { AppShell } from "@/components/layout/AppShell";
import { SkeletonBox } from "@/components/common/Skeleton";

export default function ScheduleLoading() {
  return (
    <AppShell activeTab="schedule" title="일정" theme="light" hideHeader wide>
      <div className="skeleton-page">
        {/* 보기 전환 탭 */}
        <SkeletonBox height={40} radius={10} />
        {/* 월 헤더 */}
        <SkeletonBox height={28} radius={8} />
        {/* 캘린더 그리드 */}
        <SkeletonBox height={360} radius={14} />
        {/* 결과 행 */}
        <SkeletonBox height={56} radius={12} />
      </div>
    </AppShell>
  );
}
