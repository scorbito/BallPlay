"use client";

// 자모 현황 패널 (읽기 전용, 접이식).
//
// 입력을 자동완성으로 받기 때문에 커스텀 키보드가 없다. 그래서 "어떤 자모가 이미
// 탈락했는지" 추적하는 정보를 따로 제공한다. 기본은 접힌 상태 — 정보 밀도를 낮게 유지.

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { CHO_LIST, JONG_LIST, JUNG_LIST, type JamoKind } from "@/lib/wordle/jamo";
import type { JamoStatusMap } from "@/lib/wordle/judge";

type Props = {
  status: JamoStatusMap;
};

const ROWS: ReadonlyArray<{ kind: JamoKind; label: string; list: readonly string[] }> = [
  { kind: "cho", label: "초성", list: CHO_LIST },
  { kind: "jung", label: "중성", list: JUNG_LIST },
  { kind: "jong", label: "종성", list: JONG_LIST }
];

export function WordleJamoPanel({ status }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className={`wordle-jamo${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="wordle-jamo-toggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <ChevronDown size={14} aria-hidden />
        <span>자모 현황</span>
      </button>

      {open ? (
        <div className="wordle-jamo-body">
          {ROWS.map((row) => (
            <div className="wordle-jamo-row" key={row.kind}>
              <span className="wordle-jamo-label">{row.label}</span>
              <div className="wordle-jamo-chars">
                {row.list.map((char) => {
                  const state = status[row.kind][char];
                  return (
                    <span
                      key={char}
                      className={`wordle-jamo-char${state ? ` is-${state}` : ""}`}
                    >
                      {char}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
