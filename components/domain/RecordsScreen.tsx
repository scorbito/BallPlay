"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, Lock, Trophy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { AccountTierBadge } from "@/components/common/AccountTierBadge";
import { TierUpHost } from "@/components/common/TierUpHost";
import { LineupDetailModal } from "@/components/domain/stadium/LineupDetailModal";
import {
  RematchLineupModal,
  type RematchLineupOption
} from "@/components/domain/records/RematchLineupModal";
import { RecordCard } from "@/components/domain/records/RecordCard";
import { useAppState } from "@/lib/state/AppState";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  listMyRecords,
  deleteRecord,
  canReplay,
  type BpRecordRow
} from "@/lib/supabase/query-parts/bpRecords";
import { fetchLineupStatsBulk, listMyLineups, rowToEntry, type LineupStats } from "@/lib/supabase/query-parts/bpLineups";
import { formatWinRate, type UserPublicMatchRecord } from "@/lib/supabase/query-parts/bpUserRecords";
import { getTeam } from "@/lib/constants/teams";
import { SIM_ENGINE_VERSION } from "@/lib/sim/version";
import { generateSeed, saveMatchSession } from "@/lib/sim/matchSession";
import { fillMissingPitcherSlots } from "@/lib/sim/autoPitcherLineup";
import { buildSimTeamInput } from "@/lib/sim/lineupAdapter";
import { buildStatsDirectory } from "@/lib/sim/statsLoader";
import { buildStatsDirectoryWithRecentForm } from "@/lib/sim/statsLoaderWithRecent";
import type { SimTeamInput } from "@/lib/sim/types";
import { withTimeout } from "@/lib/utils/withTimeout";

type AuthState = "loading" | "loggedIn" | "loggedOut";

type LineupOption = RematchLineupOption;

type Stats = { wins: number; losses: number; draws: number };
// 특정 라인업(또는 전체)의 본인 시점 전적 집계.
// user_side가 mirror row에선 flip되어 있으므로, user_side+final_score 조합이 곧 "본인 측 결과".
function computeStats(records: BpRecordRow[], lineupId: string | null): Stats {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const r of records) {
    if (lineupId && r.home_lineup_id !== lineupId && r.away_lineup_id !== lineupId) continue;
    const home = r.final_score.home;
    const away = r.final_score.away;
    if (home === away) {
      draws += 1;
    } else if (
      (r.user_side === "home" && home > away) ||
      (r.user_side === "away" && away > home)
    ) {
      wins += 1;
    } else {
      losses += 1;
    }
  }
  return { wins, losses, draws };
}

type RecordsScreenProps = {
  /** 서버에서 계산한 누적 공개 매치 전적 — 상단 요약 카드용. */
  userRecord?: UserPublicMatchRecord;
  /** 익명 로그인 사용자 여부 — 로그인 CTA 노출 분기. */
  isAnonymous?: boolean;
};

export function RecordsScreen({
  userRecord = { wins: 0, losses: 0, total: 0, winRate: 0 },
  isAnonymous = false
}: RecordsScreenProps = {}) {
  const router = useRouter();
  const { showToast } = useAppState();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [rows, setRows] = useState<BpRecordRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // 내 라인업 목록 — 필터 chip 노출용. 본인의 bp_lineups row id ↔ 이름 매핑.
  const [myLineups, setMyLineups] = useState<LineupOption[]>([]);
  // 재대전 picker 표시용 — entry_id → 전적.
  const [myStatsByEntryId, setMyStatsByEntryId] = useState<Record<string, LineupStats>>({});
  const [filterLineupId, setFilterLineupId] = useState<string | null>(null);
  const [previewTeam, setPreviewTeam] = useState<SimTeamInput | null>(null);
  const [rematchRecord, setRematchRecord] = useState<BpRecordRow | null>(null);
  const [rematchEntryId, setRematchEntryId] = useState<string | null>(null);
  const [startingRematch, setStartingRematch] = useState(false);
  // 필터 chip 컨테이너 — PC에서 마우스 드래그로 가로 스크롤 가능하게 ref 부착.
  const filterRef = useRef<HTMLDivElement | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoadError(null);
    const client = createSupabaseBrowserClient();
    // 네트워크가 끊겼거나 Supabase fetch가 limbo에 빠지면 영원히 "불러오는 중..."에
    // 머무는 걸 방지 — 6초 안에 응답 없으면 에러 노출 + 다시 시도 가능하게
    let user: Awaited<ReturnType<typeof client.auth.getUser>>["data"]["user"];
    try {
      const res = await withTimeout(client.auth.getUser(), 6_000);
      user = res.data.user;
    } catch {
      setAuthState("loggedIn");
      setLoadError("네트워크 응답이 너무 느려요. 다시 시도해 주세요.");
      setRows([]);
      return;
    }
    if (!user) {
      setAuthState("loggedOut");
      setRows([]);
      return;
    }
    // 익명도 본인 기록 조회 — 2026-05-27부터 익명 매치 기록 저장 활성화됨
    setAuthState("loggedIn");
    let result: Awaited<ReturnType<typeof listMyRecords>>;
    try {
      result = await withTimeout(listMyRecords(client, user.id), 6_000);
    } catch {
      setLoadError("네트워크 응답이 너무 느려요. 다시 시도해 주세요.");
      setRows([]);
      return;
    }
    if (!result.ok) {
      setLoadError(result.error);
      setRows([]);
      return;
    }
    setRows(result.rows);
    // 라인업 필터용 매핑 — 실패해도 기록 표시엔 영향 없음 (필터 chip만 안 뜸).
    const linRes = await listMyLineups(client, user.id);
    if (linRes.ok) {
      const options = linRes.rows
        .map((r) => {
          const entry = rowToEntry(r);
          return {
            id: r.id,
            entryId: entry.entryId,
            name: r.name?.trim() || getTeam(r.team_id).shortName,
            teamId: r.team_id,
            entry
          };
        })
        .filter((lineup) => lineup.entry.batting.slots.length === 9);
      setMyLineups(options);

      // 재대전 picker 라벨용 전적 fetch — 실패하면 라벨에 전적 미표시 (UI 영향 X)
      const ids = options.map((o) => o.id);
      if (ids.length > 0) {
        const statsByLineupId = await fetchLineupStatsBulk(client, ids);
        const byEntry: Record<string, LineupStats> = {};
        for (const o of options) {
          const s = statsByLineupId[o.id];
          if (s) byEntry[o.entryId] = s;
        }
        setMyStatsByEntryId(byEntry);
      }
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // PC 마우스 드래그 가로 스크롤 — chip 컨테이너에 mousedown/mousemove/mouseup 부착.
  // 모바일은 native touch scroll 그대로 동작. 드래그 거리 5px 넘으면 click 무효화해 chip 오선택 방지.
  useEffect(() => {
    const el = filterRef.current;
    if (!el || myLineups.length < 2) return;

    let isDown = false;
    let startX = 0;
    let scrollStart = 0;
    let dragDist = 0;

    const onDown = (e: MouseEvent) => {
      isDown = true;
      dragDist = 0;
      startX = e.pageX;
      scrollStart = el.scrollLeft;
      el.classList.add("is-dragging");
    };
    const onMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const walk = e.pageX - startX;
      dragDist = Math.max(dragDist, Math.abs(walk));
      el.scrollLeft = scrollStart - walk;
    };
    const onUp = () => {
      isDown = false;
      el.classList.remove("is-dragging");
    };
    // 드래그 후 발생하는 click은 무효화 — chip 의도치 않은 선택 방지
    const onClickCapture = (e: MouseEvent) => {
      if (dragDist > 5) {
        e.preventDefault();
        e.stopPropagation();
        dragDist = 0;
      }
    };

    el.addEventListener("mousedown", onDown);
    el.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    el.addEventListener("click", onClickCapture, true);
    return () => {
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, [myLineups.length]);

  // 모바일: 백그라운드 → 포그라운드 복귀 시 목록 재조회.
  // refreshSession은 layout의 AuthRefreshOnVisible이 fire-and-forget(5s 타임아웃)으로 처리.
  // 여기서 await하면 iOS Safari가 refresh를 limbo 상태로 hang시킬 때 fetchRecords가
  // 영원히 실행 안 됨 → 절대 refreshSession을 await하지 말 것.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void fetchRecords();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchRecords]);

  const handleReplay = (row: BpRecordRow) => {
    const check = canReplay(row, SIM_ENGINE_VERSION);
    if (!check.ok) {
      const msg =
        check.reason === "expired"
          ? "재생 기간(7일)이 지났어요. 결과 기록만 남아 있어요."
          : check.reason === "engine_mismatch"
          ? "엔진 버전이 바뀌어 재생할 수 없어요."
          : "재생 데이터가 만료되었어요.";
      showToast(msg);
      return;
    }
    // input/result는 canReplay 통과 시 보장됨
    saveMatchSession({
      myTeamId: row.user_side === "home" ? row.home_team_id : row.away_team_id,
      opponentTeamId: row.user_side === "home" ? row.away_team_id : row.home_team_id,
      seed: row.seed,
      input: row.input!,
      result: row.result!,
      startedAt: new Date().toISOString(),
      source: row.source,
      userSide: row.user_side,
      // 재생 중인 기록 id 표시 — 결과 화면이 자동 저장 skip하도록
      replayOfRecordId: row.id
    });
    router.push("/stadium/play");
  };

  const getOpponentSide = (row: BpRecordRow): "home" | "away" => (
    row.user_side === "home" ? "away" : "home"
  );

  const handleOpenOpponent = (row: BpRecordRow) => {
    const side = getOpponentSide(row);
    const team = row.input?.[side] ?? null;
    if (!team) {
      showToast("상대 라인업 데이터가 남아 있지 않아요.");
      return;
    }
    setPreviewTeam(team);
  };

  const openRematchPicker = (row: BpRecordRow) => {
    if (row.source !== "public") return;
    if (!row.input) {
      showToast("재대전할 라인업 데이터가 남아 있지 않아요.");
      return;
    }
    const publicLineups = myLineups.filter((lineup) => lineup.entry.isPublished === true);
    if (publicLineups.length === 0) {
      showToast("먼저 저장된 내 라인업이 필요합니다.");
      return;
    }
    setRematchRecord(row);
    setRematchEntryId(publicLineups[0]?.entryId ?? null);
  };

  const startRematch = async () => {
    if (!rematchRecord?.input || startingRematch) return;
    if (rematchRecord.source !== "public") return;
    const publicLineups = myLineups.filter((lineup) => lineup.entry.isPublished === true);
    const selected = publicLineups.find((lineup) => lineup.entryId === rematchEntryId) ?? publicLineups[0];
    if (!selected) {
      showToast("선택할 수 있는 내 라인업이 없습니다.");
      return;
    }
    const opponentSide = getOpponentSide(rematchRecord);
    const opponentTeam = rematchRecord.input[opponentSide];
    const myPitching = fillMissingPitcherSlots(selected.entry.teamId, selected.entry.pitching?.slots ?? []);
    if (!myPitching) {
      showToast("투수 라인업을 만들 수 없습니다.");
      return;
    }
    // 내 팀만 DB 스냅샷 기반 시즌+최근 폼 블렌드. 상대팀은 원본 record 보존(재현성).
    const rematchClient = createSupabaseBrowserClient();
    const stats = await buildStatsDirectoryWithRecentForm(rematchClient, [selected.entry.teamId]);
    const mine = buildSimTeamInput(
      selected.entry.teamId,
      selected.entry.batting,
      myPitching,
      stats,
      selected.entry.name
    );
    if (!mine.ok) {
      showToast(`내 라인업을 경기용으로 변환하지 못했습니다. (${mine.issues.map((i) => i.kind).join(", ")})`);
      return;
    }
    const input =
      rematchRecord.user_side === "home"
        ? { home: mine.team, away: opponentTeam, context: {} }
        : { home: opponentTeam, away: mine.team, context: {} };
    setStartingRematch(true);
    saveMatchSession({
      myTeamId: mine.team.teamId,
      opponentTeamId: opponentTeam.teamId,
      seed: generateSeed(),
      input,
      startedAt: new Date().toISOString(),
      source: rematchRecord.source,
      userSide: rematchRecord.user_side,
      myLineupId: selected.id,
      opponentLineupId:
        rematchRecord.user_side === "home"
          ? rematchRecord.away_lineup_id ?? undefined
          : rematchRecord.home_lineup_id ?? undefined
    });
    setStartingRematch(false);
    setRematchRecord(null);
    router.push("/stadium/play");
  };

  const handleDelete = async (row: BpRecordRow) => {
    if (deletingId) return;
    if (!confirm(`${row.away_label ?? row.away_team_id} vs ${row.home_label ?? row.home_team_id} 기록을 삭제할까요?`)) return;
    setDeletingId(row.id);
    const client = createSupabaseBrowserClient();
    const result = await deleteRecord(client, row.id);
    setDeletingId(null);
    if (!result.ok) {
      showToast(`삭제 실패: ${result.error}`);
      return;
    }
    setRows((prev) => (prev ? prev.filter((r) => r.id !== row.id) : prev));
    showToast("기록을 삭제했어요.");
  };

  if (authState === "loading") {
    return (
      <AppShell activeTab="records" title={<>내 기록 <span className="records-title-suffix-inline">(7일간 재생 가능)</span></>} theme="light" backHref="/" wide>
        <p className="stadium-loading">불러오는 중...</p>
      </AppShell>
    );
  }

  if (authState === "loggedOut") {
    return (
      <AppShell activeTab="records" title={<>내 기록 <span className="records-title-suffix-inline">(7일간 재생 가능)</span></>} theme="light" backHref="/" wide>
        <section className="records-empty">
          <span className="records-empty-icon">
            <Lock size={28} />
          </span>
          <strong>로그인이 필요해요</strong>
          <p>공개 라인업 매칭이나 친구 대전 결과는 로그인한 계정에 저장돼요.</p>
          <Link className="records-empty-cta" href="/login" prefetch>
            로그인하러 가기
          </Link>
        </section>
      </AppShell>
    );
  }

  if (loadError) {
    return (
      <AppShell activeTab="records" title={<>내 기록 <span className="records-title-suffix-inline">(7일간 재생 가능)</span></>} theme="light" backHref="/" wide>
        <section className="records-empty">
          <strong>불러오기 실패</strong>
          <p>{loadError}</p>
          <button
            type="button"
            className="records-empty-cta"
            onClick={() => fetchRecords()}
          >
            다시 시도
          </button>
        </section>
      </AppShell>
    );
  }

  if (rows && rows.length === 0) {
    return (
      <AppShell activeTab="records" title={<>내 기록 <span className="records-title-suffix-inline">(7일간 재생 가능)</span></>} theme="light" backHref="/" wide>
        <section className="records-empty">
          <span className="records-empty-icon">
            <History size={28} />
          </span>
          <strong>아직 저장된 경기가 없어요</strong>
          <p>공개 라인업 매칭이나 친구 대전을 한 판 해보세요. 결과가 자동으로 여기 저장돼요. (AI 대전은 저장 X)</p>
          <Link className="records-empty-cta" href="/stadium/lobby" prefetch>
            경기장으로 가기
          </Link>
        </section>
      </AppShell>
    );
  }

  // 라인업 필터 적용 — 선택된 라인업이 home/away 어느 쪽이든 매칭되는 row만 노출
  const filteredRows = filterLineupId
    ? (rows ?? []).filter(
        (r) => r.home_lineup_id === filterLineupId || r.away_lineup_id === filterLineupId
      )
    : rows ?? [];
  const publicLineups = myLineups.filter((lineup) => lineup.entry.isPublished === true);
  const rematchOpponentTeam = rematchRecord?.input?.[getOpponentSide(rematchRecord)] ?? null;

  return (
    <AppShell activeTab="records" title={<>내 기록 <span className="records-title-suffix-inline">(7일간 재생 가능)</span></>} theme="light" backHref="/" wide>
      {/* 누적 공개 매치 요약 카드 — 서버에서 집계해 props로 받은 값.
          0전 0승 0패도 카드 노출(빈 메시지 분기). 익명 사용자에겐 로그인 CTA 추가.
          우측 상단에 "랭킹 보기" 보조 버튼 — 계정 누적 랭킹 페이지로 진입. */}
      <section className="records-summary-card" aria-label="누적 공개 매치 전적">
        <div className="records-summary-row">
          {userRecord.total > 0 ? (
            <div className="records-summary-stats">
              {/* wins>=1이면 마일스톤 뱃지, 아니면 기본 📊 — 0/0 케이스는 아래 else 분기. */}
              {userRecord.wins >= 1 ? (
                <AccountTierBadge wins={userRecord.wins} size={48} />
              ) : (
                <span className="records-summary-icon" aria-hidden="true">📊</span>
              )}
              <div className="records-summary-text">
                <span className="records-summary-label">내 공개 매치 누적</span>
                <strong className="records-summary-numbers">
                  {userRecord.wins}승 {userRecord.losses}패
                  <span className="records-summary-rate">· 승률 {formatWinRate(userRecord.winRate)}</span>
                </strong>
              </div>
            </div>
          ) : (
            <div className="records-summary-stats">
              <span className="records-summary-icon" aria-hidden="true">📊</span>
              <div className="records-summary-text">
                <span className="records-summary-label">내 공개 매치 누적</span>
                <strong className="records-summary-numbers">아직 기록이 없어요</strong>
              </div>
            </div>
          )}
          <Link
            href="/play/account-ranking"
            prefetch
            className="records-ranking-link"
            aria-label="계정 누적 랭킹 보기"
          >
            <Trophy size={14} aria-hidden />
            <span>랭킹 보기</span>
          </Link>
        </div>
        {isAnonymous ? (
          <Link href="/login?next=/records" className="records-summary-cta" prefetch>
            기기 변경 시 기록 보존을 위해 로그인하세요
          </Link>
        ) : null}
      </section>

      {/* 라인업 필터 chip — 라인업이 2개 이상일 때만 노출. "전체" + 본인 라인업 각각.
          각 chip: 1줄 라인업명 + 2줄 승·패·무. PC는 마우스 드래그로도 가로 스크롤. */}
      {myLineups.length >= 2 ? (
        <div className="records-filter" role="tablist" aria-label="라인업 필터" ref={filterRef}>
          {(() => {
            return (
              <button
                type="button"
                role="tab"
                aria-selected={filterLineupId === null}
                className={`records-filter-chip is-all ${filterLineupId === null ? "is-active" : ""}`}
                onClick={() => setFilterLineupId(null)}
              >
                <span className="records-filter-chip-text">
                  <span className="records-filter-chip-name">전체</span>
                </span>
              </button>
            );
          })()}
          {myLineups.map((lineup) => {
            const s = computeStats(rows ?? [], lineup.id);
            return (
              <button
                key={lineup.id}
                type="button"
                role="tab"
                aria-selected={filterLineupId === lineup.id}
                className={`records-filter-chip ${filterLineupId === lineup.id ? "is-active" : ""}`}
                onClick={() => setFilterLineupId(lineup.id)}
              >
                <TeamBadge teamId={lineup.teamId} size="sm" />
                <span className="records-filter-chip-text">
                  <span className="records-filter-chip-name">{lineup.name}</span>
                  <span className="records-filter-chip-stats">{s.wins}승 {s.losses}패</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {filterLineupId && filteredRows.length === 0 ? (
        <section className="records-empty">
          <span className="records-empty-icon">
            <History size={28} />
          </span>
          <strong>이 라인업으로 한 경기가 아직 없어요</strong>
          <p>다른 라인업 기록을 보려면 위 필터를 바꿔보세요.</p>
        </section>
      ) : null}

      <section className="records-list">
        {filteredRows.map((row: BpRecordRow) => {
          const opponentSide = getOpponentSide(row);
          return (
            <RecordCard
              key={row.id}
              row={row}
              deleting={deletingId === row.id}
              canRematch={publicLineups.length > 0}
              opponentSide={opponentSide}
              onReplay={handleReplay}
              onOpenOpponent={handleOpenOpponent}
              onRematch={openRematchPicker}
              onDelete={handleDelete}
            />
          );
        })}
      </section>
      {/* 승급 모달 — 홈을 안 거치고 바로 내 기록 페이지에 들어오는 케이스 대비. */}
      <TierUpHost wins={userRecord.wins} />
      <LineupDetailModal
        open={previewTeam !== null}
        team={previewTeam}
        onClose={() => setPreviewTeam(null)}
      />
      <RematchLineupModal
        open={rematchRecord !== null}
        opponentTeam={rematchOpponentTeam}
        lineups={publicLineups}
        selectedEntryId={rematchEntryId}
        starting={startingRematch}
        statsByEntryId={myStatsByEntryId}
        onSelectEntry={setRematchEntryId}
        onStart={startRematch}
        onClose={() => {
          if (startingRematch) return;
          setRematchRecord(null);
        }}
      />
    </AppShell>
  );
}
