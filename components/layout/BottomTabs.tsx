"use client";

import { CalendarDays, Home, ListChecks, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// v1 BottomTabs — 4탭. 라인업 짜기/경기일정 활성, 경기 예측·미니게임 공사중(비클릭).
// 마이/로그인 탭은 v1에서 비활성. 추후 SSO 도입 시 추가.
type TabId = "home" | "schedule" | "play" | "my" | "prediction";

type BottomTabsProps = {
  activeTab: TabId;
};

type TabDef = {
  id: TabId;
  label: string;
  icon: typeof CalendarDays;
  href: string;
  disabled?: boolean;
  badge?: string;
};

const tabs: readonly TabDef[] = [
  { id: "home", label: "홈", icon: Home, href: "/" },
  { id: "play", label: "라인업 짜기", icon: ListChecks, href: "/play/lineup" },
  { id: "schedule", label: "일정&순위", icon: CalendarDays, href: "/schedule" },
  { id: "prediction", label: "경기 예측", icon: Sparkles, href: "#", disabled: true, badge: "공사중" }
] as const;

export function BottomTabs({ activeTab }: BottomTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const pendingTimerRef = useRef<number | null>(null);

  const clearPendingTimer = () => {
    if (pendingTimerRef.current === null) return;
    window.clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = null;
  };

  useEffect(() => {
    clearPendingTimer();
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => clearPendingTimer, []);

  useEffect(() => {
    for (const tab of tabs) {
      if (tab.disabled) continue;
      router.prefetch(tab.href);
    }
  }, [router]);

  useEffect(() => {
    if (!pendingHref) return;
    const timeout = window.setTimeout(() => setPendingHref(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [pendingHref]);

  return (
    <>
      <nav className="bottom-tab" aria-label="하단 메뉴">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.disabled) {
            return (
              <div
                className="tab-item tab-item-disabled"
                key={tab.id}
                aria-disabled="true"
                role="link"
              >
                <Icon size={19} strokeWidth={2} />
                <span>{tab.label}</span>
                {tab.badge ? <span className="tab-item-badge">{tab.badge}</span> : null}
              </div>
            );
          }

          const warmRoute = () => router.prefetch(tab.href);
          const markPending = () => {
            clearPendingTimer();
            setPendingHref(null);

            if (tab.href === pathname) return;

            pendingTimerRef.current = window.setTimeout(() => {
              setPendingHref(tab.href);
              pendingTimerRef.current = null;
            }, 200);
          };

          return (
            <Link
              className={`tab-item ${isActive ? "tab-item-active" : ""}`}
              href={tab.href}
              key={tab.id}
              onClick={markPending}
              onFocus={warmRoute}
              onMouseEnter={warmRoute}
              onTouchStart={warmRoute}
              prefetch
            >
              <Icon size={19} strokeWidth={isActive ? 2.8 : 2} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
      {pendingHref ? (
        <div className="route-transition-hint" role="status" aria-live="polite">
          <span className="route-transition-spinner" />
          <span>이동 중...</span>
        </div>
      ) : null}
    </>
  );
}
