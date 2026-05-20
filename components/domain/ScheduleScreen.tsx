"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam, teams } from "@/lib/constants/teams";
import { useAppState } from "@/lib/state/AppState";
import type { Game } from "@/lib/types/domain";

const WEEKDAYS_SUN = ["일", "월", "화", "수", "목", "금", "토"];

const toDateKey = (date: Date) =>
  `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;

const isSameDate = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const parseDotDate = (date: string) => {
  const [year, month, day] = date.split(".").map(Number);
  return new Date(year, month - 1, day);
};

type CalendarDate = { date: Date; inMonth: boolean };

const getMonthDates = (visibleMonth: Date): CalendarDate[] => {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstDay.getDay());
  const lastDay = new Date(year, month + 1, 0);
  const end = new Date(lastDay);
  end.setDate(end.getDate() + (6 - lastDay.getDay()));
  const totalCells = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return Array.from({ length: totalCells }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date, inMonth: date.getMonth() === month };
  });
};

const getTeamResult = (game: Game, teamId: string): "win" | "lose" | "draw" | null => {
  if (game.status !== "finished" || game.homeScore == null || game.awayScore == null) return null;
  if (game.homeScore === game.awayScore) return "draw";
  const isHome = game.homeTeamId === teamId;
  const isAway = game.awayTeamId === teamId;
  if (!isHome && !isAway) return null;
  return (isHome ? game.homeScore > game.awayScore : game.awayScore > game.homeScore) ? "win" : "lose";
};

type ScheduleScreenProps = {
  games?: Game[];
};

export function ScheduleScreen({ games = [] }: ScheduleScreenProps) {
  const { profile } = useAppState();
  const today = new Date();

  const [selectedTeamId, setSelectedTeamId] = useState(profile.mainTeamId);
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const teamPickerRef = useRef<HTMLDivElement | null>(null);

  // 외부 클릭 시 팀 드롭다운 닫기
  useEffect(() => {
    if (!teamMenuOpen) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && teamPickerRef.current && !teamPickerRef.current.contains(target)) {
        setTeamMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [teamMenuOpen]);

  // 월간(시리즈) 보기 상태
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));

  const gamesByDate = useMemo(() => {
    const map = new Map<string, Game[]>();
    games.forEach((game) => {
      const list = map.get(game.date) ?? [];
      list.push(game);
      map.set(game.date, list);
    });
    return map;
  }, [games]);

  const calendarDates = useMemo(() => getMonthDates(visibleMonth), [visibleMonth]);
  const calendarWeeks = useMemo(
    () => Array.from({ length: Math.ceil(calendarDates.length / 7) }, (_, i) => calendarDates.slice(i * 7, i * 7 + 7)),
    [calendarDates]
  );

  const teamSeries = useMemo(() => {
    type Series = {
      startDate: Date;
      endDate: Date;
      opponentTeamId: string;
      venue: "홈" | "원정";
      myWins: number;
      myLosses: number;
      draws: number;
      totalGames: number;
      finishedGames: number;
    };
    const myGames = games
      .filter((g) => g.homeTeamId === selectedTeamId || g.awayTeamId === selectedTeamId)
      .map((g) => ({
        date: parseDotDate(g.date),
        isHome: g.homeTeamId === selectedTeamId,
        opponentTeamId: g.homeTeamId === selectedTeamId ? g.awayTeamId : g.homeTeamId,
        result: getTeamResult(g, selectedTeamId),
        finished: g.status === "finished" && g.homeScore != null && g.awayScore != null
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const series: Series[] = [];
    for (const g of myGames) {
      const prev = series[series.length - 1];
      const isContiguous = prev
        && prev.opponentTeamId === g.opponentTeamId
        && (prev.venue === "홈") === g.isHome
        && (g.date.getTime() - prev.endDate.getTime()) <= 86400000;
      const target = isContiguous ? prev : (() => {
        const newSeries: Series = {
          startDate: g.date,
          endDate: g.date,
          opponentTeamId: g.opponentTeamId,
          venue: g.isHome ? "홈" : "원정",
          myWins: 0,
          myLosses: 0,
          draws: 0,
          totalGames: 0,
          finishedGames: 0
        };
        series.push(newSeries);
        return newSeries;
      })();
      target.endDate = g.date;
      target.totalGames += 1;
      if (g.finished) {
        target.finishedGames += 1;
        if (g.result === "win") target.myWins += 1;
        else if (g.result === "lose") target.myLosses += 1;
        else if (g.result === "draw") target.draws += 1;
      }
    }
    return series;
  }, [games, selectedTeamId]);

  const getSeriesResult = (s: { myWins: number; myLosses: number; draws: number; totalGames: number; finishedGames: number }) => {
    const ended = s.totalGames > 0 && s.finishedGames === s.totalGames;
    if (!ended) {
      if (s.finishedGames === 0) return null;
      return { kind: "ongoing" as const, label: `${s.myWins}:${s.myLosses}` };
    }
    if (s.myWins === s.totalGames && s.myLosses === 0) {
      return { kind: "sweep_w" as const, label: `${s.myWins}:0 스윕` };
    }
    if (s.myLosses === s.totalGames && s.myWins === 0) {
      return { kind: "sweep_l" as const, label: `0:${s.myLosses} 스윕패` };
    }
    if (s.myWins > s.myLosses) return { kind: "winning" as const, label: `${s.myWins}:${s.myLosses} 위닝` };
    if (s.myLosses > s.myWins) return { kind: "losing" as const, label: `${s.myWins}:${s.myLosses} 루징` };
    return { kind: "split" as const, label: `${s.myWins}:${s.myLosses} 무` };
  };

  const getSeriesSegmentsForWeek = (week: CalendarDate[]) => {
    const weekStart = week[0].date.getTime();
    const weekEnd = week[6].date.getTime();
    return teamSeries
      .map((s) => {
        const segStart = Math.max(s.startDate.getTime(), weekStart);
        const segEnd = Math.min(s.endDate.getTime(), weekEnd);
        if (segStart > segEnd) return null;
        const startDay = new Date(segStart).getDay() + 1;
        const span = Math.round((segEnd - segStart) / 86400000) + 1;
        return {
          opponentTeamId: s.opponentTeamId,
          venue: s.venue,
          startDay,
          span,
          continuesFromPreviousWeek: s.startDate.getTime() < weekStart,
          continuesToNextWeek: s.endDate.getTime() > weekEnd,
          result: getSeriesResult(s)
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  };

  const selectedKey = toDateKey(selectedDate);
  const selectedGames = useMemo(() => {
    const list = gamesByDate.get(selectedKey) ?? [];
    return [...list].sort((a, b) => {
      const aMine = a.homeTeamId === selectedTeamId || a.awayTeamId === selectedTeamId ? -1 : 0;
      const bMine = b.homeTeamId === selectedTeamId || b.awayTeamId === selectedTeamId ? -1 : 0;
      return aMine - bMine;
    });
  }, [gamesByDate, selectedTeamId, selectedKey]);

  const moveMonth = (dir: -1 | 1) => {
    setVisibleMonth((current) => {
      const next = new Date(current.getFullYear(), current.getMonth() + dir, 1);
      setSelectedDate(new Date(next));
      return next;
    });
  };

  const selectDate = (date: Date) => {
    setSelectedDate(date);
    if (date.getMonth() !== visibleMonth.getMonth() || date.getFullYear() !== visibleMonth.getFullYear()) {
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const selectedTitle = `${selectedDate.getMonth() + 1}.${selectedDate.getDate()} (${WEEKDAYS_SUN[selectedDate.getDay()]})`;

  const renderMonthCell = (date: Date, inMonth: boolean) => {
    const dateKey = toDateKey(date);
    const isSelected = isSameDate(date, selectedDate);
    const dayOfWeek = date.getDay();
    const dayClass = dayOfWeek === 0 ? "sched-cell-sun" : dayOfWeek === 6 ? "sched-cell-sat" : "";

    return (
      <button
        key={dateKey}
        type="button"
        className={`sched-cell sched-cell-compact ${dayClass} ${isSelected ? "sched-cell-selected" : ""} ${!inMonth ? "sched-cell-out" : ""}`}
        onClick={() => selectDate(date)}
      >
        <span className="sched-date">{date.getDate()}</span>
      </button>
    );
  };

  const selectedTeam = getTeam(selectedTeamId);

  return (
    <AppShell activeTab="schedule" title="일정" theme="dark" hideHeader>
      {/* 상단: 팀 선택 드롭다운 + 팀 순위 버튼 */}
      <div className="sched-top-bar">
        <div className="sched-team-picker" ref={teamPickerRef}>
          <button
            type="button"
            className="sched-team-picker-trigger"
            aria-haspopup="listbox"
            aria-expanded={teamMenuOpen}
            onClick={() => setTeamMenuOpen((open) => !open)}
          >
            <TeamBadge teamId={selectedTeamId} size="sm" />
            <strong>{selectedTeam.shortName}</strong>
            <ChevronDown size={16} className={teamMenuOpen ? "sched-team-picker-chevron-open" : ""} />
          </button>
          {teamMenuOpen ? (
            <ul className="sched-team-picker-menu" role="listbox" aria-label="팀 선택">
              {teams.map((team) => {
                const active = team.id === selectedTeamId;
                return (
                  <li key={team.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={active ? "sched-team-picker-item sched-team-picker-item-active" : "sched-team-picker-item"}
                      onClick={() => {
                        setSelectedTeamId(team.id);
                        setTeamMenuOpen(false);
                      }}
                    >
                      <TeamBadge teamId={team.id} size="sm" />
                      <span>{team.name}</span>
                      {active ? <Check size={14} strokeWidth={3} className="sched-team-picker-check" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <Link className="sched-rank-btn" href="/rankings" prefetch>
          <Trophy size={14} />
          <span>팀 순위</span>
        </Link>
      </div>

      <section className="sched-card">
        <div className="sched-header">
          <button type="button" aria-label="이전 월" onClick={() => moveMonth(-1)}>
            <ChevronLeft size={20} />
          </button>
          <strong>
            {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
          </strong>
          <button type="button" aria-label="다음 월" onClick={() => moveMonth(1)}>
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="sched-weeknames">
          {WEEKDAYS_SUN.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="sched-series-grid">
          {calendarWeeks.map((week, weekIndex) => (
            <div className="sched-week" key={`${visibleMonth.toISOString()}-w${weekIndex}`}>
              <div className="sched-week-cells">
                {week.map(({ date, inMonth }) => renderMonthCell(date, inMonth))}
              </div>
              {(() => {
                const segments = getSeriesSegmentsForWeek(week);
                return (
                  <>
                    <div className="sched-series-row">
                      {segments.map((s, idx) => {
                        const opponent = getTeam(s.opponentTeamId);
                        return (
                          <span
                            key={`${weekIndex}-${s.opponentTeamId}-${s.startDay}-${idx}`}
                            className={`sched-series-bar sched-series-${s.venue === "홈" ? "home" : "away"} ${s.continuesFromPreviousWeek ? "sched-series-cont-start" : ""} ${s.continuesToNextWeek ? "sched-series-cont-end" : ""}`}
                            style={{
                              "--series-color": opponent.color,
                              gridColumn: `${s.startDay} / span ${s.span}`
                            } as CSSProperties}
                          >
                            {!s.continuesFromPreviousWeek ? <small>{s.venue}</small> : null}
                            <strong>{opponent.shortName}{s.span > 1 ? "전" : ""}</strong>
                          </span>
                        );
                      })}
                    </div>
                    <div className="sched-series-result-row">
                      {segments
                        .filter((s) => !s.continuesFromPreviousWeek && s.result)
                        .map((s, idx) => (
                          <span
                            key={`r-${weekIndex}-${s.opponentTeamId}-${s.startDay}-${idx}`}
                            className={`sched-series-result sched-series-result-${s.result!.kind}`}
                            style={{ gridColumn: `${s.startDay} / span ${s.span}` } as CSSProperties}
                          >
                            {s.result!.label}
                          </span>
                        ))}
                    </div>
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      </section>

      <section className="sched-card sched-day-card">
        <div className="sched-day-head">
          <strong className="sched-day-title">{selectedTitle}</strong>
        </div>

        <div className="sched-game-list">
          {selectedGames.length > 0 ? (
            selectedGames.map((game) => {
              const home = getTeam(game.homeTeamId);
              const away = getTeam(game.awayTeamId);
              const isMine = game.homeTeamId === selectedTeamId || game.awayTeamId === selectedTeamId;
              const center = game.status === "finished"
                ? <span className="sched-game-score">{game.awayScore} : {game.homeScore}</span>
                : game.status === "canceled"
                  ? <span className="sched-game-vs">취소</span>
                  : <span className="sched-game-vs">VS</span>;

              const statusLabel = game.status === "finished"
                ? "경기종료"
                : game.status === "canceled"
                  ? "경기취소"
                  : "경기전";
              const statusClass = game.status === "finished"
                ? "sched-game-status-done"
                : game.status === "canceled"
                  ? "sched-game-status-canceled"
                  : "sched-game-status-pre";

              return (
                <div
                  className={`sched-game-row ${isMine ? "sched-game-row-mine" : ""}`}
                  key={game.id}
                >
                  <span className="sched-game-time">{game.time ? game.time.slice(0, 5) : "--:--"}</span>
                  <div className="sched-game-match">
                    <span className="sched-game-team">
                      <TeamBadge teamId={game.awayTeamId} size="sm" />
                      <strong>{away.shortName}</strong>
                    </span>
                    {center}
                    <span className="sched-game-team sched-game-team-right">
                      <strong>{home.shortName}</strong>
                      <TeamBadge teamId={game.homeTeamId} size="sm" />
                    </span>
                  </div>
                  <span className={`sched-game-status ${statusClass}`}>{statusLabel}</span>
                </div>
              );
            })
          ) : (
            <p className="sched-game-empty">선택한 날짜에는 경기 일정이 없습니다.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}
