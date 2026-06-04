"use client";

// 공개 라인업 도전 흐름 공용 컴포넌트.
// opponentLineupId(공개 라인업 row id)와 함께 마운트하면,
// RegisteredLineupList의 "도전 시작" 확인 모달과 동일한 UI/UX로
// 본인 라인업 picker + 시작 버튼을 노출한다.
//
// 동작 순서:
// 1) 로그인 확인 — 비로그인/익명이면 로그인 게이트 모달
// 2) 본인 공개 라인업 존재 확인 — 없으면 공개 라인업 필요 게이트 모달
// 3) opponentLineupId로 상대 row fetch → "도전 시작" 모달 노출
// 4) "도전 시작" 클릭 시 RegisteredLineupList.startChallenge 로직 그대로 실행

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LogIn, Swords } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { ModalShell } from "@/components/common/ModalShell";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchLineupStatsBulk,
  fetchPublishedLineupsByIds,
  listMyLineups,
  type LineupStats,
  type PublishedLineupRow
} from "@/lib/supabase/query-parts/bpLineups";
import { loadLineupEntries } from "@/lib/storage/lineupEntries";
import type { LineupEntry } from "@/lib/types/lineup";
import { getRoster } from "@/lib/rosters";
import { fillMissingPitcherSlots } from "@/lib/sim/autoPitcherLineup";
import { buildSimTeamInput } from "@/lib/sim/lineupAdapter";
import { buildStatsDirectoryWithRecentForm } from "@/lib/sim/statsLoaderWithRecent";
import { generateSeed, saveMatchSession } from "@/lib/sim/matchSession";

type Props = {
  opponentLineupId: string | null;
  onClose: () => void;
};

function formatOwnerLabel(row: PublishedLineupRow): string {
  return row.owner_display_name?.trim() || row.owner_nickname?.trim() || "익명";
}

type Stage = "idle" | "loading" | "login-gate" | "need-publish-gate" | "ready" | "error";

export function PublicLineupChallenge({ opponentLineupId, onClose }: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [userId, setUserId] = useState<string | null>(null);
  const [opponent, setOpponent] = useState<PublishedLineupRow | null>(null);
  const [myPublishedEntries, setMyPublishedEntries] = useState<LineupEntry[]>([]);
  const [myEntryId, setMyEntryId] = useState<string | null>(null);
  const [myStatsByEntryId, setMyStatsByEntryId] = useState<Record<string, LineupStats>>({});
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // opponentLineupId 변경 시 상태 재설정 + 데이터 로드.
  useEffect(() => {
    if (!opponentLineupId) {
      // 닫힘 — 내부 상태 클리어
      setStage("idle");
      setOpponent(null);
      setError(null);
      setStarting(false);
      return;
    }

    let cancelled = false;
    setStage("loading");
    setError(null);

    void (async () => {
      const client = createSupabaseBrowserClient();
      const { data: authData } = await client.auth.getUser();
      const uid = authData.user?.id ?? null;
      if (cancelled) return;
      setUserId(uid);

      if (!uid) {
        setStage("login-gate");
        return;
      }

      // 본인의 공개 라인업 (9명 + isPublished)
      const allLocal = loadLineupEntries();
      const myPublished = allLocal.filter(
        (e) => e.batting.slots.length === 9 && e.isPublished === true
      );
      if (cancelled) return;
      setMyPublishedEntries(myPublished);
      if (myPublished.length === 0) {
        setStage("need-publish-gate");
        return;
      }
      setMyEntryId((prev) => prev ?? myPublished[0].entryId);

      // 본인 공개 라인업 전적 — picker 라벨용 (RegisteredLineupList와 동일 패턴)
      try {
        const myLineupsRes = await listMyLineups(client, uid);
        if (!cancelled && myLineupsRes.ok) {
          const idByEntry: Record<string, string> = {};
          for (const row of myLineupsRes.rows) {
            if (row.is_published) idByEntry[row.entry_id] = row.id;
          }
          const ids = Object.values(idByEntry);
          if (ids.length > 0) {
            const statsByLineupId = await fetchLineupStatsBulk(client, ids);
            if (cancelled) return;
            const statsByEntry: Record<string, LineupStats> = {};
            for (const [entryId, lineupId] of Object.entries(idByEntry)) {
              const s = statsByLineupId[lineupId];
              if (s) statsByEntry[entryId] = s;
            }
            setMyStatsByEntryId(statsByEntry);
          }
        }
      } catch {
        // stats fetch 실패는 picker 라벨에만 영향 → 무시
      }

      // opponent row fetch
      const fetched = await fetchPublishedLineupsByIds(client, [opponentLineupId]);
      if (cancelled) return;
      if (!fetched.ok || fetched.rows.length === 0) {
        setError("상대 라인업을 불러오지 못했어요.");
        setStage("error");
        return;
      }
      setOpponent(fetched.rows[0]);
      setStage("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [opponentLineupId]);

  const myEntry = useMemo(
    () => myPublishedEntries.find((e) => e.entryId === myEntryId) ?? null,
    [myPublishedEntries, myEntryId]
  );

  const startChallenge = useCallback(async () => {
    if (!opponent || !myEntry || starting) return;
    if (!userId) {
      setStage("login-gate");
      return;
    }
    setStarting(true);
    setError(null);

    const opponentValidIds = new Set(getRoster(opponent.team_id).map((p) => p.id));
    const myValidIds = new Set(getRoster(myEntry.teamId).map((p) => p.id));
    const opponentPitching = fillMissingPitcherSlots(
      opponent.team_id,
      opponent.pitching?.slots ?? [],
      opponentValidIds
    );
    const myPitching = fillMissingPitcherSlots(
      myEntry.teamId,
      myEntry.pitching?.slots ?? [],
      myValidIds
    );
    if (!opponentPitching || !myPitching) {
      setStarting(false);
      setError("투수 라인업 자동 보강에 실패했습니다.");
      return;
    }

    const client = createSupabaseBrowserClient();
    const stats = await buildStatsDirectoryWithRecentForm(client, [myEntry.teamId, opponent.team_id]);
    const mine = buildSimTeamInput(myEntry.teamId, myEntry.batting, myPitching, stats, myEntry.name);
    if (!mine.ok) {
      setStarting(false);
      setError(`내 라인업 변환 실패 (${mine.issues.map((i) => i.kind).join(", ")})`);
      return;
    }
    const opp = buildSimTeamInput(
      opponent.team_id,
      opponent.batting,
      opponentPitching,
      stats,
      opponent.name
    );
    if (!opp.ok) {
      setStarting(false);
      setError(`상대 라인업 변환 실패 (${opp.issues.map((i) => i.kind).join(", ")})`);
      return;
    }

    // 본인 공개 라인업의 bp_lineups.id lookup
    const myRow = await client
      .from("bp_lineups")
      .select("id")
      .eq("owner_user_id", userId)
      .eq("entry_id", myEntry.entryId)
      .maybeSingle();
    const myLineupId = (myRow.data as { id: string } | null)?.id ?? null;

    const seed = generateSeed();
    saveMatchSession({
      myTeamId: myEntry.teamId,
      opponentTeamId: opponent.team_id,
      seed,
      input: { home: mine.team, away: opp.team, context: {} },
      startedAt: new Date().toISOString(),
      source: "public",
      userSide: "home",
      myLineupId: myLineupId ?? undefined,
      opponentLineupId: opponent.id,
      opponentNickname: formatOwnerLabel(opponent)
    });
    router.push("/stadium/play");
  }, [opponent, myEntry, starting, userId, router]);

  if (!opponentLineupId) return null;

  // 로그인 게이트
  if (stage === "login-gate") {
    return (
      <ModalShell
        open
        title="로그인이 필요해요"
        onClose={onClose}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">
            공개 라인업과 대결하려면 로그인이 필요해요.<br />
            로그인하면 내 라인업도 공개해서 전적을 쌓을 수 있어요.
          </p>
          <div className="lineup-confirm-actions">
            <button type="button" className="lineup-confirm-cancel" onClick={onClose}>
              나중에
            </button>
            <Link href="/login" className="lineup-confirm-primary" prefetch>
              <LogIn size={14} />
              로그인
            </Link>
          </div>
        </div>
      </ModalShell>
    );
  }

  // 공개 라인업 필요 게이트
  if (stage === "need-publish-gate") {
    return (
      <ModalShell
        open
        title="공개 라인업이 필요해요"
        onClose={onClose}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          <p className="lineup-confirm-msg">
            다른 공개 라인업과 도전하려면 본인도 공개 라인업이 있어야 해요.<br />
            라인업 짜기에서 9명을 채운 뒤 &lsquo;공개하기&rsquo;를 눌러주세요.
          </p>
          <div className="lineup-confirm-actions">
            <button type="button" className="lineup-confirm-cancel" onClick={onClose}>
              닫기
            </button>
            <Link href="/play" className="lineup-confirm-primary" prefetch>
              라인업 짜기
            </Link>
          </div>
        </div>
      </ModalShell>
    );
  }

  // 데이터 로딩 / 에러
  if (stage === "loading" || stage === "error") {
    return (
      <ModalShell
        open
        title="도전 시작"
        onClose={onClose}
        panelClassName="lineup-confirm-modal-panel challenge-start-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-confirm-body">
          {stage === "loading" ? (
            <p className="lineup-confirm-msg">불러오는 중...</p>
          ) : (
            <p className="lineup-confirm-msg" role="alert">
              {error ?? "오류가 발생했어요."}
            </p>
          )}
        </div>
      </ModalShell>
    );
  }

  // ready — 도전 시작 모달
  return (
    <ModalShell
      open
      title="도전 시작"
      onClose={onClose}
      panelClassName="lineup-confirm-modal-panel challenge-start-modal-panel"
      closeOnBackdrop
    >
      <div className="lineup-confirm-body">
        {opponent ? (
          <>
            <div className="stadium-enter-vs">
              <div className="stadium-enter-team">
                <span className="stadium-enter-team-label">{formatOwnerLabel(opponent)}</span>
                <TeamBadge teamId={opponent.team_id} size="lg" />
                <strong>{opponent.name}</strong>
              </div>
              <span className="stadium-enter-vs-label">VS</span>
              <div className="stadium-enter-team">
                <span className="stadium-enter-team-label">내 팀</span>
                {myEntry ? (
                  <>
                    <TeamBadge teamId={myEntry.teamId} size="lg" />
                    <strong>{myEntry.name}</strong>
                  </>
                ) : (
                  <span className="stadium-enter-empty">공개 라인업이 없음</span>
                )}
              </div>
            </div>

            {myPublishedEntries.length > 1 ? (
              <div className="stadium-discover-my-picker">
                <span className="stadium-discover-my-picker-label">내 공개 라인업 선택</span>
                <div className="stadium-discover-my-picker-list">
                  {myPublishedEntries.map((entry) => {
                    const s = myStatsByEntryId[entry.entryId];
                    const recordTxt =
                      s && s.matches > 0 ? ` (${s.wins}승 ${s.losses}패)` : "";
                    return (
                      <button
                        key={entry.entryId}
                        type="button"
                        className={`stadium-discover-my-pick ${entry.entryId === myEntryId ? "is-active" : ""}`}
                        onClick={() => setMyEntryId(entry.entryId)}
                      >
                        <TeamBadge teamId={entry.teamId} size="sm" />
                        <span>
                          {entry.name}
                          {recordTxt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="lineup-confirm-msg" role="alert">
                {error}
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
  );
}
