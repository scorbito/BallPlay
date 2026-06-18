// 사용자 등급(tier) 판정 — guest / free / pro / admin.
//
// 판정 흐름:
//   1. auth.user 없음 → guest
//   2. user.is_anonymous → guest (익명 로그인은 비로그인과 동급)
//   3. bp_user_tier row 없음 → free
//   4. row 있고 tier='admin' → admin (만료 무시)
//   5. row 있고 tier='pro' + expires_at > now() → pro
//   6. row 있고 tier='pro' + 만료 → free (만료된 pro 강등)
//
// admin은 만료 없음 (expires_at = null).

import type { SupabaseClient, User } from "@supabase/supabase-js";

export type UserTier = "guest" | "free" | "pro" | "admin";

export type UserTierResult = {
  tier: UserTier;
  user: User | null;
  /** pro 만료 시각 (해당 시) */
  expiresAt?: string;
};

type TierRow = {
  user_id: string;
  tier: "pro" | "admin";
  expires_at: string | null;
};

export async function getUserTier(client: SupabaseClient): Promise<UserTierResult> {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { tier: "guest", user: null };
  if (user.is_anonymous) return { tier: "guest", user };

  const { data, error } = await client
    .from("bp_user_tier")
    .select("user_id, tier, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return { tier: "free", user };

  const row = data as TierRow;
  if (row.tier === "admin") return { tier: "admin", user };
  if (row.tier === "pro") {
    if (!row.expires_at) return { tier: "pro", user };
    const expiresMs = new Date(row.expires_at).getTime();
    if (expiresMs > Date.now()) {
      return { tier: "pro", user, expiresAt: row.expires_at };
    }
    // 만료 → free로 강등 (DB 정리는 별도 cron 또는 admin 수동)
    return { tier: "free", user };
  }

  return { tier: "free", user };
}

// 미들웨어 헤더로 이미 확보한 식별자(userId/isAnonymous)로 tier 판정 — auth.getUser() 생략판.
// getUserTier와 동일 로직이되 네트워크 왕복(getUser) 없이 tier 테이블만 조회한다.
// user 객체가 필요 없는 호출부(홈·예측 리스트 등)에서 요청당 getUser 1~2회를 절감.
export async function getUserTierByIdentity(
  client: SupabaseClient,
  identity: { userId: string | null; isAnonymous: boolean }
): Promise<UserTierResult> {
  if (!identity.userId) return { tier: "guest", user: null };
  if (identity.isAnonymous) return { tier: "guest", user: null };

  const { data, error } = await client
    .from("bp_user_tier")
    .select("user_id, tier, expires_at")
    .eq("user_id", identity.userId)
    .maybeSingle();

  if (error || !data) return { tier: "free", user: null };

  const row = data as TierRow;
  if (row.tier === "admin") return { tier: "admin", user: null };
  if (row.tier === "pro") {
    if (!row.expires_at) return { tier: "pro", user: null };
    if (new Date(row.expires_at).getTime() > Date.now()) {
      return { tier: "pro", user: null, expiresAt: row.expires_at };
    }
    return { tier: "free", user: null };
  }

  return { tier: "free", user: null };
}

// 등급별 라벨/색상 — UI 통일용
export const TIER_LABEL: Record<UserTier, string> = {
  guest: "게스트",
  free: "회원",
  pro: "프로",
  admin: "운영자"
};

export const TIER_COLOR: Record<UserTier, string> = {
  guest: "#6b7280",
  free: "#9ca3af",
  pro: "#f59e0b",
  admin: "#ef4444"
};

// 권한 체크 헬퍼 — 컴포넌트에서 한 줄로 분기.
// 등급 우선순위: guest < free < pro < admin
const TIER_RANK: Record<UserTier, number> = {
  guest: 0,
  free: 1,
  pro: 2,
  admin: 3
};

export function tierAtLeast(tier: UserTier, required: UserTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[required];
}
