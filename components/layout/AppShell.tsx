import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BottomTabs } from "@/components/layout/BottomTabs";
import { PullToRefresh } from "@/components/common/PullToRefresh";

type AppShellProps = {
  activeTab?: "home" | "schedule" | "play" | "my";
  title?: string;
  showBeta?: boolean;
  theme?: "default" | "dark";
  headerAction?: ReactNode;
  backHref?: string;
  /** 상단 헤더(타이틀바)를 완전히 숨김. 뒤로가기·타이틀·헤더 액션 모두 함께 사라짐.
   *  일정/커뮤니티/마이 상위 페이지처럼 헤더 없이 콘텐츠를 위로 올리고 싶을 때 사용. */
  hideHeader?: boolean;
  children: ReactNode;
};

export function AppShell({
  activeTab = "home",
  title = "야구놀이터",
  showBeta = false,
  theme = "default",
  headerAction,
  backHref,
  hideHeader = false,
  children
}: AppShellProps) {
  return (
    <main className="app-backdrop">
      <section className={`phone-frame${theme === "dark" ? " phone-frame-dark" : ""}`} aria-label="야구놀이터 앱 화면">
        <div className="app-scroll">
          {hideHeader ? null : (
            <header className="app-header">
              {backHref ? (
                <Link className="header-back" href={backHref} aria-label="뒤로" prefetch>
                  <ArrowLeft size={18} />
                </Link>
              ) : null}
              <Link className="brand" href="/" prefetch>
                <span>{title}</span>
                {showBeta ? <span className="brand-beta">BETA</span> : null}
              </Link>
              {headerAction}
            </header>
          )}
          <div className={`app-content${hideHeader ? " app-content-no-header" : ""}`}>
            <PullToRefresh>{children}</PullToRefresh>
          </div>
        </div>
        <BottomTabs activeTab={activeTab} />
      </section>
    </main>
  );
}
