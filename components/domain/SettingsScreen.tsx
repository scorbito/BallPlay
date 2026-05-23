"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, FileText, HelpCircle, LogOut, Mail, ShieldCheck, UserCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/common/Button";
import { ModalShell } from "@/components/common/ModalShell";
import { signOutAction } from "@/lib/actions/auth";
import { useAppState } from "@/lib/state/AppState";
import type { AuthAccountInfo } from "@/lib/supabase/queries";

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
};

export function SettingsScreen({ accountInfo = null }: SettingsScreenProps) {
  const { isAnonymous } = useAppState();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const accountLabel = formatAccountLabel(accountInfo);

  return (
    <AppShell activeTab="home" title="설정" theme="light" backHref="/">
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
            <button className="settings-account-logout" type="button" onClick={() => setLogoutConfirmOpen(true)}>
              <LogOut size={14} /> 로그아웃
            </button>
          </div>
        )}
      </section>

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
    </AppShell>
  );
}
