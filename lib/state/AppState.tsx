"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { UserProfile } from "@/lib/types/domain";
import type { UserProfileRecord } from "@/lib/types/api-contracts";
import { useVisibilityRefresh } from "@/lib/hooks/useVisibilityRefresh";
import { initCustomCursor } from "@/lib/cursor/customCursor";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureAnonymousClient } from "@/lib/supabase/ensureAnonymousClient";
import { POINT_LABEL, SHOW_BP } from "@/lib/points/config";
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

function parsePointToastMessage(message: string): { amountLine: string; subtitle: string } {
  const lines = message.split("\n").map((line) => line.trim()).filter(Boolean);
  const amountPattern = new RegExp(`\\+?\\d[\\d,]*${POINT_LABEL}.*획득`);
  const amountLine = lines.find((line) => amountPattern.test(line)) ?? message;
  const subtitle = lines.find((line) => line !== amountLine) ?? "BP 보상";
  return { amountLine, subtitle };
}

type ProfileSettings = Pick<UserProfile, "nickname" | "mainTeamId" | "interestTeamIds" | "avatarUrl" | "bio">;

type AppState = {
  notificationsEnabled: boolean;
  publicScope: string;
  profile: UserProfile;
  isAnonymous: boolean;
  isAdmin: boolean;
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

const CHECKIN_ATTEMPT_KEY_PREFIX = "ballplay:points:checkin:lastAttempt";

function kstDateKey(): string {
  return new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function checkinAttemptKey(profileId: string | undefined, isAnonymous: boolean): string {
  return `${CHECKIN_ATTEMPT_KEY_PREFIX}:${profileId ?? (isAnonymous ? "anonymous" : "guest")}`;
}

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
  // user 식별 정보(프로필/익명여부)는 서버가 아니라 클라이언트에서 로드(/api/profile/me).
  // 루트 레이아웃이 headers()/getUser() 를 안 하게 만들어 전 페이지가 정적/ISR 캐시 가능해지도록 한 것.
  const [isAnonymous, setIsAnonymous] = useState(initialIsAnonymous);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileId, setProfileId] = useState<string | undefined>(initialProfile?.id);
  const [identityLoaded, setIdentityLoaded] = useState(Boolean(initialProfile));
  const [toast, setToast] = useState<Toast | null>(null);
  const [checkinRewardModal, setCheckinRewardModal] = useState<CheckinRewardModal | null>(null);
  const checkinAttemptedRef = useRef<string | null>(null);

  useVisibilityRefresh();

  // 마운트 시 localStorage 기준으로 커스텀 커서 body 클래스 부여 (PC 전용).
  useEffect(() => {
    initCustomCursor();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-loaded", "true");
  }, []);

  // 클라이언트 프로필 로드 — 서버(layout)가 프로필을 주입하지 않으므로 마운트 후 직접 가져온다.
  // initialProfile 이 주어진 경우(레거시 경로)엔 이미 반영돼 있으니 생략.
  useEffect(() => {
    if (initialProfile) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile/me", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setIdentityLoaded(true);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const p = data.profile as UserProfileRecord | null;
        if (p) {
          setProfileSettings({
            nickname: p.nickname,
            mainTeamId: p.mainTeamId,
            interestTeamIds: p.interestTeamIds ?? [],
            avatarUrl: p.avatarImageUrl ?? null,
            bio: p.bio ?? null
          });
          setNotificationsEnabled(p.notificationsEnabled ?? true);
          setPublicScope(
            p.defaultPublicScope === "friends" ? "친구 공개"
            : p.defaultPublicScope === "private" ? "나만 보기"
            : "전체 공개"
          );
          setProfileId(p.id);
        }
        setIsAnonymous(Boolean(data.isAnonymous));
        setIsAdmin(Boolean(data.isAdmin));
        setIdentityLoaded(true);
      } catch {
        if (!cancelled) setIdentityLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialProfile]);

  // 출석 보상 — 식별 정보가 확정된 뒤(identityLoaded) 1회 시도.
  useEffect(() => {
    if (!SHOW_BP) return; // BP 숨김 — 출석 보상 모달 미노출
    if (!identityLoaded) return;
    const identity = profileId ?? (isAnonymous ? "anonymous" : "guest");
    if (checkinAttemptedRef.current === identity) return;
    checkinAttemptedRef.current = identity;

    (async () => {
      const today = kstDateKey();
      const storageKey = checkinAttemptKey(profileId, isAnonymous);

      try {
        if (window.localStorage.getItem(storageKey) === today) return;
      } catch {
        // localStorage is an optimization only.
      }

      try {
        const client = createSupabaseBrowserClient();
        await ensureAnonymousClient(client);
        const res = await fetch("/api/points/checkin", { method: "POST" });
        const data = await res.json();
        if (!res.ok || !data.ok) return;
        try {
          window.localStorage.setItem(storageKey, today);
        } catch {
          // localStorage is an optimization only.
        }
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
  }, [identityLoaded, profileId, isAnonymous]);

  const showToast = (message: string) => {
    const id = Date.now();
    setToast({
      id,
      message,
      pointReward: new RegExp(`\\+?\\d[\\d,]*${POINT_LABEL}.*획득`).test(message)
    });
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 3600);
  };

  const value = useMemo<AppState>(() => ({
    notificationsEnabled,
    publicScope,
    profile: { ...profileSettings, interestTeamIds: profileSettings.interestTeamIds },
    isAnonymous,
    isAdmin,
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
  }), [isAnonymous, isAdmin, notificationsEnabled, profileSettings, publicScope, toast]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
      {SHOW_BP && checkinRewardModal ? (
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
            <>
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
              {(() => {
                const parsed = parsePointToastMessage(toast.message);
                return (
                  <span className="point-toast-content">
                    <span className="point-toast-icon" aria-hidden="true">
                      <PointBaseballIcon size={24} />
                    </span>
                    <strong>{parsed.amountLine}</strong>
                    <small>{parsed.subtitle}</small>
                  </span>
                );
              })()}
            </>
          ) : (
            <span className="toast-message-text">{toast.message}</span>
          )}
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
