"use client";

// Perfect Grid daily game.
//
// 워들과 같은 구조다. 서버 호출이 없다 — 격자는 커밋된 스냅샷을 날짜 시드로 생성하고
// 진행 상태·통계는 localStorage 에 둔다. 덕분에 페이지가 정적으로 유지된다.
// (지금은 운영자 테스트 단계라 페이지가 force-dynamic 이지만, 공개 전환 시
//  app/play/grid/page.tsx 의 게이트만 걷어내면 정적으로 돌아간다.)

import { useCallback, useEffect, useMemo, useState } from "react";
import { Info, RotateCcw, Share2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ModalShell } from "@/components/common/ModalShell";
import { TeamLogo } from "@/components/common/TeamLogo";
import { useAppState } from "@/lib/state/AppState";
import { getTeam } from "@/lib/constants/teams";
import {
  CELL_COUNT,
  MAX_GUESSES,
  MAX_HINTS,
  boardKeyOf,
  cellAxes,
  countAnswers,
  hintFor,
  judgeName,
  type CellIndex,
  type GridBoard
} from "@/lib/grid/board";
import { getBoardForDate, getRandomBoard, kstDateString } from "@/lib/grid/daily";
import { findPlayersByName, getNameCount, getPlayerCount, teamsOf } from "@/lib/grid/pool";
import {
  loadProgress,
  loadStats,
  recordResult,
  saveProgress,
  type GridFilled,
  type GridStats
} from "@/lib/storage/grid";
import { GridCellSheet } from "./GridCellSheet";

type Mode = "daily" | "practice";

export function GridScreen() {
  const { showToast } = useAppState();

  // 날짜·격자는 클라이언트에서만 확정한다. 서버 렌더 시점 날짜와 사용자 기기의 KST
  // 날짜가 어긋나면 하이드레이션 불일치가 난다.
  const [dateISO, setDateISO] = useState<string | null>(null);
  const [dailyFilled, setDailyFilled] = useState<GridFilled[]>([]);
  const [dailyUsed, setDailyUsed] = useState(0);
  const [dailyHinted, setDailyHinted] = useState<number[]>([]);
  const [stats, setStats] = useState<GridStats | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [openCell, setOpenCell] = useState<CellIndex | null>(null);

  // ── 연습 모드 ──
  // 공식 판은 하루 1판(공유·누적 통계의 근거). 연습은 임의 격자로 무제한이고
  // localStorage 저장도, 누적 통계 반영도 하지 않는다.
  const [mode, setMode] = useState<Mode>("daily");
  const [practiceBoard, setPracticeBoard] = useState<GridBoard | null>(null);
  const [practiceFilled, setPracticeFilled] = useState<GridFilled[]>([]);
  const [practiceUsed, setPracticeUsed] = useState(0);
  const [practiceHinted, setPracticeHinted] = useState<number[]>([]);

  useEffect(() => {
    const today = kstDateString();
    setDateISO(today);
    // 저장된 진행 상태는 날짜와 격자 지문이 모두 같을 때만 복원한다.
    const todayBoard = getBoardForDate(today);
    const saved = todayBoard ? loadProgress(today, boardKeyOf(todayBoard)) : null;
    if (saved) {
      setDailyFilled(saved.filled);
      setDailyUsed(saved.used);
      setDailyHinted(saved.hintedCells);
    }
    setStats(loadStats());
  }, []);

  const isDaily = mode === "daily";
  const board = useMemo(() => {
    if (!isDaily) return practiceBoard;
    return dateISO ? getBoardForDate(dateISO) : null;
  }, [isDaily, practiceBoard, dateISO]);

  const filled = isDaily ? dailyFilled : practiceFilled;
  const used = isDaily ? dailyUsed : practiceUsed;
  const hinted = isDaily ? dailyHinted : practiceHinted;
  const remaining = MAX_GUESSES - used;
  const hintsLeft = MAX_HINTS - hinted.length;
  const finished = filled.length === CELL_COUNT || remaining <= 0;

  /**
   * 셀별 초성 힌트 — 이미 연 칸만 값을 준다.
   * 채운 이름을 제외해 다시 계산하므로, 힌트로 가리키던 선수를 다른 칸에 써버려도
   * 남은 정답 쪽으로 힌트가 옮겨간다.
   */
  const hintByCell = useMemo(() => {
    const map = new Map<number, string>();
    if (!board) return map;
    const usedSoFar = filled.map((f) => f.name);
    for (const cell of hinted) {
      const { row, col } = cellAxes(board, cell as CellIndex);
      const value = hintFor(row, col, usedSoFar);
      if (value) map.set(cell, value);
    }
    return map;
  }, [board, hinted, filled]);

  const filledByCell = useMemo(() => {
    const map = new Map<number, GridFilled>();
    for (const item of filled) map.set(item.cell, item);
    return map;
  }, [filled]);

  const usedNames = useMemo(() => filled.map((f) => f.name), [filled]);

  // 판이 끝나면 통계에 1회 반영. recordResult 가 같은 날 중복 반영을 막는다.
  useEffect(() => {
    if (!isDaily || !dateISO || !finished) return;
    setStats(recordResult(dateISO, dailyFilled.length));
  }, [isDaily, dateISO, finished, dailyFilled.length]);

  const handleSubmit = useCallback(
    (name: string) => {
      if (!board || openCell === null || finished) return;
      const cell = openCell;
      const { row, col } = cellAxes(board, cell);
      const verdict = judgeName(name, row, col);
      const nextUsed = used + 1;

      setOpenCell(null);

      if (verdict.correct) {
        const entry: GridFilled = { cell, name, poolSize: countAnswers(row, col) };
        const nextFilled = [...filled, entry];
        if (isDaily) {
          setDailyFilled(nextFilled);
          setDailyUsed(nextUsed);
          if (dateISO) {
            saveProgress({
              date: dateISO,
              boardKey: boardKeyOf(board),
              filled: nextFilled,
              used: nextUsed,
              usedNames: nextFilled.map((f) => f.name),
              hintedCells: hinted,
              done: nextFilled.length === CELL_COUNT || MAX_GUESSES - nextUsed <= 0
            });
          }
        } else {
          setPracticeFilled(nextFilled);
          setPracticeUsed(nextUsed);
        }
        return;
      }

      // 오답 — 실제로 어느 팀에서 뛰었는지 알려준다. 그냥 "땡"만 하면 왜 틀렸는지 알 수
      // 없고, 프랜차이즈 승계(해태=KIA 등)를 오해한 경우를 스스로 교정할 수 없다.
      // judgeName 은 맞았을 때만 사람을 돌려주므로 여기서 다시 조회한다.
      const people = findPlayersByName(name);
      const hint =
        people.length === 1
          ? ` (${teamsOf(people[0])
              .map((id) => getTeam(id).shortName)
              .join("·")})`
          : "";
      showToast(`${name}은(는) 이 칸의 정답이 아니에요${hint}`);

      if (isDaily) {
        setDailyUsed(nextUsed);
        if (dateISO) {
          saveProgress({
            date: dateISO,
            boardKey: boardKeyOf(board),
            filled,
            used: nextUsed,
            usedNames,
            hintedCells: hinted,
            done: MAX_GUESSES - nextUsed <= 0
          });
        }
      } else {
        setPracticeUsed(nextUsed);
      }
    },
    [board, openCell, finished, used, filled, hinted, isDaily, dateISO, usedNames, showToast]
  );

  /** 초성 힌트 열기. 기회는 소모하지 않고 판당 MAX_HINTS 번으로 제한한다. */
  const handleHint = useCallback(() => {
    if (!board || openCell === null || hintsLeft <= 0 || hinted.includes(openCell)) return;
    const next = [...hinted, openCell];
    if (isDaily) {
      setDailyHinted(next);
      if (dateISO) {
        saveProgress({
          date: dateISO,
          boardKey: boardKeyOf(board),
          filled,
          used,
          usedNames,
          hintedCells: next,
          done: false
        });
      }
    } else {
      setPracticeHinted(next);
    }
  }, [board, openCell, hintsLeft, hinted, isDaily, dateISO, filled, used, usedNames]);

  const startPractice = useCallback(() => {
    setPracticeBoard(getRandomBoard());
    setPracticeFilled([]);
    setPracticeUsed(0);
    setPracticeHinted([]);
    setMode("practice");
  }, []);

  const handleShare = useCallback(async () => {
    if (!board) return;
    const lines: string[] = [];
    for (let r = 0; r < 3; r++) {
      let line = "";
      for (let c = 0; c < 3; c++) line += filledByCell.has(r * 3 + c) ? "🟩" : "⬜";
      lines.push(line);
    }
    const text = [
      `퍼펙트 그리드 ${dateISO ?? ""}`.trim(),
      `${filled.length}/9칸 · 시도 ${used}회`,
      ...lines,
      "https://ballnori.com/play/grid"
    ].join("\n");
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        showToast("결과를 복사했어요");
      }
    } catch {
      // 사용자가 공유 시트를 닫은 경우 — 알릴 필요 없다.
    }
  }, [board, filledByCell, filled.length, used, dateISO, showToast]);

  const openSheetFor = (cell: CellIndex) => {
    if (finished || filledByCell.has(cell)) return;
    setOpenCell(cell);
  };

  return (
    // theme="light" 가 .phone-frame-light 를 붙인다 — grid.css 전체가 이 클래스 아래로
    // 스코프돼 있어 빠뜨리면 스타일이 통째로 죽는다(워들과 동일한 구조).
    <AppShell
      activeTab="home"
      title="퍼펙트 그리드"
      theme="light"
      backHref="/"
      headerAction={
        <button type="button" className="grid-help-btn" onClick={() => setHelpOpen(true)}>
          <Info size={13} strokeWidth={2.5} aria-hidden />
          <span>게임방법</span>
        </button>
      }
    >
      <div className="grid-game">
        <header className="grid-head">
          <p className="grid-head-date">{isDaily ? (dateISO ?? " ") : "연습 판"}</p>
          <p className="grid-subtitle">
            {finished
              ? `${filled.length}/9칸 · 시도 ${used}회`
              : `남은 기회 ${remaining} · ${filled.length}/9칸`}
          </p>
        </header>

        {/* 모드 전환 — 공식 판을 끝낸 뒤에도 계속 놀 수 있게 */}
        <div className="grid-mode-tabs" role="tablist" aria-label="모드">
          <button
            type="button"
            role="tab"
            aria-selected={isDaily}
            className={`grid-mode-tab${isDaily ? " is-active" : ""}`}
            onClick={() => setMode("daily")}
          >
            오늘의 판
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isDaily}
            className={`grid-mode-tab${!isDaily ? " is-active" : ""}`}
            onClick={startPractice}
          >
            연습
          </button>
        </div>

        {!board ? (
          <p className="grid-empty">격자를 준비하고 있어요…</p>
        ) : (
          <>
            <div className="grid-board" role="grid" aria-label="9칸 격자">
              {/* 좌상단 빈 칸 + 열 머리 */}
              <div className="grid-corner" aria-hidden />
              {board.cols.map((axis) => (
                <div key={`col-${axis.teamId}`} className="grid-axis grid-axis-col">
                  <TeamLogo teamId={axis.teamId} size="sm" />
                  <span>{getTeam(axis.teamId).shortName}</span>
                </div>
              ))}

              {board.rows.map((rowAxis, r) => (
                <div key={`row-${rowAxis.teamId}`} className="grid-row" role="row">
                  <div className="grid-axis grid-axis-row">
                    <TeamLogo teamId={rowAxis.teamId} size="sm" />
                    <span>{getTeam(rowAxis.teamId).shortName}</span>
                  </div>
                  {board.cols.map((colAxis, c) => {
                    const index = (r * 3 + c) as CellIndex;
                    const hit = filledByCell.get(index);
                    const pool = countAnswers(rowAxis, colAxis);
                    return (
                      <button
                        key={`cell-${index}`}
                        type="button"
                        role="gridcell"
                        className={`grid-cell${hit ? " is-filled" : ""}${finished && !hit ? " is-missed" : ""}`}
                        onClick={() => openSheetFor(index)}
                        disabled={finished || Boolean(hit)}
                        aria-label={`${getTeam(rowAxis.teamId).shortName} × ${getTeam(colAxis.teamId).shortName}${
                          hit ? ` — ${hit.name}` : ""
                        }`}
                      >
                        {hit ? (
                          <>
                            <span className="grid-cell-name">{hit.name}</span>
                            {/* 희소성 — 후보가 적은 칸을 맞힐수록 잘한 것이다.
                                유저 통계가 없는 v1 에서는 정답 후보 수로 대신한다. */}
                            <span className="grid-cell-pool">후보 {hit.poolSize}명</span>
                          </>
                        ) : finished ? (
                          <span className="grid-cell-pool">정답 {pool}명</span>
                        ) : (
                          <>
                            {/* 열어둔 초성 힌트는 칸에 남긴다 — 시트를 닫아도 다시
                                열어보지 않게. 힌트가 없으면 + 로 빈 칸임을 알린다. */}
                            {hintByCell.has(index) ? (
                              <span className="grid-cell-hint">{hintByCell.get(index)}</span>
                            ) : (
                              <span className="grid-cell-plus" aria-hidden>
                                +
                              </span>
                            )}
                            {/* 진행 중에도 후보 수를 보여준다. 어느 칸이 쉬운지 알면
                                순서를 고를 수 있어 막막함이 크게 준다. */}
                            <span className="grid-cell-pool">후보 {pool}명</span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {finished ? (
              <section className="grid-result" aria-label="결과">
                <p className="grid-result-line">
                  <strong>{filled.length}칸</strong>을 채웠어요
                  {filled.length === CELL_COUNT ? " — 완벽!" : ""}
                </p>
                {stats && isDaily ? (
                  <p className="grid-result-stats">
                    누적 {stats.played}판 · 최고 {stats.bestFilled}칸 · 전부 채운 판 {stats.perfect}회
                  </p>
                ) : null}
                <div className="grid-result-actions">
                  <button type="button" className="grid-btn is-primary" onClick={handleShare}>
                    <Share2 size={15} aria-hidden /> 결과 공유
                  </button>
                  <button type="button" className="grid-btn" onClick={startPractice}>
                    <RotateCcw size={15} aria-hidden /> 연습 한 판 더
                  </button>
                </div>
              </section>
            ) : (
              <p className="grid-guide">
                칸을 눌러 <strong>두 팀에서 모두 뛴 선수</strong>를 넣어보세요.
              </p>
            )}
          </>
        )}

        {board && openCell !== null ? (
          <GridCellSheet
            open
            row={cellAxes(board, openCell).row}
            col={cellAxes(board, openCell).col}
            remaining={remaining}
            poolSize={countAnswers(cellAxes(board, openCell).row, cellAxes(board, openCell).col)}
            hint={hintByCell.get(openCell) ?? null}
            hintsLeft={hintsLeft}
            usedNames={usedNames}
            onHint={handleHint}
            onClose={() => setOpenCell(null)}
            onSubmit={handleSubmit}
          />
        ) : null}

        <ModalShell open={helpOpen} onClose={() => setHelpOpen(false)} closeOnBackdrop title="게임 방법">
          <div className="grid-help">
            <p>
              가로줄과 세로줄에 팀이 하나씩 있어요. 각 칸에는 <strong>두 팀에서 모두 1군
              경기에 나온 선수</strong>를 넣습니다.
            </p>
            <ul>
              <li>기회는 {MAX_GUESSES}번. 틀려도 1회가 사용돼요.</li>
              <li>
                막히면 <strong>초성 힌트</strong>를 쓰세요. 판당 {MAX_HINTS}번까지 쓸 수 있고 기회는
                줄지 않아요.
              </li>
              <li>칸에 적힌 &ldquo;후보 N명&rdquo;은 그 칸의 정답이 몇 명인지예요. 많은 칸부터 채우면 쉬워요.</li>
              <li>같은 선수는 두 칸에 쓸 수 없어요.</li>
              <li>1982년부터 지금까지 뛴 선수 {getPlayerCount().toLocaleString()}명이 정답 후보예요. 은퇴 선수도 포함됩니다.</li>
              <li>
                팀 이름은 프랜차이즈 기준이에요. KIA는 해태, LG는 MBC, 두산은 OB, SSG는 SK,
                한화는 빙그레, 키움은 히어로즈·넥센 시절을 포함합니다.
              </li>
              <li>동명이인은 이름만 맞으면 돼요. 그 이름의 누군가가 조건에 맞으면 정답입니다.</li>
            </ul>
            <p className="grid-help-foot">
              등록된 이름 {getNameCount().toLocaleString()}개 · 매일 자정(KST)에 새 격자가 열려요.
            </p>
          </div>
        </ModalShell>
      </div>
    </AppShell>
  );
}
