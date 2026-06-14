import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BottomTabs } from "@/components/layout/BottomTabs";
import { PullToRefresh } from "@/components/common/PullToRefresh";
import { PointBalanceChip } from "@/components/domain/points/PointBalanceChip";
import { PredictionCorrectBonusModal } from "@/components/domain/points/PredictionCorrectBonusModal";

type AppShellProps = {
  activeTab?: "home" | "play" | "stadium" | "records" | "my" | "schedule";
  title?: ReactNode;
  /** 타이틀 좌우 장식. "slashes" = 핑크 사선 두 줄(경기 진행 화면용). */
  titleDecoration?: "slashes";
  showBeta?: boolean;
  theme?: "default" | "dark" | "light";
  headerAction?: ReactNode;
  backHref?: string;
  /** 뒤로가기를 네비게이션 대신 콜백으로 가로챔(예: 가을야구 이탈 시 패배 확인 모달).
   *  지정 시 backHref 보다 우선하며 <button>으로 렌더된다. */
  onBack?: () => void;
  /** 상단 헤더(타이틀바)를 완전히 숨김. 뒤로가기·타이틀·헤더 액션 모두 함께 사라짐.
   *  일정/커뮤니티/마이 상위 페이지처럼 헤더 없이 콘텐츠를 위로 올리고 싶을 때 사용. */
  hideHeader?: boolean;
  /** 하단 BottomTabs를 숨김. 시뮬 진행·친구 대결 등 몰입 화면에서 사용해
   *  실수 탭으로 매치를 잃지 않게 한다. 뒤로가기는 유지되므로 명시적 이탈만 가능. */
  hideBottomTabs?: boolean;
  hidePointChip?: boolean;
  hideFloatingPointChip?: boolean;
  /** PC(≥1025px)에서 phone-frame을 와이드로 확장. 콘텐츠가 가로로 더 펼쳐져야 하는 페이지(라인업 등)용. */
  wide?: boolean;
  children: ReactNode;
};

export function AppShell({
  activeTab = "home",
  title = "야구놀이터",
  titleDecoration,
  showBeta = false,
  theme = "default",
  headerAction,
  backHref,
  onBack,
  hideHeader = false,
  hideBottomTabs = false,
  hidePointChip = false,
  hideFloatingPointChip = false,
  wide = false,
  children
}: AppShellProps) {
  // theme="dark": 레거시 "오늘은 승요" 공유 화면용 (다크 톤 유지).
  // theme="light": BallPlay 신규 라이트 톤 — product-spec §5.5 (--bp-* 토큰 + 팀 컬러 주도).
  const frameClasses = [
    "phone-frame",
    theme === "dark" ? "phone-frame-dark" : "",
    theme === "light" ? "phone-frame-light" : "",
    wide ? "phone-frame-wide" : ""
  ].filter(Boolean).join(" ");
  return (
    <main className="app-backdrop">
      <section className={frameClasses} aria-label="야구놀이터 앱 화면">
        {hideHeader && !hideFloatingPointChip && !hidePointChip ? (
          <div className="app-floating-point-chip">
            <PointBalanceChip />
          </div>
        ) : null}
        <div className="app-scroll">
          {hideHeader ? null : (
            <header className="app-header">
              <div className="app-header-left">
                {onBack ? (
                  <button type="button" className="header-back" onClick={onBack} aria-label="뒤로">
                    <ArrowLeft size={18} />
                  </button>
                ) : backHref ? (
                  <Link className="header-back" href={backHref} aria-label="뒤로" prefetch>
                    <ArrowLeft size={18} />
                  </Link>
                ) : null}
              </div>
              <Link className={`brand${titleDecoration ? ` brand-deco-${titleDecoration}` : ""}`} href="/" prefetch>
                {titleDecoration === "slashes" ? (
                  <span className="brand-deco-side" aria-hidden="true" />
                ) : null}
                <span>{title}</span>
                {titleDecoration === "slashes" ? (
                  <span className="brand-deco-side" aria-hidden="true" />
                ) : null}
                {showBeta ? <span className="brand-beta">BETA</span> : null}
              </Link>
              <div className="app-header-right">
                {headerAction}
                {hidePointChip ? null : <PointBalanceChip />}
              </div>
            </header>
          )}
          <div className={`app-content${hideHeader ? " app-content-no-header" : ""}`}>
            <PullToRefresh>{children}</PullToRefresh>
          </div>
        </div>
        {hideBottomTabs ? null : <BottomTabs activeTab={activeTab} />}
        <PredictionCorrectBonusModal />
      </section>
    </main>
  );
}
