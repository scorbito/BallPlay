"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/common/Card";
import { TeamLogo } from "@/components/common/TeamLogo";
import { useAppState } from "@/lib/state/AppState";
import { loadLineupEntries } from "@/lib/storage/lineupEntries";
import { PITCHER_STARTER_INDEX, type LineupEntry } from "@/lib/types/lineup";
import { startPlayoffRun } from "@/lib/actions/playoff";
import { PLAYOFF_ROUND_LABEL, type PlayoffRun } from "@/lib/supabase/query-parts/bpPlayoff";
import { PlayoffBracket } from "./PlayoffBracket";

/** 완성 팀 — 타자 9명 + 선발 1명. */
function isComplete(e: LineupEntry): boolean {
  return e.batting.slots.length === 9 && !!e.pitching?.slots?.[PITCHER_STARTER_INDEX];
}

type Props = { initialRun: PlayoffRun | null; loggedIn: boolean };

export function PlayoffHubScreen({ initialRun, loggedIn }: Props) {
  const { showToast } = useAppState();
  const [run, setRun] = useState<PlayoffRun | null>(initialRun);
  // "auto": 최신 run 따라감 / "select": 새 도전 팀 선택
  const [mode, setMode] = useState<"auto" | "select">("auto");
  const [starting, startTransition] = useTransition();

  // localStorage 읽기는 마운트 후 — 서버/초기 클라이언트 렌더 일치(hydration-safe).
  const [entries, setEntries] = useState<LineupEntry[]>([]);
  useEffect(() => {
    setEntries(loadLineupEntries().filter(isComplete));
  }, [mode, run]);

  const showBracket = mode === "auto" && run?.status === "active";
  const showResult = mode === "auto" && (run?.status === "champion" || run?.status === "eliminated");

  const handleStart = (entry: LineupEntry) => {
    startTransition(async () => {
      const res = await startPlayoffRun({
        entryId: entry.entryId,
        teamId: entry.teamId,
        teamName: entry.name
      });
      if (res.ok) {
        setRun(res.run);
        setMode("auto");
      } else {
        showToast(res.error);
      }
    });
  };

  return (
    <AppShell activeTab="stadium" title="가을야구" backHref="/stadium/lobby" theme="light" wide>
      {showBracket && run ? (
        <PlayoffBracket run={run} onRunUpdate={setRun} />
      ) : showResult && run ? (
        <PlayoffResultCard run={run} onNew={() => setMode("select")} />
      ) : (
        <PlayoffTeamSelect entries={entries} loggedIn={loggedIn} starting={starting} onStart={handleStart} />
      )}
    </AppShell>
  );
}

function PlayoffTeamSelect({
  entries,
  loggedIn,
  starting,
  onStart
}: {
  entries: LineupEntry[];
  loggedIn: boolean;
  starting: boolean;
  onStart: (e: LineupEntry) => void;
}) {
  return (
    <section className="playoff-select">
      <div className="playoff-intro">
        <h2 className="playoff-intro-title">가을야구 도전</h2>
        <p className="playoff-intro-desc">
          5위로 시작해 AI 4팀을 차례로 꺾고 한국시리즈 우승에 도전하세요.
          <br />한 번 지면 탈락이에요.
        </p>
      </div>

      {entries.length === 0 ? (
        <Card className="playoff-empty">
          <p className="playoff-empty-title">출전할 완성 팀이 없어요</p>
          <p className="playoff-empty-sub">타자 9명과 선발 투수를 채운 팀이 필요해요.</p>
          {loggedIn ? null : (
            <p className="playoff-empty-sub">로그인하면 기록이 저장돼요.</p>
          )}
          <Link href="/play/lineup" className="stadium-cta-primary playoff-empty-cta" prefetch>
            팀 관리로 이동
          </Link>
        </Card>
      ) : (
        <ul className="playoff-team-grid">
          {entries.map((e) => (
            <li key={e.entryId} className="playoff-team-card">
              <TeamLogo teamId={e.teamId} size="md" />
              <span className="playoff-team-name">{e.name}</span>
              <button
                type="button"
                className="playoff-team-go"
                disabled={starting}
                onClick={() => onStart(e)}
              >
                {starting ? "시작 중..." : "도전 시작"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PlayoffResultCard({ run, onNew }: { run: PlayoffRun; onNew: () => void }) {
  const champion = run.status === "champion";
  return (
    <section className="playoff-result-state">
      <Card className={`playoff-result-card ${champion ? "is-champion" : "is-eliminated"}`}>
        <div className="playoff-result-emoji" aria-hidden="true">{champion ? "🏆" : "🍂"}</div>
        <strong className="playoff-result-title">
          {champion ? "한국시리즈 우승!" : "탈락"}
        </strong>
        <div className="playoff-result-team">
          <TeamLogo teamId={run.teamId} size="sm" />
          <span>{run.teamName}</span>
        </div>
        <p className="playoff-result-sub">
          {champion
            ? "5위의 기적을 만들었어요!"
            : `${PLAYOFF_ROUND_LABEL[run.currentRound] ?? ""}에서 멈췄어요`}
        </p>
        <button type="button" className="stadium-cta-primary" onClick={onNew}>
          {champion ? "새 도전" : "재도전"}
        </button>
      </Card>
    </section>
  );
}
