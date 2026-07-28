"use client";

// 결과 시트 — 정답/실패 후 노출.

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import { MAX_ATTEMPTS } from "@/lib/wordle/daily";
import type { WordlePlayer } from "@/lib/wordle/pool";
import type { WordleStats } from "@/lib/storage/wordle";

type Props = {
  solved: boolean;
  attempts: number;
  answer: WordlePlayer;
  stats: WordleStats;
  shareText: string;
  onShare: () => Promise<boolean>;
};

function commentFor(solved: boolean, attempts: number): string {
  if (!solved) return "다음 문제에 다시 도전해 보세요";
  if (attempts <= 2) return "감이 좋으시네요";
  if (attempts <= 4) return "깔끔하게 좁혔어요";
  return "막판에 잡았어요";
}

export function WordleResultSheet({
  solved,
  attempts,
  answer,
  stats,
  shareText,
  onShare
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const ok = await onShare();
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const winRate = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;

  return (
    <section className="wordle-result" aria-label="결과">
      <p className={`wordle-result-headline${solved ? " is-solved" : ""}`}>
        {solved ? `${attempts}/${MAX_ATTEMPTS} 정답!` : "아쉽게 실패"}
      </p>
      <p className="wordle-result-comment">{commentFor(solved, attempts)}</p>

      <div className="wordle-result-answer">
        <TeamBadge teamId={answer.teamId} size="md" />
        <div className="wordle-result-answer-text">
          <strong>{answer.name}</strong>
          <span>
            {getTeam(answer.teamId).shortName} · {answer.posGroup} · {answer.jersey}번
          </span>
        </div>
      </div>

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

      <button type="button" className="wordle-result-share" onClick={() => void handleShare()}>
        {copied ? <Check size={15} strokeWidth={3} aria-hidden /> : <Copy size={15} aria-hidden />}
        <span>{copied ? "복사했어요" : "결과 공유하기"}</span>
      </button>

      <pre className="wordle-result-preview" aria-label="공유 텍스트 미리보기">
        {shareText}
      </pre>

      <p className="wordle-result-next">내일 0시에 새 문제가 열려요</p>
    </section>
  );
}
