"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Bot, ChevronLeft, ChevronRight, Lock, Trophy, Wand2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import { getRoster } from "@/lib/rosters";
import { trackEvent } from "@/lib/analytics/events";
import { useAppState } from "@/lib/state/AppState";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildFakeOpponentTeam, type RecentLineupHint } from "@/lib/sim/fakeOpponent";
import {
  getLatestBattingLineupForTeam,
  type RecentLineupRow
} from "@/lib/supabase/query-parts/bpRecentLineups";
import {
  applyBlendedStatsToTeam,
  buildStatsDirectoryWithRecentForm
} from "@/lib/sim/statsLoaderWithRecent";
import { generateSeed, saveMatchSession } from "@/lib/sim/matchSession";
import type { GameStatus } from "@/lib/types/api-contracts";
import type {
  AiOverallStats,
  AiProvider,
  AiProviderStats,
  BpAiPredictionRow
} from "@/lib/supabase/query-parts/bpAiPredictions";

export type AiWinnerGame = {
  id: string;
  gameTime: string | null;
  stadium: string;
  homeTeamId: string;
  awayTeamId: string;
  homeStarter: string | null;
  awayStarter: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
  predictions: BpAiPredictionRow[];
};

type Props = {
  today: string;                  // 오늘 KST YYYY-MM-DD (네비 한계용)
  selectedDate: string;           // 현재 보고 있는 날짜
  isToday: boolean;
  isFuture: boolean;              // 오늘보다 미래 (예측 없을 가능성)
  /** 이전 경기일 (없으면 null — 화살표 비활성) */
  prevDate: string | null;
  /** 다음 경기일 (없으면 null — 화살표 비활성). 미래 경기일도 허용 (AI 예측 도착 전 카운트다운 표시). */
  nextDate: string | null;
  /** 공개 여부 — 그 날 모든 경기가 3개 AI 예측을 다 갖추면 true. (기존 09시 게이트 대체) */
  published: boolean;
  showWeeklyPreview?: boolean;
  games: AiWinnerGame[];
  nextGameDate: string | null;    // 오늘 경기 없을 때 다음 경기일 (오늘 한정)
  overallStats: AiOverallStats;
  providerStats: AiProviderStats[];
  /** 운영자는 09시 공개 전이라도 잠금 해제 (컨텐츠 영상 제작용). */
  isAdmin?: boolean;
  /** 소프트 게이트 — 비로그인/익명이면 true. 매치업만 보이고 AI 픽·분석은 로그인 유도. */
  locked?: boolean;
};

const AI_LABEL: Record<AiProvider, string> = {
  gemini: "Gemini",
  claude: "Claude",
  gpt: "GPT"
};

// AI 표시 순서 — 사용자 요청에 따라 GPT → Gemini → Claude 고정.
// 적중률 헤더, 경기 카드 픽, reveal 페이지 모두 같은 순서로.
const AI_ORDER: AiProvider[] = ["gpt", "gemini", "claude"];
const AI_ORDER_RANK: Record<AiProvider, number> = { gpt: 0, gemini: 1, claude: 2 };

type WeeklySeriesPick = {
  provider: AiProvider;
  teamId: string;
  result: string;
  note: string;
};

type WeeklySeriesMock = {
  id: string;
  group: "early" | "weekend";
  label: string;
  range: string;
  homeTeamId: string;
  awayTeamId: string;
  headline: string;
  picks: WeeklySeriesPick[];
};

const WEEKLY_SERIES_MOCK: WeeklySeriesMock[] = [
  {
    id: "early-doosan-lotte",
    group: "early",
    label: "주중 3연전",
    range: "6.9 - 6.11",
    homeTeamId: "doosan",
    awayTeamId: "lotte",
    headline: "두산 선발진 우세, 롯데 타선 응집력이 변수",
    picks: [
      { provider: "gpt", teamId: "doosan", result: "두산 위닝", note: "선발 안정감" },
      { provider: "gemini", teamId: "doosan", result: "두산 2승 1패", note: "불펜 우위" },
      { provider: "claude", teamId: "lotte", result: "롯데 위닝", note: "타선 반등" }
    ]
  },
  {
    id: "early-lg-hanwha",
    group: "early",
    label: "주중 3연전",
    range: "6.9 - 6.11",
    homeTeamId: "lg",
    awayTeamId: "hanwha",
    headline: "LG의 출루 흐름과 한화 장타력이 맞붙는 시리즈",
    picks: [
      { provider: "gpt", teamId: "lg", result: "LG 위닝", note: "상위타선 우세" },
      { provider: "gemini", teamId: "hanwha", result: "한화 2승 1패", note: "장타 변수" },
      { provider: "claude", teamId: "lg", result: "LG 2승 1패", note: "수비 안정" }
    ]
  },
  {
    id: "early-kia-samsung",
    group: "early",
    label: "주중 3연전",
    range: "6.9 - 6.11",
    homeTeamId: "kia",
    awayTeamId: "samsung",
    headline: "KIA 중심타선이 앞서지만 삼성 후반 집중력도 강점",
    picks: [
      { provider: "gpt", teamId: "kia", result: "KIA 위닝", note: "득점권 강세" },
      { provider: "gemini", teamId: "kia", result: "KIA 2승 1패", note: "타선 깊이" },
      { provider: "claude", teamId: "samsung", result: "삼성 위닝", note: "후반 승부" }
    ]
  },
  {
    id: "early-ssg-nc",
    group: "early",
    label: "주중 3연전",
    range: "6.9 - 6.11",
    homeTeamId: "ssg",
    awayTeamId: "nc",
    headline: "장타 싸움으로 흐르면 SSG, 접전이면 NC가 유리",
    picks: [
      { provider: "gpt", teamId: "ssg", result: "SSG 2승 1패", note: "홈런 기대" },
      { provider: "gemini", teamId: "nc", result: "NC 위닝", note: "접전 운영" },
      { provider: "claude", teamId: "ssg", result: "SSG 위닝", note: "초반 득점" }
    ]
  },
  {
    id: "early-kt-kiwoom",
    group: "early",
    label: "주중 3연전",
    range: "6.9 - 6.11",
    homeTeamId: "kt",
    awayTeamId: "kiwoom",
    headline: "KT 마운드 운영과 키움 젊은 타선의 흐름 대결",
    picks: [
      { provider: "gpt", teamId: "kt", result: "KT 위닝", note: "마운드 우위" },
      { provider: "gemini", teamId: "kiwoom", result: "키움 2승 1패", note: "타선 활력" },
      { provider: "claude", teamId: "kt", result: "KT 2승 1패", note: "불펜 안정" }
    ]
  },
  {
    id: "weekend-doosan-kia",
    group: "weekend",
    label: "주말 3연전",
    range: "6.12 - 6.14",
    homeTeamId: "doosan",
    awayTeamId: "kia",
    headline: "상위권 분위기를 가를 수 있는 주말 핵심 시리즈",
    picks: [
      { provider: "gpt", teamId: "kia", result: "KIA 위닝", note: "공격 기대값" },
      { provider: "gemini", teamId: "doosan", result: "두산 2승 1패", note: "선발 매치업" },
      { provider: "claude", teamId: "kia", result: "KIA 2승 1패", note: "중심타선" }
    ]
  },
  {
    id: "weekend-lotte-lg",
    group: "weekend",
    label: "주말 3연전",
    range: "6.12 - 6.14",
    homeTeamId: "lotte",
    awayTeamId: "lg",
    headline: "롯데의 홈 분위기와 LG의 출루 야구가 맞붙는 시리즈",
    picks: [
      { provider: "gpt", teamId: "lg", result: "LG 위닝", note: "출루율 우세" },
      { provider: "gemini", teamId: "lotte", result: "롯데 위닝", note: "홈 강세" },
      { provider: "claude", teamId: "lg", result: "LG 2승 1패", note: "작전 수행" }
    ]
  },
  {
    id: "weekend-hanwha-ssg",
    group: "weekend",
    label: "주말 3연전",
    range: "6.12 - 6.14",
    homeTeamId: "hanwha",
    awayTeamId: "ssg",
    headline: "한화의 장타와 SSG의 한 방이 정면으로 붙는 매치업",
    picks: [
      { provider: "gpt", teamId: "ssg", result: "SSG 위닝", note: "장타 생산" },
      { provider: "gemini", teamId: "hanwha", result: "한화 2승 1패", note: "선발 호투" },
      { provider: "claude", teamId: "ssg", result: "SSG 2승 1패", note: "득점 루트" }
    ]
  },
  {
    id: "weekend-samsung-kt",
    group: "weekend",
    label: "주말 3연전",
    range: "6.12 - 6.14",
    homeTeamId: "samsung",
    awayTeamId: "kt",
    headline: "삼성의 후반 응집력과 KT의 마운드 계산이 관건",
    picks: [
      { provider: "gpt", teamId: "kt", result: "KT 2승 1패", note: "선발 안정" },
      { provider: "gemini", teamId: "samsung", result: "삼성 위닝", note: "후반 집중" },
      { provider: "claude", teamId: "kt", result: "KT 위닝", note: "불펜 우세" }
    ]
  },
  {
    id: "weekend-nc-kiwoom",
    group: "weekend",
    label: "주말 3연전",
    range: "6.12 - 6.14",
    homeTeamId: "nc",
    awayTeamId: "kiwoom",
    headline: "NC의 경기 운영이 앞서지만 키움의 업셋 가능성도 있는 시리즈",
    picks: [
      { provider: "gpt", teamId: "nc", result: "NC 위닝", note: "운영 우세" },
      { provider: "gemini", teamId: "nc", result: "NC 2승 1패", note: "투타 균형" },
      { provider: "claude", teamId: "kiwoom", result: "키움 위닝", note: "젊은 타선" }
    ]
  }
];

function formatDateLabel(dateISO: string): string {
  const [, m, d] = dateISO.split("-");
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "long"
  }).format(new Date(`${dateISO}T00:00:00+09:00`));
  return `${Number(m)}월 ${Number(d)}일(${weekday})`;
}

/** "18:30:00" 또는 "18:30" → "18:30". null/undefined 면 빈 문자열. */
function formatGameTime(time: string | null): string {
  if (!time) return "";
  return time.slice(0, 5);
}

function findRosterIdByName(teamId: string, name: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const roster = getRoster(teamId);
  const exact = roster.find((p) => p.name === trimmed);
  if (exact) return exact.id;
  const partial = roster.find((p) => p.name.includes(trimmed) || trimmed.includes(p.name));
  return partial?.id ?? null;
}

function toRecentLineupHint(
  teamId: string,
  row: RecentLineupRow | null,
  starterName: string | null
): RecentLineupHint | null {
  if (!row || !Array.isArray(row.batting) || row.batting.length < 9) return null;
  return {
    batting: row.batting,
    starter_roster_id: findRosterIdByName(teamId, starterName) ?? row.starter_roster_id,
    starter_name: starterName ?? row.starter_name
  };
}

/** 구장이 "미정" 또는 빈값이면 표시 안 함. */
function shouldShowStadium(stadium: string | null): boolean {
  if (!stadium) return false;
  const trimmed = stadium.trim();
  if (!trimmed) return false;
  return trimmed !== "미정";
}

/** 다수결 + 가중평균을 동시에 산출. UI 카드에서 한눈에. */
function summarize(predictions: BpAiPredictionRow[], homeTeamId: string, awayTeamId: string) {
  if (predictions.length === 0) return null;
  const homeVotes = predictions.filter((p) => p.predicted_winner_team_id === homeTeamId).length;
  const awayVotes = predictions.filter((p) => p.predicted_winner_team_id === awayTeamId).length;
  // 가중평균: 각 픽의 confidence를 해당 팀에 가산
  let homeWeight = 0;
  let awayWeight = 0;
  for (const p of predictions) {
    if (p.predicted_winner_team_id === homeTeamId) homeWeight += p.confidence;
    else if (p.predicted_winner_team_id === awayTeamId) awayWeight += p.confidence;
  }
  const totalWeight = homeWeight + awayWeight;
  const homePct = totalWeight > 0 ? Math.round((homeWeight / totalWeight) * 100) : 50;
  const dominantTeamId = homeVotes > awayVotes ? homeTeamId : awayVotes > homeVotes ? awayTeamId : null;
  // 합의 수준
  const isUnanimous = homeVotes === predictions.length || awayVotes === predictions.length;
  const isSplit = homeVotes > 0 && awayVotes > 0 && Math.abs(homeVotes - awayVotes) <= 1
    && predictions.length >= 2 && !isUnanimous;
  return {
    homeVotes,
    awayVotes,
    homePct,
    awayPct: 100 - homePct,
    dominantTeamId,
    isUnanimous,
    isSplit
  };
}

// reveal 페이지가 마킹하는 키 — 한 번 본 게임은 목록에서 결과 노출
function WeeklySeriesPreview() {
  const groups: Array<{ id: WeeklySeriesMock["group"]; title: string; sub: string }> = [
    { id: "early", title: "이번주초 시리즈", sub: "화-목 예상 매치업" },
    { id: "weekend", title: "주말 시리즈", sub: "금-일 예상 매치업" }
  ];

  return (
    <div className="ai-weekly-preview">
      <header className="ai-weekly-hero">
        <span className="ai-weekly-kicker">월요일 콘텐츠</span>
        <h2>이번 주 AI 시리즈 예측</h2>
        <p>이번 주 예정된 10개 시리즈를 AI 3개가 각각 예측한 임시 화면입니다.</p>
      </header>

      {groups.map((group) => (
        <section key={group.id} className="ai-weekly-section">
          <div className="ai-weekly-section-head">
            <div>
              <h3>{group.title}</h3>
              <p>{group.sub}</p>
            </div>
            <span>{WEEKLY_SERIES_MOCK.filter((s) => s.group === group.id).length}개</span>
          </div>

          <ul className="ai-weekly-series-list">
            {WEEKLY_SERIES_MOCK.filter((series) => series.group === group.id).map((series) => {
              const home = getTeam(series.homeTeamId);
              const away = getTeam(series.awayTeamId);
              return (
                <li key={series.id} className="ai-weekly-series-card">
                  <Link
                    href={`/predict/ai-winner/weekly/${series.id}`}
                    className="ai-weekly-series-link"
                    prefetch={false}
                  >
                  <div className="ai-weekly-series-top">
                    <span className="ai-weekly-series-label">{series.label}</span>
                    <span className="ai-weekly-series-range">{series.range}</span>
                  </div>

                  <div className="ai-weekly-matchup">
                    <div className="ai-weekly-team">
                      <TeamBadge teamId={series.homeTeamId} size="sm" />
                      <strong>{home.shortName}</strong>
                    </div>
                    <span className="ai-weekly-vs">vs</span>
                    <div className="ai-weekly-team">
                      <strong>{away.shortName}</strong>
                      <TeamBadge teamId={series.awayTeamId} size="sm" />
                    </div>
                  </div>

                  <p className="ai-weekly-headline">{series.headline}</p>

                  <div className="ai-weekly-picks">
                    {AI_ORDER.map((provider) => {
                      const pick = series.picks.find((p) => p.provider === provider)!;
                      return (
                        <div key={provider} className={`ai-weekly-pick ai-weekly-pick-${provider}`}>
                          <span className="ai-weekly-pick-provider">{AI_LABEL[provider]}</span>
                          <span className="ai-weekly-pick-result">
                            <TeamBadge teamId={pick.teamId} size="sm" />
                            {pick.result}
                          </span>
                          <span className="ai-weekly-pick-note">{pick.note}</span>
                        </div>
                      );
                    })}
                  </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

const SEEN_STORAGE_PREFIX = "ballplay:ai-predict-seen:";

export function AiWinnerListScreen({
  today,
  selectedDate,
  isToday,
  isFuture,
  prevDate,
  nextDate,
  published,
  showWeeklyPreview = false,
  games,
  nextGameDate,
  overallStats,
  providerStats,
  isAdmin = false,
  locked = false
}: Props) {
  // 로그인 유도 링크 — 로그인 후 현재 날짜의 AI 예측으로 복귀.
  const loginHref = `/login?next=${encodeURIComponent(`/predict/ai-winner?date=${selectedDate}`)}`;
  // 클라이언트 hydration 후 게이트 계산 (SSR 미스매치 회피)
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // 진입 시 서버 데이터(경기 status·점수) 강제 최신화.
  // 홈에서 client 네비게이션으로 들어오면 Next 라우터 캐시가 오래된 RSC 를 재사용해,
  // finished/적중·카드 open/close 가 어긋나고 "새로고침해야 열리는" 문제가 있었다.
  // 이 페이지는 경기 진행에 따라 상태가 실시간으로 바뀌므로 진입 시 1회 refresh 로
  // sim-1000 처럼 들어오자마자 최신 상태가 보이게 한다.
  const router = useRouter();
  const { showToast } = useAppState();
  const [simStartingGameId, setSimStartingGameId] = useState<string | null>(null);
  useEffect(() => {
    router.refresh();
  }, [router]);

  // 홈 펄스 뱃지용 — 오늘자 AI 예측 페이지 진입 시 viewed 마킹.
  // 공개 전이거나 예측이 0건이면 마킹 안 함 (그땐 어차피 뱃지 안 떠야 함).
  useEffect(() => {
    if (!isToday || !published) return;
    const hasAny = games.some((g) => g.predictions.length > 0);
    if (!hasAny) return;
    try {
      window.localStorage.setItem("ballplay:ai-predict:lastViewedDate", selectedDate);
    } catch {
      // ignore storage errors
    }
  }, [isToday, published, games, selectedDate]);

  useEffect(() => {
    const predictionCount = games.reduce((sum, g) => sum + g.predictions.length, 0);
    if (predictionCount === 0 || locked) return;
    void trackEvent("ai_prediction_viewed", {
      gameDate: selectedDate,
      gameCount: games.length,
      predictionCount
    });
  }, [games, locked, selectedDate]);

  // 한 번이라도 reveal 페이지에서 본 게임 id 집합. hydration 후에만 채움 (SSR 안전).
  // pageshow / visibilitychange 도 같이 감지 — reveal 다녀와서 뒤로가기로 돌아온 경우
  // bfcache로 useEffect 가 mount 시 한 번만 도는 걸 보완.
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const refresh = () => {
      const next = new Set<string>();
      for (const g of games) {
        try {
          if (window.localStorage.getItem(`${SEEN_STORAGE_PREFIX}${g.id}`) === "1") {
            next.add(g.id);
          }
        } catch {
          // ignore storage errors
        }
      }
      setSeenIds(next);
    };
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [games]);

  // 09:00 도달 전: 모든 경기가 잠금 상태.
  // 운영자(admin) 는 잠금 해제 — 컨텐츠 영상 사전 제작용으로 예측을 미리 봐야 함.
  // 공개 시각 전 — admin도 카드에 예측이 없으면 카운트다운 표시 (데이터 미생성 안내용).
  // 단 예측이 이미 존재하면 showLocked가 hasPredictions로 자연히 false가 돼서 admin은 미리 reveal됨.
  const isBeforePublish = hydrated && !published;

  const providerByName = useMemo(() => {
    const map = new Map<AiProvider, AiProviderStats>();
    for (const p of providerStats) map.set(p.ai_provider, p);
    return map;
  }, [providerStats]);

  const startPredictionSim = async (game: AiWinnerGame) => {
    if (simStartingGameId) return;
    setSimStartingGameId(game.id);
    try {
      const seed = generateSeed();
      const client = createSupabaseBrowserClient();
      const [statsDir, homeLineupRes, awayLineupRes] = await Promise.all([
        buildStatsDirectoryWithRecentForm(client, [
          game.homeTeamId,
          game.awayTeamId
        ]),
        getLatestBattingLineupForTeam(client, game.homeTeamId),
        getLatestBattingLineupForTeam(client, game.awayTeamId)
      ]);
      if (!homeLineupRes.ok || !awayLineupRes.ok) {
        showToast("최신 라인업을 불러올 수 없어요.");
        setSimStartingGameId(null);
        return;
      }
      const homeHint = toRecentLineupHint(game.homeTeamId, homeLineupRes.row, game.homeStarter);
      const awayHint = toRecentLineupHint(game.awayTeamId, awayLineupRes.row, game.awayStarter);
      if (!homeHint || !awayHint) {
        showToast("DB에 저장된 최신 라인업이 부족해요.");
        setSimStartingGameId(null);
        return;
      }
      const homeRaw = buildFakeOpponentTeam(game.homeTeamId, seed + 101, homeHint);
      const awayRaw = buildFakeOpponentTeam(game.awayTeamId, seed + 202, awayHint);
      if (!homeRaw || !awayRaw) {
        showToast("가상 경기 라인업을 만들 수 없어요.");
        setSimStartingGameId(null);
        return;
      }
      const home = applyBlendedStatsToTeam(homeRaw, statsDir);
      const away = applyBlendedStatsToTeam(awayRaw, statsDir);
      saveMatchSession({
        myTeamId: game.homeTeamId,
        opponentTeamId: game.awayTeamId,
        seed,
        input: { home, away, context: {} },
        startedAt: new Date().toISOString(),
        source: "ai"
      });
      router.push("/stadium/play");
    } catch {
      showToast("예측 시뮬레이션을 준비하는 중 오류가 발생했어요.");
      setSimStartingGameId(null);
    }
  };

  return (
    <AppShell activeTab="home" title="AI 승리팀 예측" theme="light" backHref="/" wide>
      <section className="ai-winner-screen">
        {/* ── 시즌 적중률 헤더 카드 ── */}
        <header className="ai-winner-stats-card">
          <div className="ai-winner-stats-overall">
            <span className="ai-winner-stats-label">
              <Trophy size={12} strokeWidth={2.5} />
              AI 종합
            </span>
            <span className="ai-winner-stats-accuracy">
              {overallStats.accuracy !== null ? `${overallStats.accuracy}%` : "—"}
            </span>
            <span className="ai-winner-stats-detail">
              {overallStats.correct_count} / {overallStats.total_count} 적중
            </span>
          </div>
          <div className="ai-winner-stats-providers">
            {AI_ORDER.map((name) => {
              const stat = providerByName.get(name);
              const acc = stat?.accuracy;
              const total = stat?.total_count ?? 0;
              const correct = stat?.correct_count ?? 0;
              return (
                <div key={name} className={`ai-winner-provider-mini ai-winner-provider-${name}`}>
                  <span className="ai-winner-provider-name">{AI_LABEL[name]}</span>
                  <span className="ai-winner-provider-acc">{acc !== null && acc !== undefined ? `${acc}%` : "—"}</span>
                  <span className="ai-winner-provider-count">{correct}/{total}</span>
                </div>
              );
            })}
          </div>
        </header>

        {/* ── 로그인 유도 배너 (비로그인/익명 한정). 위 종합 적중률은 미끼로 그대로 노출. ── */}
        {locked ? (
          <div className="ai-winner-login-banner">
            <Lock size={18} strokeWidth={2.5} aria-hidden="true" />
            <div className="ai-winner-login-banner-text">
              <strong>AI 승부예측은 로그인 후 볼 수 있어요</strong>
              <p>오늘 어느 팀이 이길지 — 적중률 높은 AI들의 예측과 분석을 확인하세요.</p>
            </div>
            <Link href={loginHref} className="ai-winner-login-banner-cta" prefetch={false}>
              로그인
              <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
          </div>
        ) : null}

        {/* ── 날짜 네비게이션 — 경기 없는 날 자동 스킵.
            미래로도 이동 가능 (AI 예측 도착 전엔 카운트다운 카드로 표시). ── */}
        <nav className="ai-winner-date-nav" aria-label="날짜 선택">
          {prevDate ? (
            <Link
              href={`/predict/ai-winner?date=${prevDate}`}
              className="ai-winner-date-nav-btn"
              aria-label="이전 경기일"
              prefetch={false}
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </Link>
          ) : (
            <span className="ai-winner-date-nav-btn is-disabled" aria-hidden="true">
              <ChevronLeft size={16} strokeWidth={2.5} />
            </span>
          )}
          <div className="ai-winner-date-nav-current">
            <span className="ai-winner-date-nav-date">{formatDateLabel(selectedDate)}</span>
            <span className="ai-winner-date-nav-badge">
              {isToday ? "오늘" : isFuture ? "미래" : "지난 예측"}
            </span>
          </div>
          {nextDate ? (
            <Link
              href={`/predict/ai-winner?date=${nextDate}`}
              className="ai-winner-date-nav-btn"
              aria-label="다음 경기일"
              prefetch={false}
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </Link>
          ) : (
            <span className="ai-winner-date-nav-btn is-disabled" aria-hidden="true">
              <ChevronRight size={16} strokeWidth={2.5} />
            </span>
          )}
        </nav>

        {/* ── 선택 날짜 경기 ── */}
        <section className="ai-winner-games">
          {games.length === 0 && showWeeklyPreview ? (
            <WeeklySeriesPreview />
          ) : games.length === 0 ? (
            <div className="ai-winner-empty">
              <Bot size={36} strokeWidth={1.5} aria-hidden="true" />
              <p className="ai-winner-empty-title">
                {isToday ? "오늘은 경기가 없어요" : isFuture ? "예정된 경기가 없어요" : "이날은 경기가 없었어요"}
              </p>
              {isToday && nextGameDate ? (
                <p className="ai-winner-empty-sub">다음 경기 — {formatDateLabel(nextGameDate)}</p>
              ) : null}
              {!isToday ? (
                <p className="ai-winner-empty-sub">
                  <Link href="/predict/ai-winner" className="ai-winner-back-today">오늘로 돌아가기</Link>
                </p>
              ) : !nextGameDate ? (
                <p className="ai-winner-empty-sub">다음 일정은 곧 업데이트됩니다</p>
              ) : null}
            </div>
          ) : (() => {
            // 오늘 경기가 모두 종료되면 미스터리 연출 끄고 자동으로 적중/실패 노출.
            // 사용자가 reveal 페이지 일일이 안 들어가도 결과가 한눈에 보이도록.
            const allTodayFinished =
              isToday &&
              games.every(
                (g) =>
                  g.status === "finished" ||
                  g.status === "canceled" ||
                  // 진행 중(in_progress) 경기는 중간 스코어가 있어도 종료가 아님.
                  (g.status !== "in_progress" && g.homeScore !== null && g.awayScore !== null)
              );
            return (
            <ul className="ai-winner-game-list">
              {games.map((g) => {
                const home = getTeam(g.homeTeamId);
                const away = getTeam(g.awayTeamId);
                // status='finished' 이거나, (진행 중이 아니면서) 양쪽 점수가 들어와 있으면 종료로 간주.
                // KBO sync가 status 늦게 올리는 경우도 점수만으로 적중 판정 가능하되,
                // in_progress(라이브)는 중간 스코어가 있어도 종료가 아니므로 제외 — 그래야 경기 중에
                // 적중/실패가 미리 떠버리는 버그가 없다.
                // 과거 날짜(어제 이전)는 sync 지연/누락과 무관하게 무조건 종료로 간주 — "지난 예측"
                // 라벨 보이면 결과 카드(picks + 적중/실패) 항상 펼친 상태여야 함.
                const isPastDate = !isToday && !isFuture;
                const finished =
                  g.status === "finished" ||
                  (g.status !== "in_progress" && g.homeScore !== null && g.awayScore !== null) ||
                  isPastDate;
                const isCanceled = g.status === "canceled";
                const hasPredictions = g.predictions.length > 0;
                // AI 표시 순서 고정 (GPT → Gemini → Claude)
                const orderedPredictions = [...g.predictions].sort(
                  (a, b) => AI_ORDER_RANK[a.ai_provider] - AI_ORDER_RANK[b.ai_provider]
                );
                const summary = summarize(g.predictions, g.homeTeamId, g.awayTeamId);
                // 사용자가 이 게임의 reveal 페이지를 한 번이라도 본 적 있는가
                // 안 봤으면 합의/픽/적중 미리보기를 숨겨서 클릭 동기 유발.
                // ⚠️ 미스터리 연출은 "오늘 첫 reveal"에만 의미 있음. 과거 날짜 경기는
                //    적중 결과 확인이 목적이므로 무조건 펼친 상태로 노출.
                const hasSeenReveal = seenIds.has(g.id);
                const effectiveSeen = hasSeenReveal || !isToday || allTodayFinished;

                // 카드 상태:
                //   1) 09시 전 + 예측 없음 → 잠금 카운트다운
                //   2) 09시 후 + 예측 있음 + 안 봤음 → "예측 완료 · 결과 보기" 미스터리
                //   2') 09시 후 + 예측 있음 + 봤음 → 결과 노출 (현재 로직)
                //   3) 경기 종료 + 안 봤음 → "경기 종료 · 결과 보기" (적중 가림)
                //   3') 경기 종료 + 봤음 → 점수 + 적중 노출
                //   4) 그 외 (예측 없는데 09시 지남) → "예측 준비 중"
                // 소프트 게이트: 잠겼으면 픽 데이터가 아예 없으니(predictions=[]) 모든 예측 상태를
                // 끄고 로그인 유도만 표시. 매치업·점수(종료경기)는 위에서 그대로 노출됨.
                const showLoginGate = locked;
                const showLocked = !locked && isBeforePublish && !hasPredictions;
                const showOpenTeaser = !locked && hasPredictions && !finished && !effectiveSeen;
                const showOpenRevealed = !locked && hasPredictions && !finished && effectiveSeen;
                const showFinishedTeaser = !locked && finished && hasPredictions && !effectiveSeen;
                const showFinishedRevealed = !locked && finished && effectiveSeen;
                // "예측 준비 중"은 오늘만 의미 있음. 과거 날짜(우천취소·예측 누락 등)에선
                // 별도 메시지 없이 카드를 그대로 둔다 — 결과(점수) 만 보이거나 빈 카드.
                const showPending = !locked && isToday
                  && !showLocked && !showOpenTeaser && !showOpenRevealed
                  && !showFinishedTeaser && !showFinishedRevealed && !finished;
                // 빈 종료 경기 (예측 없음 + finished) — 점수만 표시
                const showFinishedNoPredict = finished && !hasPredictions;

                // 점수는 실제 점수가 있을 때만 표시 (과거 날짜라도 sync 누락이면 0-0 가짜 점수 방지).
                // AI 예측의 적중 여부만 teaser 로 가린다.
                const showScoreInline = g.homeScore !== null && g.awayScore !== null;
                const timeLabel = formatGameTime(g.gameTime);

                return (
                  <li key={g.id} className="ai-winner-game-card">
                    <div className="ai-winner-game-row">
                      <header className="ai-winner-game-head">
                        {timeLabel ? <span className="ai-winner-game-time">{timeLabel}</span> : null}
                        {shouldShowStadium(g.stadium) ? (
                          <span className="ai-winner-game-stadium">{g.stadium}</span>
                        ) : null}
                      </header>

                      <div className="ai-winner-game-teams">
                        {/* 홈팀 — 뱃지 · 팀명 · 점수(있을 때) */}
                        <div className="ai-winner-team">
                          <TeamBadge teamId={g.homeTeamId} size="sm" />
                          <span className="ai-winner-team-name">{home.shortName}</span>
                          {showScoreInline ? (
                            <span className="ai-winner-team-score">{g.homeScore ?? 0}</span>
                          ) : null}
                        </div>
                        <span className="ai-winner-vs">vs</span>
                        {/* 어웨이팀 — 점수(있을 때) · 팀명 · 뱃지 (홈팀과 좌우 대칭) */}
                        <div className="ai-winner-team">
                          {showScoreInline ? (
                            <span className="ai-winner-team-score">{g.awayScore ?? 0}</span>
                          ) : null}
                          <span className="ai-winner-team-name">{away.shortName}</span>
                          <TeamBadge teamId={g.awayTeamId} size="sm" />
                        </div>
                      </div>

                      {/* 의견 요약 — 시간/팀 라인의 우측에 inline 으로. 아이콘 + 우세팀 + 예측률.
                          showOpenRevealed 일 때만 노출 (잠금/teaser/finished 상태에선 숨김). */}
                      {showOpenRevealed && summary ? (
                        <span
                          className={`ai-winner-game-summary ai-winner-game-summary-${
                            summary.isUnanimous ? "unanimous" : summary.isSplit ? "split" : "majority"
                          }`}
                        >
                          {summary.isUnanimous ? "🔥" : summary.isSplit ? "⚔" : "⚡"}{" "}
                          {summary.dominantTeamId
                            ? `${getTeam(summary.dominantTeamId).shortName} ${
                                summary.dominantTeamId === g.homeTeamId ? summary.homePct : summary.awayPct
                              }%`
                            : `${home.shortName} ${summary.homePct}%`}
                        </span>
                      ) : null}
                    </div>

                    {/* 우천취소·일정변경 등으로 경기 자체가 없어진 경우 — 적중 판정 불가.
                        AI 예측 픽은 그대로 표시(있으면), 적중/실패만 자연 미표시. */}
                    {isCanceled ? (
                      <div className="ai-winner-canceled-banner">
                        🌧 경기 취소 · 적중 판정 없음
                      </div>
                    ) : null}

                    {showLocked ? (
                      <div className="ai-winner-card-state ai-winner-state-locked">
                        <Lock size={12} strokeWidth={2.5} />
                        <strong>AI들이 예측 중이에요</strong>
                      </div>
                    ) : null}

                    {/* 소프트 게이트 — 비로그인은 픽 자리에 로그인 안내. */}
                    {showLoginGate ? (
                      <div className="ai-winner-card-state ai-winner-state-locked">
                        <Lock size={12} strokeWidth={2.5} />
                        AI 픽 · 분석은 <strong>로그인 후 공개</strong>
                      </div>
                    ) : null}

                    {showPending ? (
                      <div className="ai-winner-card-state ai-winner-state-pending">
                        예측 준비 중
                      </div>
                    ) : null}

                    {/* 09시 후 + 안 본 경기 — 미스터리 톤으로 클릭 유도 */}
                    {showOpenTeaser ? (
                      <div className="ai-winner-card-state ai-winner-state-teaser">
                        <Wand2 size={12} strokeWidth={2.5} />
                        AI 예측이 도착했어요
                      </div>
                    ) : null}

                    {/* 09시 후 + 본 경기 — AI별 픽만 표시. 종합 요약은 game-row 우측 inline 으로 이동. */}
                    {showOpenRevealed && summary ? (
                      <div className="ai-winner-picks">
                        {orderedPredictions.map((p) => (
                          <span
                            key={p.id}
                            className={`ai-winner-pick ai-winner-pick-${p.ai_provider}`}
                          >
                            <span className="ai-winner-pick-ai">{AI_LABEL[p.ai_provider]}</span>
                            <span className="ai-winner-pick-team">
                              <TeamBadge teamId={p.predicted_winner_team_id} size="sm" />
                              <span className="ai-winner-pick-team-name">{getTeam(p.predicted_winner_team_id).shortName}</span>
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {/* 경기 종료 + 안 본 경기 — 점수도 비공개 + 결과 보기 미스터리 톤 */}
                    {showFinishedTeaser ? (
                      <div className="ai-winner-card-state ai-winner-state-teaser">
                        <Wand2 size={12} strokeWidth={2.5} />
                        경기 종료 · AI 예측 결과 확인하기
                      </div>
                    ) : null}

                    {/* 경기 종료 + 본 경기 — AI별 픽팀 + 신뢰도 + 적중/실패 */}
                    {showFinishedRevealed && hasPredictions ? (
                      <div className="ai-winner-picks">
                        {orderedPredictions.map((p) => (
                          <span
                            key={p.id}
                            className={`ai-winner-pick ai-winner-pick-${p.ai_provider} ${p.is_correct === true ? "is-correct" : p.is_correct === false ? "is-wrong" : ""}`}
                          >
                            <span className="ai-winner-pick-ai">{AI_LABEL[p.ai_provider]}</span>
                            <span className="ai-winner-pick-team">
                              <TeamBadge teamId={p.predicted_winner_team_id} size="sm" />
                              <span className="ai-winner-pick-team-name">{getTeam(p.predicted_winner_team_id).shortName}</span>
                            </span>
                            <span className="ai-winner-pick-result">
                              {p.is_correct === true ? "✓ 적중" : p.is_correct === false ? "✗ 실패" : "—"}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {showLoginGate ? (
                      <Link href={loginHref} className="ai-winner-card-cta" prefetch={false}>
                        로그인하고 결과 보기
                        <ArrowRight size={12} strokeWidth={2.5} />
                      </Link>
                    ) : hasPredictions ? (
                      <div className="ai-winner-card-actions">
                        <Link
                          href={`/predict/ai-winner/${g.id}`}
                          className="ai-winner-card-cta ai-winner-card-cta-main"
                        >
                          결과 보기
                          <ArrowRight size={12} strokeWidth={2.5} />
                        </Link>
                        <button
                          type="button"
                          className="ai-winner-card-cta ai-winner-card-cta-sim"
                          onClick={() => void startPredictionSim(g)}
                          disabled={simStartingGameId === g.id}
                          title="최신 라인업과 오늘 선발로 가상 경기를 시작"
                        >
                          {simStartingGameId === g.id ? "준비" : "가상 경기"}
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            );
          })()}
        </section>
      </section>
    </AppShell>
  );
}
