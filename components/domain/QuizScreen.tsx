"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Brain, CheckCircle2, XCircle, RefreshCw, Home } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { trackEvent } from "@/lib/analytics/events";
import quizData from "@/data/quiz/baseball-quiz.json";

// ── 데이터 타입 (baseball-quiz.json 구조) ──
type Tier = "초급" | "중급" | "고급";

type QuizQuestion = {
  id: string;
  tier: Tier;
  category: string;
  q: string;
  answer: string;
  distractors: string[];
  explain: string;
};

// 진입 시 1회 추출되는, 보기 순서가 셔플된 문제.
type PreparedQuestion = QuizQuestion & {
  options: string[];
};

const ALL_QUESTIONS = quizData.questions as QuizQuestion[];

// Fisher-Yates 셔플 (원본 보존). 클라이언트 전용이라 Math.random OK.
function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// 난이도별 출제 개수(고정) + 출제 순서 — 초급 3 → 중급 4 → 고급 3 (총 10, ramp).
const TIER_PLAN: ReadonlyArray<{ tier: Tier; count: number }> = [
  { tier: "초급", count: 3 },
  { tier: "중급", count: 4 },
  { tier: "고급", count: 3 }
];

function pickQuestions(): PreparedQuestion[] {
  // 난이도별로 정해진 개수만큼 랜덤 추출 → 초급→중급→고급 순서로 이어붙임.
  // 해당 난이도 문제가 부족하면 가능한 만큼만(현재 풀은 난이도별 충분).
  const picked = TIER_PLAN.flatMap(({ tier, count }) =>
    shuffle(ALL_QUESTIONS.filter((q) => q.tier === tier)).slice(0, count)
  );
  return picked.map((q) => ({
    ...q,
    options: shuffle([q.answer, ...q.distractors])
  }));
}

// 난이도별 뱃지 색 클래스.
function tierClass(tier: Tier): string {
  if (tier === "초급") return "quiz-tier-easy";
  if (tier === "중급") return "quiz-tier-mid";
  return "quiz-tier-hard";
}

// 점수대별 한줄 코멘트.
function scoreComment(score: number): string {
  if (score >= 9) return "야구 박사!";
  if (score >= 7) return "수준급";
  if (score >= 4) return "더 보면 늘어요";
  return "입문 환영";
}

// 한 문제에 대한 사용자의 선택 기록.
type AnswerRecord = {
  question: PreparedQuestion;
  selected: string;
  correct: boolean;
};

export function QuizScreen() {
  // 라운드 키 — 증가시키면 useMemo가 새 랜덤 10문제를 다시 추출.
  const [round, setRound] = useState(0);
  const questions = useMemo<PreparedQuestion[]>(() => pickQuestions(), [round]);

  const [current, setCurrent] = useState(0); // 현재 문제 인덱스 (0-based)
  const [selected, setSelected] = useState<string | null>(null); // 이번 문제에서 고른 보기
  const [records, setRecords] = useState<AnswerRecord[]>([]); // 누적 정오 기록
  const [finished, setFinished] = useState(false);
  const completionTrackedRef = useRef(false);

  const total = questions.length;
  const q = questions[current];

  // 보기 선택 — 한 문제당 1회만(이미 고른 뒤엔 잠금).
  function handleSelect(option: string) {
    if (selected !== null) return;
    setSelected(option);
    setRecords((prev) => [
      ...prev,
      { question: q, selected: option, correct: option === q.answer }
    ]);
  }

  // "다음" — 다음 문제로, 마지막이면 결과 화면.
  function handleNext() {
    if (selected === null) return;
    if (current + 1 >= total) {
      setFinished(true);
      return;
    }
    setCurrent((c) => c + 1);
    setSelected(null);
  }

  // "다시 풀기" — 새 랜덤 10문제로 전체 초기화.
  function handleRestart() {
    setRound((r) => r + 1);
    setCurrent(0);
    setSelected(null);
    setRecords([]);
    setFinished(false);
  }

  const score = records.filter((r) => r.correct).length;
  const wrong = records.filter((r) => !r.correct);

  useEffect(() => {
    completionTrackedRef.current = false;
    void trackEvent("quiz_started", { total });
  }, [round, total]);

  useEffect(() => {
    if (!finished || completionTrackedRef.current) return;
    completionTrackedRef.current = true;
    void trackEvent("quiz_completed", {
      score,
      total,
      wrong: total - score,
      accuracy: total > 0 ? Math.round((score / total) * 100) : null
    });
  }, [finished, score, total]);

  return (
    <AppShell activeTab="home" title="야구 상식 퀴즈" theme="light" backHref="/">
      <section className="quiz-screen">
        {!finished ? (
          <>
            {/* ── 진행 헤더: 번호 + 진행바 ── */}
            <div className="quiz-progress">
              <div className="quiz-progress-top">
                <span className="quiz-progress-count">
                  {current + 1} / {total}
                </span>
                <span className={`quiz-tier ${tierClass(q.tier)}`}>{q.tier}</span>
              </div>
              <div className="quiz-progress-track">
                <div
                  className="quiz-progress-fill"
                  style={{ width: `${((current + 1) / total) * 100}%` }}
                />
              </div>
            </div>

            {/* ── 문제 카드 ── */}
            <div className="quiz-question-card">
              <span className="quiz-category">{q.category}</span>
              <h2 className="quiz-question">{q.q}</h2>
            </div>

            {/* ── 보기 4개 ── */}
            <div className="quiz-options">
              {q.options.map((opt) => {
                const isAnswer = opt === q.answer;
                const isPicked = opt === selected;
                let stateClass = "";
                if (selected !== null) {
                  if (isAnswer) stateClass = " quiz-option-correct";
                  else if (isPicked) stateClass = " quiz-option-wrong";
                  else stateClass = " quiz-option-dim";
                }
                return (
                  <button
                    type="button"
                    key={opt}
                    className={`quiz-option${stateClass}`}
                    onClick={() => handleSelect(opt)}
                    disabled={selected !== null}
                  >
                    <span className="quiz-option-text">{opt}</span>
                    {selected !== null && isAnswer ? (
                      <CheckCircle2 size={18} strokeWidth={2.5} aria-hidden="true" />
                    ) : selected !== null && isPicked ? (
                      <XCircle size={18} strokeWidth={2.5} aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* ── 해설 (선택 후 노출) ── */}
            {selected !== null ? (
              <div
                className={`quiz-explain ${
                  selected === q.answer ? "quiz-explain-correct" : "quiz-explain-wrong"
                }`}
              >
                <strong className="quiz-explain-verdict">
                  {selected === q.answer ? "정답이에요!" : "아쉬워요"}
                </strong>
                <p className="quiz-explain-text">{q.explain}</p>
              </div>
            ) : null}

            {/* ── 다음 버튼 (선택 전 비활성) ── */}
            <button
              type="button"
              className="quiz-next"
              onClick={handleNext}
              disabled={selected === null}
            >
              {current + 1 >= total ? "결과 보기" : "다음"}
            </button>
          </>
        ) : (
          <>
            {/* ── 결과 화면 ── */}
            <div className="quiz-result-card">
              <span className="quiz-result-icon">
                <Brain size={32} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="quiz-result-score">
                {score}
                <span className="quiz-result-score-total"> / {total}</span>
              </span>
              <span className="quiz-result-comment">{scoreComment(score)}</span>
            </div>

            {/* ── 오답 리뷰 ── */}
            {wrong.length > 0 ? (
              <div className="quiz-review">
                <h3 className="quiz-review-title">틀린 문제 다시 보기</h3>
                <ul className="quiz-review-list">
                  {wrong.map((r) => (
                    <li className="quiz-review-item" key={r.question.id}>
                      <p className="quiz-review-q">{r.question.q}</p>
                      <p className="quiz-review-line quiz-review-mine">
                        <span className="quiz-review-label">내 답</span>
                        {r.selected}
                      </p>
                      <p className="quiz-review-line quiz-review-answer">
                        <span className="quiz-review-label">정답</span>
                        {r.question.answer}
                      </p>
                      <p className="quiz-review-explain">{r.question.explain}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="quiz-review-perfect">전부 맞히셨어요. 대단해요!</p>
            )}

            {/* ── 액션 ── */}
            <div className="quiz-result-actions">
              <button type="button" className="quiz-restart" onClick={handleRestart}>
                <RefreshCw size={16} strokeWidth={2.5} aria-hidden="true" />
                다시 풀기
              </button>
              <Link href="/" className="quiz-home" prefetch>
                <Home size={16} strokeWidth={2.5} aria-hidden="true" />
                홈으로
              </Link>
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}
