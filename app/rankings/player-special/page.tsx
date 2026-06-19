"use client";

import { useEffect, useState } from "react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { AppShell } from "@/components/layout/AppShell";
import { getTeam } from "@/lib/constants/teams";

type PlayerKind = "batter" | "pitcher";

type PlayerRankingRow = {
  player_id: string;
  player_name: string;
  team_id: string;
  kind: PlayerKind;
  snapshot_date: string;
  games: number;
  starts: number;
  pa: number;
  ab: number;
  ip: number;
  hits: number;
  homers: number;
  rbi: number;
  doubles: number;
  triples: number;
  walks: number;
  hbp: number;
  strikeouts: number;
  sb: number;
  cs: number;
  total_bases: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  era: number;
  whip: number;
  pitcher_strikeouts: number;
  wins: number;
  saves: number;
  holds: number;
  bb9: number;
  hr9: number;
  pitcher_homers_allowed: number;
};

type CategoryId = "batting" | "pitching" | "fun";
type MetricId = keyof PlayerRankingRow;

type TabDef = {
  id: MetricId;
  category: CategoryId;
  label: string;
  title: string;
  unit: string;
  desc: string;
  order: "asc" | "desc";
  kind: PlayerKind | "all";
  minPa?: number;
  minIp?: number;
  minStarts?: number;
  minValue?: number;
  subText: (row: PlayerRankingRow) => string;
  format: (value: number) => string;
};

const CATEGORIES: Array<{ id: CategoryId; label: string; desc: string }> = [
  { id: "batting", label: "타격", desc: "시즌 누적 타격 성향" },
  { id: "pitching", label: "투수", desc: "시즌 누적 투수 성향" },
  { id: "fun", label: "재미지표", desc: "기록으로 보는 선수별 숨은 특징" }
];

const TABS: TabDef[] = [
  {
    id: "ops",
    category: "batting",
    label: "OPS",
    title: "OPS TOP",
    unit: "",
    desc: "출루와 장타를 함께 만든 타자",
    order: "desc",
    kind: "batter",
    minPa: 50,
    subText: (row) => `${row.pa}타석 · ${row.homers}홈런`,
    format: formatRate
  },
  {
    id: "homers",
    category: "batting",
    label: "홈런",
    title: "홈런 TOP",
    unit: "개",
    desc: "담장을 가장 많이 넘긴 타자",
    order: "desc",
    kind: "batter",
    minValue: 1,
    subText: (row) => `${row.ab}타수 · OPS ${formatRate(row.ops)}`,
    format: formatInteger
  },
  {
    id: "hits",
    category: "batting",
    label: "안타",
    title: "안타 TOP",
    unit: "개",
    desc: "가장 꾸준히 안타를 만든 타자",
    order: "desc",
    kind: "batter",
    minValue: 1,
    subText: (row) => `${row.games}경기 · 타율 ${formatRate(row.avg)}`,
    format: formatInteger
  },
  {
    id: "slg",
    category: "batting",
    label: "장타율",
    title: "장타율 TOP",
    unit: "",
    desc: "한 번 칠 때 가장 멀리 보내는 타자",
    order: "desc",
    kind: "batter",
    minPa: 50,
    subText: (row) => `${row.total_bases}루타 · ${row.homers}홈런`,
    format: formatRate
  },
  {
    id: "obp",
    category: "batting",
    label: "출루율",
    title: "출루율 TOP",
    unit: "",
    desc: "가장 자주 살아 나가는 타자",
    order: "desc",
    kind: "batter",
    minPa: 50,
    subText: (row) => `${row.pa}타석 · 볼넷 ${row.walks}개`,
    format: formatRate
  },
  {
    id: "wins",
    category: "pitching",
    label: "승리수",
    title: "승리수 TOP",
    unit: "승",
    desc: "가장 많은 승리를 기록한 투수",
    order: "desc",
    kind: "pitcher",
    minValue: 1,
    subText: (row) => `${row.games}경기 · ERA ${row.era.toFixed(2)}`,
    format: formatInteger
  },
  {
    id: "era",
    category: "pitching",
    label: "ERA",
    title: "ERA TOP",
    unit: "",
    desc: "시즌 누적 기준 가장 안정적으로 막은 투수",
    order: "asc",
    kind: "pitcher",
    minIp: 20,
    minStarts: 3,
    subText: (row) => `${row.starts}선발 · ${formatIp(row.ip)}이닝`,
    format: (value) => value.toFixed(2)
  },
  {
    id: "whip",
    category: "pitching",
    label: "WHIP",
    title: "WHIP TOP",
    unit: "",
    desc: "이닝당 출루 허용이 적은 투수",
    order: "asc",
    kind: "pitcher",
    minIp: 20,
    minStarts: 3,
    subText: (row) => `${row.starts}선발 · ERA ${row.era.toFixed(2)}`,
    format: (value) => value.toFixed(2)
  },
  {
    id: "pitcher_strikeouts",
    category: "pitching",
    label: "탈삼진",
    title: "탈삼진 TOP",
    unit: "K",
    desc: "타자를 가장 많이 돌려세운 투수",
    order: "desc",
    kind: "pitcher",
    minValue: 1,
    subText: (row) => `${formatIp(row.ip)}이닝 · ERA ${row.era.toFixed(2)}`,
    format: formatInteger
  },
  {
    id: "bb9",
    category: "pitching",
    label: "제구력",
    title: "제구력 TOP",
    unit: "BB/9",
    desc: "9이닝당 볼넷을 가장 적게 허용한 투수",
    order: "asc",
    kind: "pitcher",
    minIp: 20,
    minStarts: 3,
    subText: (row) => `${row.starts}선발 · WHIP ${row.whip.toFixed(2)}`,
    format: (value) => value.toFixed(2)
  },
  {
    id: "saves",
    category: "pitching",
    label: "세이브",
    title: "세이브 TOP",
    unit: "SV",
    desc: "경기를 가장 많이 마무리한 투수",
    order: "desc",
    kind: "pitcher",
    minValue: 1,
    subText: (row) => `${row.games}경기 · ${formatIp(row.ip)}이닝`,
    format: formatInteger
  },
  {
    id: "holds",
    category: "pitching",
    label: "홀드",
    title: "홀드 TOP",
    unit: "H",
    desc: "리드를 가장 많이 지켜낸 불펜 투수",
    order: "desc",
    kind: "pitcher",
    minValue: 1,
    subText: (row) => `${row.games}경기 · ${formatIp(row.ip)}이닝`,
    format: formatInteger
  },
  {
    id: "walks",
    category: "fun",
    label: "눈야구",
    title: "눈야구 TOP",
    unit: "개",
    desc: "볼넷을 가장 많이 골라낸 타자",
    order: "desc",
    kind: "batter",
    minValue: 1,
    subText: (row) => `${row.pa}타석 · 출루율 ${formatRate(row.obp)}`,
    format: formatInteger
  },
  {
    id: "hbp",
    category: "fun",
    label: "몸에 맞는 공",
    title: "몸에 맞는 공 TOP",
    unit: "개",
    desc: "몸에 맞는 공으로 가장 많이 출루한 선수",
    order: "desc",
    kind: "batter",
    minValue: 1,
    subText: (row) => `${row.pa}타석 · 출루율 ${formatRate(row.obp)}`,
    format: formatInteger
  },
  {
    id: "sb",
    category: "fun",
    label: "도루왕",
    title: "도루 TOP",
    unit: "개",
    desc: "베이스를 가장 많이 훔친 선수",
    order: "desc",
    kind: "batter",
    minValue: 1,
    subText: (row) => `${row.cs}실패 · 출루율 ${formatRate(row.obp)}`,
    format: formatInteger
  },
  {
    id: "cs",
    category: "fun",
    label: "도루 실패",
    title: "도루 실패 TOP",
    unit: "개",
    desc: "도루 시도 중 가장 많이 잡힌 선수",
    order: "desc",
    kind: "batter",
    minValue: 1,
    subText: (row) => `${row.sb}도루 성공`,
    format: formatInteger
  },
  {
    id: "strikeouts",
    category: "fun",
    label: "헛스윙",
    title: "삼진 많은 타자",
    unit: "K",
    desc: "삼진을 가장 많이 당한 타자",
    order: "desc",
    kind: "batter",
    minValue: 1,
    subText: (row) => `${row.pa}타석 · OPS ${formatRate(row.ops)}`,
    format: formatInteger
  },
  {
    id: "pitcher_homers_allowed",
    category: "fun",
    label: "피홈런",
    title: "피홈런 많은 투수",
    unit: "개",
    desc: "홈런을 가장 많이 허용한 투수",
    order: "desc",
    kind: "pitcher",
    minValue: 1,
    subText: (row) => `${formatIp(row.ip)}이닝 · HR/9 ${row.hr9.toFixed(2)}`,
    format: formatInteger
  }
];

const PLAYER_SPECIAL_CACHE_KEY = "player-special-rankings:v7";
const PLAYER_SPECIAL_CACHE_TTL_MS = 10 * 60 * 1000;

type PlayerSpecialCache = {
  savedAt: number;
  snapshotDate: string;
  rows: PlayerRankingRow[];
};

function formatInteger(value: number) {
  return String(Math.round(value));
}

function formatRate(value: number) {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(3).replace(/^0/, "");
}

function formatIp(value: number) {
  if (!Number.isFinite(value)) return "0";
  const outs = Math.round(value * 3);
  const whole = Math.floor(outs / 3);
  const remain = outs % 3;
  return `${whole}.${remain}`;
}

function formatSnapshotDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getMonth() + 1}.${date.getDate()} 기준`;
}

function getTeamName(teamId: string) {
  try {
    return getTeam(teamId).shortName;
  } catch {
    return teamId;
  }
}

function isEligible(row: PlayerRankingRow, tab: TabDef) {
  if (tab.kind !== "all" && row.kind !== tab.kind) return false;
  if (tab.minPa && row.pa < tab.minPa) return false;
  if (tab.minIp && row.ip < tab.minIp) return false;
  if (tab.minStarts && row.starts < tab.minStarts) return false;
  const value = Number(row[tab.id]) || 0;
  if (tab.minValue && value < tab.minValue) return false;
  if (value <= 0 && tab.order === "desc") return false;
  return true;
}

export default function PlayerSpecialRankingsPage() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("batting");
  const [activeTab, setActiveTab] = useState<MetricId>("ops");
  const [rows, setRows] = useState<PlayerRankingRow[]>([]);
  const [snapshotDate, setSnapshotDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const cachedText = window.sessionStorage.getItem(PLAYER_SPECIAL_CACHE_KEY);
        if (cachedText) {
          const cached = JSON.parse(cachedText) as PlayerSpecialCache;
          const isFresh =
            Array.isArray(cached.rows) &&
            Date.now() - Number(cached.savedAt ?? 0) < PLAYER_SPECIAL_CACHE_TTL_MS;

          if (isFresh) {
            setRows(cached.rows);
            setSnapshotDate(cached.snapshotDate);
            return;
          }
        }

        const res = await fetch("/api/rankings/player-special");
        const json = await res.json();
        if (!json.ok || !Array.isArray(json.rows)) {
          throw new Error(json.error || "데이터를 로드하지 못했습니다.");
        }

        setRows(json.rows);
        setSnapshotDate(json.snapshotDate || "");
        window.sessionStorage.setItem(
          PLAYER_SPECIAL_CACHE_KEY,
          JSON.stringify({ savedAt: Date.now(), snapshotDate: json.snapshotDate || "", rows: json.rows })
        );
      } catch (err) {
        console.error(err);
        setError("선수 랭킹 데이터를 불러오는 중 문제가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const visibleTabs = TABS.filter((tab) => tab.category === activeCategory);
  const currentTabDef = TABS.find((tab) => tab.id === activeTab) ?? visibleTabs[0] ?? TABS[0];
  const rankedRows = rows
    .filter((row) => isEligible(row, currentTabDef))
    .sort((a, b) => {
      const valueA = Number(a[currentTabDef.id]) || 0;
      const valueB = Number(b[currentTabDef.id]) || 0;
      const primary = currentTabDef.order === "asc" ? valueA - valueB : valueB - valueA;
      if (primary !== 0) return primary;
      if (currentTabDef.kind === "batter") return (b.pa ?? 0) - (a.pa ?? 0);
      return (b.ip ?? 0) - (a.ip ?? 0);
    })
    .slice(0, 10);

  function selectCategory(categoryId: CategoryId) {
    setActiveCategory(categoryId);
    const firstTab = TABS.find((tab) => tab.category === categoryId);
    if (firstTab) setActiveTab(firstTab.id);
  }

  return (
    <AppShell activeTab="home" title="선수 별별랭킹" theme="light" backHref="/" wide>
      <div className="w-full max-w-2xl mx-auto px-4 py-5 bg-[#f8fafc] min-h-screen phone-frame-light">
        <header className="mb-4 text-center">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">기록으로 보는 선수 성향</h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            시즌 누적 스냅샷 기준으로 선수별 특징을 확인하세요
            {snapshotDate ? `(${formatSnapshotDate(snapshotDate)})` : ""}
          </p>
        </header>

        <div className="mb-3 grid grid-cols-3 gap-1.5" role="tablist" aria-label="선수 별별랭킹 카테고리">
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
          <div className="flex flex-wrap gap-x-4 gap-y-2 pb-2" role="tablist" aria-label="선수 별별랭킹 세부 항목">
            {visibleTabs.map((tab) => {
              const isActive = tab.id === activeTab;
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
                  {tab.label}
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
            <p className="text-xs font-bold text-slate-500 mt-3">선수 기록 집계 중...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center text-red-600 text-xs font-bold">
            {error}
          </div>
        ) : rankedRows.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400 text-xs font-bold">
            표시할 선수 기록이 없습니다.
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            {rankedRows.map((row, index) => {
              const rank = index + 1;
              const value = Number(row[currentTabDef.id]) || 0;
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
                  key={`${String(activeTab)}-${row.player_id}`}
                  className={`player-special-rank-item flex items-center justify-between px-4 py-3.5 ${rowClass}`}
                  style={{ animationDelay: `${index * 55}ms` }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="w-8 flex flex-shrink-0 items-center justify-center">{badgeNode}</div>
                    <div className="w-8 h-8 flex flex-shrink-0 items-center justify-center">
                      <TeamBadge teamId={row.team_id} size="sm" showName={false} fallbackName={getTeamName(row.team_id)} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-800">{row.player_name}</p>
                      <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                        {getTeamName(row.team_id)} · {currentTabDef.subText(row)}
                      </p>
                    </div>
                  </div>

                  <div className="w-24 flex-shrink-0 text-right tabular-nums">
                    <strong className="text-sm font-black text-slate-900">
                      {currentTabDef.format(value)}
                    </strong>
                    {currentTabDef.unit ? (
                      <span className="ml-1 text-[10px] font-bold text-slate-400">{currentTabDef.unit}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <style jsx>{`
          .player-special-rank-item {
            opacity: 0;
            transform: translateY(10px);
            animation: playerSpecialRankItemIn 360ms ease-out forwards;
          }

          @keyframes playerSpecialRankItemIn {
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
