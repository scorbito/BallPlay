"use client";

// 6줄 x 3칸 격자.
//
// 음절 칸은 큰 글자 1개 + 하단에 초성/중성/종성 3개 색바로 그린다.
// 자모를 9칸으로 쪼개 보여주면 모바일에서 3칸 x 6줄이 한 화면에 안 들어간다.
// 색바만으로도 "몇 번째 자모가 맞았는지"는 전달된다.

import { Check, X } from "lucide-react";
import { getTeam } from "@/lib/constants/teams";
import { MAX_ATTEMPTS, SYLLABLE_COUNT } from "@/lib/wordle/daily";
import { JAMO_KINDS } from "@/lib/wordle/jamo";
import type { GuessResult } from "@/lib/wordle/judge";
import type { WordlePlayer } from "@/lib/wordle/pool";

export type AttributeHint = {
  teamMatch: boolean;
  posMatch: boolean;
  /** 등번호 방향. 아직 안 열렸으면 null. */
  jerseyDirection: "up" | "down" | "same" | null;
};

type Props = {
  results: GuessResult[];
  /** results 와 같은 순서의 추측 선수 정보(속성 힌트용) */
  guessedPlayers: WordlePlayer[];
  hints: AttributeHint[];
};

const DIRECTION_LABEL: Record<"up" | "down" | "same", string> = {
  up: "↑",
  down: "↓",
  same: "="
};

/** 칩 안에 붙는 일치/불일치 마크. 색에 의존하지 않고 의미를 전달한다. */
function MatchMark({ matched }: { matched: boolean }) {
  return matched ? (
    <Check size={10} strokeWidth={3.5} className="wordle-chip-mark" aria-hidden />
  ) : (
    <X size={10} strokeWidth={3.5} className="wordle-chip-mark" aria-hidden />
  );
}

export function WordleGrid({ results, guessedPlayers, hints }: Props) {
  const emptyRows = Math.max(0, MAX_ATTEMPTS - results.length);

  return (
    <div className="wordle-grid" role="table" aria-label="추측 기록">
      {results.map((result, rowIndex) => {
        const player = guessedPlayers[rowIndex];
        const hint = hints[rowIndex];
        const chars = Array.from(result.name);
        return (
          <div className="wordle-row" key={`${result.name}-${rowIndex}`} role="row">
            <div className="wordle-row-cells">
              {chars.map((char, cellIndex) => {
                const syllable = result.syllables[cellIndex];
                return (
                  <div className="wordle-cell" key={cellIndex} role="cell">
                    <span className="wordle-cell-char">{char}</span>
                    <span className="wordle-cell-bars" aria-hidden>
                      {JAMO_KINDS.map((kind) => (
                        <span key={kind} className={`wordle-bar is-${syllable[kind]}`} />
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
            {player && hint ? (
              // 일치/불일치를 색으로만 표시하면 색약 사용자가 구분할 수 없고, 회색은
              // "아님"보다 "정보 없음"으로 읽힌다. 그래서 체크·엑스 마크를 함께 붙인다.
              <div className="wordle-row-hint">
                <span
                  className={`wordle-chip${hint.teamMatch ? " is-match" : ""}`}
                  aria-label={`팀 ${getTeam(player.teamId).shortName} ${
                    hint.teamMatch ? "일치" : "불일치"
                  }`}
                >
                  {getTeam(player.teamId).shortName}
                  <MatchMark matched={hint.teamMatch} />
                </span>
                <span
                  className={`wordle-chip${hint.posMatch ? " is-match" : ""}`}
                  aria-label={`포지션 ${player.posGroup} ${hint.posMatch ? "일치" : "불일치"}`}
                >
                  {player.posGroup}
                  <MatchMark matched={hint.posMatch} />
                </span>
                {hint.jerseyDirection ? (
                  <span
                    className={`wordle-chip wordle-chip-jersey${
                      hint.jerseyDirection === "same" ? " is-match" : ""
                    }`}
                    aria-label={
                      hint.jerseyDirection === "same"
                        ? `등번호 ${player.jersey} 일치`
                        : `정답 등번호는 ${player.jersey}번보다 ${
                            hint.jerseyDirection === "up" ? "큼" : "작음"
                          }`
                    }
                  >
                    {/* 등번호는 ↑↓ 가 이미 "다르다 + 방향"을 말해주므로 엑스를 덧붙이지 않는다. */}
                    {hint.jerseyDirection === "same" ? (
                      <>
                        {player.jersey}
                        <MatchMark matched />
                      </>
                    ) : (
                      `${player.jersey}${DIRECTION_LABEL[hint.jerseyDirection]}`
                    )}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {Array.from({ length: emptyRows }).map((_, rowIndex) => (
        <div className="wordle-row" key={`empty-${rowIndex}`} role="row">
          <div className="wordle-row-cells">
            {Array.from({ length: SYLLABLE_COUNT }).map((__, cellIndex) => (
              <div className="wordle-cell is-blank" key={cellIndex} role="cell" aria-hidden />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
