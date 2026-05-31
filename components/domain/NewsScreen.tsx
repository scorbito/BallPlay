"use client";

// 야구 뉴스 화면 — 날짜·제목 리스트, 클릭 시 기사 링크(새 탭).
// 팀 필터 칩으로 클라이언트 필터 (서버 재요청 없이 즉시).
// 초기 SSR 후 "더 보기" 버튼으로 페이지네이션 (브라우저 supabase 클라이언트 직접 사용).

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Newspaper } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TEAM_FILTER_OPTIONS, titleMatchesTeam } from "@/lib/news/teamFilter";
import type { BpNewsRow } from "@/lib/supabase/query-parts/bpNews";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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

type Props = {
  initialNews: BpNewsRow[];
  pageSize: number;
};

export function NewsScreen({ initialNews, pageSize }: Props) {
  const [team, setTeam] = useState<string | null>(null);
  const [news, setNews] = useState<BpNewsRow[]>(initialNews);
  // 첫 페이지가 pageSize 미만이면 더 가져올 게 없음.
  const [hasMore, setHasMore] = useState(initialNews.length === pageSize);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 홈 펄스 뱃지용 — 페이지 진입 시점 기준으로 viewed 마킹.
  // 이후 게시된 뉴스의 published_at > 이 시각 ⇒ 다시 뱃지 표시.
  useEffect(() => {
    try {
      window.localStorage.setItem("ballplay:news:lastViewedAt", new Date().toISOString());
    } catch {
      // ignore storage errors
    }
  }, []);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setLoadError(null);
    const client = createSupabaseBrowserClient();
    const from = news.length;
    const to = from + pageSize - 1;
    const { data, error } = await client
      .from("bp_news")
      .select("id, title, url, source, published_at, image_url")
      .order("published_at", { ascending: false })
      .range(from, to);
    setLoadingMore(false);
    if (error) {
      setLoadError("더 가져오지 못했어요. 다시 시도해 주세요.");
      return;
    }
    const rows = (data ?? []) as BpNewsRow[];
    if (rows.length < pageSize) setHasMore(false);
    if (rows.length === 0) return;
    setNews((prev) => [...prev, ...rows]);
  };

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
        <>
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
        {/* 더 보기 — 팀 필터가 켜져 있어도 같은 전체 풀에서 더 가져온 뒤 클라이언트 필터 적용 */}
        {hasMore ? (
          <div className="news-more">
            <button
              type="button"
              className="news-more-btn"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <Loader2 size={14} className="news-more-spin" /> 불러오는 중...
                </>
              ) : (
                "더 보기"
              )}
            </button>
            {loadError ? <p className="news-more-error">{loadError}</p> : null}
          </div>
        ) : (
          <p className="news-more-end">이전 뉴스는 7일 후 자동으로 정리돼요.</p>
        )}
        </>
      )}
    </AppShell>
  );
}
