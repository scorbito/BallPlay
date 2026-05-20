"use server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export type PublicProfilePayload = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  mainTeamId: string;
  bio: string | null;
  isSelf: boolean;
};

/** 작성자 영역(닉네임/사진) 탭 시 열리는 프로필 모달의 데이터 조회.
 *  미니멀 프로필 정보만 반환 — 닉네임, 팀, 사진, 자기소개, 본인 여부. */
export async function getPublicProfileAction(targetUserId: string): Promise<PublicProfilePayload | null> {
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("로그인이 필요합니다.");
  }
  const me = authData.user.id;

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,nickname,main_team_id,avatar_image_url,bio")
    .eq("id", targetUserId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`프로필을 불러오지 못했습니다: ${profileError.message}`);
  }
  if (!profile) return null;

  return {
    userId: profile.id,
    nickname: profile.nickname,
    avatarUrl: profile.avatar_image_url ?? null,
    mainTeamId: profile.main_team_id,
    bio: profile.bio ?? null,
    isSelf: targetUserId === me
  };
}
