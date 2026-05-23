"use server";

// 온보딩 우회용 — 정식 가입/OAuth 사용자가 profiles 행 없으면 디폴트로 자동 생성.
// 익명 가입은 signInAnonymouslyAction에서 이미 디폴트 row를 만드므로 별도 호출 필요 X.

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { generateDefaultNickname } from "@/lib/constants/nicknames";

/** profiles row 없으면 디폴트로 생성. 있으면 no-op. */
export async function ensureProfile(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from("profiles").upsert({
    id: userId,
    nickname: generateDefaultNickname(userId),
    main_team_id: "doosan",
    interest_team_ids: [],
    notifications_enabled: true,
    default_public_scope: "public"
  }, {
    onConflict: "id",
    ignoreDuplicates: true // 이미 있으면 변경 안 함
  });
}
