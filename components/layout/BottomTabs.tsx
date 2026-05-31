"use client";

import Image from "next/image";
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
  iconSrc: string;
  href: string;
  disabled?: boolean;
  badge?: string;
};

const tabs: readonly TabDef[] = [
  { id: "home", label: "홈", iconSrc: "/icons/tabs/home.png", href: "/" },
  { id: "play", label: "라인업 짜기", iconSrc: "/icons/tabs/play.png", href: "/play/lineup" },
  { id: "stadium", label: "경기장", iconSrc: "/icons/tabs/stadium.png", href: "/stadium/lobby" },
  { id: "records", label: "내 기록", iconSrc: "/icons/tabs/records.png", href: "/records" }
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
          const isActive = activeTab === tab.id;

          if (tab.disabled) {
            return (
              <div
                className="tab-item tab-item-disabled"
                key={tab.id}
                aria-disabled="true"
                role="link"
              >
                <span className="tab-item-icon">
                  <Image src={tab.iconSrc} alt="" width={32} height={32} />
                </span>
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
              <span className="tab-item-icon">
                <Image src={tab.iconSrc} alt="" width={32} height={32} priority={isActive} />
              </span>
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
