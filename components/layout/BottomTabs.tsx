"use client";

import { History, Home, ListChecks, Swords } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type TabId = "home" | "play" | "stadium" | "records";

type BottomTabsProps = {
  activeTab: TabId | (string & {});
};

type TabDef = {
  id: TabId;
  label: string;
  icon: typeof Home;
  href: string;
  disabled?: boolean;
  badge?: string;
};

const tabs: readonly TabDef[] = [
  { id: "home", label: "홈", icon: Home, href: "/" },
  { id: "play", label: "라인업 짜기", icon: ListChecks, href: "/play/lineup" },
  { id: "stadium", label: "경기장", icon: Swords, href: "/stadium/lobby" },
  { id: "records", label: "내 기록", icon: History, href: "/records" }
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
