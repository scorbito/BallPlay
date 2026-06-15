"use client";

import { useMemo, useState } from "react";
import { Activity, ChevronDown, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import {
  RECENT10_CATEGORIES,
  type Recent10CategoryId,
  type Recent10TopPlayer
} from "@/lib/recent10/categories";
import { getTeam } from "@/lib/constants/teams";

type Props = {
  initialByCategory: Record<Recent10CategoryId, Recent10TopPlayer[]>;
  snapshotDate: string;
};

function formatSnapshotDate(value: string): string {
  if (!value) return "";
  if (value.includes("~")) return value;
  const d = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getMonth() + 1}.${d.getDate()} 기준`;
}

function getTeamColor(teamId: string): string {
  try {
    const team = getTeam(teamId);
    return team.accent ?? team.color;
  } catch {
    return "#e84a8a";
  }
}

function getTeamName(teamId: string): string {
  try {
    return getTeam(teamId).shortName;
  } catch {
    return teamId;
  }
}

export function Recent10TopScreen({ initialByCategory, snapshotDate }: Props) {
  const [activeCategory, setActiveCategory] = useState<Recent10CategoryId>("avg");
  const category = useMemo(
    () => RECENT10_CATEGORIES.find((item) => item.id === activeCategory) ?? RECENT10_CATEGORIES[0],
    [activeCategory]
  );
  const rows = initialByCategory[activeCategory] ?? [];

  return (
    <AppShell activeTab="home" title="최근 경기 TOP10" backHref="/" theme="light" wide>
      <section className="recent10-hero">
        <div className="recent10-hero-icon">
          <Sparkles size={20} />
        </div>
        <div className="recent10-hero-copy">
          <span>{formatSnapshotDate(snapshotDate)}</span>
          <h1>최근 경기 TOP10</h1>
          <p>최근 스냅샷 구간에서 돋보인 선수들을 기록별로 모았어요.</p>
        </div>
      </section>

      <div className="recent10-tabs" role="tablist" aria-label="최근 경기 TOP10 분류">
        {RECENT10_CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={activeCategory === item.id}
            className={`recent10-tab ${activeCategory === item.id ? "is-active" : ""}`}
            onClick={() => setActiveCategory(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="recent10-section-head">
        <div>
          <h2>{category.title}</h2>
          <p>{category.description}</p>
        </div>
        <span className="recent10-count">
          <Activity size={14} />
          TOP {rows.length}
        </span>
      </section>

      {rows.length === 0 ? (
        <div className="recent10-empty">
          <ChevronDown size={22} />
          <strong>표시할 선수가 아직 없어요</strong>
          <span>스냅샷 데이터가 더 쌓이면 자동으로 채워집니다.</span>
        </div>
      ) : (
        <div className="recent10-card-grid" key={activeCategory}>
          {rows.map((row, index) => (
            <article
              key={`${activeCategory}-${row.playerId}`}
              className={`recent10-player-card rank-${row.rank}`}
              style={{
                ["--flip-delay" as string]: `${index * 130}ms`,
                ["--team-color" as string]: getTeamColor(row.teamId)
              }}
            >
              <div className="recent10-rank">{row.rank}위</div>
              <div className="recent10-team">
                <span>{getTeamName(row.teamId)}</span>
                <TeamBadge teamId={row.teamId} size="sm" showName={false} />
              </div>
              <div className="recent10-card-body">
                <strong className="recent10-player-name">{row.playerName}</strong>
                <span className="recent10-main-value">{row.displayValue}</span>
                <span className="recent10-sub-value">{row.subText}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
