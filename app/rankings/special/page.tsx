"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AppShell } from "@/components/layout/AppShell";

type RankingRow = {
  team_id: string;
  games_played: number;
  total_bases: number;
  total_late_runs: number;
  total_sacrifice_hits_flies: number;
  avg_left_on_base: number;
  total_stolen_bases: number;
  total_caught_stealing: number;
  total_pitcher_strikeouts: number;
  avg_earned_runs: number;
  total_pitcher_walks_hbp: number;
  total_errors: number;
};

type TabDef = {
  id: keyof RankingRow;
  label: string;
  unit: string;
  desc: string;
  order: "asc" | "desc";
  icon: string;
};

const TABS: TabDef[] = [
  {
    id: "total_bases",
    label: "화력 발전소",
    unit: "루타",
    desc: "안타와 홈런으로 베이스를 가장 많이 전진한 팀 (누적 루타수)",
    order: "desc",
    icon: "💥"
  },
  {
    id: "total_late_runs",
    label: "약속의 8회왕",
    unit: "점",
    desc: "7회 이후 경기 후반 집중력이 폭발하는 구단 (7회~연장 득점 합산)",
    order: "desc",
    icon: "🔥"
  },
  {
    id: "total_stolen_bases",
    label: "그라운드 육상부",
    unit: "도루",
    desc: "기습적인 타이밍에 베이스를 가장 많이 훔쳐낸 기동력 구단 (도루 성공)",
    order: "desc",
    icon: "🏃‍♂️"
  },
  {
    id: "total_sacrifice_hits_flies",
    label: "작전의 정석",
    unit: "개",
    desc: "희생번트와 희생플라이로 팀을 위해 주자를 진루시킨 헌신 구단 (희생타)",
    order: "desc",
    icon: "🧘‍♂️"
  },
  {
    id: "avg_earned_runs",
    label: "짠물 마운드",
    unit: "ERA",
    desc: "경기당 상대에게 자책점을 최소한으로 내준 철벽 수비 마운드 (평균 자책점)",
    order: "asc",
    icon: "🧱"
  },
  {
    id: "total_pitcher_strikeouts",
    label: "삼진 폭격기",
    unit: "개",
    desc: "상대 타자들의 배트를 허공에 돌려세운 막강 피칭 구단 (탈삼진)",
    order: "desc",
    icon: "☄️"
  },
  {
    id: "avg_left_on_base",
    label: "잔루 감옥",
    unit: "개",
    desc: "출루는 잔뜩 해두고 득점으로 잇지 못해 팬들 혈압 올리는 구단 (경기당 평균 잔루)",
    order: "desc",
    icon: "🔒"
  },
  {
    id: "total_caught_stealing",
    label: "그린라이트 폭주",
    unit: "개",
    desc: "무모한 도루 시도로 주루사하여 소중한 찬스를 날려버린 구단 (도루 실패)",
    order: "desc",
    icon: "🚨"
  },
  {
    id: "total_pitcher_walks_hbp",
    label: "볼넷 공장",
    unit: "개",
    desc: "사사구 허용으로 주자를 공짜로 1루에 많이 걸어보낸 구단 (볼넷+사구 허용)",
    order: "desc",
    icon: "🏭"
  },
  {
    id: "total_errors",
    label: "행복수비왕",
    unit: "개",
    desc: "어처구니없는 실책으로 상대방의 흥을 돋우어준 개그 야구단 (누적 실책)",
    order: "desc",
    icon: "🤡"
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

export default function SpecialRankingsPage() {
  const [activeTab, setActiveTab] = useState<keyof RankingRow>("total_bases");
  const [data, setData] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch("/api/rankings/special");
        const json = await res.json();
        if (json.ok && Array.isArray(json.rows)) {
          setData(json.rows);
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

  const currentTabDef = TABS.find((t) => t.id === activeTab)!;

  // 정렬 처리
  const sortedData = [...data].sort((a, b) => {
    const valA = Number(a[activeTab]) || 0;
    const valB = Number(b[activeTab]) || 0;
    if (currentTabDef.order === "asc") {
      return valA - valB; // 오름차순 (예: ERA는 낮을수록 1위)
    } else {
      return valB - valA; // 내림차순
    }
  });

  return (
    <AppShell activeTab="home" title="별별팀랭킹" theme="light" backHref="/" wide>
      <div className="max-w-md mx-auto px-4 py-5 bg-[#f8fafc] min-h-screen phone-frame-light">
        {/* 상단 소개 배너 */}
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex justify-center items-center gap-2">
            🏆 별별팀랭킹
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            KBO 수집 통계 기반 이색 팩폭·성공 랭킹
          </p>
        </header>

        {/* 탭 카테고리 (요즘폼 TOP10 스타일의 여러 줄 바둑판식 레이아웃) */}
        <div className="recent10-tabs mb-6" role="tablist" aria-label="별별팀랭킹 분류">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`recent10-tab ${isActive ? "is-active" : ""}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "0 10px",
                  fontSize: "12px",
                  height: "32px"
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 랭킹 설명 말풍선 */}
        <div className="bg-pink-50/50 border border-pink-100/60 rounded-2xl p-4 mb-6 relative">
          <p className="text-sm font-extrabold text-[#FF2A7A] mb-1 flex items-center gap-1">
            {currentTabDef.icon} {currentTabDef.label} 랭킹이란?
          </p>
          <p className="text-xs font-semibold text-slate-600 leading-relaxed">
            {currentTabDef.desc}
          </p>
        </div>

        {/* 랭킹 리스트 영역 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="w-8 h-8 border-4 border-[#FF2A7A] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-500 mt-3">실시간 기록 집계 중...</p>
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

              // 메달 및 랭킹 스타일링
              let badgeNode = <span className="text-slate-400 font-extrabold text-sm">{rank}</span>;
              let rowClass = "border-b border-slate-100 hover:bg-slate-50/60 transition-colors";
              if (rank === 1) {
                badgeNode = <span className="text-2xl">🥇</span>;
                rowClass += " bg-amber-50/30";
              } else if (rank === 2) {
                badgeNode = <span className="text-2xl">🥈</span>;
              } else if (rank === 3) {
                badgeNode = <span className="text-2xl">🥉</span>;
              }

              return (
                <div key={teamId} className={`flex items-center justify-between px-4 py-3.5 ${rowClass}`}>
                  {/* 순위와 로고 및 구단명 */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 flex items-center justify-center flex-shrink-0">
                      {badgeNode}
                    </div>
                    <div className="relative w-8 h-8 rounded-full border border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                      <Image
                        src={`/team-logos/${teamId}.png`}
                        alt=""
                        width={24}
                        height={24}
                        className="object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{teamName}</p>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                        {row.games_played}경기 출장
                      </p>
                    </div>
                  </div>

                  {/* 지표 수치 표시 */}
                  <div className="text-right flex-shrink-0">
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
      </div>
    </AppShell>
  );
}
