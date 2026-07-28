"use client";

// 6줄 x 3칸 격자.
//
// 음절 칸은 큰 글자 1개 + 하단에 초성/중성/종성 3개 색바로 그린다.
// 자모를 9칸으로 쪼개 보여주면 모바일에서 3칸 x 6줄이 한 화면에 안 들어간다.
// 색바만으로도 "몇 번째 자모가 맞았는지"는 전달된다.

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
              <div className="wordle-row-hint">
                <span className={`wordle-chip${hint.teamMatch ? " is-match" : ""}`}>
                  {getTeam(player.teamId).shortName}
                </span>
                <span className={`wordle-chip${hint.posMatch ? " is-match" : ""}`}>
                  {player.posGroup}
                </span>
                {hint.jerseyDirection ? (
                  <span
                    className={`wordle-chip wordle-chip-jersey${
                      hint.jerseyDirection === "same" ? " is-match" : ""
                    }`}
                  >
                    {`${player.jersey}${DIRECTION_LABEL[hint.jerseyDirection]}`}
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
