"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Check, Copy, Loader2, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { LineupDetailModal } from "./LineupDetailModal";
import { getTeam } from "@/lib/constants/teams";
import type { SimTeamInput } from "@/lib/sim/types";
import type { LineupEntry } from "@/lib/types/lineup";
import { loadLineupEntries } from "@/lib/storage/lineupEntries";
import { buildSharedTeamFromEntry, restoreSimTeamFromShared } from "@/lib/sim/matchShare";
import { getOrCreateGuestId } from "@/lib/sim/guestId";
import { saveMatchSession } from "@/lib/sim/matchSession";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getMatchByInviteCode,
  joinMatch,
  setMatchStart,
  subscribeToMatch,
  type BpMatchRow
} from "@/lib/supabase/query-parts/bpMatches";
import { listMyLineups } from "@/lib/supabase/query-parts/bpLineups";

// 초대 링크 진입점.
//   - 매치 row 조회 (invite_code)
//   - 내 정체성 (auth.uid OR guestId) 으로 호스트/참가자/제3자 분기
//   - 호스트: 초대 URL 복사 + 친구 join 대기 + Realtime UPDATE 구독
//   - 참가자(빈 슬롯 측): 라인업 선택 → joinMatch
//   - 양쪽 ready 시: Phase C에서 카운트다운/start_at 셋업 (현재는 안내만)

type Identity =
  | { role: "host"; side: "home" | "away" }
  | { role: "joinable" }              // 빈 슬롯 있는 상태 — 참여 가능
  | { role: "spectator" };            // 양쪽 다 차있는데 나는 둘 다 아님

function identifyMe(
  row: BpMatchRow,
  guestId: string,
  uid: string | null
): Identity {
  const matchesSide = (side: "home" | "away"): boolean => {
    const owner = side === "home" ? row.home_owner_id : row.away_owner_id;
    const guest = side === "home" ? row.home_guest_id : row.away_guest_id;
    if (uid && owner === uid) return true;
    if (guest === guestId) return true;
    return false;
  };
  if (matchesSide("home")) return { role: "host", side: "home" };
  if (matchesSide("away")) return { role: "host", side: "away" };
  const homeEmpty = !row.home_lineup_snapshot;
  const awayEmpty = !row.away_lineup_snapshot;
  if (homeEmpty || awayEmpty) return { role: "joinable" };
  return { role: "spectator" };
}

export function LiveMatchScreen({ inviteCode }: { inviteCode: string }) {
  const router = useRouter();
  const clientRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  if (!clientRef.current) clientRef.current = createSupabaseBrowserClient();
  const client = clientRef.current;

  const [row, setRow] = useState<BpMatchRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [guestId, setGuestId] = useState<string>("");

  // 참가용 라인업 선택 상태
  const [entries, setEntries] = useState<LineupEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  // entry_id → bp_lineups.id (공개 등록 카드만). 정식 매치 판정용.
  const [publishedLineupIdByEntry, setPublishedLineupIdByEntry] = useState<Record<string, string>>({});

  // 초대 URL 복사
  const [copied, setCopied] = useState(false);

  // 라인업 상세 미리보기 모달
  const [previewTeam, setPreviewTeam] = useState<SimTeamInput | null>(null);

  // ── 초기 로드 ─────────────────────────────────────────────
  useEffect(() => {
    setGuestId(getOrCreateGuestId());
    const ready = loadLineupEntries().filter((e) => e.batting.slots.length === 9);
    setEntries(ready);
    if (ready.length > 0) setSelectedEntryId(ready[0].entryId);

    let cancelled = false;
    (async () => {
      const {
        data: { user }
      } = await client.auth.getUser();
      if (cancelled) return;
      setUid(user?.id ?? null);

      // 공개 라인업 매핑 (entry_id → bp_lineups.id) 로드
      if (user?.id) {
        const lineupRes = await listMyLineups(client, user.id);
        if (!cancelled && lineupRes.ok) {
          const map: Record<string, string> = {};
          for (const r of lineupRes.rows) {
            if (r.is_published) map[r.entry_id] = r.id;
          }
          setPublishedLineupIdByEntry(map);
        }
      }

      const data = await getMatchByInviteCode(client, inviteCode);
      if (cancelled) return;
      if (!data) {
        setError("매치를 찾을 수 없습니다. 링크가 만료됐을 수 있어요.");
        setLoading(false);
        return;
      }
      setRow(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [client, inviteCode]);

  // ── Realtime 구독 ─────────────────────────────────────────
  useEffect(() => {
    if (!row) return;
    const unsubscribe = subscribeToMatch(client, row.id, (next) => {
      setRow(next);
    });
    return unsubscribe;
  }, [client, row?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ready → 자동 setMatchStart (홈 슬롯 호스트가 호출. 단일 책임으로 race 회피) ──
  const startTriggeredRef = useRef(false);
  useEffect(() => {
    if (!row) return;
    if (row.status !== "ready") return;
    if (startTriggeredRef.current) return;
    // 본인이 홈 슬롯의 owner/guest인 경우만 (= 매치 생성자)
    const isHomeOwner =
      (uid && row.home_owner_id === uid) || row.home_guest_id === guestId;
    if (!isHomeOwner) return;
    startTriggeredRef.current = true;
    void setMatchStart(client, row.id, 3).then((res) => {
      if (!res.ok) {
        setError(res.error);
        startTriggeredRef.current = false;
      }
    });
  }, [row, uid, guestId, client]);

  // ── playing → SimGameInput 복원 + matchSession 저장 + /stadium/play 이동 ──
  const redirectedRef = useRef(false);
  useEffect(() => {
    if (!row) return;
    if (row.status !== "playing") return;
    if (!row.home_lineup_snapshot || !row.away_lineup_snapshot) return;
    if (!row.start_at) return;
    if (redirectedRef.current) return;
    redirectedRef.current = true;

    void (async () => {
      const home = restoreSimTeamFromShared(row.home_lineup_snapshot!);
      const away = restoreSimTeamFromShared(row.away_lineup_snapshot!);
      if (!home.ok || !away.ok) {
        setError(`라인업 복원 실패: ${home.ok ? "" : `홈 ${home.reason}`} ${away.ok ? "" : `원정 ${away.reason}`}`);
        redirectedRef.current = false;
        return;
      }

      const isHome =
        (uid && row.home_owner_id === uid) || row.home_guest_id === guestId;

      const oppOwnerId = isHome ? row.away_owner_id : row.home_owner_id;
      let opponentNickname: string | undefined;
      if (oppOwnerId) {
        const { data: profile } = await client
          .from("profiles")
          .select("nickname")
          .eq("id", oppOwnerId)
          .maybeSingle();
        opponentNickname = profile?.nickname?.trim() || undefined;
      }
      if (!opponentNickname) {
        const oppGuestId = isHome ? row.away_guest_id : row.home_guest_id;
        if (oppGuestId) opponentNickname = "게스트";
      }

      // 공개 라인업 ID — 본인/상대 측을 row 에서 직접 가져옴.
      // bp_matches.home_lineup_id / away_lineup_id 는 createMatch/joinMatch 시 세팅된 값.
      const myLineupId = isHome ? row.home_lineup_id : row.away_lineup_id;
      const opponentLineupId = isHome ? row.away_lineup_id : row.home_lineup_id;

      saveMatchSession({
        myTeamId: isHome ? home.team.teamId : away.team.teamId,
        opponentTeamId: isHome ? away.team.teamId : home.team.teamId,
        seed: row.seed,
        input: { home: home.team, away: away.team, context: {} },
        startedAt: new Date().toISOString(),
        source: "friend",
        userSide: isHome ? "home" : "away",
        liveMatchId: row.id,
        liveStartAt: row.start_at!,
        liveMode: row.mode ?? "live",
        myLineupId: myLineupId ?? undefined,
        opponentLineupId: opponentLineupId ?? undefined,
        opponentNickname
      });
      router.replace("/stadium/play");
    })();
  }, [row, uid, guestId, router, client]);

  const identity = useMemo<Identity | null>(() => {
    if (!row) return null;
    return identifyMe(row, guestId, uid);
  }, [row, guestId, uid]);

  const selectedEntry = useMemo(
    () => entries.find((e) => e.entryId === selectedEntryId) ?? null,
    [entries, selectedEntryId]
  );

  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/stadium/live/${inviteCode}`;
  }, [inviteCode]);

  const handleCopy = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }, [inviteUrl]);

  const handleJoin = useCallback(async () => {
    if (!row || !selectedEntry) {
      setError("출전할 라인업을 선택해주세요.");
      return;
    }
    setError(null);
    setJoining(true);

    const shared = buildSharedTeamFromEntry(selectedEntry);
    if (!shared.ok) {
      setError(shared.error);
      setJoining(false);
      return;
    }

    const joinerLineupId = publishedLineupIdByEntry[selectedEntry.entryId] ?? null;
    const result = await joinMatch(client, {
      matchId: row.id,
      ownerId: uid,
      guestId,
      team: shared.team,
      lineupId: joinerLineupId
    });
    if (!result.ok) {
      setError(result.error);
      setJoining(false);
      return;
    }
    setRow(result.row);
    setJoining(false);
  }, [row, selectedEntry, client, uid, guestId]);

  // ── 렌더 분기 ────────────────────────────────────────────
  if (loading) {
    return (
      <AppShell activeTab="stadium" title="친구와 대결" backHref="/stadium/lobby" theme="light" wide hideBottomTabs>
        <p className="stadium-loading">
          <Loader2 size={16} className="stadium-spin" /> 매치 정보를 불러오는 중...
        </p>
      </AppShell>
    );
  }

  if (error && !row) {
    return (
      <AppShell activeTab="stadium" title="친구와 대결" backHref="/stadium/lobby" theme="light" wide hideBottomTabs>
        <section className="stadium-replay-error">
          <AlertCircle size={28} />
          <strong>매치를 열 수 없어요</strong>
          <p>{error}</p>
          <Link href="/stadium/lobby" className="stadium-cta-secondary" prefetch>
            매칭풀로 돌아가기
          </Link>
        </section>
      </AppShell>
    );
  }

  if (!row || !identity) return null;

  const hostSide: "home" | "away" = row.home_lineup_snapshot ? "home" : "away";
  const hostTeam = row[`${hostSide}_team_id` as const];
  const guestTeam =
    hostSide === "home" ? row.away_team_id : row.home_team_id;
  // 사용자 지정 팀명(SharedTeam.n) 우선 — 없으면 KBO 팀명 폴백
  const hostSnapshot = hostSide === "home" ? row.home_lineup_snapshot : row.away_lineup_snapshot;
  const guestSnapshot = hostSide === "home" ? row.away_lineup_snapshot : row.home_lineup_snapshot;
  const hostLabel = hostSnapshot?.n?.trim() || (hostTeam ? getTeam(hostTeam).name : "");
  const guestLabel = guestSnapshot?.n?.trim() || (guestTeam ? getTeam(guestTeam).name : "");

  // 스냅샷 → SimTeamInput 변환 후 모달 오픈
  const openSnapshotPreview = (snapshot: typeof hostSnapshot) => {
    if (!snapshot) return;
    const restored = restoreSimTeamFromShared(snapshot);
    if (!restored.ok) return;
    setPreviewTeam(restored.team);
  };

  const bothReady = row.status === "ready" || row.status === "playing";
  const finished = row.status === "finished" || row.status === "cancelled";

  return (
    <AppShell activeTab="stadium" title="친구와 대결" backHref="/stadium/lobby" theme="light" wide hideBottomTabs>
      <section className="stadium-live">
        {/* ── 매치 VS 헤더 — 라인업 카드 클릭 시 상세 모달 ── */}
        <div className="stadium-enter-vs">
          {hostTeam && hostSnapshot ? (
            <button
              type="button"
              className="stadium-enter-team stadium-enter-team-clickable"
              onClick={() => openSnapshotPreview(hostSnapshot)}
              aria-label={`${hostLabel} 라인업 보기`}
            >
              <span className="stadium-enter-team-label">{hostSide === "home" ? "홈" : "원정"}</span>
              <TeamBadge teamId={hostTeam} size="lg" />
              <strong>{hostLabel}</strong>
            </button>
          ) : (
            <div className="stadium-enter-team">
              <span className="stadium-enter-team-label">{hostSide === "home" ? "홈" : "원정"}</span>
              <span className="stadium-enter-empty">대기</span>
            </div>
          )}
          <span className="stadium-enter-vs-label">VS</span>
          {guestTeam && guestSnapshot ? (
            <button
              type="button"
              className="stadium-enter-team stadium-enter-team-clickable"
              onClick={() => openSnapshotPreview(guestSnapshot)}
              aria-label={`${guestLabel} 라인업 보기`}
            >
              <span className="stadium-enter-team-label">{hostSide === "home" ? "원정" : "홈"}</span>
              <TeamBadge teamId={guestTeam} size="lg" />
              <strong>{guestLabel}</strong>
            </button>
          ) : (
            <div className="stadium-enter-team">
              <span className="stadium-enter-team-label">{hostSide === "home" ? "원정" : "홈"}</span>
              <span className="stadium-enter-empty">친구 대기</span>
            </div>
          )}
        </div>

        {/* ── 상태별 본문 ── */}
        {finished ? (
          <div className="stadium-live-status">
            <p>매치가 종료되었거나 취소되었습니다.</p>
            <Link href="/stadium/lobby" className="stadium-cta-secondary" prefetch>
              매칭풀로 돌아가기
            </Link>
          </div>
        ) : bothReady ? (
          <div className="stadium-live-status">
            <p className="stadium-live-status-ready">
              <Check size={16} /> 양쪽 라인업 준비 완료
            </p>
            <p className="stadium-live-status-hint">
              곧 카운트다운이 시작되고 시뮬레이션이 동시 진행됩니다. (실시간 동시 시청은 다음 단계에서 활성화)
            </p>
          </div>
        ) : identity.role === "host" ? (
          <div className="stadium-live-host">
            <p className="stadium-live-host-title">
              <Loader2 size={14} className="stadium-spin" /> 친구가 들어오기를 기다리는 중...
            </p>
            <p className="stadium-live-host-sub">
              아래 링크를 친구에게 보내주세요. 같은 디바이스에서는 시크릿 창으로 열어야 별도 사용자로 인식됩니다.
            </p>
            <div className="stadium-live-invite">
              <code className="stadium-live-invite-url">{inviteUrl}</code>
              <button
                type="button"
                className="stadium-live-copy"
                onClick={handleCopy}
                disabled={!inviteUrl}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? "복사됨" : "복사"}</span>
              </button>
            </div>
            <p className="stadium-live-invite-code">
              초대 코드: <strong>{row.invite_code}</strong>
            </p>
          </div>
        ) : identity.role === "joinable" ? (
          <div className="stadium-live-join">
            <p className="stadium-live-join-title">친구의 초대장</p>
            <p className="stadium-live-join-sub">
              내 라인업을 골라 매치에 참여하세요.
            </p>
            {entries.length > 0 ? (
              <div className="stadium-enter-picker">
                <span className="stadium-enter-picker-label">출전 라인업 선택</span>
                <div className="stadium-enter-picker-row">
                  {entries.map((entry) => {
                    const active = entry.entryId === selectedEntryId;
                    const isPublished = entry.entryId in publishedLineupIdByEntry;
                    return (
                      <button
                        key={entry.entryId}
                        type="button"
                        className={`stadium-enter-picker-item ${active ? "is-active" : ""}`}
                        onClick={() => setSelectedEntryId(entry.entryId)}
                        title={entry.name}
                      >
                        <TeamBadge teamId={entry.teamId} size="sm" />
                        <span className="stadium-enter-picker-name">{entry.name}</span>
                        {isPublished ? (
                          <span className="stadium-enter-picker-tag stadium-enter-picker-tag-published">공개 등록</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <p className="stadium-enter-picker-hint">
                  양쪽 모두 <strong>공개 등록</strong> 라인업이면 <strong>정식 매치</strong>로 기록돼요.
                </p>
                {Object.keys(publishedLineupIdByEntry).length === 0 ? (
                  <Link href="/play/lineup" className="stadium-enter-picker-cta" prefetch>
                    라인업 공개 등록하고 정식 매치로 진행 →
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="stadium-enter-empty-box">
                <p>출전 가능한 라인업이 없습니다.</p>
                <p className="stadium-enter-empty-hint">라인업 빌더에서 9명 타순을 모두 채워야 참여할 수 있어요.</p>
                <Link href="/play/lineup" className="stadium-cta-secondary" prefetch>
                  라인업 만들러 가기
                </Link>
              </div>
            )}
            {error ? <p className="stadium-error">{error}</p> : null}
            <button
              type="button"
              className="stadium-cta-primary"
              onClick={handleJoin}
              disabled={!selectedEntry || joining}
            >
              <Users size={16} />
              <span>{joining ? "참여 중..." : "매치 참여"}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <div className="stadium-live-status">
            <p>이미 두 명이 참여한 매치입니다.</p>
            <Link href="/stadium/lobby" className="stadium-cta-secondary" prefetch>
              매칭풀로 돌아가기
            </Link>
          </div>
        )}
      </section>

      <LineupDetailModal
        open={previewTeam !== null}
        team={previewTeam}
        onClose={() => setPreviewTeam(null)}
      />
    </AppShell>
  );
}
