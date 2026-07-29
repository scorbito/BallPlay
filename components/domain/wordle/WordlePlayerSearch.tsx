"use client";

// 선수 검색 자동완성 입력.
//
// 커스텀 자모 키보드 대신 이 방식을 쓰는 이유:
//   1) 한글 IME 의 조합 중 상태(ㄱ → 기 → 김)를 직접 처리하지 않아도 된다.
//   2) "추측은 실제 KBO 선수여야 한다"는 규칙이 입력 단계에서 자동으로 강제된다.
//   3) 이름을 정확히 기억하지 못해도 "김" 만 쳐서 고를 수 있다.
// 자유 입력(하드 모드)은 v2 백로그.

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { getTeam } from "@/lib/constants/teams";
import { searchPlayers, type WordlePlayer } from "@/lib/wordle/pool";

type Props = {
  disabled?: boolean;
  /** 이미 추측한 이름 — 목록에서 흐리게 처리하고 선택을 막는다. */
  usedNames: string[];
  onPick: (player: WordlePlayer) => void;
};

// 실측(898명 기준): 목록 5개로도 초성 패턴 331개 중 289개(87%)를 이미 "전부" 보여준다.
// 8개로 늘리면 96%. 즉 개수는 난이도를 거의 바꾸지 않고 찾기 편의만 달라진다.
// (난이도를 실제로 결정하는 건 초성 정보 — 초성 3자를 알면 정답 후보가 평균 1.59명이다.)
const RESULT_LIMIT = 8;

export function WordlePlayerSearch({ disabled = false, usedNames, onPick }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const used = useMemo(() => new Set(usedNames), [usedNames]);

  const matches = useMemo(() => searchPlayers(query, RESULT_LIMIT), [query]);

  // 판이 끝나면 입력창을 비운다.
  useEffect(() => {
    if (disabled) setQuery("");
  }, [disabled]);

  const handlePick = (player: WordlePlayer) => {
    if (used.has(player.name)) return;
    onPick(player);
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div className="wordle-search">
      <div className="wordle-search-field">
        <Search size={15} aria-hidden />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={disabled ? "오늘 문제는 끝났어요" : "선수 이름 검색 (초성도 돼요)"}
          disabled={disabled}
          // 모바일에서 자동 대문자·자동완성이 한글 입력을 방해하지 않도록.
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="선수 이름 검색"
        />
      </div>

      {!disabled && query.trim() ? (
        <ul className="wordle-search-list" aria-label="검색 결과">
          {matches.length === 0 ? (
            <li className="wordle-search-empty">해당하는 선수가 없어요</li>
          ) : (
            matches.map((player) => {
              const isUsed = used.has(player.name);
              return (
                <li key={player.id}>
                  <button
                    type="button"
                    className={`wordle-search-item${isUsed ? " is-used" : ""}`}
                    onClick={() => handlePick(player)}
                    disabled={isUsed}
                  >
                    <span className="wordle-search-name">{player.name}</span>
                    {/* 2단이라 셀이 좁다 — 이미 추측한 항목은 팀·포지션 대신 상태만 보여준다. */}
                    {isUsed ? (
                      <span className="wordle-search-used">이미 추측</span>
                    ) : (
                      <span className="wordle-search-meta">
                        {`${getTeam(player.teamId).shortName} · ${player.posGroup}`}
                      </span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
