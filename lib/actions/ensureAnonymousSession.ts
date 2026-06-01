"use server";

// 익명 세션 lazy 생성 (2026-06-02 ~).
// 진입 시 강제 부트스트랩을 없앤 대신, 실제 행동(라인업 저장·라이브 입장·예측 제출 등)
// 진입 시점에 이 헬퍼를 호출해 그때 비로소 익명 계정을 만든다.
// 봇은 "보기"만 하므로 계정이 생기지 않아 DB가 부풀지 않는다.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/actions/ensureProfile";

export type EnsureAnonymousResult = {
  userId: string;
  isAnonymous: boolean;
  /** 이번 호출에서 새로 익명 계정을 생성했으면 true (기존 세션이면 false) */
  created: boolean;
};

/**
 * 행동 진입 시점에 호출해 세션을 보장한다.
 * - 이미 세션이 있으면 그 user를 반환 (profiles row 존재 보장).
 * - 세션이 없으면 그때 익명 계정 + 기본 프로필을 생성해 반환.
 *
 * 세션 쿠키 저장을 위해 **서버 액션 / 라우트 핸들러** 컨텍스트에서 호출해야 한다
 * (Server Component에서는 쿠키 set이 무시되어 세션이 유지되지 않음).
 * 익명 가입 자체가 실패하면 null을 반환하니 호출부에서 분기 처리한다.
 */
export async function ensureAnonymousSession(): Promise<EnsureAnonymousResult | null> {
  const supabase = createSupabaseServerClient();

  const { data: existing } = await supabase.auth.getUser();
  if (existing?.user) {
    // 기존 세션 — profiles row가 없을 가능성(예외)에 대비해 보장만 하고 통과.
    await ensureProfile(existing.user.id).catch(() => {});
    return {
      userId: existing.user.id,
      isAnonymous: Boolean(existing.user.is_anonymous),
      created: false
    };
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data?.user) {
    return null;
  }

  await ensureProfile(data.user.id).catch(() => {});
  return { userId: data.user.id, isAnonymous: true, created: true };
}
