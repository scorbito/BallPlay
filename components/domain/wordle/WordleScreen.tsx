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
  POSITION_HINT_FROM_ATTEMPT,
  TEAM_HINT_FROM_ATTEMPT,
  getAnswerForDate,
  getAnswerPoolSize,
  getRandomAnswer,
  kstDateString
} from "@/lib/wordle/daily";
import { buildJamoStatus, judgeGuess, type GuessResult } from "@/lib/wordle/judge";
import { getGuessablePlayers, type WordlePlayer } from "@/lib/wordle/pool";
import { buildShareText } from "@/lib/wordle/shareText";
import { getStarterSuggestions } from "@/lib/wordle/starters";
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
import { WordleResultSheet, type PracticeSession } from "./WordleResultSheet";

type Mode = "daily" | "practice";

function findPlayerByName(name: string): WordlePlayer | null {
  return getGuessablePlayers().find((player) => player.name === name) ?? null;
}

export function WordleScreen() {
  const { showToast } = useAppState();

  // 날짜·정답은 클라이언트에서만 확정한다. 서버 렌더 시점의 날짜와 사용자 기기의
  // KST 날짜가 어긋나면 하이드레이션 불일치가 나므로 mount 후에 세팅.
  const [dateISO, setDateISO] = useState<string | null>(null);
  const [dailyGuesses, setDailyGuesses] = useState<string[]>([]);
  const [stats, setStats] = useState<WordleStats | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  // ── 연습 모드 ──
  // 공식 문제는 하루 1판(공유·streak·누적통계의 근거). 연습은 랜덤 정답으로 무제한이고
  // localStorage 저장도, 누적 통계 반영도, 공유도 하지 않는다. 연습 기록을 누적에 섞으면
  // 정답률·연속 지표가 무의미해진다.
  const [mode, setMode] = useState<Mode>("daily");
  const [practiceAnswer, setPracticeAnswer] = useState<WordlePlayer | null>(null);
  const [practiceGuesses, setPracticeGuesses] = useState<string[]>([]);
  const [practiceSession, setPracticeSession] = useState<PracticeSession>({ played: 0, won: 0 });
  // 이번 세션에 이미 나온 정답 — 연달아 같은 선수가 나오지 않게.
  const [practiceSeen, setPracticeSeen] = useState<string[]>([]);

  const dailyAnswer = useMemo(() => (dateISO ? getAnswerForDate(dateISO) : null), [dateISO]);

  const isDaily = mode === "daily";
  const answer = isDaily ? dailyAnswer : practiceAnswer;
  const guesses = isDaily ? dailyGuesses : practiceGuesses;

  // 최초 마운트 — 오늘 날짜 확정 + 저장된 진행 상태 복원.
  useEffect(() => {
    const today = kstDateString();
    setDateISO(today);
    const saved = loadProgress(today);
    setDailyGuesses(saved?.guesses ?? []);
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

  // 속성 힌트 — 시도 횟수에 따라 단계적으로 열린다(포지션 2 → 팀 3 → 등번호 4).
  //
  // 기준은 "몇 번째 줄인지"가 아니라 "지금까지 몇 번 시도했는지"다. 즉 3시도에 도달하면
  // 1·2시도 줄에도 팀이 소급 표시된다. 줄마다 다르게 열면 어느 줄에 어떤 칩이 있었는지
  // 외워야 해서 추리가 아니라 기억력 게임이 된다.
  const hints = useMemo<AttributeHint[]>(() => {
    if (!answer) return [];
    const attempts = guessedPlayers.length;
    const posOpen = attempts >= POSITION_HINT_FROM_ATTEMPT;
    const teamOpen = attempts >= TEAM_HINT_FROM_ATTEMPT;
    const jerseyOpen = attempts >= JERSEY_HINT_FROM_ATTEMPT;

    return guessedPlayers.map((player) => ({
      teamMatch: teamOpen ? player.teamId === answer.teamId : null,
      posMatch: posOpen ? player.posGroup === answer.posGroup : null,
      jerseyDirection: !jerseyOpen
        ? null
        : player.jersey === answer.jersey
        ? "same"
        : player.jersey < answer.jersey
        ? "up"
        : "down"
    }));
  }, [guessedPlayers, answer]);

  const jamoStatus = useMemo(() => buildJamoStatus(results), [results]);

  // 첫 추측 유도 — 빈 격자 앞에서 멈추지 않게 탭 한 번으로 시작되는 후보를 준다.
  // 연습에서는 숨긴다. 연습까지 온 사람은 규칙을 이미 알고, 회전이 날짜 기준이라
  // 매 연습 판마다 같은 이름이 뜬다.
  const starters = useMemo(
    () => (isDaily && dateISO ? getStarterSuggestions(dateISO, dailyAnswer) : []),
    [isDaily, dateISO, dailyAnswer]
  );

  const shareText = useMemo(() => {
    if (!dateISO || !isDaily) return "";
    return buildShareText({ dateISO, results, solved });
  }, [dateISO, isDaily, results, solved]);

  // 공식 문제가 끝나면 통계에 1회 기록. recordFinishedGame 이 같은 날짜 중복 호출을 막는다.
  // 연습은 여기에 들어오지 않는다(mode 가드).
  useEffect(() => {
    if (!isDaily || !dateISO || !finished) return;
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
  }, [isDaily, dateISO, finished, solved, guesses.length]);

  const handlePick = useCallback(
    (player: WordlePlayer) => {
      if (!answer || finished) return;
      if (guesses.includes(player.name)) return;

      const nextGuesses = [...guesses, player.name];
      const isSolved = player.name === answer.name;

      if (isDaily) {
        if (!dateISO) return;
        setDailyGuesses(nextGuesses);
        saveProgress({
          date: dateISO,
          guesses: nextGuesses,
          status: isSolved ? "won" : nextGuesses.length >= MAX_ATTEMPTS ? "lost" : "playing"
        });
        return;
      }

      setPracticeGuesses(nextGuesses);
      // 연습 세션 집계는 여기서 한다 — effect 로 하면 mode 전환 타이밍에 중복 집계 위험.
      if (isSolved || nextGuesses.length >= MAX_ATTEMPTS) {
        setPracticeSession((prev) => ({
          played: prev.played + 1,
          won: prev.won + (isSolved ? 1 : 0)
        }));
      }
    },
    [answer, finished, guesses, isDaily, dateISO]
  );

  const startPractice = useCallback(() => {
    const exclude = [...practiceSeen];
    if (dailyAnswer) exclude.push(dailyAnswer.id);
    const next = getRandomAnswer(exclude);
    if (!next) return;
    setPracticeAnswer(next);
    setPracticeGuesses([]);
    setPracticeSeen((prev) => [...prev, next.id]);
    setMode("practice");
  }, [practiceSeen, dailyAnswer]);

  const backToDaily = useCallback(() => setMode("daily"), []);

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
        // ⓘ 아이콘만 두면 "누를 수 있는 것"임을 아는 사람만 누른다. 텍스트 라벨로 바꿨다.
        // "도움말"보다 "게임방법"이 무엇이 나올지 명확하다(도움말은 문의·FAQ로도 읽힌다).
        // 헤더 제목이 max-width: calc(100% - 200px) 라 버튼 폭은 100px 이내로 유지해야 한다.
        <button type="button" className="wordle-help-btn" onClick={() => setHelpOpen(true)}>
          <Info size={13} strokeWidth={2.5} aria-hidden />
          <span>게임방법</span>
        </button>
      }
    >
      <div className="wordle-screen">
        <header className="wordle-head">
          <p className="wordle-head-date">
            {isDaily ? (
              dateISO ?? " "
            ) : (
              <span className="wordle-head-practice">{`연습 ${practiceSession.played + 1}판`}</span>
            )}
          </p>
          {/* 게임 목적 한 줄 — 범례는 "채점 방식", 추천 칩은 "무엇을 할지"를 알려주지만
              "이게 무슨 게임인가"는 어디에도 없었다. 첫 추측 전에만 노출한다. */}
          {isDaily && results.length === 0 ? (
            <p className="wordle-head-desc">
              이름의 <strong>자음·모음 힌트</strong>로 오늘의 선수를 맞혀 보세요
            </p>
          ) : null}
          <p className="wordle-head-sub">
            {finished
              ? isDaily
                ? "오늘 공식 문제 완료"
                : "연습 판 완료"
              : results.length === 0
              ? `${MAX_ATTEMPTS}번의 기회`
              : `KBO 선수 한 명 · 남은 기회 ${MAX_ATTEMPTS - guesses.length}`}
          </p>
        </header>

        {dateISO && !answer ? (
          <p className="wordle-empty">
            {isDaily
              ? "오늘 문제를 불러올 수 없어요. 잠시 후 다시 시도해 주세요."
              : "연습 문제를 불러올 수 없어요."}
          </p>
        ) : (
          <>
            {/* 색 범례 — 색바만 보고는 무슨 뜻인지 알 수 없어서 격자 위에 상시 노출한다.
                색 클래스(.wordle-bar.is-*)를 격자와 공유하므로 색이 어긋날 수 없다.
                채점 단위 설명은 첫 추측 전에만 — 한 번 보면 되는 정보다. */}
            <section className="wordle-legend" aria-label="색상 설명">
              {results.length === 0 ? (
                <p className="wordle-legend-intro">
                  글자마다 <strong>초성·중성·종성</strong>을 따로 채점해요
                </p>
              ) : null}
              <div className="wordle-legend-items">
                <span className="wordle-legend-item">
                  <i className="wordle-bar is-hit" aria-hidden />
                  자리까지 정확
                </span>
                <span className="wordle-legend-item">
                  <i className="wordle-bar is-near" aria-hidden />
                  자리만 다름
                </span>
                <span className="wordle-legend-item">
                  <i className="wordle-bar is-miss" aria-hidden />
                  없음
                </span>
              </div>
            </section>

            <WordleGrid results={results} guessedPlayers={guessedPlayers} hints={hints} />

            {/* 첫 수 유도 — 워들에서 첫 추측은 정답을 노리는 게 아니라 단서를 뽑는
                프로브인데, 처음 접하는 사람은 그걸 모르고 빈 격자 앞에서 멈춘다. */}
            {!finished && results.length === 0 ? (
              <section className="wordle-starters" aria-label="첫 추측 추천">
                {/* 안내 문구는 정적이라 첫 페인트부터 보인다. 추천 칩은 날짜가 확정된
                    뒤에 채워지므로 자리만 미리 잡아 레이아웃이 밀리지 않게 한다. */}
                <p className="wordle-starters-hint">
                  <strong>생각나는 선수를 아무나</strong> 넣어보세요.
                  <br />
                  정답이 아니어도 글자 단서가 나와요.
                </p>
                <div className="wordle-starter-chips">
                  {starters.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      className="wordle-starter-chip"
                      onClick={() => handlePick(player)}
                    >
                      {player.name}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {!finished ? (
              <WordlePlayerSearch usedNames={guesses} onPick={handlePick} />
            ) : null}

            {answer && finished ? (
              <WordleResultSheet
                mode={mode}
                solved={solved}
                attempts={guesses.length}
                answer={answer}
                stats={stats}
                session={practiceSession}
                shareText={shareText}
                onShare={handleShare}
                onPractice={startPractice}
                onBackToDaily={backToDaily}
              />
            ) : null}

            <WordleJamoPanel status={jamoStatus} />
          </>
        )}
      </div>

      <ModalShell
        open={helpOpen}
        title="게임방법"
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
          <li>
            속성 힌트는 단계적으로 열려요. <strong>{POSITION_HINT_FROM_ATTEMPT}시도</strong>부터
            포지션, <strong>{TEAM_HINT_FROM_ATTEMPT}시도</strong>부터 팀,{" "}
            <strong>{JERSEY_HINT_FROM_ATTEMPT}시도</strong>부터 등번호 높낮이가 보여요.
          </li>
          <li>열리면 앞선 시도의 줄에도 함께 표시돼요. 외워둘 필요 없어요.</li>
          <li>6번 안에 맞히면 성공이에요. 자정에 새 문제로 바뀌어요.</li>
          <li>
            <strong>공식 문제는 하루 한 판</strong>이에요. 다 풀면 <strong>연습</strong>으로 계속
            할 수 있는데, 연습은 랜덤 문제라 기록과 공유에는 반영되지 않아요.
          </li>
          <li>정답 후보는 올 시즌 30경기 이상 출장한 {getAnswerPoolSize()}명이에요.</li>
        </ul>
      </ModalShell>
    </AppShell>
  );
}
