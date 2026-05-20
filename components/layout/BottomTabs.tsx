"use client";

import { CalendarDays, Gamepad2, Home, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type TabId = "home" | "schedule" | "play" | "my";

type BottomTabsProps = {
  activeTab: TabId;
};

const tabs = [
  { id: "home", label: "홈", icon: Home, href: "/" },
  { id: "schedule", label: "일정", icon: CalendarDays, href: "/schedule" },
  { id: "play", label: "놀이", icon: Gamepad2, href: "/play" },
  { id: "my", label: "마이", icon: UserRound, href: "/my" }
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
