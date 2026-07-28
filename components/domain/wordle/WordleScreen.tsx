"use client";

// 선수명 워들 "오늘 선수는 누구?" — 하루 한 명, 6번의 기회.
//
// 서버 호출이 없다. 정답은 커밋된 스냅샷을 날짜로 순환해 클라이언트에서 계산하고,
// 진행 상태·통계는 localStorage 에 둔다. 덕분에 페이지가 정적으로 유지된다.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ModalShell } from "@/components/common/ModalShell";
import { useAppState } from "@/lib/state/AppState";
import { trackEvent } from "@/lib/analytics/events";
import {
  JERSEY_HINT_FROM_ATTEMPT,
  MAX_ATTEMPTS,
  getAnswerForDate,
  getAnswerPoolSize,
  kstDateString
} from "@/lib/wordle/daily";
import { buildJamoStatus, judgeGuess, type GuessResult } from "@/lib/wordle/judge";
import { getGuessablePlayers, type WordlePlayer } from "@/lib/wordle/pool";
import { buildShareText } from "@/lib/wordle/shareText";
import {
  loadProgress,
  loadStats,
  recordFinishedGame,
  saveProgress,
  type WordleStats
} from "@/lib/storage/wordle";
import { WordleGrid, type AttributeHint } from "./WordleGrid";
import { WordlePlayerSearch } from "./WordlePlayerSearch";
import { WordleJamoPanel } from "./WordleJamoPanel";
import { WordleResultSheet } from "./WordleResultSheet";

function findPlayerByName(name: string): WordlePlayer | null {
  return getGuessablePlayers().find((player) => player.name === name) ?? null;
}

export function WordleScreen() {
  const { showToast } = useAppState();

  // 날짜·정답은 클라이언트에서만 확정한다. 서버 렌더 시점의 날짜와 사용자 기기의
  // KST 날짜가 어긋나면 하이드레이션 불일치가 나므로 mount 후에 세팅.
  const [dateISO, setDateISO] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [stats, setStats] = useState<WordleStats | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const answer = useMemo(() => (dateISO ? getAnswerForDate(dateISO) : null), [dateISO]);

  // 최초 마운트 — 오늘 날짜 확정 + 저장된 진행 상태 복원.
  useEffect(() => {
    const today = kstDateString();
    setDateISO(today);
    const saved = loadProgress(today);
    setGuesses(saved?.guesses ?? []);
    setStats(loadStats());
  }, []);

  const results = useMemo<GuessResult[]>(() => {
    if (!answer) return [];
    return guesses
      .map((name) => judgeGuess(name, answer.name))
      .filter((result): result is GuessResult => result !== null);
  }, [guesses, answer]);

  const solved = results.some((result) => result.solved);
  const finished = solved || guesses.length >= MAX_ATTEMPTS;

  const guessedPlayers = useMemo(
    () => guesses.map((name) => findPlayerByName(name)).filter((p): p is WordlePlayer => p !== null),
    [guesses]
  );

  // 속성 힌트 — 등번호 방향은 4번째 시도부터. 팀·포지션만으로도 초반 정보량이 충분해서
  // 처음부터 다 열면 글자 추리 없이 속성만으로 좁혀지는 게임이 된다.
  const hints = useMemo<AttributeHint[]>(() => {
    if (!answer) return [];
    return guessedPlayers.map((player, index) => ({
      teamMatch: player.teamId === answer.teamId,
      posMatch: player.posGroup === answer.posGroup,
      jerseyDirection:
        index + 1 >= JERSEY_HINT_FROM_ATTEMPT
          ? player.jersey === answer.jersey
            ? "same"
            : player.jersey < answer.jersey
            ? "up"
            : "down"
          : null
    }));
  }, [guessedPlayers, answer]);

  const jamoStatus = useMemo(() => buildJamoStatus(results), [results]);

  const shareText = useMemo(() => {
    if (!dateISO) return "";
    return buildShareText({ dateISO, results, solved });
  }, [dateISO, results, solved]);

  // 판이 끝나면 통계에 1회 기록. recordFinishedGame 이 같은 날짜 중복 호출을 막는다.
  useEffect(() => {
    if (!dateISO || !finished) return;
    const next = recordFinishedGame({
      dateISO,
      solved,
      attempts: guesses.length
    });
    setStats(next);
    void trackEvent("wordle_completed", {
      date: dateISO,
      solved,
      attempts: guesses.length
    });
  }, [dateISO, finished, solved, guesses.length]);

  const handlePick = useCallback(
    (player: WordlePlayer) => {
      if (!dateISO || !answer || finished) return;
      if (guesses.includes(player.name)) return;

      const nextGuesses = [...guesses, player.name];
      const isSolved = player.name === answer.name;
      setGuesses(nextGuesses);
      saveProgress({
        date: dateISO,
        guesses: nextGuesses,
        status: isSolved ? "won" : nextGuesses.length >= MAX_ATTEMPTS ? "lost" : "playing"
      });
    },
    [dateISO, answer, finished, guesses]
  );

  const handleShare = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
        return true;
      }
      await navigator.clipboard.writeText(shareText);
      return true;
    } catch {
      showToast("공유에 실패했어요. 아래 텍스트를 직접 복사해 주세요.");
      return false;
    }
  }, [shareText, showToast]);

  return (
    <AppShell
      activeTab="home"
      title="오늘 선수는 누구?"
      theme="light"
      backHref="/"
      headerAction={
        <button
          type="button"
          className="wordle-help-btn"
          onClick={() => setHelpOpen(true)}
          aria-label="게임 규칙 안내"
        >
          <Info size={16} strokeWidth={2.5} />
        </button>
      }
    >
      <div className="wordle-screen">
        <header className="wordle-head">
          <p className="wordle-head-date">{dateISO ?? " "}</p>
          <p className="wordle-head-sub">
            {finished
              ? "오늘 문제 완료"
              : `KBO 선수 한 명 · 남은 기회 ${MAX_ATTEMPTS - guesses.length}`}
          </p>
        </header>

        {dateISO && !answer ? (
          <p className="wordle-empty">오늘 문제를 불러올 수 없어요. 잠시 후 다시 시도해 주세요.</p>
        ) : (
          <>
            <WordleGrid results={results} guessedPlayers={guessedPlayers} hints={hints} />

            {!finished ? (
              <WordlePlayerSearch usedNames={guesses} onPick={handlePick} />
            ) : null}

            {answer && finished && stats ? (
              <WordleResultSheet
                solved={solved}
                attempts={guesses.length}
                answer={answer}
                stats={stats}
                shareText={shareText}
                onShare={handleShare}
              />
            ) : null}

            <WordleJamoPanel status={jamoStatus} />
          </>
        )}
      </div>

      <ModalShell
        open={helpOpen}
        title="게임 규칙"
        onClose={() => setHelpOpen(false)}
        panelClassName="lineup-confirm-modal-panel"
        closeOnBackdrop
      >
        <ul className="wordle-help-list">
          <li>
            오늘의 정답은 KBO 현역 선수 <strong>한 명</strong>이에요. 세 글자 이름이고, 전 유저가
            같은 문제를 풀어요.
          </li>
          <li>
            아무 KBO 선수 이름을 대면 돼요. <strong>정답일 필요는 없어요</strong> — 단서를 얻는 게
            목적이에요.
          </li>
          <li>
            글자마다 초성·중성·종성을 따로 채점해요. 초록은 자리까지 정확, 노랑은 정답에 있지만
            다른 글자 자리, 회색은 없음이에요.
          </li>
          <li>추측한 선수의 팀·포지션이 정답과 같은지도 알려줘요.</li>
          <li>4번째 시도부터는 등번호가 정답보다 큰지 작은지도 열려요.</li>
          <li>6번 안에 맞히면 성공이에요. 자정에 새 문제로 바뀌어요.</li>
          <li>정답 후보는 올 시즌 30경기 이상 출장한 {getAnswerPoolSize()}명이에요.</li>
        </ul>
      </ModalShell>
    </AppShell>
  );
}
