"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Bot, Clock, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import type { GameStatus } from "@/lib/types/api-contracts";

type GameRow = {
  id: string;
  gameDate: string;
  gameTime: string | null;
  stadium: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
  homeStarter: string | null;
  awayStarter: string | null;
  hasPrediction: boolean;
};

type Props = {
  games: GameRow[];
  selectedDate: string;
  onDateChange: (date: string) => void;
};

export function AiBattleListScreen({ games: initialGames, selectedDate, onDateChange }: Props) {
  const router = useRouter();
  const [games, setGames] = useState(initialGames);

  // 최초 진입 시 Next.js Router Cache 강제 무효화 및 최신화
  useEffect(() => {
    router.refresh();
  }, [router]);

  // 마운트/날짜 변경 시 predictions 재확인 — 서버 캐시로 stale 데이터가 왔을 때 보정.
  useEffect(() => {
    setGames(initialGames);
    const ids = initialGames.map((g) => g.id).filter(Boolean);
    if (ids.length === 0) return;
    fetch(`/api/predict/ai-winner/predictions-check?ids=${ids.join(",")}`)
      .then((r) => r.json())
      .then((active: string[]) => {
        const set = new Set(active);
        setGames((prev) => prev.map((g) => ({ ...g, hasPrediction: set.has(g.id) })));
      })
      .catch(() => {});
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps
  // 날짜 포맷팅 헬퍼
  const formatDateLabel = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const days = ["일", "월", "화", "수", "목", "금", "토"];
      return `${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
    } catch {
      return dateStr;
    }
  };

  // 날짜 이동 헬퍼
  const navigateDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    onDateChange(`${yyyy}-${mm}-${dd}`);
  };

  const today = new Date().toISOString().slice(0, 10);
  const isFutureDate = selectedDate > today;

  return (
    <AppShell activeTab="home" title="AI 승부 맞대결" backHref="/" theme="light" wide>
      <section className="ai-winner-screen">
        {/* ── 상단 인트로 히어로 배너 (가운데 정렬) ── */}
        <header className="ai-battle-hero-card">
          <div className="ai-battle-hero-card-content">
            <span style={{ fontSize: "11px", fontWeight: 900, color: "var(--bp-accent)", padding: "3px 10px", background: "rgba(232,74,138,0.1)", borderRadius: "999px", width: "fit-content" }}>
              💡 신규 대결 콘텐츠
            </span>
            <h2 style={{ margin: 0, fontSize: "19px", fontWeight: 900, color: "var(--bp-text)", letterSpacing: "-0.5px" }}>
              Gemini vs GPT 승리 근거 매치
            </h2>
            <p style={{ margin: 0, fontSize: "12.5px", fontWeight: 650, color: "var(--bp-text-secondary)", lineHeight: 1.5, maxWidth: "420px" }}>
              홈팀 수호자 <strong>Gemini</strong>와 원정팀 수호자 <strong>GPT</strong>가 분석한 결정적인 승리 요인 분석 대결!
              매 경기 어느 쪽 AI 주장이 더 강력한지 투표해보세요.
            </p>
          </div>
        </header>

        {/* ── 날짜 선택 네비게이터 ── */}
        <nav className="ai-winner-date-nav" aria-label="날짜 선택">
          <button type="button" onClick={() => navigateDate(-1)} className="ai-winner-date-nav-btn">
            ◀
          </button>
          <div className="ai-winner-date-nav-current">
            <span className="ai-winner-date-nav-date">{formatDateLabel(selectedDate)}</span>
          </div>
          <button type="button" onClick={() => navigateDate(1)} className="ai-winner-date-nav-btn">
            ▶
          </button>
        </nav>

        {/* ── 대결 매치 리스트 ── */}
        <section className="ai-winner-games">
          {games.length === 0 ? (
            <div className="ai-winner-empty">
              <CalendarDays size={32} />
              {isFutureDate ? (
                <>
                  <p className="ai-winner-empty-title">아직 경기 일정이 없습니다</p>
                  <p className="ai-winner-empty-sub">경기 일정이 확정되면 대결이 열립니다.</p>
                </>
              ) : (
                <>
                  <p className="ai-winner-empty-title">경기가 없습니다</p>
                  <p className="ai-winner-empty-sub">해당 날짜에는 예정된 경기가 없습니다.</p>
                </>
              )}
            </div>
          ) : (
            <ul className="ai-winner-game-list" style={{ gap: "8px", paddingBottom: "20px" }}>
              {games.map((g) => {
                const home = getTeam(g.homeTeamId);
                const away = getTeam(g.awayTeamId);
                const finished = g.status === "finished";
                const canEnter = g.hasPrediction && !isFutureDate;

                return (
                  <li key={g.id} className="ai-battle-game-card">
                    {/* 상단 메타 정보 영역 */}
                    <div className="ai-battle-card-meta">
                      <span className="ai-battle-meta-time">
                        <Clock size={14} className="ai-battle-clock-icon" />
                        {(g.gameTime ?? "18:30").slice(0, 5)} {g.stadium}
                      </span>
                      <span className="ai-battle-meta-status" style={{
                        background: finished ? "#f1f3f5" : isFutureDate ? "#f1f3f5" : "#ffe8ec",
                        color: finished ? "#495057" : isFutureDate ? "#868e96" : "#ff2a85"
                      }}>
                        {finished ? "경기 종료" : isFutureDate ? "예정" : "배틀 투표중 🔥"}
                      </span>
                    </div>

                    {/* 데칼코마니 Versus 바디 영역 */}
                    <div className="ai-battle-match-body">
                      {/* 좌측: 홈팀 수호 박스 */}
                      <div className="ai-battle-team-box home-box">
                        <div className="ai-battle-team-box-inner">
                          <div className="ai-battle-team-row">
                            <TeamBadge teamId={g.homeTeamId} size="sm" />
                            <span className="ai-battle-team-name">{home.name.split(" ")[0]}</span>
                            {finished && (
                              <span className="ai-battle-team-score">{g.homeScore ?? 0}</span>
                            )}
                          </div>
                          <span className="ai-battle-team-ai gemini-ai">
                            <Sparkles size={11} />
                            Gemini 승리론
                          </span>
                        </div>
                      </div>

                      {/* 중앙 VS 디바이더 */}
                      <div className="ai-battle-center-vs">
                        <div className="vs-glow-circle">
                          <span>Vs</span>
                        </div>
                      </div>

                      {/* 우측: 원정팀 수호 박스 */}
                      <div className="ai-battle-team-box away-box">
                        <div className="ai-battle-team-box-inner">
                          <div className="ai-battle-team-row">
                            <TeamBadge teamId={g.awayTeamId} size="sm" />
                            <span className="ai-battle-team-name">{away.name.split(" ")[0]}</span>
                            {finished && (
                              <span className="ai-battle-team-score">{g.awayScore ?? 0}</span>
                            )}
                          </div>
                          <span className="ai-battle-team-ai gpt-ai">
                            <Bot size={11} />
                            GPT 승리론
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 하단 대결장 들어가기 버튼 */}
                    <div className="ai-battle-action-row">
                      {canEnter ? (
                        <Link
                          href={`/predict/battle/${g.id}`}
                          className="ai-battle-enter-btn"
                        >
                          대결장 들어가기 & 투표하기 <span className="btn-arrow">&gt;</span>
                        </Link>
                      ) : (
                        <span className="ai-battle-enter-btn is-disabled">
                          {isFutureDate ? "예측 오픈 전" : "대결 데이터 없음"}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </section>
    </AppShell>
  );
}
