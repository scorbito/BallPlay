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
import { useAppState } from "@/lib/state/AppState";

export function ResultScreen() {
  const router = useRouter();
  const { showToast } = useAppState();
  const [session, setSession] = useState<MatchSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sharing, setSharing] = useState(false);

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

  if (!hydrated || !session?.result || !session.input) {
    return (
      <AppShell activeTab="stadium" title="결과" backHref="/stadium/lobby" theme="dark">
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
      startedAt: new Date().toISOString()
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
    <AppShell activeTab="stadium" title="결과" backHref="/stadium/lobby" theme="dark">
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
          <div className="stadium-result-team">
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
