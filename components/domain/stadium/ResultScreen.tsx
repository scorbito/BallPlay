"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw, Share2, Trophy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import {
  generateSeed,
  loadMatchSession,
  saveMatchSession,
  type MatchSession
} from "@/lib/sim/matchSession";
import { buildShareUrl } from "@/lib/sim/matchShare";
import { SIM_ENGINE_VERSION } from "@/lib/sim/version";
import { useAppState } from "@/lib/state/AppState";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createRecord, type BpRecordSource } from "@/lib/supabase/query-parts/bpRecords";

export function ResultScreen() {
  const router = useRouter();
  const { showToast } = useAppState();
  const [session, setSession] = useState<MatchSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    const s = loadMatchSession();
    if (!s?.result || !s.input) {
      router.replace("/stadium/lobby");
      return;
    }
    setSession(s);
    setHydrated(true);
  }, [router]);

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

    let cancelled = false;
    (async () => {
      setSaving(true);
      try {
        const client = createSupabaseBrowserClient();
        const { data: { user } } = await client.auth.getUser();
        if (!user || user.is_anonymous) return;

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
          homeLineupId: session.userSide === "home"
            ? (session.myLineupId ?? null)
            : (session.opponentLineupId ?? null),
          awayLineupId: session.userSide === "home"
            ? (session.opponentLineupId ?? null)
            : (session.myLineupId ?? null)
        });

        if (cancelled) return;
        if (!result.ok) {
          showToast(`기록 자동 저장 실패: ${result.error}`);
          return;
        }
        setSavedId(result.row.id);
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

  if (!hydrated || !session?.result || !session.input) {
    return (
      <AppShell activeTab="stadium" title="결과" backHref="/stadium/lobby" theme="light" wide>
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
    saveMatchSession({
      myTeamId: session.myTeamId,
      opponentTeamId: session.opponentTeamId,
      seed: newSeed,
      input: session.input,
      startedAt: new Date().toISOString(),
      // 재대결은 항상 AI 처리 (친구/공개 매칭 재대결은 별도 흐름 필요)
      source: "ai"
    });
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
    <AppShell activeTab="stadium" title="결과" backHref="/stadium/lobby" theme="light" wide>
      <section className="stadium-result">
        <div className="stadium-result-banner">
          <Trophy size={24} />
          <strong>{winnerLabel}</strong>
        </div>

        <div className="stadium-result-scoreboard">
          <div className="stadium-result-team">
            <TeamBadge teamId={awayTeam.id} size="lg" />
            <span>{awayLabel}</span>
            <strong>{finalScore.away}</strong>
          </div>
          <span className="stadium-result-divider">:</span>
          <div className="stadium-result-team is-right">
            <TeamBadge teamId={homeTeam.id} size="lg" />
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
      </section>
    </AppShell>
  );
}
