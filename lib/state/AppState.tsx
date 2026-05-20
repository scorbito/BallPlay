"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UserProfile } from "@/lib/types/domain";
import type { UserProfileRecord } from "@/lib/types/api-contracts";
import { useVisibilityRefresh } from "@/lib/hooks/useVisibilityRefresh";

type Toast = {
  id: number;
  message: string;
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

  useVisibilityRefresh();

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

  const showToast = (message: string) => {
    const id = Date.now();
    setToast({ id, message });
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 2200);
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
      {toast ? <div className="toast-message">{toast.message}</div> : null}
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
