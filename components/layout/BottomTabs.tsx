"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AiChatSheet } from "@/components/domain/AiChatSheet";

type TabId = "home" | "ai" | "schedule" | "settings";

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
  { id: "ai", label: "AI 예측", iconSrc: "/icons/menu/ai-prediction.png", href: "/predict/ai-winner" },
  { id: "schedule", label: "일정", iconSrc: "/icons/menu/schedule.png", href: "/schedule" },
  { id: "settings", label: "설정", iconSrc: "/icons/header/settings.png", href: "/my/settings" }
] as const;

export function BottomTabs({ activeTab }: BottomTabsProps) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
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
    if (!pendingHref) return;
    const timeout = window.setTimeout(() => setPendingHref(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [pendingHref]);

  return (
    <>
      <nav className="bottom-tab" aria-label="하단 메뉴">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id || (tab.id === "ai" && chatOpen);

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

          const markPending = () => {
            clearPendingTimer();
            setPendingHref(null);

            if (tab.href === pathname) return;

            pendingTimerRef.current = window.setTimeout(() => {
              setPendingHref(tab.href);
              pendingTimerRef.current = null;
            }, 200);
          };

          if (tab.id === "ai") {
            return (
              <button
                className={`tab-item tab-item-chatbot ${isActive ? "tab-item-active" : ""}`}
                type="button"
                key={tab.id}
                onClick={() => {
                  clearPendingTimer();
                  setPendingHref(null);
                  setChatOpen(true);
                }}
                aria-pressed={chatOpen}
              >
                <span className="tab-item-badge tab-item-badge-new">NEW</span>
                <span className="tab-item-icon tab-item-icon-chatbot">
                  <Image src="/icons/menu/chatbot.png" alt="" width={32} height={32} priority={isActive} />
                </span>
                <span>AI 챗봇</span>
              </button>
            );
          }

          return (
            <Link
              className={`tab-item ${isActive ? "tab-item-active" : ""}`}
              href={tab.href}
              key={tab.id}
              onClick={markPending}
              prefetch={false}
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
      <AiChatSheet open={chatOpen} onOpenChange={setChatOpen} />
    </>
  );
}
