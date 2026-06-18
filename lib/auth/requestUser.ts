// 미들웨어(updateSupabaseSession)가 검증해 주입한 user 식별자를 읽는 헬퍼.
// auth.getUser()는 Supabase Auth 서버로의 네트워크 왕복이라 페이지마다 반복하면 비싸다.
// 미들웨어가 요청당 1회만 검증하고 x-bp-user-id / x-bp-is-anon 헤더로 넘겨주므로,
// 서버 컴포넌트/페이지는 이 헤더를 읽어 재호출을 생략한다.

import { headers } from "next/headers";

export type RequestIdentity = {
  /** 검증된 user id (비로그인이면 null) */
  userId: string | null;
  /** 익명 로그인 세션 여부 */
  isAnonymous: boolean;
  /** 헤더가 실제로 존재했는지(미들웨어 경유 여부) — false면 호출부가 fallback 판단 */
  present: boolean;
};

export function getRequestIdentity(): RequestIdentity {
  const h = headers();
  const id = h.get("x-bp-user-id");
  const anon = h.get("x-bp-is-anon");
  return {
    userId: id && id.length > 0 ? id : null,
    isAnonymous: anon === "1",
    present: id !== null || anon !== null
  };
}
