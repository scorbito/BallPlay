"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, ChevronRight, Download, FileText, HelpCircle, Loader2, LogIn, LogOut, Mail, MousePointer2, ShieldCheck, Ticket, UserCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/common/Button";
import { ModalShell } from "@/components/common/ModalShell";
import { InstallAppModal } from "@/components/domain/InstallAppModal";
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";
import { TierBadge } from "@/components/common/TierBadge";
import { signOutAction } from "@/lib/actions/auth";
import { updateProfileAction } from "@/lib/actions/profile";
import { useAppState } from "@/lib/state/AppState";
import type { AuthAccountInfo } from "@/lib/supabase/queries";
import { getCustomCursorEnabled, setCustomCursorEnabled } from "@/lib/cursor/customCursor";
import {
  isPushSupported,
  isIos,
  getCurrentSubscription,
  subscribeToPush,
  unsubscribeFromPush
} from "@/lib/push/clientPush";

const NICKNAME_MAX = 16;

function formatAccountLabel(info: AuthAccountInfo | null | undefined): { label: string; provider: string } | null {
  if (!info || info.isAnonymous) return null;
  if (info.provider === "google") {
    return { label: info.identifier ?? "Google 계정", provider: "Google" };
  }
  if (info.provider === "kakao") {
    return { label: info.identifier ?? "카카오 계정", provider: "Kakao" };
  }
  if (info.provider === "email") {
    return { label: info.identifier ?? "이메일 계정", provider: "이메일" };
  }
  return null;
}

type SettingsScreenProps = {
  accountInfo?: AuthAccountInfo | null;
  isAdmin?: boolean;
  /** 안 본 쿠폰 수 — "내 쿠폰함" NEW 배지 */
  couponUnseen?: number;
};

export function SettingsScreen({ accountInfo = null, isAdmin = false, couponUnseen = 0 }: SettingsScreenProps) {
  const { isAnonymous, profile, showToast } = useAppState();
  const { isStandalone } = useInstallPrompt();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const accountLabel = formatAccountLabel(accountInfo);

  // 푸시 알림 토글 — 실제 구독 상태와 연동.
  // pushSupported: false 면 토글 비활성 + 안내(iOS 는 홈 화면 추가 안내).
  const [pushSupported, setPushSupported] = useState(true);
  const [pushIsIos, setPushIsIos] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  // 마운트 후 환경/현재 구독 상태 동기화 (hydration-safe).
  useEffect(() => {
    const supported = isPushSupported();
    setPushSupported(supported);
    setPushIsIos(isIos());
    if (supported) {
      void getCurrentSubscription().then((sub) => setPushOn(Boolean(sub)));
    }
  }, []);

  const handleTogglePush = async () => {
    if (pushBusy || !pushSupported) return;
    setPushBusy(true);
    try {
      if (!pushOn) {
        const result = await subscribeToPush();
        if (result.ok) {
          setPushOn(true);
          showToast("알림을 켰어요. 오늘의 AI 예측을 받아보세요.");
        } else if (result.reason === "denied") {
          setPushOn(false);
          showToast("알림 권한이 거부됐어요. 브라우저 설정에서 허용해주세요.");
        } else if (result.reason === "unsupported") {
          setPushOn(false);
          setPushSupported(false);
        } else {
          setPushOn(false);
          showToast("알림 설정에 실패했어요. 잠시 후 다시 시도해주세요.");
        }
      } else {
        await unsubscribeFromPush();
        setPushOn(false);
        showToast("알림을 껐어요.");
      }
    } finally {
      setPushBusy(false);
    }
  };

  // 닉네임 편집 — 라인업 등록 시 노출되는 식별자
  const [nicknameDraft, setNicknameDraft] = useState(profile?.nickname ?? "");
  const [savingNickname, setSavingNickname] = useState(false);
  const [nicknameSavedAt, setNicknameSavedAt] = useState<number | null>(null);
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  // profile.nickname이 외부에서 갱신될 때 초안 동기화 (다른 탭/페이지에서 변경됐을 때)
  useEffect(() => {
    setNicknameDraft(profile?.nickname ?? "");
  }, [profile?.nickname]);

  // 커스텀 커서 토글 — localStorage 기준. 마운트 후 hydration-safe 하게 읽음.
  const [cursorEnabled, setCursorEnabled] = useState(false);
  useEffect(() => {
    setCursorEnabled(getCustomCursorEnabled());
  }, []);
  const handleToggleCursor = () => {
    const next = !cursorEnabled;
    setCursorEnabled(next);
    setCustomCursorEnabled(next);
  };

  const nicknameTrimmed = nicknameDraft.trim();
  const nicknameDirty = nicknameTrimmed.length > 0 && nicknameTrimmed !== (profile?.nickname ?? "");

  const handleSaveNickname = async () => {
    if (!nicknameDirty || savingNickname || isAnonymous) return;
    setSavingNickname(true);
    setNicknameError(null);
    try {
      await updateProfileAction({ nickname: nicknameTrimmed });
      setNicknameSavedAt(Date.now());
      window.setTimeout(() => setNicknameSavedAt(null), 1800);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "저장에 실패했습니다.";
      setNicknameError(msg);
    } finally {
      setSavingNickname(false);
    }
  };

  return (
    <AppShell activeTab="settings" title="설정" theme="light" backHref="/">
      {/* 연동 계정 정보 — 마이 프로필 영역에서 옮겨옴.
          익명 로그인 사용자는 연동 정보가 없으므로 "익명 로그인" 안내 + 로그아웃 노출. */}
      <section className="settings-account-section" aria-label="연동 계정">
        <header className="settings-section-head">
          <UserCircle size={14} /> 연동 계정
        </header>
        {accountLabel ? (
          <div className={`settings-account-card settings-account-${accountInfo?.provider ?? "unknown"}`}>
            <div className="settings-account-main">
              <span className={`settings-account-provider settings-account-provider-${accountInfo?.provider}`}>
                {accountLabel.provider}
              </span>
              <span className="settings-account-id">{accountLabel.label}</span>
              <TierBadge size="sm" hideGuest />
            </div>
            <button className="settings-account-logout" type="button" onClick={() => setLogoutConfirmOpen(true)}>
              <LogOut size={14} /> 로그아웃
            </button>
          </div>
        ) : (
          <div className="settings-account-card settings-account-anonymous">
            <div className="settings-account-main">
              <span className="settings-account-provider settings-account-provider-anonymous">익명</span>
              <span className="settings-account-id">아직 계정을 연동하지 않았어요</span>
            </div>
            {/* 익명/비로그인 상태에선 로그아웃 대신 로그인 버튼.
                경기장 도전·내 기록 등 로그인 필요 메뉴와 동일한 진입점. */}
            <Link className="settings-account-login" href="/login" prefetch>
              <LogIn size={14} /> 로그인
            </Link>
          </div>
        )}
      </section>

      {/* 닉네임 패널 — 라인업 등록 시 다른 사용자에게 노출되는 이름 */}
      <section className="settings-nickname-section" aria-label="닉네임">
        <header className="settings-section-head">
          <UserCircle size={14} /> 닉네임
        </header>
        <div className="settings-nickname-card">
          <input
            type="text"
            className="settings-nickname-input"
            value={nicknameDraft}
            placeholder={isAnonymous ? "로그인하면 변경 가능" : "닉네임 입력"}
            maxLength={NICKNAME_MAX}
            disabled={isAnonymous || savingNickname}
            onChange={(e) => setNicknameDraft(e.target.value.slice(0, NICKNAME_MAX))}
          />
          <button
            type="button"
            className="settings-nickname-save"
            disabled={!nicknameDirty || savingNickname || isAnonymous}
            onClick={handleSaveNickname}
          >
            {savingNickname ? (
              <Loader2 size={14} className="settings-nickname-spin" />
            ) : nicknameSavedAt ? (
              <Check size={14} />
            ) : null}
            <span>{savingNickname ? "저장 중" : nicknameSavedAt ? "저장됨" : "저장"}</span>
          </button>
        </div>
        {nicknameError ? (
          <p className="settings-nickname-error">{nicknameError}</p>
        ) : (
          <p className="settings-nickname-hint">경기장 등록 라인업에 닉네임이 표시됩니다 (최대 {NICKNAME_MAX}자)</p>
        )}
      </section>

      {/* 내 쿠폰함 — 당첨 쿠폰 보관·열람. 안 본 쿠폰 있으면 NEW 배지. */}
      <section className="menu-list settings-list settings-list-secondary" aria-label="쿠폰">
        <Link className="settings-row" href="/my/coupons" prefetch={false}>
          <Ticket size={18} />
          <strong>내 쿠폰함</strong>
          <span className="settings-value">
            {couponUnseen > 0 ? (
              <span className="settings-new-badge">NEW {couponUnseen}</span>
            ) : null}
          </span>
          <ChevronRight size={18} aria-hidden />
        </Link>
      </section>

      {/* 알림 — 웹 푸시 구독 토글. 오늘 AI 예측 발행 시 정오에 1건 발송. */}
      <section className="menu-list settings-list settings-list-secondary" aria-label="알림">
        <button
          type="button"
          className="settings-row"
          onClick={handleTogglePush}
          aria-pressed={pushOn}
          disabled={!pushSupported || pushBusy}
        >
          {pushBusy ? <Loader2 size={18} className="settings-nickname-spin" /> : <Bell size={18} />}
          <strong>알림 받기</strong>
          <span className="settings-value">
            {!pushSupported ? "지원 안 함" : pushOn ? "켜짐" : "꺼짐"}
          </span>
          <ChevronRight size={18} aria-hidden />
        </button>
        {!pushSupported ? (
          <p className="settings-nickname-hint">
            {pushIsIos
              ? "홈 화면에 추가하면 알림을 받을 수 있어요"
              : "이 브라우저는 푸시를 지원하지 않아요"}
          </p>
        ) : (
          <p className="settings-nickname-hint">오늘의 AI 승부예측이 나오면 정오에 알려드려요</p>
        )}
      </section>

      {/* 화면 설정 — 커스텀 마우스 커서 토글 (PC 전용) */}
      <section className="menu-list settings-list settings-list-secondary" aria-label="화면 설정">
        <button
          type="button"
          className="settings-row"
          onClick={handleToggleCursor}
          aria-pressed={cursorEnabled}
        >
          <MousePointer2 size={18} />
          <strong>커스텀 마우스 커서</strong>
          <span className="settings-value">{cursorEnabled ? "켜짐" : "꺼짐"}</span>
          <ChevronRight size={18} aria-hidden />
        </button>
      </section>

      {/* 앱 설치 — 이미 PWA로 설치된 사용자에겐 숨김 */}
      {!isStandalone ? (
        <section className="menu-list settings-list settings-list-secondary" aria-label="앱">
          <button type="button" className="settings-row" onClick={() => setInstallModalOpen(true)}>
            <Download size={18} />
            <strong>앱으로 설치</strong>
            <span className="settings-value" />
            <ChevronRight size={18} aria-hidden />
          </button>
        </section>
      ) : null}

      {isAdmin ? (
        <section className="menu-list settings-list settings-list-secondary" aria-label="운영자">
          <Link className="settings-row" href="/admin/events" prefetch>
            <ShieldCheck size={18} />
            <strong>운영자 이벤트 통계</strong>
            <span className="settings-value" />
            <ChevronRight size={18} />
          </Link>
          <Link className="settings-row" href="/admin/coupons" prefetch={false}>
            <Ticket size={18} />
            <strong>쿠폰 지급</strong>
            <span className="settings-value" />
            <ChevronRight size={18} />
          </Link>
        </section>
      ) : null}

      <section className="menu-list settings-list settings-list-secondary">
        <Link className="settings-row" href="/my/help" prefetch>
          <HelpCircle size={18} />
          <strong>이용안내 / 자주 묻는 질문</strong>
          <span className="settings-value" />
          <ChevronRight size={18} />
        </Link>
        <Link className="settings-row" href="/my/contact" prefetch>
          <Mail size={18} />
          <strong>문의하기</strong>
          <span className="settings-value" />
          <ChevronRight size={18} />
        </Link>
      </section>

      <section className="menu-list settings-list settings-list-secondary">
        <Link className="settings-row" href="/legal/terms" prefetch>
          <FileText size={18} />
          <strong>이용약관</strong>
          <span className="settings-value" />
          <ChevronRight size={18} />
        </Link>
        <Link className="settings-row" href="/legal/privacy" prefetch>
          <ShieldCheck size={18} />
          <strong>개인정보처리방침</strong>
          <span className="settings-value" />
          <ChevronRight size={18} />
        </Link>
      </section>

      <ModalShell open={logoutConfirmOpen} title="로그아웃" onClose={() => setLogoutConfirmOpen(false)} panelClassName="dark-confirm-panel">
        <form action={signOutAction}>
          <div className="confirm-stack">
            <p>로그아웃 할까요?</p>
            <span className="confirm-hint">
              {isAnonymous
                ? "익명 로그인은 같은 기기에서만 유지돼요. 로그아웃하면 지금까지 활동에 다시 접근할 수 없을 수 있어요."
                : "다시 로그인하려면 이메일·비밀번호가 필요해요."}
            </span>
            <div className="confirm-actions">
              <button type="button" className="confirm-cancel" onClick={() => setLogoutConfirmOpen(false)}>취소</button>
              <Button type="submit">로그아웃</Button>
            </div>
          </div>
        </form>
      </ModalShell>
      <InstallAppModal open={installModalOpen} onClose={() => setInstallModalOpen(false)} />
    </AppShell>
  );
}
