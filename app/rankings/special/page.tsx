"use client";

import { useEffect, useState } from "react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { AppShell } from "@/components/layout/AppShell";

type RankingRow = {
  team_id: string;
  games_played: number;
  total_runs: number;
  avg_runs: number;
  total_hits: number;
  avg_hits: number;
  total_walks_hbp: number;
  total_rbi: number;
  total_doubles: number;
  total_triples: number;
  total_homers: number;
  total_bases: number;
  total_gidp: number;
  total_late_runs: number;
  total_sacrifice_hits_flies: number;
  avg_left_on_base: number;
  total_stolen_bases: number;
  total_caught_stealing: number;
  total_pitcher_hits_allowed: number;
  total_pitcher_homers_allowed: number;
  total_pitcher_strikeouts: number;
  total_pitcher_runs_allowed: number;
  avg_runs_allowed: number;
  avg_earned_runs: number;
  total_pitcher_walks_hbp: number;
  total_errors: number;
  comeback_wins: number;
  comeback_losses: number;
  first_score_games: number;
  first_score_wins: number;
  first_score_win_rate: number;
  late_comeback_wins: number;
};

type CategoryId = "offense" | "pitching" | "operation" | "fun";

type TabDef = {
  id: keyof RankingRow;
  category: CategoryId;
  label: string;
  unit: string;
  desc: string;
  order: "asc" | "desc";
  icon: string;
};

const CATEGORIES: Array<{ id: CategoryId; label: string; desc: string }> = [
  { id: "offense", label: "공격", desc: "점수와 장타를 만드는 팀" },
  { id: "pitching", label: "투수", desc: "실점을 막고 타자를 돌려세우는 팀" },
  { id: "operation", label: "수비·운영", desc: "주루와 작전, 수비 안정감" },
  { id: "fun", label: "재미지표", desc: "기록으로 보는 숨은 팀 색깔" }
];

const TABS: TabDef[] = [
  {
    id: "avg_runs",
    category: "offense",
    label: "득점력 TOP",
    unit: "점",
    desc: "경기마다 가장 꾸준히 점수를 만든 팀",
    order: "desc",
    icon: "🔥"
  },
  {
    id: "total_hits",
    category: "offense",
    label: "안타 생산 TOP",
    unit: "안타",
    desc: "가장 많은 안타로 공격 흐름을 만든 팀",
    order: "desc",
    icon: "⚾"
  },
  {
    id: "total_homers",
    category: "offense",
    label: "홈런 생산 TOP",
    unit: "홈런",
    desc: "담장을 넘기는 한 방이 가장 많았던 팀",
    order: "desc",
    icon: "🚀"
  },
  {
    id: "total_bases",
    category: "offense",
    label: "장타 폭발 TOP",
    unit: "루타",
    desc: "안타와 장타로 가장 많은 베이스를 만든 팀",
    order: "desc",
    icon: "💥"
  },
  {
    id: "total_late_runs",
    category: "offense",
    label: "후반 집중력 TOP",
    unit: "점",
    desc: "7회 이후 가장 많은 득점을 만든 팀",
    order: "desc",
    icon: "🔥"
  },
  {
    id: "total_walks_hbp",
    category: "offense",
    label: "출루 집중 TOP",
    unit: "개",
    desc: "볼넷과 사구로 가장 많이 출루한 팀",
    order: "desc",
    icon: "👀"
  },
  {
    id: "avg_earned_runs",
    category: "pitching",
    label: "자책 억제 TOP",
    unit: "점",
    desc: "경기당 자책점을 가장 적게 내준 팀",
    order: "asc",
    icon: "🧱"
  },
  {
    id: "avg_runs_allowed",
    category: "pitching",
    label: "실점 억제 TOP",
    unit: "점",
    desc: "경기당 실점을 가장 적게 허용한 팀",
    order: "asc",
    icon: "🛡️"
  },
  {
    id: "total_pitcher_strikeouts",
    category: "pitching",
    label: "탈삼진 TOP",
    unit: "개",
    desc: "상대 타자를 가장 많이 삼진으로 돌려세운 팀",
    order: "desc",
    icon: "☄️"
  },
  {
    id: "total_pitcher_walks_hbp",
    category: "pitching",
    label: "제구 불안 TOP",
    unit: "개",
    desc: "사사구 허용이 가장 많았던 팀",
    order: "desc",
    icon: "🏭"
  },
  {
    id: "total_pitcher_homers_allowed",
    category: "pitching",
    label: "피홈런 억제 TOP",
    unit: "홈런",
    desc: "상대에게 홈런을 가장 적게 허용한 팀",
    order: "asc",
    icon: "🚫"
  },
  {
    id: "total_stolen_bases",
    category: "operation",
    label: "뛰는 야구 TOP",
    unit: "도루",
    desc: "도루 성공으로 가장 많이 베이스를 훔친 팀",
    order: "desc",
    icon: "🏃"
  },
  {
    id: "total_sacrifice_hits_flies",
    category: "operation",
    label: "작전 수행 TOP",
    unit: "개",
    desc: "희생번트와 희생플라이를 가장 많이 성공한 팀",
    order: "desc",
    icon: "📝"
  },
  {
    id: "total_errors",
    category: "operation",
    label: "실책 주의 TOP",
    unit: "개",
    desc: "실책이 가장 많았던 팀",
    order: "desc",
    icon: "🧤"
  },
  {
    id: "total_caught_stealing",
    category: "operation",
    label: "도루 실패 TOP",
    unit: "개",
    desc: "도루를 시도하다 가장 많이 잡힌 팀",
    order: "desc",
    icon: "🚨"
  },
  {
    id: "avg_left_on_base",
    category: "fun",
    label: "잔루 많은 팀",
    unit: "개",
    desc: "안타+사사구-득점으로 추정한 출루 대비 득점을 못한 팀",
    order: "desc",
    icon: "🔒"
  },
  {
    id: "total_gidp",
    category: "fun",
    label: "병살 주의보",
    unit: "개",
    desc: "병살타로 공격 흐름이 가장 자주 끊긴 팀",
    order: "desc",
    icon: "😵"
  },
  {
    id: "total_pitcher_hits_allowed",
    category: "fun",
    label: "많이 맞은 팀",
    unit: "안타",
    desc: "상대에게 가장 많은 안타를 허용한 팀",
    order: "desc",
    icon: "🥊"
  },
  {
    id: "comeback_wins",
    category: "fun",
    label: "역전승 많은 팀",
    unit: "승",
    desc: "경기 중 뒤진 적이 있지만 최종 승리한 팀",
    order: "desc",
    icon: ""
  },
  {
    id: "comeback_losses",
    category: "fun",
    label: "역전패 많은 팀",
    unit: "패",
    desc: "경기 중 앞선 적이 있지만 최종 패배한 팀",
    order: "desc",
    icon: ""
  },
  {
    id: "first_score_win_rate",
    category: "fun",
    label: "선취점 승률",
    unit: "%",
    desc: "먼저 점수를 냈을 때 승리한 비율",
    order: "desc",
    icon: ""
  },
  {
    id: "late_comeback_wins",
    category: "fun",
    label: "7회 이후 역전승",
    unit: "승",
    desc: "7회 이후 뒤진 흐름을 뒤집고 승리한 팀",
    order: "desc",
    icon: ""
  }
];

const TEAM_NAMES: Record<string, string> = {
  doosan: "두산 베어스",
  lg: "LG 트윈스",
  kt: "KT 위즈",
  ssg: "SSG 랜더스",
  nc: "NC 다이노스",
  kiwoom: "키움 히어로즈",
  samsung: "삼성 라이온즈",
  lotte: "롯데 자이언츠",
  kia: "KIA 타이거즈",
  hanwha: "한화 이글스"
};

const SPECIAL_RANKINGS_CACHE_KEY = "special-rankings:v4";
const SPECIAL_RANKINGS_CACHE_TTL_MS = 10 * 60 * 1000;

type SpecialRankingsCache = {
  savedAt: number;
  rows: RankingRow[];
  asOfDate?: string;
};

function formatAsOfDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getMonth() + 1}.${date.getDate()} 기준`;
}

export default function SpecialRankingsPage() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("offense");
  const [activeTab, setActiveTab] = useState<keyof RankingRow>("total_bases");
  const [data, setData] = useState<RankingRow[]>([]);
  const [asOfDate, setAsOfDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const cachedText = window.sessionStorage.getItem(SPECIAL_RANKINGS_CACHE_KEY);
        if (cachedText) {
          const cached = JSON.parse(cachedText) as SpecialRankingsCache;
          const isFresh =
            Array.isArray(cached.rows) &&
            Date.now() - Number(cached.savedAt ?? 0) < SPECIAL_RANKINGS_CACHE_TTL_MS;

          if (isFresh) {
            setData(cached.rows);
            setAsOfDate(cached.asOfDate || "");
            return;
          }
        }

        const res = await fetch("/api/rankings/special");
        const json = await res.json();
        if (json.ok && Array.isArray(json.rows)) {
          setData(json.rows);
          setAsOfDate(json.asOfDate || "");
          window.sessionStorage.setItem(
            SPECIAL_RANKINGS_CACHE_KEY,
            JSON.stringify({ savedAt: Date.now(), rows: json.rows, asOfDate: json.asOfDate || "" })
          );
        } else {
          throw new Error(json.error || "데이터를 로드하지 못했습니다.");
        }
      } catch (err) {
        console.error(err);
        setError("지표 데이터를 불러오는 중 문제가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const visibleTabs = TABS.filter((tab) => tab.category === activeCategory);
  const currentTabDef = TABS.find((t) => t.id === activeTab) ?? visibleTabs[0] ?? TABS[0];
  const activeCategoryDef = CATEGORIES.find((category) => category.id === activeCategory) ?? CATEGORIES[0];

  function selectCategory(categoryId: CategoryId) {
    setActiveCategory(categoryId);
    const firstTab = TABS.find((tab) => tab.category === categoryId);
    if (firstTab) setActiveTab(firstTab.id);
  }

  const sortedData = [...data].sort((a, b) => {
    const valA = Number(a[activeTab]) || 0;
    const valB = Number(b[activeTab]) || 0;
    if (currentTabDef.order === "asc") {
      return valA - valB;
    } else {
      return valB - valA;
    }
  });

  return (
    <AppShell activeTab="home" title="팀 별별랭킹" theme="light" backHref="/" wide>
      <div className="w-full max-w-2xl mx-auto px-4 py-5 bg-[#f8fafc] min-h-screen phone-frame-light">
        <header className="mb-4 text-center">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex justify-center items-center gap-2">
            기록으로 보는 팀 성향
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            팀별로 강한 부분과 약한 부분을 한눈에 확인하세요
            {asOfDate ? `(${formatAsOfDate(asOfDate)})` : ""}
          </p>
        </header>

        <div className="mb-3 grid grid-cols-4 gap-1.5" role="tablist" aria-label="별별 팀 랭킹 카테고리">
          {CATEGORIES.map((category) => {
            const isActive = category.id === activeCategory;
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => selectCategory(category.id)}
                className={`h-10 rounded-2xl border text-xs font-black transition ${
                  isActive
                    ? "border-[#FF2A7A] bg-[#FF2A7A] text-white shadow-lg shadow-pink-200/70"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        <div className="mb-4">
          <div className="flex flex-wrap gap-x-4 gap-y-2 pb-2" role="tablist" aria-label="별별 팀 랭킹 세부 항목">
            {visibleTabs.map((tab) => {
              const isActive = tab.id === activeTab;
              const label = tab.label.replace(" TOP", "");
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative h-7 shrink-0 px-0.5 text-xs font-black transition ${
                    isActive
                      ? "text-[#FF2A7A] after:absolute after:left-0 after:right-0 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-[#FF2A7A]"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 rounded-2xl border border-pink-100 bg-white px-3 py-2 text-xs font-semibold leading-relaxed text-slate-500">
            {currentTabDef.desc}
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="w-8 h-8 border-4 border-[#FF2A7A] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-500 mt-3">기록 집계 중...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center text-red-600 text-xs font-bold">
            {error}
          </div>
        ) : sortedData.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 text-xs font-bold">
            집계된 경기 통계가 없습니다.
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            {sortedData.map((row, index) => {
              const rank = index + 1;
              const teamId = row.team_id;
              const teamName = TEAM_NAMES[teamId] || teamId;
              const value = row[activeTab];

              let badgeNode = <span className="text-slate-400 font-extrabold text-sm">{rank}</span>;
              let rowClass = "border-b border-slate-100 hover:bg-slate-50/60 transition-colors";
              if (rank === 1) {
                badgeNode = <span className="text-[30px] leading-none">🥇</span>;
                rowClass += " bg-amber-50/30";
              } else if (rank === 2) {
                badgeNode = <span className="text-[26px] leading-none">🥈</span>;
              } else if (rank === 3) {
                badgeNode = <span className="text-[24px] leading-none">🥉</span>;
              }

              return (
                <div
                  key={`${String(activeTab)}-${teamId}`}
                  className={`special-rank-item flex items-center justify-between px-4 py-3.5 ${rowClass}`}
                  style={{ animationDelay: `${index * 55}ms` }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 flex items-center justify-center flex-shrink-0">
                      {badgeNode}
                    </div>
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <TeamBadge teamId={teamId} size="sm" showName={false} fallbackName={teamName} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{teamName}</p>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                        {row.games_played}경기 집계
                      </p>
                    </div>
                  </div>

                  <div className="w-20 text-right flex-shrink-0 tabular-nums">
                    <strong className="text-sm font-black text-slate-900">
                      {value}
                    </strong>
                    <span className="text-[10px] font-bold text-slate-400 ml-1">
                      {currentTabDef.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <style jsx>{`
          .special-rank-item {
            opacity: 0;
            transform: translateY(10px);
            animation: specialRankItemIn 360ms ease-out forwards;
          }

          @keyframes specialRankItemIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </AppShell>
  );
}
