// 서버 시계 동기화 — 친구 실시간 매치 양쪽 클라이언트 시작 시각을 ms 단위로 맞춤.
//
// 문제: 호스트/참가자의 wall-clock 이 NTP 차이로 1~3초 어긋나면, start_at(ISO)을
//   각자 Date.now() 로 비교하는 카운트다운이 그만큼 어긋나 시작 시각이 차이남.
// 해결: 양쪽이 한 번씩 server `now()` 를 RPC 로 받아 자기 시계와의 offset 을 캐시.
//   countdown 비교 시 `Date.now() - offset` 으로 서버 기준 시각 사용 → 두 클라가
//   동일 server time 에 도달한 순간 동시에 시작.
//
// offset 계산은 round-trip 의 절반을 빼는 단순 NTP-lite. 정확도 ±50~100ms 수준.

import type { SupabaseClient } from "@supabase/supabase-js";

let cachedOffsetMs: number | null = null;
let inflight: Promise<number> | null = null;

/**
 * 서버 시각과의 offset(ms) 반환. 양수면 클라 시계가 server 보다 빠름.
 * 한 번 fetch 후 캐시 — 이후 호출은 즉시 반환. refresh() 로 강제 갱신 가능.
 */
export async function getServerTimeOffsetMs(client: SupabaseClient): Promise<number> {
  if (cachedOffsetMs !== null) return cachedOffsetMs;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const t0 = Date.now();
      const { data, error } = await client.rpc("bp_server_now");
      const t1 = Date.now();
      if (error || !data) {
        cachedOffsetMs = 0;
        return 0;
      }
      // round-trip 의 절반을 빼서 서버 응답 도착 시점에서 server clock 추정
      const tMid = (t0 + t1) / 2;
      const tServer = new Date(data as string).getTime();
      if (!Number.isFinite(tServer)) {
        cachedOffsetMs = 0;
        return 0;
      }
      cachedOffsetMs = tMid - tServer;
      return cachedOffsetMs;
    } catch {
      cachedOffsetMs = 0;
      return 0;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** 마지막으로 캐시된 offset 사용해 server-equivalent now 반환. offset 없으면 그냥 Date.now(). */
export function serverNow(): number {
  return cachedOffsetMs == null ? Date.now() : Date.now() - cachedOffsetMs;
}

/** 테스트/명시 갱신용. */
export function resetServerTimeOffset(): void {
  cachedOffsetMs = null;
  inflight = null;
}
