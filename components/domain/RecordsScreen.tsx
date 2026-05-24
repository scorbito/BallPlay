"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, Play, Trash2, Lock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { TierBadge } from "@/components/common/TierBadge";
import { useAppState } from "@/lib/state/AppState";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  listMyRecords,
  deleteRecord,
  canReplay,
  type BpRecordRow
} from "@/lib/supabase/query-parts/bpRecords";
import { SIM_ENGINE_VERSION } from "@/lib/sim/version";
import { saveMatchSession } from "@/lib/sim/matchSession";

type AuthState = "loading" | "anonymous" | "loggedIn" | "loggedOut";

export function RecordsScreen() {
  const router = useRouter();
  const { showToast } = useAppState();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [rows, setRows] = useState<BpRecordRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoadError(null);
    const client = createSupabaseBrowserClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      setAuthState("loggedOut");
      setRows([]);
      return;
    }
    if (user.is_anonymous) {
      setAuthState("anonymous");
      setRows([]);
      return;
    }
    setAuthState("loggedIn");
    const result = await listMyRecords(client, user.id);
    if (!result.ok) {
      setLoadError(result.error);
      setRows([]);
      return;
    }
    setRows(result.rows);
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // 모바일: 백그라운드 → 포그라운드 복귀 시 세션 갱신 + 목록 재조회.
  // 토큰이 만료됐을 수 있어 명시적 refresh 후 fetch.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const client = createSupabaseBrowserClient();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void (async () => {
        try {
          await client.auth.refreshSession();
        } catch {
          // ignore — fetchRecords가 새 토큰으로 재시도
        }
        void fetchRecords();
      })();
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
      <AppShell activeTab="records" title="내 기록" theme="light" hideHeader wide>
        <header className="play-hub-header">
          <h1>내 기록</h1>
        </header>
        <p className="stadium-loading">불러오는 중...</p>
      </AppShell>
    );
  }

  if (authState === "loggedOut" || authState === "anonymous") {
    return (
      <AppShell activeTab="records" title="내 기록" theme="light" hideHeader wide>
        <header className="play-hub-header">
          <h1>내 기록</h1>
          <p>경기 기록은 정식 계정에 저장돼요</p>
        </header>
        <section className="records-empty">
          <span className="records-empty-icon">
            <Lock size={28} />
          </span>
          <strong>로그인이 필요해요</strong>
          <p>
            {authState === "anonymous"
              ? "익명 로그인 상태에서는 기록이 저장되지 않아요. 정식 계정으로 로그인하면 다른 기기에서도 기록을 볼 수 있어요."
              : "공개 라인업 매칭이나 친구 대전 결과는 로그인한 계정에 저장돼요."}
          </p>
          <Link className="records-empty-cta" href="/login" prefetch>
            로그인하러 가기
          </Link>
        </section>
      </AppShell>
    );
  }

  if (loadError) {
    return (
      <AppShell activeTab="records" title="내 기록" theme="light" hideHeader wide>
        <header className="play-hub-header">
          <h1>내 기록</h1>
        </header>
        <p className="stadium-error">{loadError}</p>
      </AppShell>
    );
  }

  if (rows && rows.length === 0) {
    return (
      <AppShell activeTab="records" title="내 기록" theme="light" hideHeader wide>
        <header className="play-hub-header">
          <h1>내 기록</h1>
          <p>공개 라인업 매칭과 친구 대전 결과가 자동으로 쌓여요</p>
        </header>
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

  return (
    <AppShell activeTab="records" title="내 기록" theme="light" hideHeader wide>
      <header className="play-hub-header records-header-with-badge">
        <div className="records-header-titlebar">
          <h1>내 기록</h1>
          <TierBadge size="md" hideGuest />
        </div>
        <p>자동 저장된 공개 라인업 매칭 · 친구 대전 (7일간 재생 가능)</p>
      </header>
      <section className="records-list">
        {rows?.map((row) => {
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
