"use client";

// 결과 시트 — 정답/실패 후 노출.
//
// 데일리와 연습의 결과를 같은 컴포넌트로 처리하되 보여주는 게 다르다.
//   데일리: 누적 통계 + 공유(전 유저가 같은 문제라 비교가 성립)
//   연습  : 이번 세션 기록 + "한 판 더" (공유·누적 통계 없음)
// 연습 결과를 공유하게 하면 각자 다른 문제라 "3/6"이 비교 불가능한 숫자가 되고,
// 데일리 격자의 의미까지 희석된다.

import { useState } from "react";
import { Copy, Check, RotateCcw, CalendarDays } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { KboPlayerPhoto } from "@/components/common/KboPlayerPhoto";
import { getTeam } from "@/lib/constants/teams";
import { MAX_ATTEMPTS } from "@/lib/wordle/daily";
import type { WordlePlayer } from "@/lib/wordle/pool";
import type { WordleStats } from "@/lib/storage/wordle";

export type PracticeSession = { played: number; won: number };

type Props = {
  mode: "daily" | "practice";
  solved: boolean;
  attempts: number;
  answer: WordlePlayer;
  /** 데일리 전용 — 누적 통계 */
  stats: WordleStats | null;
  /** 연습 전용 — 이번 세션 기록 */
  session: PracticeSession;
  shareText: string;
  onShare: () => Promise<boolean>;
  onPractice: () => void;
  onBackToDaily: () => void;
};

function commentFor(solved: boolean, attempts: number): string {
  if (!solved) return "다음 문제에 다시 도전해 보세요";
  if (attempts <= 2) return "감이 좋으시네요";
  if (attempts <= 4) return "깔끔하게 좁혔어요";
  return "막판에 잡았어요";
}

export function WordleResultSheet({
  mode,
  solved,
  attempts,
  answer,
  stats,
  session,
  shareText,
  onShare,
  onPractice,
  onBackToDaily
}: Props) {
  const [copied, setCopied] = useState(false);
  const isDaily = mode === "daily";

  const handleShare = async () => {
    const ok = await onShare();
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const winRate = stats && stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;

  return (
    <section className="wordle-result" aria-label="결과">
      {!isDaily ? <span className="wordle-result-mode">연습</span> : null}

      <p className={`wordle-result-headline${solved ? " is-solved" : ""}`}>
        {solved ? `${attempts}/${MAX_ATTEMPTS} 정답!` : "아쉽게 실패"}
      </p>
      <p className="wordle-result-comment">{commentFor(solved, attempts)}</p>

      {/* 정답이 밝혀진 뒤에만 얼굴을 공개한다 — 이름만으로는 "아 그 선수" 하고 넘어가는데,
          얼굴이 뜨면 확인 욕구가 채워지고 실패했을 때도 다음 판 동기가 된다.
          원본이 94×118이라 그보다 키우지 않는다. */}
      <div className="wordle-result-answer">
        <KboPlayerPhoto
          playerId={answer.pid}
          name={answer.name}
          teamId={answer.teamId}
          year={answer.py}
          className="wordle-result-answer-photo"
        />
        <TeamBadge teamId={answer.teamId} size="md" />
        <div className="wordle-result-answer-text">
          <strong>{answer.name}</strong>
          <span>
            {getTeam(answer.teamId).shortName} · {answer.posGroup} · {answer.jersey}번
          </span>
        </div>
      </div>

      {isDaily && stats ? (
        <div className="wordle-result-stats">
          <div className="wordle-result-stat">
            <strong>{stats.played}</strong>
            <span>플레이</span>
          </div>
          <div className="wordle-result-stat">
            <strong>{winRate}%</strong>
            <span>정답률</span>
          </div>
          <div className="wordle-result-stat">
            <strong>{stats.streak}</strong>
            <span>연속</span>
          </div>
          <div className="wordle-result-stat">
            <strong>{stats.maxStreak}</strong>
            <span>최고 연속</span>
          </div>
        </div>
      ) : (
        <div className="wordle-result-stats">
          <div className="wordle-result-stat">
            <strong>{session.played}</strong>
            <span>연습 판수</span>
          </div>
          <div className="wordle-result-stat">
            <strong>{session.won}</strong>
            <span>맞힌 판</span>
          </div>
        </div>
      )}

      {isDaily ? (
        <button type="button" className="wordle-result-share" onClick={() => void handleShare()}>
          {copied ? (
            <Check size={15} strokeWidth={3} aria-hidden />
          ) : (
            <Copy size={15} aria-hidden />
          )}
          <span>{copied ? "복사했어요" : "결과 공유하기"}</span>
        </button>
      ) : null}

      {isDaily ? (
        <pre className="wordle-result-preview" aria-label="공유 텍스트 미리보기">
          {shareText}
        </pre>
      ) : null}

      <button type="button" className="wordle-result-practice" onClick={onPractice}>
        <RotateCcw size={15} strokeWidth={2.5} aria-hidden />
        <span>연습으로 한 판 더</span>
      </button>

      {isDaily ? (
        <p className="wordle-result-next">
          오늘 공식 문제는 끝났어요 · 내일 0시에 새 문제가 열려요
        </p>
      ) : (
        <button type="button" className="wordle-result-back" onClick={onBackToDaily}>
          <CalendarDays size={13} aria-hidden />
          <span>오늘 공식 문제 결과 보기</span>
        </button>
      )}
    </section>
  );
}
