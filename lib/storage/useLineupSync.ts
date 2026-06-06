"use client";

// 라인업 다기기 동기화 훅 — 로그인 시 DB ↔ localStorage 양방향 sync.
//
// 흐름:
//   1. 마운트 시 localStorage 즉시 표시 (UX 빠름)
//   2. auth.getUser()로 로그인 확인
//   3. 로그인 안 됨 → status="local-only", localStorage만 사용
//   4. 로그인 됨 → DB fetch
//      - DB 비어있음 + localStorage 있음 → bulkUpsert (첫 로그인 마이그레이션)
//      - 양쪽 다 있음 → entryId 기준 merge, updatedAt 큰 쪽 우선 (last-write-wins)
//      - DB만 있음 → DB → localStorage 덮어쓰기
//      - 둘 다 비어있음 → 빈 상태
//   5. onAuthStateChange 구독 — 로그인/로그아웃 시 재실행
//   6. 변경 함수(syncedUpsert/Delete)는 localStorage write + DB upsert 둘 다 수행
//
// 충돌 정책: updatedAt 큰 쪽 우선 (last-write-wins, 단순). 같은 entryId가 다른
// 기기에서 동시 수정되면 마지막 저장이 이김. v1엔 충분.

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureAnonymousClient } from "@/lib/supabase/ensureAnonymousClient";
import {
  loadLineupEntries,
  saveLineupEntries,
  upsertLineupEntry as localUpsert,
  deleteLineupEntry as localDelete,
  renameLineupEntry as localRename
} from "@/lib/storage/lineupEntries";
import type { LineupEntry } from "@/lib/types/lineup";
import {
  bulkUpsertLineups,
  deleteLineupByEntryId,
  archiveLineupByEntryId,
  existsOwnerPublishedHash,
  listMyLineups,
  publishLineup as dbPublishLineup,
  rowToEntry,
  unpublishLineup as dbUnpublishLineup,
  upsertLineup
} from "@/lib/supabase/query-parts/bpLineups";
import { computeLineupHash } from "@/lib/sim/lineupHash";

export type SyncStatus =
  | "loading"        // 초기 로드 또는 sync 진행 중
  | "local-only"     // 비로그인 — localStorage만 사용
  | "synced"         // 로그인 + DB와 일치
  | "error";         // 동기화 실패 (localStorage는 계속 작동)

type State = {
  entries: LineupEntry[];
  status: SyncStatus;
  userId: string | null;
  errorMessage: string | null;
};

function mergeByEntryId(local: LineupEntry[], remote: LineupEntry[]): LineupEntry[] {
  // entryId 기준 merge. 같은 키면 updatedAt 큰 쪽 우선 + "데이터 적은 쪽으로 회귀 금지" 보호.
  // 보호: remote가 더 최신이라도 batting/pitching이 local보다 데이터가 "적은" 경우엔 local 신뢰.
  //   - 모바일 race (race·트리거 차단)로 DB에 stale batting이 남고 updated_at만 갱신된 케이스에서
  //     local의 정상 데이터가 빈 데이터로 회귀하는 버그 방어용.
  const map = new Map<string, LineupEntry>();
  for (const e of remote) map.set(e.entryId, e);
  for (const e of local) {
    const r = map.get(e.entryId);
    if (!r) {
      map.set(e.entryId, e);
      continue;
    }
    const localTs = Date.parse(e.updatedAt) || 0;
    const remoteTs = Date.parse(r.updatedAt) || 0;
    const winner = localTs >= remoteTs ? e : r;
    const loser = winner === e ? r : e;
    // 회귀 방지 — winner가 remote(=DB)인데 batting/pitching이 local보다 적게 차있으면
    // local의 데이터 보존(데이터는 local, 메타데이터는 winner의 것 사용).
    const winnerBat = winner.batting?.slots?.length ?? 0;
    const loserBat = loser.batting?.slots?.length ?? 0;
    const winnerPit = winner.pitching?.slots?.filter(Boolean).length ?? 0;
    const loserPit = loser.pitching?.slots?.filter(Boolean).length ?? 0;
    if (winnerBat < loserBat || winnerPit < loserPit) {
      map.set(e.entryId, {
        ...winner,
        batting: loserBat > winnerBat ? loser.batting : winner.batting,
        pitching: loserPit > winnerPit ? loser.pitching : winner.pitching
      });
    } else {
      map.set(e.entryId, winner);
    }
  }
  // updatedAt 내림차순 (최근 수정 먼저)
  return Array.from(map.values()).sort((a, b) => {
    return (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0);
  });
}

// localStorage에 마지막으로 sync된 user.id 보관 — user 전환 감지용.
// 같은 PC/브라우저에서 정식 계정 A → B로 전환할 때 A의 라인업이 B에게
// 마이그되지 않도록 localStorage를 리셋하기 위함.
const LAST_SYNCED_USER_KEY = "ballplay:last-synced-user-id";

// 마지막 sync 완료 시각 (user별). local-only entry가 새로 만든 건지 vs
// 다른 기기에서 삭제된 건지 판정하는 기준점.
//   - entry.updatedAt > lastSyncedAt → 마지막 sync 이후 생성/수정 → DB push
//   - entry.updatedAt < lastSyncedAt → 한 번 sync된 후 DB에서 사라짐 → 다른 기기 삭제 → 로컬에서도 제거
const LAST_SYNCED_AT_PREFIX = "ballplay:last-synced-at:";

function readLastSyncedUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_SYNCED_USER_KEY);
  } catch {
    return null;
  }
}

function writeLastSyncedUserId(userId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (userId) window.localStorage.setItem(LAST_SYNCED_USER_KEY, userId);
    else window.localStorage.removeItem(LAST_SYNCED_USER_KEY);
  } catch {
    // ignore
  }
}

function readLastSyncedAt(userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_SYNCED_AT_PREFIX + userId);
  } catch {
    return null;
  }
}

function writeLastSyncedAt(userId: string, iso: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_SYNCED_AT_PREFIX + userId, iso);
  } catch {
    // ignore
  }
}

export function useLineupSync() {
  const clientRef = useRef(createSupabaseBrowserClient());
  // 공개 토글 / 직전 syncedUpsert 진행 중에는 visibilitychange 동기화를 스킵.
  // (모바일에서 백그라운드 진입 → 복귀 시 race로 DB의 직전 stale 상태가 local을 덮어쓰는 버그 차단)
  const publishingRef = useRef(false);
  const [state, setState] = useState<State>(() => ({
    entries: loadLineupEntries(),
    status: "loading",
    userId: null,
    errorMessage: null
  }));

  // 마운트 시 + auth 변경 시 sync 실행
  useEffect(() => {
    const client = clientRef.current;
    let cancelled = false;

    const syncOnce = async () => {
      const { data: authData } = await client.auth.getUser();
      const user = authData.user;
      const lastSyncedUid = readLastSyncedUserId();

      // 비로그인만 local-only — 익명도 user.id 보유 + 슬롯 2개 한정이라 DB 동기화 허용.
      // (이전 정책: 익명도 local-only. 익명이 라인업 공개/매치 못 해 재미 못 느낀다는 피드백으로 풀어줌)
      if (!user) {
        if (cancelled) return;
        // 로그인 → 비로그인 전환 시 localStorage 정리 (보안 + 깨끗한 시작)
        if (lastSyncedUid) {
          saveLineupEntries([]);
          writeLastSyncedUserId(null);
        }
        setState({
          entries: loadLineupEntries(),
          status: "local-only",
          userId: null,
          errorMessage: null
        });
        return;
      }

      // 정식 user인데 마지막 sync된 user와 다름 = 계정 전환 → localStorage 리셋
      // 이전 user의 entry_id가 새 user에게 마이그되는 부작용 방지
      const isUserSwitch = lastSyncedUid !== null && lastSyncedUid !== user.id;
      if (isUserSwitch) {
        saveLineupEntries([]);
      }
      const local = loadLineupEntries();
      writeLastSyncedUserId(user.id);

      // 로그인 됨 — DB fetch
      if (!cancelled) {
        setState((s) => ({ ...s, status: "loading", userId: user.id }));
      }
      const res = await listMyLineups(client, user.id);
      if (cancelled) return;

      if (!res.ok) {
        setState({
          entries: local,
          status: "error",
          userId: user.id,
          errorMessage: res.error
        });
        return;
      }
      const remote = res.rows.map(rowToEntry);

      // DB 비어있음 + localStorage 있음 → 첫 로그인 마이그레이션
      if (remote.length === 0 && local.length > 0) {
        const up = await bulkUpsertLineups(client, local, user.id);
        if (cancelled) return;
        if (!up.ok) {
          setState({
            entries: local,
            status: "error",
            userId: user.id,
            errorMessage: up.error
          });
          return;
        }
        // 마이그 후 다시 fetch (서버 타임스탬프 기준 정렬)
        const final = up.rows.map(rowToEntry);
        saveLineupEntries(final);
        writeLastSyncedAt(user.id, new Date().toISOString());
        setState({
          entries: final,
          status: "synced",
          userId: user.id,
          errorMessage: null
        });
        return;
      }

      // 양쪽 merge (updatedAt 큰 쪽 우선)
      const merged = mergeByEntryId(local, remote);

      // local에만 있는 entry 분류:
      //   - lastSyncedAt 이후에 생성/수정된 entry → DB에 push (새로 만든 거)
      //   - lastSyncedAt 이전에 마지막 수정된 entry → 다른 기기에서 삭제된 거로 간주, 로컬에서 제거
      //   - lastSyncedAt 자체가 없으면 (이 user의 첫 sync) → 모두 push (마이그레이션)
      const lastSyncedAt = readLastSyncedAt(user.id);
      const lastSyncedTs = lastSyncedAt ? Date.parse(lastSyncedAt) || 0 : 0;
      const remoteIds = new Set(remote.map((e) => e.entryId));
      const localOnly = local.filter((e) => !remoteIds.has(e.entryId));
      const toPush: LineupEntry[] = [];
      const toRemoveIds = new Set<string>();
      for (const e of localOnly) {
        const localTs = Date.parse(e.updatedAt) || 0;
        if (!lastSyncedAt || localTs > lastSyncedTs) {
          toPush.push(e);
        } else {
          // 한 번 sync된 적 있는데 DB에 없음 → 다른 기기에서 삭제. 로컬에서도 제거.
          toRemoveIds.add(e.entryId);
        }
      }
      if (toPush.length > 0) {
        await bulkUpsertLineups(client, toPush, user.id);
      }

      // local과 DB 둘 다 있지만 local이 더 최신인 것도 push
      for (const e of merged) {
        const r = remote.find((x) => x.entryId === e.entryId);
        if (!r) continue;
        const localTs = Date.parse(e.updatedAt) || 0;
        const remoteTs = Date.parse(r.updatedAt) || 0;
        if (localTs > remoteTs) {
          await upsertLineup(client, e, user.id);
        }
      }

      // "다른 기기 삭제" 판정된 entry는 최종 결과에서도 제외 (로컬도 정리됨).
      const finalEntries = toRemoveIds.size > 0
        ? merged.filter((e) => !toRemoveIds.has(e.entryId))
        : merged;

      saveLineupEntries(finalEntries);
      writeLastSyncedAt(user.id, new Date().toISOString());
      if (cancelled) return;
      setState({
        entries: finalEntries,
        status: "synced",
        userId: user.id,
        errorMessage: null
      });
    };

    void syncOnce();

    // 로그인/로그아웃 감지
    const { data: sub } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        void syncOnce();
      }
    });

    // 백그라운드 → 포그라운드 복귀 시 재동기화.
    // refreshSession 은 lib/supabase/client.ts 의 전역 핸들러가 single-flight 락으로
    // 직렬화해 처리. 여기선 syncOnce 만 — refreshSession 호출 금지 (race 시 invalid_grant).
    //
    // ⚠️ publishingRef 진행 중에는 스킵 — togglePublished/syncedUpsert가 끝나기 전에
    //   동기화하면 DB의 stale 상태(racing UPDATE/UPSERT 사이)가 local을 덮어쓸 수 있다.
    const onVisible = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      if (publishingRef.current) return;
      void syncOnce();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, []);

  // ============================================================
  // 변경 함수 — localStorage 즉시 + DB 백그라운드 push
  // ============================================================

  const syncedUpsert = useCallback(
    (entry: LineupEntry): LineupEntry[] => {
      const next = localUpsert(entry); // localStorage 즉시
      setState((s) => ({ ...s, entries: next }));
      const userId = state.userId;
      if (userId) {
        // DB write 중에는 publishingRef를 잠깐 set → visibilitychange의 동기화가 race 못 들어오게.
        publishingRef.current = true;
        void upsertLineup(clientRef.current, entry, userId)
          .then((res) => {
            if (!res.ok) {
              setState((s) => ({ ...s, status: "error", errorMessage: res.error }));
            } else {
              // DB와 local이 일치 — 다음 full sync에서 "삭제됨 판정"의 기준점 갱신.
              writeLastSyncedAt(userId, new Date().toISOString());
              setState((s) => (s.status === "error" ? s : { ...s, status: "synced" }));
            }
          })
          .finally(() => {
            publishingRef.current = false;
          });
      }
      return next;
    },
    [state.userId]
  );

  const syncedDelete = useCallback(
    (
      entryId: string,
      opts?: {
        onSyncResult?: (res: { ok: boolean; error?: string }) => void;
        // true 면 하드 삭제 대신 은퇴(보관). 전적 있는 팀에 사용 — 전적/스냅샷 보존.
        archive?: boolean;
      }
    ): LineupEntry[] => {
      // 로컬 활성 목록에서는 둘 다 제거. DB만 삭제 vs 은퇴로 분기.
      const next = localDelete(entryId);
      setState((s) => ({ ...s, entries: next }));

      // state.userId 는 callback 생성 시점의 closure 값이라 stale 일 수 있다.
      // 호출 시점에 supabase 의 최신 세션을 직접 조회해서 정확한 userId 확보.
      // getSession 은 캐시된 값을 반환하므로 네트워크 호출 없음 (빠름).
      void (async () => {
        let resolved = false;
        const timeoutMs = 10000;
        const timer = (typeof window !== "undefined" ? window : globalThis).setTimeout(() => {
          if (resolved) return;
          resolved = true;
          const msg = "응답이 늦어요. 네트워크 상태를 확인해 주세요.";
          setState((s) => ({ ...s, status: "error", errorMessage: msg }));
          opts?.onSyncResult?.({ ok: false, error: msg });
        }, timeoutMs);

        try {
          const { data: { session } } = await clientRef.current.auth.getSession();
          const liveUserId = session?.user?.id ?? null;

          if (!liveUserId) {
            // 정말로 세션 없음 — 비로그인 상태. opts 콜백으로 명시.
            clearTimeout(timer);
            resolved = true;
            opts?.onSyncResult?.({ ok: false, error: "offline" });
            return;
          }

          const res = opts?.archive
            ? await archiveLineupByEntryId(clientRef.current, entryId, liveUserId)
            : await deleteLineupByEntryId(clientRef.current, entryId, liveUserId);
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          if (!res.ok) {
            setState((s) => ({ ...s, status: "error", errorMessage: res.error }));
          } else {
            writeLastSyncedAt(liveUserId, new Date().toISOString());
            setState((s) => (s.status === "error" ? s : { ...s, status: "synced" }));
          }
          opts?.onSyncResult?.(res);
        } catch (err) {
          // 네트워크 끊김, getSession 실패 등 — promise reject 모두 잡음.
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          const msg = (err as Error)?.message ?? "네트워크 연결을 확인해 주세요.";
          setState((s) => ({ ...s, status: "error", errorMessage: msg }));
          opts?.onSyncResult?.({ ok: false, error: msg });
        }
      })();

      return next;
    },
    []  // clientRef 는 ref 라 안 바뀜. state.userId 의존 제거 → stale closure 없음.
  );

  const syncedRename = useCallback(
    (entryId: string, name: string): LineupEntry[] => {
      const next = localRename(entryId, name);
      setState((s) => ({ ...s, entries: next }));
      const userId = state.userId;
      const updated = next.find((e) => e.entryId === entryId);
      if (userId && updated) {
        void upsertLineup(clientRef.current, updated, userId).then((res) => {
          if (!res.ok) {
            setState((s) => ({ ...s, status: "error", errorMessage: res.error }));
          } else {
            writeLastSyncedAt(userId, new Date().toISOString());
            setState((s) => (s.status === "error" ? s : { ...s, status: "synced" }));
          }
        });
      }
      return next;
    },
    [state.userId]
  );

  // 외부에서 entries를 직접 setEntries(newArray) 형태로 통째 교체하는 케이스도 지원 —
  // 단, DB 동기화 의도 명확치 않으므로 localStorage만 갱신 + entries 반영.
  const replaceEntries = useCallback((next: LineupEntry[]) => {
    saveLineupEntries(next);
    setState((s) => ({ ...s, entries: next }));
  }, []);

  // 미완성 라인업(타선 9명 미만)은 DB로 push하지 않음. localStorage만 갱신.
  // 사용자가 9명 채워 완성 상태가 되면 syncedUpsert로 commit.
  const localUpsertEntry = useCallback((entry: LineupEntry) => {
    const next = localUpsert(entry);
    setState((s) => ({ ...s, entries: next }));
    return next;
  }, []);

  // 공개 풀 토글 — 로그인 + 9명 완성된 라인업에서만 호출 (UI에서 강제).
  // - 공개 ON: lineup_hash 계산 → publishLineup (중복 차단)
  // - 공개 OFF: unpublishLineup (전적 보존 + lineup_hash null) — 팀 슬롯 모델
  const togglePublished = useCallback(
    async (entryId: string, nextPublished: boolean): Promise<{ ok: boolean; error?: string }> => {
      let userId = state.userId;
      if (!userId) {
        // 공개(등록)는 서버 신원이 필요한 "행동" → 세션 없으면 이 시점에 익명 계정 lazy 생성.
        // 비공개 전환은 공개된 적 있어야 가능 → 세션 없으면 만들 것도 없으니 조회만.
        userId = nextPublished
          ? await ensureAnonymousClient(clientRef.current)
          : (await clientRef.current.auth.getUser()).data.user?.id ?? null;
        if (userId) {
          setState((s) => ({ ...s, userId, status: s.status === "local-only" ? "synced" : s.status }));
          writeLastSyncedUserId(userId);
        }
      }
      if (!userId) {
        return nextPublished
          ? { ok: false, error: "공개 처리에 실패했어요. 잠시 후 다시 시도해 주세요." }
          : { ok: true };
      }
      // ⚠️ state.entries 는 React 배치 때문에 직전 syncedUpsert 결과가 아직 반영 안 됐을 수 있다.
      //    localStorage 는 syncedUpsert 가 동기 write 했으므로 항상 최신.
      //    공개 시 stale pitching/batting 으로 hash 계산 + DB 저장되는 race condition 차단.
      const current =
        loadLineupEntries().find((e) => e.entryId === entryId) ??
        state.entries.find((e) => e.entryId === entryId);
      if (!current) return { ok: false, error: "라인업을 찾을 수 없습니다." };

      publishingRef.current = true;
      // optimistic: localStorage + state 먼저 갱신.
      // updatedAt도 함께 새로 찍어 → 이후 sync에서 (혹시 race로) DB updated_at만 newer가 되어도
      // 차이가 크지 않도록 보호.
      const now = new Date().toISOString();
      const optimistic = { ...current, isPublished: nextPublished, updatedAt: now };
      localUpsert(optimistic);
      setState((s) => ({
        ...s,
        entries: s.entries.map((e) => (e.entryId === entryId ? optimistic : e))
      }));

      const rollback = (errMsg: string) => {
        localUpsert(current);
        setState((s) => ({
          ...s,
          entries: s.entries.map((e) => (e.entryId === entryId ? current : e)),
          status: "error",
          errorMessage: errMsg
        }));
      };

      try {
        if (nextPublished) {
          // 공개로 전환: hash 계산 + 중복 사전 체크 + publish (batting/pitching 포함 atomic)
          const hash = computeLineupHash(current.teamId, current.batting, current.pitching);
          const dup = await existsOwnerPublishedHash(clientRef.current, userId, hash, entryId);
          if (dup) {
            rollback("이미 같은 라인업을 공개했어요");
            return { ok: false, error: "이미 같은 라인업을 공개했어요" };
          }
          // entry 전체(batting/pitching/name)를 함께 atomic 저장.
          // 직전 syncedUpsert와 race가 나도 DB가 stale batting을 가질 일 없음.
          const res = await dbPublishLineup(clientRef.current, {
            entryId,
            userId,
            lineupHash: hash,
            entry: optimistic
          });
          if (!res.ok) {
            const msg = res.code === "duplicate" ? "이미 같은 라인업을 공개했어요" : res.error;
            rollback(msg);
            return { ok: false, error: msg };
          }
          // DB가 돌려준 최종 row를 localStorage에 반영 (updated_at 등 server-side 값)
          const finalEntry = rowToEntry(res.row);
          localUpsert(finalEntry);
          writeLastSyncedAt(userId, new Date().toISOString());
          setState((s) => ({
            ...s,
            entries: s.entries.map((e) => (e.entryId === entryId ? finalEntry : e)),
            status: "synced"
          }));
          return { ok: true };
        } else {
          // 출전 철회: 전적 보존 + lineup_hash null (팀 슬롯 모델 — 더 이상 리셋 안 함)
          const res = await dbUnpublishLineup(clientRef.current, { entryId, userId });
          if (!res.ok) {
            rollback(res.error);
            return { ok: false, error: res.error };
          }
          writeLastSyncedAt(userId, new Date().toISOString());
          return { ok: true };
        }
      } finally {
        publishingRef.current = false;
      }
    },
    [state.userId, state.entries]
  );

  return {
    entries: state.entries,
    status: state.status,
    userId: state.userId,
    errorMessage: state.errorMessage,
    syncedUpsert,
    syncedDelete,
    syncedRename,
    replaceEntries,
    localUpsertEntry,
    togglePublished
  };
}
