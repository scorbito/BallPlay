"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw, Share2, Trophy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamLogo } from "@/components/common/TeamLogo";
import { getTeam } from "@/lib/constants/teams";
import {
  generateSeed,
  loadMatchSession,
  saveMatchSession,
  clearMatchSession,
  type MatchSession
} from "@/lib/sim/matchSession";
import { recordPlayoffGame } from "@/lib/actions/playoff";
import { buildShareUrl } from "@/lib/sim/matchShare";
import { SIM_ENGINE_VERSION } from "@/lib/sim/version";
import { useAppState } from "@/lib/state/AppState";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createRecord, type BpRecordSource } from "@/lib/supabase/query-parts/bpRecords";
import { TierUpHost } from "@/components/common/TierUpHost";

export function ResultScreen() {
  const router = useRouter();
  const { showToast } = useAppState();
  const [session, setSession] = useState<MatchSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  // 동기 ref 가드 — useEffect가 두 번 실행돼도 INSERT 1회만 시도하도록 차단.
  const saveAttemptedRef = useRef(false);
  // 플레이오프 결과 기록+이동 진행 중 (버튼 중복 클릭 차단).
  const [playoffReturning, setPlayoffReturning] = useState(false);
  // 매치 종료 직후 승급 모달 트리거용 — 본인 누적 승수.
  const [accountWins, setAccountWins] = useState<number>(0);

  useEffect(() => {
    const s = loadMatchSession();
    if (!s?.result || !s.input) {
      router.replace("/stadium/lobby");
      return;
    }
    setSession(s);
    setHydrated(true);
  }, [router]);

  // 마운트 + 저장 완료 후 본인 누적 승수 조회 → 승급 모달 트리거.
  // PlayScreen이 GAME_END 시점에 이미 저장했으면 mount 시점에 바로 최신값 잡힘.
  // ResultScreen이 직접 저장하는 케이스(fallback)는 savedId 변화 후 다시 조회.
  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      try {
        const client = createSupabaseBrowserClient();
        const { data: { user } } = await client.auth.getUser();
        if (!user || user.is_anonymous) return;
        // bp_account_stats 직접 query — getAccountStats 모듈은 server-only import 포함이라
        // client에서 import 못 함. 인라인으로 동일 로직 수행.
        const { data } = await client
          .from("bp_account_stats")
          .select("wins")
          .eq("user_id", user.id)
          .maybeSingle();
        setAccountWins(data?.wins ?? 0);
      } catch {
        // ignore — 단순 부가 기능
      }
    })();
  }, [hydrated, savedId]);

  const mvpPlayer = useMemo(() => {
    if (!session?.result || !session.input) return null;
    const mvpId = session.result.mvp.playerId;
    const allBatters = [...session.input.home.batters, ...session.input.away.batters];
    const allPitchers = [
      session.input.home.starter,
      ...session.input.home.bullpen,
      session.input.away.starter,
      ...session.input.away.bullpen
    ];
    return (
      allBatters.find((b) => b.playerId === mvpId) ??
      allPitchers.find((p) => p.playerId === mvpId) ??
      null
    );
  }, [session]);

  // 자동 저장 — source가 public/friend일 때만, 로그인+정식계정에서만.
  // PlayScreen이 GAME_END 시점에 먼저 저장하므로 ResultScreen은 보통 skip.
  // Fallback: 직접 /stadium/result URL 진입 등 PlayScreen 거치지 않은 케이스만 저장.
  // ⚠ Rules of Hooks 위반 방지를 위해 early return 앞에 위치해야 함.
  const canSave =
    (session?.source === "public" || session?.source === "friend") &&
    !session?.replayOfRecordId &&
    !session?.savedRecordId;

  useEffect(() => {
    if (!hydrated || !session?.input || !session.result) return;
    if (!canSave) return;
    if (savedId || saving) return;
    // 동기 ref 가드 — effect 두 번 실행 차단
    if (saveAttemptedRef.current) return;
    // sessionStorage 기준 가드 — PlayScreen이 이미 진행/완료했으면 skip
    const sessionFresh = loadMatchSession();
    if (sessionFresh?.savedRecordId) {
      setSavedId(sessionFresh.savedRecordId);
      setSession((prev) => (prev ? { ...prev, savedRecordId: sessionFresh.savedRecordId } : prev));
      return;
    }
    saveAttemptedRef.current = true;

    let cancelled = false;
    (async () => {
      setSaving(true);
      try {
        // 한 번 더 확인 (async 시점에 변경됐을 수 있음)
        const fresh = loadMatchSession();
        if (fresh?.savedRecordId) {
          if (!cancelled) {
            setSavedId(fresh.savedRecordId);
            setSession((prev) => (prev ? { ...prev, savedRecordId: fresh.savedRecordId } : prev));
          }
          return;
        }

        const client = createSupabaseBrowserClient();
        const { data: { user } } = await client.auth.getUser();
        if (!user) return;

        const { home, away } = session.input!;
        const { finalScore, mvp, innings } = session.result!;
        const totalInnings = Math.max(9, ...innings.map((i) => i.inning));
        const lastInning = innings[innings.length - 1];
        const isWalkOff =
          !!lastInning &&
          lastInning.inning >= 9 &&
          !!lastInning.bottom &&
          finalScore.home > finalScore.away;

        const homeLabel = home.displayName?.trim() || null;
        const awayLabel = away.displayName?.trim() || null;

        const result = await createRecord(client, {
          ownerUserId: user.id,
          source: session.source as BpRecordSource,
          bpMatchId: session.liveMatchId ?? null,
          userSide: session.userSide ?? "home",
          engineVersion: SIM_ENGINE_VERSION,
          seed: session.seed,
          input: session.input!,
          result: session.result!,
          homeTeamId: home.teamId,
          awayTeamId: away.teamId,
          homeLabel,
          awayLabel,
          finalScore,
          mvpPlayerId: mvp.playerId,
          mvpName: mvpPlayer?.name ?? null,
          isWalkoff: isWalkOff,
          totalInnings,
          homeLineupId: session.source === "public"
            ? (session.userSide === "home"
                ? (session.myLineupId ?? null)
                : (session.opponentLineupId ?? null))
            : null,
          awayLineupId: session.source === "public"
            ? (session.userSide === "home"
                ? (session.opponentLineupId ?? null)
                : (session.myLineupId ?? null))
            : null,
          opponentNickname: session.opponentNickname ?? null
        });

        if (cancelled) return;
        if (!result.ok) {
          showToast(`기록 자동 저장 실패: ${result.error}`);
          // 실패 시 ref 풀어 재시도 가능하게
          saveAttemptedRef.current = false;
          return;
        }
        // alreadyExists: 상대방 mirror trigger가 먼저 만든 경우 — row.id 없음. "mirrored" placeholder로 마킹.
        const recordId = result.row?.id ?? "mirrored";
        setSavedId(recordId);
        const cur = loadMatchSession();
        if (cur) saveMatchSession({ ...cur, savedRecordId: recordId });
      } catch {
        if (!cancelled) showToast("기록 저장 중 오류가 발생했어요.");
      } finally {
        if (!cancelled) setSaving(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, canSave, session, mvpPlayer, savedId, saving, showToast]);

  // 뒤로가기 — public 매치는 경기장, 그 외는 연습경기장.
  // 플레이오프는 결과 기록을 반드시 거치게 하려고 헤더 뒤로가기를 숨기고(undefined)
  // "대진표로" 버튼(기록 await 후 이동)만 노출한다.
  const backHrefForSource =
    session?.source === "public"
      ? "/stadium/lobby"
      : session?.source === "playoff"
        ? undefined
        : "/play/practice";

  // 플레이오프 — 결과 기록(승=다음 라운드/패=탈락/4R승=우승)을 await한 뒤 대진표로.
  const handlePlayoffReturn = async () => {
    if (playoffReturning) return;
    setPlayoffReturning(true);
    const s = loadMatchSession();
    if (s?.source === "playoff" && s.playoffRunId && s.playoffRound != null && s.result) {
      const fs = s.result.finalScore;
      try {
        await recordPlayoffGame({
          runId: s.playoffRunId,
          round: s.playoffRound,
          win: fs.home > fs.away,
          scoreMe: fs.home,
          scoreOpp: fs.away,
          playSeed: s.seed,
          oppTeamId: s.opponentTeamId
        });
      } catch {
        // 기록 실패해도 대진표에서 재시도 가능 — 이동은 진행.
      }
    }
    clearMatchSession();
    router.push("/stadium/playoff");
  };

  if (!hydrated || !session?.result || !session.input) {
    return (
      <AppShell activeTab="stadium" title="결과" backHref={backHrefForSource} theme="light" wide>
        <p className="stadium-loading">결과를 불러오는 중...</p>
      </AppShell>
    );
  }

  const { home, away } = session.input;
  const { finalScore, mvp, innings, engineVersion, seed } = session.result;
  const homeTeam = getTeam(home.teamId);
  const awayTeam = getTeam(away.teamId);
  // 사용자 지정 팀명(라인업 이름) 우선
  const homeLabel = home.displayName?.trim() || homeTeam.shortName;
  const awayLabel = away.displayName?.trim() || awayTeam.shortName;
  const homeWin = finalScore.home > finalScore.away;
  const draw = finalScore.home === finalScore.away;

  const winnerLabel = draw
    ? "무승부"
    : homeWin
      ? `${homeLabel} 승리`
      : `${awayLabel} 승리`;

  const handleRematch = () => {
    const newSeed = generateSeed();
    // 공개 매치(public)는 재대결 시에도 source/userSide/lineup ids/opponentNickname 유지
    // → 새 record 가 정상 저장되어 라인업 전적 누적.
    // friend(실시간 친구 대전)는 1회성이라 재대결 시 AI 로 폴백.
    // savedRecordId 는 의도적으로 미복사 — 새 매치이므로 새 record id 받아야 함.
    const isPublic = session.source === "public";
    const next: MatchSession = {
      myTeamId: session.myTeamId,
      opponentTeamId: session.opponentTeamId,
      seed: newSeed,
      input: session.input,
      startedAt: new Date().toISOString(),
      source: isPublic ? "public" : "ai"
    };
    if (isPublic) {
      next.userSide = session.userSide;
      next.myLineupId = session.myLineupId;
      next.opponentLineupId = session.opponentLineupId;
      next.opponentNickname = session.opponentNickname;
    }
    saveMatchSession(next);
    router.push("/stadium/play");
  };

  const handleShare = async () => {
    if (!session?.input || sharing) return;
    setSharing(true);
    try {
      const url = buildShareUrl(session.input, session.seed);
      // Web Share API 우선 (모바일), 실패 시 클립보드 복사
      if (typeof navigator !== "undefined" && "share" in navigator) {
        try {
          await (navigator as Navigator).share({
            title: "야구놀이터 매치 결과",
            text: "내 라인업으로 한 가상 대결 보러가기",
            url
          });
          showToast("공유 시트를 열었어요.");
          return;
        } catch {
          // 사용자가 share 시트 닫음 → 클립보드 폴백
        }
      }
      await navigator.clipboard.writeText(url);
      showToast("공유 링크를 복사했어요.");
    } catch {
      showToast("공유 링크 생성에 실패했어요.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <AppShell activeTab="stadium" title="결과" backHref={backHrefForSource} theme="light" wide>
      {/* 승급 감지 + 모달 — 매치 결과 직후 즉시 알림. */}
      <TierUpHost wins={accountWins} />
      <section className="stadium-result">
        <div className="stadium-result-banner">
          <Trophy size={24} />
          <strong>{winnerLabel}</strong>
        </div>

        <div className="stadium-result-scoreboard">
          <div className="stadium-result-team">
            <TeamLogo teamId={awayTeam.id} size="lg" />
            <span>{awayLabel}</span>
            <strong>{finalScore.away}</strong>
          </div>
          <span className="stadium-result-divider">:</span>
          <div className="stadium-result-team is-right">
            <TeamLogo teamId={homeTeam.id} size="lg" />
            <span>{homeLabel}</span>
            <strong>{finalScore.home}</strong>
          </div>
        </div>

        <div className="stadium-result-mvp">
          <span className="stadium-result-mvp-label">MVP</span>
          <strong>{mvpPlayer?.name ?? mvp.playerId}</strong>
          <span className="stadium-result-mvp-reason">{mvp.reason}</span>
        </div>

        <div className="stadium-result-line">
          <table className="stadium-result-linetable">
            <thead>
              <tr>
                <th />
                {innings.map((i) => <th key={i.inning}>{i.inning}</th>)}
                <th>R</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{awayTeam.shortName}</td>
                {innings.map((i) => <td key={`a-${i.inning}`}>{i.top.runs}</td>)}
                <td><strong>{finalScore.away}</strong></td>
              </tr>
              <tr>
                <td>{homeTeam.shortName}</td>
                {innings.map((i) => (
                  <td key={`h-${i.inning}`}>{i.bottom ? i.bottom.runs : "-"}</td>
                ))}
                <td><strong>{finalScore.home}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="stadium-result-meta">
          <span>엔진 v{engineVersion}</span>
          <span>시드 {seed}</span>
        </div>

        {(session.source === "public" || session.source === "friend") && !session.replayOfRecordId ? (
          <div className="stadium-result-save-status">
            {(savedId || session.savedRecordId) ? "✓ 기록에 자동 저장됨" : saving ? "기록 저장 중..." : null}
          </div>
        ) : null}

        {session.source === "playoff" ? (
          <footer className="stadium-result-actions">
            <button
              type="button"
              className="stadium-cta-primary"
              onClick={handlePlayoffReturn}
              disabled={playoffReturning}
            >
              <Trophy size={16} />
              <span>{playoffReturning ? "기록 중..." : "대진표로"}</span>
            </button>
          </footer>
        ) : (
          <footer className="stadium-result-actions">
            <button type="button" className="stadium-cta-primary" onClick={handleRematch}>
              <RotateCcw size={16} />
              <span>다시 대결</span>
            </button>
            <button
              type="button"
              className="stadium-cta-secondary"
              onClick={handleShare}
              disabled={sharing}
            >
              <Share2 size={16} />
              <span>{sharing ? "공유 중..." : "결과 공유"}</span>
            </button>
            <Link className="stadium-cta-secondary" href="/stadium/lobby" prefetch>
              매칭풀로
            </Link>
          </footer>
        )}
      </section>
    </AppShell>
  );
}
