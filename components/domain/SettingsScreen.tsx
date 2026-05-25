"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, FileText, HelpCircle, Loader2, LogOut, Mail, ShieldCheck, UserCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/common/Button";
import { ModalShell } from "@/components/common/ModalShell";
import { signOutAction } from "@/lib/actions/auth";
import { updateProfileAction } from "@/lib/actions/profile";
import { useAppState } from "@/lib/state/AppState";
import type { AuthAccountInfo } from "@/lib/supabase/queries";

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
};

export function SettingsScreen({ accountInfo = null }: SettingsScreenProps) {
  const { isAnonymous, profile } = useAppState();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const accountLabel = formatAccountLabel(accountInfo);

  // 닉네임 편집 — 라인업 등록 시 노출되는 식별자
  const [nicknameDraft, setNicknameDraft] = useState(profile?.nickname ?? "");
  const [savingNickname, setSavingNickname] = useState(false);
  const [nicknameSavedAt, setNicknameSavedAt] = useState<number | null>(null);
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  // profile.nickname이 외부에서 갱신될 때 초안 동기화 (다른 탭/페이지에서 변경됐을 때)
  useEffect(() => {
    setNicknameDraft(profile?.nickname ?? "");
  }, [profile?.nickname]);

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
