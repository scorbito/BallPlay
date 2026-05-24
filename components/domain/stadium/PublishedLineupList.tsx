"use client";

// 공개 라인업 풀 목록 + 도전 모달. Lobby와 Discover 모두에서 사용.
//   - Lobby: maxItems=6, 메인 영역
//   - Discover: maxItems=50, 풀 페이지

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, List, LogIn, RefreshCw, Swords } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { ModalShell } from "@/components/common/ModalShell";
import { LineupDetailModal } from "./LineupDetailModal";
import { getTeam } from "@/lib/constants/teams";
import type { SimTeamInput } from "@/lib/sim/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  listPublishedLineups,
  rowToEntry,
  type PublishedLineupRow
} from "@/lib/supabase/query-parts/bpLineups";
import { loadLineupEntries } from "@/lib/storage/lineupEntries";
import { PITCHER_SLOTS_COUNT, type LineupEntry, type SavedPitcherLineup } from "@/lib/types/lineup";
import { buildSimTeamInput } from "@/lib/sim/lineupAdapter";
import { buildStatsDirectory, getTeamStats } from "@/lib/sim/statsLoader";
import { generateSeed, saveMatchSession } from "@/lib/sim/matchSession";

function autoFillPitcherLineup(teamId: string): SavedPitcherLineup | null {
  const stats = getTeamStats(teamId);
  if (stats.pitchers.length < 1) return null;
  const sorted = [...stats.pitchers].sort((a, b) => b.staminaPitches - a.staminaPitches);
  const slots: (string | null)[] = Array.from({ length: PITCHER_SLOTS_COUNT }, () => null);
  for (let i = 0; i < PITCHER_SLOTS_COUNT && i < sorted.length; i++) {
    slots[i] = sorted[i].playerId;
  }
  return { teamId, slots, updatedAt: new Date().toISOString() };
}

function formatOpponentLabel(row: PublishedLineupRow): string {
  return row.owner_display_name?.trim() || row.owner_nickname?.trim() || "익명 도전자";
}

function formatRelativeDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diffMs = Date.now() - t;
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDay <= 0) return "오늘";
  if (diffDay === 1) return "어제";
  if (diffDay < 7) return `${diffDay}일 전`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}주 전`;
  return `${Math.floor(diffDay / 30)}달 전`;
}

type Props = {
  maxItems?: number;
  /** Lobby용 — 도전 모달 안 띄우고 클릭 시 /stadium/discover로 보냄 (선택). 기본 false. */
  redirectOnClick?: boolean;
  /** 헤더 (제목/새로고침) 렌더 여부. 기본 true. */
  showHeader?: boolean;
};

export function PublishedLineupList({
  maxItems = 50,
  redirectOnClick = false,
  showHeader = true
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<PublishedLineupRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);          // 정식 로그인 — 게이트용
  const [ownerIdForExclude, setOwnerIdForExclude] = useState<string | null>(null); // 익명 포함 — 본인 제외용
  const [myEntries, setMyEntries] = useState<LineupEntry[]>([]);

  const [selectedOpponent, setSelectedOpponent] = useState<PublishedLineupRow | null>(null);
  const [myEntryId, setMyEntryId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [loginGateOpen, setLoginGateOpen] = useState(false);
  const [previewTeam, setPreviewTeam] = useState<SimTeamInput | null>(null);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    void (async () => {
      const { data: authData } = await client.auth.getUser();
      // 익명 로그인 사용자는 정식 계정 연동 안 한 상태 — 비로그인 취급 (기획 §10)
      const user = authData.user;
      const realUid = user && !user.is_anonymous ? user.id : null;
      const anyUid = user?.id ?? null; // 익명도 포함 — 본인 row 노출 방지용
      setUserId(realUid);
      setOwnerIdForExclude(anyUid);

      // 본인 라인업 제외 — owner_user_id 매칭만으론 같은 기기에서 다른 계정/익명/
      // 비로그인으로 볼 때 본인 인식이 깨짐. localStorage entryId 목록도 함께 전달해
      // "같은 기기에서 만든 라인업은 본인 거"로 일관되게 제외.
      const allLocalEntries = loadLineupEntries();
      const localEntryIds = allLocalEntries.map((e) => e.entryId);
      const ready = allLocalEntries.filter((e) => e.batting.slots.length === 9);
      setMyEntries(ready);
      if (ready.length > 0) setMyEntryId(ready[0].entryId);

      setLoading(true);
      const res = await listPublishedLineups(client, anyUid, localEntryIds);
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRows(res.rows.slice(0, maxItems));
    })();
  }, [maxItems]);

  const refresh = useCallback(async () => {
    const client = createSupabaseBrowserClient();
    setLoading(true);
    setError(null);
    const localEntryIds = loadLineupEntries().map((e) => e.entryId);
    const res = await listPublishedLineups(client, ownerIdForExclude, localEntryIds);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRows(res.rows.slice(0, maxItems));
  }, [ownerIdForExclude, maxItems]);

  // 모바일: 백그라운드 → 포그라운드 복귀 시 세션 갱신 + 공개 라인업 재조회.
  // 백그라운드 동안 토큰이 만료되어 401로 빈 목록이 되는 케이스 방지.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const client = createSupabaseBrowserClient();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void (async () => {
        try {
          await client.auth.refreshSession();
        } catch {
          // ignore — refresh 다음 호출
        }
        void refresh();
      })();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const myEntry = useMemo(
    () => myEntries.find((e) => e.entryId === myEntryId) ?? null,
    [myEntries, myEntryId]
  );

  // 공개 라인업 미리보기 — row를 SimTeamInput으로 변환해 모달에 표시
  const openLineupPreview = (row: PublishedLineupRow) => {
    const entry = rowToEntry(row);
    const pitching = entry.pitching ?? autoFillPitcherLineup(entry.teamId);
    if (!pitching) return;
    const stats = buildStatsDirectory([entry.teamId]);
    const built = buildSimTeamInput(entry.teamId, entry.batting, pitching, stats, entry.name);
    if (!built.ok) return;
    setPreviewTeam(built.team);
  };

  const startChallenge = useCallback(() => {
    if (!selectedOpponent || !myEntry || starting) return;
    // 안전장치 — 모달이 어쩌다 열렸어도 비로그인이면 시뮬 진입 막음
    if (!userId) {
      setSelectedOpponent(null);
      setLoginGateOpen(true);
      return;
    }
    setStarting(true);
    setError(null);

    const opponentEntry = rowToEntry(selectedOpponent);
    const opponentPitching = opponentEntry.pitching ?? autoFillPitcherLineup(opponentEntry.teamId);
    const myPitching = myEntry.pitching ?? autoFillPitcherLineup(myEntry.teamId);

    if (!opponentPitching || !myPitching) {
      setStarting(false);
      setError("투수 라인업 자동 보강에 실패했습니다.");
      return;
    }

    const stats = buildStatsDirectory([myEntry.teamId, opponentEntry.teamId]);
    const mine = buildSimTeamInput(myEntry.teamId, myEntry.batting, myPitching, stats, myEntry.name);
    if (!mine.ok) {
      setStarting(false);
      setError(`내 라인업 변환 실패 (${mine.issues.map((i) => i.kind).join(", ")})`);
      return;
    }
    const opp = buildSimTeamInput(
      opponentEntry.teamId,
      opponentEntry.batting,
      opponentPitching,
      stats,
      opponentEntry.name
    );
    if (!opp.ok) {
      setStarting(false);
      setError(`상대 라인업 변환 실패 (${opp.issues.map((i) => i.kind).join(", ")})`);
      return;
    }

    const seed = generateSeed();
    saveMatchSession({
      myTeamId: myEntry.teamId,
      opponentTeamId: opponentEntry.teamId,
      seed,
      input: { home: mine.team, away: opp.team, context: {} },
      startedAt: new Date().toISOString(),
      source: "public",
      userSide: "home"
    });
    router.push("/stadium/play");
  }, [selectedOpponent, myEntry, starting, router, userId]);

  if (loading && rows === null) {
    return <p className="stadium-loading">불러오는 중...</p>;
  }
  if (rows === null) {
    return error ? <p className="stadium-error">{error}</p> : null;
  }
  if (rows.length === 0) {
    return (
      <section className="stadium-discover-empty">
        <strong>아직 공개된 라인업이 없어요</strong>
        <p>본인 라인업을 빌더에서 &lsquo;공개&rsquo;로 바꾸면 다른 사람이 도전할 수 있어요.</p>
      </section>
    );
  }

  return (
    <>
      {showHeader ? (
        <div className="stadium-discover-actions">
          <button type="button" className="stadium-discover-refresh" onClick={refresh} disabled={loading}>
            <RefreshCw size={12} className={loading ? "stadium-discover-spin" : ""} />
            새로고침
          </button>
        </div>
      ) : null}

      {error ? <p className="stadium-error">{error}</p> : null}

      <section className="stadium-discover-list">
        {rows.map((row) => {
          const team = getTeam(row.team_id);
          return (
            <div key={row.id} className="stadium-discover-card">
              <TeamBadge teamId={row.team_id} size="md" />
              <div className="stadium-discover-card-body">
                <strong>{row.name}</strong>
                <span>
                  {formatOpponentLabel(row)} · {team.shortName} · {formatRelativeDate(row.updated_at)}
                </span>
              </div>
              <div className="stadium-lobby-card-actions">
                <button
                  type="button"
                  className="stadium-lobby-card-btn stadium-lobby-card-btn-secondary"
                  onClick={() => openLineupPreview(row)}
                  aria-label={`${row.name} 라인업 보기`}
                >
                  <List size={14} />
                  <span>라인업</span>
                </button>
                <button
                  type="button"
                  className="stadium-lobby-card-btn stadium-lobby-card-btn-primary"
                  onClick={() => {
                    if (!userId) {
                      setLoginGateOpen(true);
                      return;
                    }
                    if (redirectOnClick) {
                      router.push("/stadium/discover");
                    } else {
                      setSelectedOpponent(row);
                    }
                  }}
                  aria-label={`${row.name}에 도전`}
                >
                  <Swords size={14} />
                  <span>도전</span>
                </button>
              </div>
            </div>
          );
        })}
      </section>

      <LineupDetailModal
        open={previewTeam !== null}
        team={previewTeam}
        onClose={() => setPreviewTeam(null)}
      />

      <ModalShell
        open={selectedOpponent !== null}
        title="도전 시작"
        onClose={() => setSelectedOpponent(null)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          {selectedOpponent ? (
            <>
              <div className="stadium-discover-vs">
                <div className="stadium-discover-vs-team">
                  <span className="stadium-discover-vs-label">상대</span>
                  <TeamBadge teamId={selectedOpponent.team_id} size="lg" />
                  <strong>{selectedOpponent.name}</strong>
                  <span className="stadium-discover-vs-owner">{formatOpponentLabel(selectedOpponent)}</span>
                </div>
                <span className="stadium-discover-vs-divider">VS</span>
                <div className="stadium-discover-vs-team">
                  <span className="stadium-discover-vs-label">내 팀</span>
                  {myEntry ? (
                    <>
                      <TeamBadge teamId={myEntry.teamId} size="lg" />
                      <strong>{myEntry.name}</strong>
                    </>
                  ) : (
                    <span className="stadium-enter-empty">완성된 라인업이 없음</span>
                  )}
                </div>
              </div>

              {myEntries.length > 1 ? (
                <div className="stadium-discover-my-picker">
                  <span className="stadium-discover-my-picker-label">내 라인업 선택</span>
                  <div className="stadium-discover-my-picker-list">
                    {myEntries.map((entry) => (
                      <button
                        key={entry.entryId}
                        type="button"
                        className={`stadium-discover-my-pick ${entry.entryId === myEntryId ? "is-active" : ""}`}
                        onClick={() => setMyEntryId(entry.entryId)}
                      >
                        <TeamBadge teamId={entry.teamId} size="sm" />
                        <span>{entry.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {myEntries.length === 0 ? (
                <p className="stadium-error">
                  9명을 채운 라인업이 없어요. 라인업 짜기에서 먼저 완성해주세요.
                </p>
              ) : null}

              <button
                type="button"
                className="stadium-cta-primary"
                disabled={!myEntry || starting}
                onClick={startChallenge}
              >
                <Swords size={16} />
                <span>{starting ? "시작 중..." : "도전 시작"}</span>
                <ArrowRight size={16} />
              </button>
            </>
          ) : null}
        </div>
      </ModalShell>

      {/* 비로그인 게이트 모달 — 공개 라인업 도전은 로그인 사용자만 가능 */}
      <ModalShell
        open={loginGateOpen}
        title="로그인이 필요해요"
        onClose={() => setLoginGateOpen(false)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">
            공개 라인업과 대결하려면 로그인이 필요해요.<br />
            로그인하면 내 라인업도 다른 사람한테 공개할 수 있어요.
          </p>
          <div className="lineup-confirm-actions">
            <button
              type="button"
              className="lineup-confirm-cancel"
              onClick={() => setLoginGateOpen(false)}
            >
              나중에
            </button>
            <Link href="/login" className="lineup-confirm-primary" prefetch>
              <LogIn size={14} />
              로그인
            </Link>
          </div>
        </div>
      </ModalShell>
    </>
  );
}
