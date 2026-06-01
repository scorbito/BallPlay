"use client";

// 클라이언트(브라우저) 측 익명 세션 lazy 생성 (2026-06-02 ~).
// 행동(라인업 공개·라이브 입장·예측 제출·기록 저장) 시점에 호출.
// 서버 액션 ensureAnonymousSession과 짝 — 이쪽은 브라우저 supabase 클라이언트 흐름용.
//
// 왜 서버 액션이 아니라 브라우저에서 직접 signInAnonymously() 하나:
//   브라우저 supabase-js 인스턴스가 즉시 세션을 갖고 onAuthStateChange(SIGNED_IN)가
//   발화돼, useLineupSync 등 구독 중인 훅이 자동으로 DB 동기화를 시작한다.
//   서버 액션으로 만들면 쿠키만 set되고 브라우저 인스턴스는 다음 새로고침까지 모름.

import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureProfile } from "@/lib/actions/ensureProfile";

/**
 * 세션이 없으면 익명 계정을 만들고 user.id를 반환한다.
 * 이미 세션이 있으면 그 user.id를 반환. 익명 가입 실패 시 null.
 */
export async function ensureAnonymousClient(client: SupabaseClient): Promise<string | null> {
  const { data: existing } = await client.auth.getUser();
  if (existing?.user) {
    return existing.user.id;
  }

  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data?.user) {
    return null;
  }

  // profiles row는 RLS상 본인이 직접 insert 못 함 → 서버(admin)에서 생성.
  await ensureProfile(data.user.id).catch(() => {});
  return data.user.id;
}
