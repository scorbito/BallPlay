// 서버 사이드 throttle helper.
//   - bp_sync_throttle 의 try_claim RPC 로 atomic lock 시도.
//   - 작업 끝나면 release 호출.
//   - 호출자는 await ensureSync(key, throttleSec, fn) 형태.
//
// 사용 패턴:
//   void ensureSync("games-sync:" + dateISO, 300, () => syncGamesForDate(dateISO))
//   → 5분 안에 같은 키 호출은 즉시 false 반환하고 끝.
//   → 진행 중이면 in_flight 로 다른 호출 차단.
//
// 페이지 server component 에서 fire-and-forget 으로 부르면 응답 속도에 영향 없음.

import { createSupabaseAdminClient } from "@/lib/supabase/server";

type EnsureSyncResult =
  | { ok: true; ran: true; result: unknown }
  | { ok: true; ran: false; reason: "throttled" | "in_flight" }
  | { ok: false; error: string };

/**
 * @param key  bp_sync_throttle 의 key. 의미 있는 prefix:파라미터 형식 권장 (예: "games-sync:2026-05-30")
 * @param throttleSeconds  마지막 성공 후 이 시간 안에는 재실행 안 함.
 * @param fn  실제 sync 작업. 에러 throw 해도 release 는 finally 로 보장.
 */
export async function ensureSync<T>(
  key: string,
  throttleSeconds: number,
  fn: () => Promise<T>
): Promise<EnsureSyncResult> {
  const sb = createSupabaseAdminClient();

  // 1) lock 시도. RPC 가 atomic 으로 처리.
  const { data: claimed, error: claimErr } = await sb.rpc("bp_sync_throttle_try_claim", {
    p_key: key,
    p_throttle_seconds: throttleSeconds
  });

  if (claimErr) {
    return { ok: false, error: `throttle claim failed: ${claimErr.message}` };
  }
  if (!claimed) {
    // 이미 다른 호출자가 도는 중이거나 throttle 내. 호출자는 그냥 캐시된 데이터 사용.
    return { ok: true, ran: false, reason: "throttled" };
  }

  // 2) 실제 작업 + release.
  try {
    const result = await fn();
    return { ok: true, ran: true, result };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  } finally {
    // last_run 갱신 + in_flight 해제. 실패해도 무시 (다음 호출의 timeout 으로 자연 회복).
    try {
      await sb.rpc("bp_sync_throttle_release", { p_key: key });
    } catch {
      // ignore
    }
  }
}
