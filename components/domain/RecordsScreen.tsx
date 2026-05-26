"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, Play, Trash2, Lock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { useAppState } from "@/lib/state/AppState";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  listMyRecords,
  deleteRecord,
  canReplay,
  type BpRecordRow
} from "@/lib/supabase/query-parts/bpRecords";
import { listMyLineups } from "@/lib/supabase/query-parts/bpLineups";
import { getTeam } from "@/lib/constants/teams";
import { SIM_ENGINE_VERSION } from "@/lib/sim/version";
import { saveMatchSession } from "@/lib/sim/matchSession";
import { withTimeout } from "@/lib/utils/withTimeout";

type AuthState = "loading" | "loggedIn" | "loggedOut";

type LineupOption = { id: string; name: string; teamId: string };

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

export function RecordsScreen() {
  const router = useRouter();
  const { showToast } = useAppState();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [rows, setRows] = useState<BpRecordRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // 내 라인업 목록 — 필터 chip 노출용. 본인의 bp_lineups row id ↔ 이름 매핑.
  const [myLineups, setMyLineups] = useState<LineupOption[]>([]);
  const [filterLineupId, setFilterLineupId] = useState<string | null>(null);

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
      setMyLineups(
        linRes.rows.map((r) => ({
          id: r.id,
          name: r.name?.trim() || getTeam(r.team_id).shortName,
          teamId: r.team_id
        }))
      );
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

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
      <AppShell activeTab="records" title="내 기록" theme="light" backHref="/" wide>
        <p className="stadium-loading">불러오는 중...</p>
      </AppShell>
    );
  }

  if (authState === "loggedOut") {
    return (
      <AppShell activeTab="records" title="내 기록" theme="light" backHref="/" wide>
        <p className="records-subtitle">경기 기록은 계정에 저장돼요</p>
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
      <AppShell activeTab="records" title="내 기록" theme="light" backHref="/" wide>
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
      <AppShell activeTab="records" title="내 기록" theme="light" backHref="/" wide>
        <p className="records-subtitle">공개 라인업 매칭과 친구 대전 결과가 자동으로 쌓여요</p>
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

  return (
    <AppShell activeTab="records" title="내 기록" theme="light" backHref="/" wide>
      <p className="records-subtitle">자동 저장된 공개 라인업 매칭 · 친구 대전 (7일간 재생 가능)</p>

      {/* 라인업 필터 chip — 라인업이 2개 이상일 때만 노출. "전체" + 본인 라인업 각각.
          각 chip에 본인 시점 승·패·무 표시. 가로 스크롤 (오른쪽 끝 fade로 hint). */}
      {myLineups.length >= 2 ? (
        <div className="records-filter" role="tablist" aria-label="라인업 필터">
          {(() => {
            const total = computeStats(rows ?? [], null);
            return (
              <button
                type="button"
                role="tab"
                aria-selected={filterLineupId === null}
                className={`records-filter-chip ${filterLineupId === null ? "is-active" : ""}`}
                onClick={() => setFilterLineupId(null)}
              >
                <span>전체</span>
                <span className="records-filter-chip-stats">{total.wins}·{total.losses}·{total.draws}</span>
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
                <span>{lineup.name}</span>
                <span className="records-filter-chip-stats">{s.wins}·{s.losses}·{s.draws}</span>
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
          const replay = canReplay(row, SIM_ENGINE_VERSION);
          const isWinner =
            (row.user_side === "home" && row.final_score.home > row.final_score.away) ||
            (row.user_side === "away" && row.final_score.away > row.final_score.home);
          const isDraw = row.final_score.home === row.final_score.away;
          return (
            <article key={row.id} className="records-card">
              <div className="records-card-head">
                <span className={`records-card-source records-card-source-${row.source}`}>
                  {row.source === "friend" ? "친구 대전" : "공개 매칭"}
                </span>
                <span
                  className={`records-card-outcome ${
                    isDraw ? "is-draw" : isWinner ? "is-win" : "is-lose"
                  }`}
                >
                  {isDraw ? "무" : isWinner ? "승" : "패"}
                </span>
                <span className="records-card-date">
                  {new Date(row.created_at).toLocaleDateString("ko-KR", {
                    month: "2-digit",
                    day: "2-digit"
                  })}
                </span>
              </div>

              <div className="records-card-score">
                <div className="records-card-team">
                  <TeamBadge teamId={row.away_team_id} size="sm" />
                  <span>{row.away_label ?? row.away_team_id}</span>
                  <strong>{row.final_score.away}</strong>
                </div>
                <span className="records-card-vs">:</span>
                <div className="records-card-team is-right">
                  <TeamBadge teamId={row.home_team_id} size="sm" />
                  <span>{row.home_label ?? row.home_team_id}</span>
                  <strong>{row.final_score.home}</strong>
                </div>
              </div>

              {row.mvp_name ? (
                <div className="records-card-mvp">
                  MVP <strong>{row.mvp_name}</strong>
                  {row.is_walkoff ? <span className="records-card-walkoff">끝내기</span> : null}
                </div>
              ) : null}

              <footer className="records-card-actions">
                <button
                  type="button"
                  className="records-card-replay"
                  onClick={() => handleReplay(row)}
                  disabled={!replay.ok}
                  title={
                    replay.ok
                      ? "재생"
                      : replay.reason === "expired"
                      ? "재생 만료 (7일)"
                      : replay.reason === "engine_mismatch"
                      ? "엔진 버전 변경으로 재생 불가"
                      : "재생 데이터 없음"
                  }
                >
                  <Play size={14} />
                  <span>{replay.ok ? "재생" : "재생 불가"}</span>
                </button>
                <button
                  type="button"
                  className="records-card-delete"
                  onClick={() => handleDelete(row)}
                  disabled={deletingId === row.id}
                  aria-label="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </footer>
            </article>
          );
        })}
      </section>
    </AppShell>
  );
}
