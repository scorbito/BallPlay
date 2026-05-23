import { AppShell } from "@/components/layout/AppShell";
import { SkeletonBox, SkeletonLine } from "@/components/common/Skeleton";

export default function NoticesLoading() {
  return (
    <AppShell activeTab="my" title="공지사항" theme="light" backHref="/">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "14px 16px",
              background: "var(--hd-bg-card)",
              border: "1px solid var(--hd-border-soft)",
              borderRadius: 14
            }}
          >
            <SkeletonLine width={70} height={11} />
            <SkeletonLine width="80%" height={15} />
            <SkeletonLine width="100%" height={11} />
            <SkeletonLine width="60%" height={11} />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
