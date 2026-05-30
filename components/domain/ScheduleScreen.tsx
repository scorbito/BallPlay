"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam, teams } from "@/lib/constants/teams";
import { useAppState } from "@/lib/state/AppState";
import { refreshTodayGamesAction } from "@/lib/actions/refreshTodayGames";
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
  const { profile, showToast } = useAppState();
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = new Date();

  // 일정 페이지의 팀 선택은 localStorage 에 고정. 새로 진입해도 직전 선택이 유지.
  // 응원팀과 별개라 마이페이지의 mainTeamId 와는 분리.
  const STORAGE_KEY = "ballplay:schedule:selected-team";
  const [selectedTeamId, setSelectedTeamIdState] = useState(profile.mainTeamId);
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const teamPickerRef = useRef<HTMLDivElement | null>(null);

  // SSR hydration mismatch 방지 — mount 후 localStorage 값을 한 번 적용.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && teams.some((t) => t.id === saved)) {
        setSelectedTeamIdState(saved);
      }
    } catch {
      // localStorage 접근 실패 (시크릿 모드 등) → 무시
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSelectedTeamId = (id: string) => {
    setSelectedTeamIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  };

  // "오늘 경기 결과" 메뉴에서 진입 시 자동으로 오늘 날짜 선택 + 하단 일정 카드로 스크롤
  const dayCardRef = useRef<HTMLElement | null>(null);
  const focusToday = searchParams.get("focus") === "today";

  // 갱신 — KBO API 호출해서 오늘 경기 결과 DB 동기화 → router.refresh()로 페이지 재페치
  const [refreshing, startRefresh] = useTransition();
  const handleRefresh = useCallback(() => {
    startRefresh(async () => {
      const result = await refreshTodayGamesAction();
      if (!result.ok) {
        showToast(`갱신 실패: ${result.error}`);
        return;
      }
      router.refresh();

      // 진단 친화 토스트
      if (result.source === "none") {
        showToast(`KBO: ${result.kboError ?? "?"} / 네이버: ${result.naverError ?? "?"}`);
        return;
      }
      if (result.totalFromApi === 0) {
        const kboNote = result.kboError ? ` / KBO 에러: ${result.kboError}` : "";
        showToast(`API ${result.source}: 오늘(${result.date}) 경기 0건${kboNote}`);
        return;
      }
      const changed = result.inserted + result.updated;
      const kboNote = result.kboError ? ` / KBO 에러: ${result.kboError}` : "";
      showToast(
        `갱신 완료 — API(${result.source}) ${result.totalFromApi}경기 / 종료 ${result.finishedCount} / DB 반영 ${changed}${kboNote}`
      );
    });
  }, [router, showToast]);

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
      // 우천취소 등 처리된 비결과 경기. ended 판정에서 finishedGames 와 함께
      // "처리 완료" 로 간주 (그래야 3경기 중 1경기 취소 + 2경기 finished 일 때 시리즈 종료로 판정).
      canceledGames: number;
    };
    const myGames = games
      .filter((g) => g.homeTeamId === selectedTeamId || g.awayTeamId === selectedTeamId)
      .map((g) => ({
        date: parseDotDate(g.date),
        isHome: g.homeTeamId === selectedTeamId,
        opponentTeamId: g.homeTeamId === selectedTeamId ? g.awayTeamId : g.homeTeamId,
        result: getTeamResult(g, selectedTeamId),
        finished: g.status === "finished" && g.homeScore != null && g.awayScore != null,
        canceled: g.status === "canceled"
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
          finishedGames: 0,
          canceledGames: 0
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
      } else if (g.canceled) {
        target.canceledGames += 1;
      }
    }
    return series;
  }, [games, selectedTeamId]);

  const getSeriesResult = (s: { myWins: number; myLosses: number; draws: number; totalGames: number; finishedGames: number; canceledGames: number }) => {
    // 결과가 정해진 경기 = finished + canceled. 시리즈 종료 판정에 함께 포함.
    const decidedGames = s.finishedGames + s.canceledGames;
    const ended = s.totalGames > 0 && decidedGames === s.totalGames;
    if (!ended) {
      if (s.finishedGames === 0) return null;
      // 시리즈 진행 중 — 승/패는 항상, 무는 있을 때만 표시 (예: "2승 1패", "1승 1패 1무").
      const parts: string[] = [`${s.myWins}승`, `${s.myLosses}패`];
      if (s.draws > 0) parts.push(`${s.draws}무`);
      return { kind: "ongoing" as const, label: parts.join(" ") };
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

  // 오늘 선택된 상태인지 + 오늘 경기 진행 상태 분석
  const isTodaySelected = isSameDate(selectedDate, today);
  const todayGames = isTodaySelected ? selectedGames : [];
  const allTodayFinished = todayGames.length > 0 &&
    todayGames.every((g) => g.status === "finished" || g.status === "canceled");
  // 갱신 버튼: 오늘 날짜일 때 노출. "이미 모든 경기 종료" 상태일 때만 숨김.
  //   - 0경기 표시 상태 → 노출 (DB에 today row가 없을 수 있어 한 번 fetch 필요)
  //   - 미완료 경기 있음 → 노출
  //   - 모두 종료 → 숨김
  const canShowRefresh = isTodaySelected && !allTodayFinished;

  // focus=today 진입 시 — 오늘 경기 결과가 있으면 오늘, 없으면 결과가 있는 가장 최근 날짜로.
  // 시즌 휴식일/오늘 미시작 경기뿐일 때 "결과 0건" 빈 화면 대신 어제(또는 직전 경기일) 결과 보여줌.
  useEffect(() => {
    if (!focusToday) return;

    let targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayKey = toDateKey(targetDate);
    const todayHasResults = (gamesByDate.get(todayKey) ?? []).some((g) => g.status === "finished");

    if (!todayHasResults) {
      // 가장 최근 finished 경기가 있는 과거(또는 오늘) 날짜 찾기
      const pastDatesWithResults = Array.from(gamesByDate.entries())
        .filter(([, list]) => list.some((g) => g.status === "finished"))
        .map(([key]) => parseDotDate(key))
        .filter((d) => d.getTime() <= targetDate.getTime())
        .sort((a, b) => b.getTime() - a.getTime());
      if (pastDatesWithResults.length > 0) {
        targetDate = pastDatesWithResults[0];
      }
      // 없으면 시즌 초/데이터 부재 — 오늘 유지
    }

    setSelectedDate(targetDate);
    setVisibleMonth(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
    // setSelectedDate + setVisibleMonth → 캘린더 리렌더 → 페이지 높이 변동 →
    // 100ms 타임아웃 안에 layout 완료 보장 안 됨 (특히 모바일).
    // requestAnimationFrame 2번(레이아웃 + paint) 후 + 여유 timeout 으로 안정화.
    let raf1 = 0;
    let raf2 = 0;
    let t = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        t = window.setTimeout(() => {
          dayCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToday]);

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
    <AppShell activeTab="schedule" title="일정" theme="light" hideHeader wide>
      {/* 상단: 뒤로가기 + 팀 선택(중앙) */}
      <div className="sched-top-bar">
        <Link className="sched-back-btn" href="/" aria-label="뒤로" prefetch>
          <ArrowLeft size={18} />
        </Link>
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

      <section className="sched-card sched-day-card" ref={dayCardRef}>
        <div className="sched-day-head">
          <button
            type="button"
            className="sched-day-back"
            onClick={() => router.back()}
            aria-label="뒤로가기"
            title="뒤로가기"
          >
            <ArrowLeft size={18} />
          </button>
          <strong className="sched-day-title">{selectedTitle}</strong>
          <div className="sched-day-head-right">
            {canShowRefresh ? (
              <button
                type="button"
                className="sched-day-refresh"
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label="경기 결과 갱신"
                title="경기 결과 갱신"
              >
                <RefreshCw size={14} className={refreshing ? "sched-day-refresh-spin" : ""} />
                <span>{refreshing ? "갱신 중..." : "갱신"}</span>
              </button>
            ) : null}
          </div>
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
