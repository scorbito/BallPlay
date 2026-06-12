"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { UserProfile } from "@/lib/types/domain";
import type { UserProfileRecord } from "@/lib/types/api-contracts";
import { useVisibilityRefresh } from "@/lib/hooks/useVisibilityRefresh";
import { initCustomCursor } from "@/lib/cursor/customCursor";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureAnonymousClient } from "@/lib/supabase/ensureAnonymousClient";
import { POINT_LABEL } from "@/lib/points/config";
import { emitPointBalanceUpdated } from "@/components/domain/points/pointEvents";
import { PointBaseballIcon } from "@/components/domain/points/PointBaseballIcon";

type Toast = {
  id: number;
  message: string;
  pointReward: boolean;
};

type CheckinRewardModal = {
  amount: number;
  bonus: number;
  streak: number;
};

type ProfileSettings = Pick<UserProfile, "nickname" | "mainTeamId" | "interestTeamIds" | "avatarUrl" | "bio">;

type AppState = {
  notificationsEnabled: boolean;
  publicScope: string;
  profile: UserProfile;
  isAnonymous: boolean;
  toast: Toast | null;
  updateProfile: (profile: Partial<ProfileSettings>) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setPublicScope: (scope: string) => void;
  showToast: (message: string) => void;
};

const AppStateContext = createContext<AppState | null>(null);

const emptyProfileSettings: ProfileSettings = {
  nickname: "",
  mainTeamId: "lg",
  interestTeamIds: [],
  avatarUrl: null,
  bio: null
};

type AppStateProviderProps = {
  children: ReactNode;
  initialProfile?: UserProfileRecord | null;
  initialIsAnonymous?: boolean;
};

export function AppStateProvider({ children, initialProfile, initialIsAnonymous = false }: AppStateProviderProps) {
  const [profileSettings, setProfileSettings] = useState<ProfileSettings>(
    initialProfile
      ? {
          nickname: initialProfile.nickname,
          mainTeamId: initialProfile.mainTeamId,
          interestTeamIds: initialProfile.interestTeamIds ?? [],
          avatarUrl: initialProfile.avatarImageUrl ?? null,
          bio: initialProfile.bio ?? null
        }
      : emptyProfileSettings
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    initialProfile?.notificationsEnabled ?? true
  );
  const [publicScope, setPublicScope] = useState(
    initialProfile?.defaultPublicScope === "friends" ? "친구 공개"
    : initialProfile?.defaultPublicScope === "private" ? "나만 보기"
    : "전체 공개"
  );
  const [toast, setToast] = useState<Toast | null>(null);
  const [checkinRewardModal, setCheckinRewardModal] = useState<CheckinRewardModal | null>(null);
  const checkinAttemptedRef = useRef(false);

  useVisibilityRefresh();

  // 마운트 시 localStorage 기준으로 커스텀 커서 body 클래스 부여 (PC 전용).
  useEffect(() => {
    initCustomCursor();
  }, []);

  useEffect(() => {
    if (!initialProfile) return;
    setProfileSettings({
      nickname: initialProfile.nickname,
      mainTeamId: initialProfile.mainTeamId,
      interestTeamIds: initialProfile.interestTeamIds ?? [],
      avatarUrl: initialProfile.avatarImageUrl ?? null,
      bio: initialProfile.bio ?? null
    });
  }, [initialProfile?.nickname, initialProfile?.mainTeamId, initialProfile?.avatarImageUrl, initialProfile?.bio]);

  useEffect(() => {
    document.documentElement.setAttribute("data-loaded", "true");
  }, []);

  useEffect(() => {
    if (checkinAttemptedRef.current) return;
    checkinAttemptedRef.current = true;

    (async () => {
      try {
        const client = createSupabaseBrowserClient();
        await ensureAnonymousClient(client);
        const res = await fetch("/api/points/checkin", { method: "POST" });
        const data = await res.json();
        if (!res.ok || !data.ok) return;
        emitPointBalanceUpdated(Number(data.balance));
        if (data.awarded) {
          setCheckinRewardModal({
            amount: Number(data.amount ?? 0),
            bonus: Number(data.bonus ?? 0),
            streak: Number(data.streak ?? 1)
          });
        }
      } catch {
        // 출석 보상은 진입 보조 기능이라 실패해도 화면 진입은 막지 않는다.
      }
    })();
  }, []);

  const showToast = (message: string) => {
    const id = Date.now();
    setToast({
      id,
      message,
      pointReward: new RegExp(`\\+\\d[\\d,]*${POINT_LABEL}.*획득`).test(message)
    });
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 3600);
  };

  const value = useMemo<AppState>(() => ({
    notificationsEnabled,
    publicScope,
    profile: { ...profileSettings, interestTeamIds: profileSettings.interestTeamIds },
    isAnonymous: initialIsAnonymous,
    toast,
    updateProfile: (nextProfile) => {
      setProfileSettings((current) => ({ ...current, ...nextProfile }));
      showToast("프로필을 저장했어요.");
    },
    setNotificationsEnabled: (enabled) => {
      setNotificationsEnabled(enabled);
      showToast(enabled ? "알림을 켰어요." : "알림을 껐어요.");
    },
    setPublicScope: (scope) => {
      setPublicScope(scope);
      showToast(`${scope}로 변경했어요.`);
    },
    showToast
  }), [initialIsAnonymous, notificationsEnabled, profileSettings, publicScope, toast]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
      {checkinRewardModal ? (
        <div className="daily-checkin-backdrop" role="presentation">
          <section
            className="daily-checkin-panel"
            role="dialog"
            aria-modal="true"
            aria-label="출석 보상"
          >
            <span className="daily-checkin-icon" aria-hidden="true">
              <PointBaseballIcon size={30} className="daily-checkin-ball-icon" />
            </span>
            <h2>오늘도 야구놀이터를 방문해주셔서 감사합니다.</h2>
            <p>
              출석 보상으로 <strong>{checkinRewardModal.amount.toLocaleString()}{POINT_LABEL}</strong> 지급
            </p>
            {checkinRewardModal.bonus > 0 ? (
              <span className="daily-checkin-bonus">
                연속 출석 보너스 +{checkinRewardModal.bonus.toLocaleString()}{POINT_LABEL}
              </span>
            ) : null}
            <p className="daily-checkin-message">즐거운 시간 되세요.</p>
            <button type="button" onClick={() => setCheckinRewardModal(null)}>
              확인
            </button>
          </section>
        </div>
      ) : null}
      {toast ? (
        <div className={`toast-message${toast.pointReward ? " point-reward-toast" : ""}`}>
          {toast.pointReward ? (
            <span className="point-toast-particles" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </span>
          ) : null}
          <span className="toast-message-text">{toast.message}</span>
        </div>
      ) : null}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
}
