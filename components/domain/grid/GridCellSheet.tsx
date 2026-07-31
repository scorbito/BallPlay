"use client";

// 칸을 누르면 열리는 선수 입력 시트.
//
// 워들과 같은 자동완성 방식이다. 자유 입력을 받지 않는 이유는 동일하다 —
// 한글 IME 조합 상태를 직접 처리하지 않아도 되고, "실제 KBO 선수여야 한다"는 규칙이
// 입력 단계에서 강제된다. 다만 그리드는 은퇴 선수까지 3400명이라 목록을 더 길게 준다.

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";
import { TeamLogo } from "@/components/common/TeamLogo";
import { getTeam } from "@/lib/constants/teams";
import { FRANCHISE_NOTE } from "@/lib/grid/teams";
import { careerSpan, findPlayersByName, searchNames } from "@/lib/grid/pool";
import type { GridAxis } from "@/lib/grid/board";

const RESULT_LIMIT = 10;

type Props = {
  open: boolean;
  row: GridAxis;
  col: GridAxis;
  /** 남은 시도 수 — 시트 안에서도 보여야 함부로 찍지 않는다. */
  remaining: number;
  /** 이미 쓴 이름 — 같은 선수를 두 칸에 못 쓴다. */
  usedNames: string[];
  onClose: () => void;
  onSubmit: (name: string) => void;
};

export function GridCellSheet({ open, row, col, remaining, usedNames, onClose, onSubmit }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const used = useMemo(() => new Set(usedNames), [usedNames]);
  const matches = useMemo(() => (open ? searchNames(query, RESULT_LIMIT) : []), [open, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      // 시트 진입 애니메이션이 끝난 뒤 포커스 — 즉시 주면 모바일에서 시트가 튄다.
      const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  if (!open) return null;

  const rowTeam = getTeam(row.teamId);
  const colTeam = getTeam(col.teamId);

  const handlePick = (name: string) => {
    if (used.has(name)) return;
    onSubmit(name);
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      closeOnBackdrop
      panelClassName="grid-sheet-panel"
      ariaLabel={`${rowTeam.shortName} × ${colTeam.shortName} 정답 입력`}
      title={
        <span className="grid-sheet-title">
          <TeamLogo teamId={row.teamId} size="sm" />
          <span>{rowTeam.shortName}</span>
          <em className="grid-sheet-x">×</em>
          <TeamLogo teamId={col.teamId} size="sm" />
          <span>{colTeam.shortName}</span>
        </span>
      }
    >
      <div className="grid-sheet">
        <header className="grid-sheet-head">
          <p className="grid-sheet-sub">
            두 팀에서 모두 1군 경기에 나온 선수
            {/* 프랜차이즈 승계는 여기서도 한 번 더 짚는다 — 정답을 알면서 못 넣는 게 제일 아깝다 */}
            {FRANCHISE_NOTE[row.teamId] || FRANCHISE_NOTE[col.teamId] ? (
              <span className="grid-sheet-note">
                {[
                  FRANCHISE_NOTE[row.teamId] ? `${rowTeam.shortName}는 ${FRANCHISE_NOTE[row.teamId]}` : null,
                  FRANCHISE_NOTE[col.teamId] ? `${colTeam.shortName}는 ${FRANCHISE_NOTE[col.teamId]}` : null
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            ) : null}
          </p>
          <p className="grid-sheet-remaining">남은 기회 {remaining}</p>
        </header>

        <div className="grid-sheet-field">
          <Search size={15} aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="선수 이름 검색 (초성도 돼요)"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="선수 이름 검색"
          />
        </div>

        {query.trim() ? (
          <ul className="grid-sheet-list" aria-label="검색 결과">
            {matches.length === 0 ? (
              <li className="grid-sheet-empty">해당하는 선수가 없어요</li>
            ) : (
              matches.map((name) => {
                const isUsed = used.has(name);
                const people = findPlayersByName(name);
                // 동명이인은 판정이 이름 단위라 목록에서도 한 줄로 합친다.
                // 대신 활동 기간을 보여줘 "내가 아는 그 선수"인지 가늠하게 한다.
                const meta =
                  people.length > 1
                    ? `동명이인 ${people.length}명 · ${people
                        .map((p) => careerSpan(p))
                        .slice(0, 2)
                        .join(", ")}${people.length > 2 ? " 외" : ""}`
                    : careerSpan(people[0]);
                return (
                  <li key={name}>
                    <button
                      type="button"
                      className={`grid-sheet-item${isUsed ? " is-used" : ""}`}
                      onClick={() => handlePick(name)}
                      disabled={isUsed}
                    >
                      <span className="grid-sheet-name">{name}</span>
                      <span className="grid-sheet-meta">{isUsed ? "이미 사용" : meta}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        ) : (
          <p className="grid-sheet-hint">
            이름을 입력하면 후보가 나와요.
            <br />
            고르는 순간 시도 1회가 사용됩니다.
          </p>
        )}
      </div>
    </ModalShell>
  );
}
