import type { UserProfileRecord } from "@/lib/types/api-contracts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthAccountInfo = {
  provider: "google" | "kakao" | "email" | "anonymous" | "unknown";
  // Google/email은 실제 이메일, 카카오는 닉네임 또는 카카오ID, 익명은 null.
  identifier: string | null;
  isAnonymous: boolean;
};

/** 현재 로그인한 사용자의 OAuth provider + 식별자(이메일/닉네임)를 반환.
 *  마이 페이지의 "어떤 계정으로 로그인했는지" 표시에 사용. */
export async function getCurrentAuthAccountInfo(): Promise<AuthAccountInfo | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const user = data.user;
  if (user.is_anonymous) {
    return { provider: "anonymous", identifier: null, isAnonymous: true };
  }

  const identities = user.identities ?? [];
  const oauth = identities.find((i) => i.provider === "google" || i.provider === "kakao");

  if (oauth?.provider === "google") {
    const email = (oauth.identity_data?.email as string | undefined) ?? user.email ?? null;
    return { provider: "google", identifier: email, isAnonymous: false };
  }

  if (oauth?.provider === "kakao") {
    const nickname = (oauth.identity_data?.user_name as string | undefined)
      ?? (oauth.identity_data?.nickname as string | undefined)
      ?? (oauth.identity_data?.preferred_username as string | undefined)
      ?? null;
    return { provider: "kakao", identifier: nickname, isAnonymous: false };
  }

  if (identities.some((i) => i.provider === "email") || user.email) {
    return { provider: "email", identifier: user.email ?? null, isAnonymous: false };
  }

  return { provider: "unknown", identifier: user.email ?? null, isAnonymous: false };
}

export async function getCurrentProfileFromDb(): Promise<UserProfileRecord | null> {
  const supabase = createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,nickname,main_team_id,main_team_changed_at,interest_team_ids,notifications_enabled,default_public_scope,avatar_image_url,bio,created_at,updated_at")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    nickname: data.nickname,
    mainTeamId: data.main_team_id,
    mainTeamChangedAt: data.main_team_changed_at,
    interestTeamIds: data.interest_team_ids,
    notificationsEnabled: data.notifications_enabled,
    defaultPublicScope: data.default_public_scope,
    avatarImageUrl: data.avatar_image_url,
    bio: data.bio ?? null,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}
