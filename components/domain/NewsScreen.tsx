"use client";

// 야구 뉴스 화면 — 날짜·제목 리스트, 클릭 시 기사 링크(새 탭).
// 팀 필터 칩으로 클라이언트 필터 (서버 재요청 없이 즉시).

import { useMemo, useState } from "react";
import { ExternalLink, Newspaper } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TEAM_FILTER_OPTIONS, titleMatchesTeam } from "@/lib/news/teamFilter";
import type { BpNewsRow } from "@/lib/supabase/query-parts/bpNews";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value])
  );
  return `${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
}

export function NewsScreen({ news }: { news: BpNewsRow[] }) {
  const [team, setTeam] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!team) return news;
    return news.filter((n) => titleMatchesTeam(n.title, team));
  }, [news, team]);

  return (
    <AppShell activeTab="home" title="야구 뉴스" backHref="/" theme="light" wide>
      {/* 팀 필터 칩 */}
      <div className="news-filter" role="tablist" aria-label="팀 필터">
        <button
          type="button"
          className={`news-filter-chip ${team === null ? "is-active" : ""}`}
          aria-selected={team === null}
          onClick={() => setTeam(null)}
        >
          전체
        </button>
        {TEAM_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`news-filter-chip ${team === opt.id ? "is-active" : ""}`}
            aria-selected={team === opt.id}
            onClick={() => setTeam(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <p className="news-empty">
          {team ? "해당 팀 뉴스가 아직 없어요." : "아직 수집된 뉴스가 없어요."}
        </p>
      ) : (
        <ul className="news-list">
          {filtered.map((n) => (
            <li key={n.id} className="news-item">
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="news-link"
              >
                <span className="news-thumb-wrap">
                  <Newspaper size={20} className="news-thumb-ph" aria-hidden />
                  {n.image_url ? (
                    <img
                      src={n.image_url}
                      alt=""
                      className="news-thumb-img"
                      loading="lazy"
                      onError={(e) => {
                        // 핫링크 차단·깨진 이미지 → 숨기고 플레이스홀더 노출
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}
                </span>
                <span className="news-body">
                  <span className="news-title">{n.title}</span>
                  <span className="news-meta">
                    {n.source ? <span className="news-source">{n.source}</span> : null}
                    <span className="news-date">{formatDate(n.published_at)}</span>
                    <ExternalLink size={12} className="news-ext" aria-hidden />
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
