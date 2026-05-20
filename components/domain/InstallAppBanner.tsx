"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";
import { InstallAppModal } from "@/components/domain/InstallAppModal";
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";

const DISMISS_KEY = "install-banner.dismissedAt";
const COOLDOWN_DAYS = 30;
// 페이지 콘텐츠가 먼저 그려진 뒤 자연스럽게 슬라이드 업 — 너무 빠르면 콘텐츠보다 배너가 먼저.
const SHOW_AFTER_MS = 1_500;

// 배너 노출 제외 경로 — 입구/인증 페이지에선 하단 액션 버튼을 가릴 수 있어 차단.
// 로그인 후 앱 내부 화면(/, /schedule, /community, /my/*, ...)에서만 노출.
const EXCLUDED_PATHS = ["/login", "/onboarding"];
function isExcludedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname.startsWith("/auth")) return true; // /auth/callback 등
  return EXCLUDED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** 하단 플로팅 설치 안내 바.
 *  - 이미 설치(standalone) → 표시 X
 *  - 30일 이내 닫은 적 있음 → 표시 X
 *  - 첫 진입 30초 뒤 슬라이드 업 등장
 *  - "설치방법" 클릭 → InstallAppModal 노출 (디바이스별 안내)
 *  - x 닫기 → localStorage에 dismissedAt 기록, 30일 안 보임 */
export function InstallAppBanner() {
  const pathname = usePathname();
  const { isStandalone, isIOS, isAndroid } = useInstallPrompt();
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 입구/인증 페이지에선 노출 X (랜딩의 로그인 버튼 등을 가릴 수 있음)
    if (isExcludedPath(pathname)) return;

    // PWA 설치 후엔 절대 노출 X
    if (isStandalone) return;

    // 모바일 디바이스가 아니면 권유 의미 없음 (PC에선 설치 흐름이 다르고 효용도 작음)
    if (!isIOS && !isAndroid) return;

    // 최근 30일 안에 닫았으면 노출 X
    try {
      const dismissedAt = window.localStorage.getItem(DISMISS_KEY);
      if (dismissedAt) {
        const elapsedMs = Date.now() - Number(dismissedAt);
        if (elapsedMs < COOLDOWN_DAYS * 24 * 60 * 60 * 1000) return;
      }
    } catch {
      // localStorage 차단 환경에선 그냥 노출.
    }

    const timer = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [pathname, isStandalone, isIOS, isAndroid]);

  // 경로가 제외 영역으로 바뀌면 표시 중인 배너도 즉시 숨김.
  useEffect(() => {
    if (isExcludedPath(pathname)) {
      setVisible(false);
    }
  }, [pathname]);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  // 항상 동일한 구조를 반환 — 조건부 분기로 렌더링 트리 구조가 바뀌지 않도록.
  // 배너 div는 visible일 때만 보이고, 모달은 항상 마운트 (open prop으로 표시 제어).
  return (
    <>
      {visible ? (
        <div className="install-banner" role="region" aria-label="앱으로 설치 안내">
          <div className="install-banner-icon" aria-hidden="true">
            <Download size={16} />
          </div>
          <div className="install-banner-text">
            <strong>홈 화면에 추가하면 더 편해요!</strong>
            <span>URL 바 없이 풀스크린으로 사용</span>
          </div>
          <button type="button" className="install-banner-cta" onClick={() => setModalOpen(true)}>
            설치방법
          </button>
          <button type="button" className="install-banner-dismiss" onClick={dismiss} aria-label="닫기">
            <X size={16} />
          </button>
        </div>
      ) : null}
      <InstallAppModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
