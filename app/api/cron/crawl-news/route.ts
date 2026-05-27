import { NextResponse, type NextRequest } from "next/server";
import * as cheerio from "cheerio";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// KBO 뉴스 크롤 — bet 프로젝트에서 이식 (bp_news로 격리).
//   1순위: 네이버 검색 OpenAPI (공식, 키 인증)
//   폴백: Google News RSS (ko/KR)
//   저장: bp_news (url unique upsert), 7일 지난 건 bp_delete_old_news()
// cron-job.org 또는 Vercel cron 이 Bearer CRON_SECRET 으로 GET 호출.

export const maxDuration = 60;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type NewsItem = {
  title: string;
  url: string;
  source: string | null;
  published_at: string;
};

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

function stripHtmlEntities(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

const HOST_TO_SOURCE: Record<string, string> = {
  "sports.news.naver.com": "네이버스포츠",
  "n.news.naver.com": "네이버뉴스",
  "m.sports.naver.com": "네이버스포츠",
  "news.naver.com": "네이버뉴스",
  "starnewskorea.com": "스타뉴스",
  "osen.mt.co.kr": "OSEN",
  "isplus.com": "일간스포츠",
  "sportalkorea.com": "스포탈코리아",
  "sportsseoul.com": "스포츠서울",
  "sports.chosun.com": "스포츠조선",
  "sportskhan.news": "스포츠경향",
  "mydaily.co.kr": "마이데일리",
  "spotvnews.co.kr": "SPOTV NEWS",
  "sports.khan.co.kr": "스포츠경향",
  "xportsnews.com": "엑스포츠뉴스",
  "news1.kr": "뉴스1",
  "newsis.com": "뉴시스",
  "yna.co.kr": "연합뉴스",
  "jtbc.co.kr": "JTBC",
  "kbs.co.kr": "KBS",
  "mbn.co.kr": "MBN",
  "sbs.co.kr": "SBS"
};

function extractSource(link: string): string | null {
  try {
    const host = new URL(link).hostname.toLowerCase();
    if (HOST_TO_SOURCE[host]) return HOST_TO_SOURCE[host];
    const stripped = host.replace(/^(www|m|news|sports|biz|n)\./, "");
    if (HOST_TO_SOURCE[stripped]) return HOST_TO_SOURCE[stripped];
    return stripped.split(".")[0];
  } catch {
    return null;
  }
}

function isBaseballRelated(title: string): boolean {
  const keywords = [
    "야구", "KBO", "프로야구", "두산", "LG", "키움", "SSG", "랜더스",
    "롯데", "자이언츠", "삼성", "KIA", "타이거즈", "한화", "이글스",
    "NC", "다이노스", "KT", "위즈", "트윈스", "베어스", "히어로즈",
    "라이온즈", "구단", "타자", "투수", "홈런", "안타", "경기", "리그",
    "포수", "내야수", "외야수", "감독", "선발", "마무리", "구원"
  ];
  return keywords.some((k) => title.includes(k));
}

/** 1순위: 네이버 검색 OpenAPI (공식 API, 키 인증) */
async function fetchNaverSearchApi(): Promise<NewsItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정");
  }

  const queries = ["KBO", "프로야구"];
  const all: NewsItem[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(
      query
    )}&display=100&sort=date`;
    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret
        }
      });
      if (!res.ok) {
        console.warn(`[NEWS] Naver Search HTTP ${res.status} for "${query}"`);
        continue;
      }
      const json = (await res.json()) as { items?: Array<Record<string, unknown>> };
      const items = Array.isArray(json.items) ? json.items : [];

      for (const item of items) {
        const title = stripHtmlEntities(String(item.title ?? ""));
        const link = String(item.link || item.originallink || "").trim();
        if (!title || !link) continue;
        if (seen.has(link)) continue;
        // "KBO" 검색엔 농구/배구 등 섞일 수 있어 야구 키워드 필터
        if (query === "KBO" && !isBaseballRelated(title)) continue;
        seen.add(link);

        let iso = new Date().toISOString();
        if (item.pubDate) {
          const parsed = new Date(String(item.pubDate));
          if (!isNaN(parsed.getTime())) iso = parsed.toISOString();
        }
        all.push({
          title,
          url: link,
          source: extractSource(String(item.originallink || link)),
          published_at: iso
        });
      }
    } catch (e) {
      console.warn(`[NEWS] Naver Search "${query}" 실패:`, (e as Error).message);
    }
  }

  if (all.length === 0) throw new Error("Naver Search 결과 0건");
  return all;
}

/** 2순위: Google News RSS 폴백 */
async function fetchGoogleNewsRss(): Promise<NewsItem[]> {
  const queries = ["KBO 야구", "프로야구", "KBO 리그"];
  const all: NewsItem[] = [];
  const seen = new Set<string>();

  for (const q of queries) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
      q
    )}&hl=ko&gl=KR&ceid=KR:ko`;
    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "User-Agent": USER_AGENT }
      });
      if (!res.ok) {
        console.warn(`[NEWS] Google RSS HTTP ${res.status} for "${q}"`);
        continue;
      }
      const xml = await res.text();
      const $ = cheerio.load(xml, { xmlMode: true });

      $("item").each((_, el) => {
        const $item = $(el);
        const rawTitle = $item.find("title").first().text().trim();
        const link = $item.find("link").first().text().trim();
        const pubDate = $item.find("pubDate").first().text().trim();
        const sourceTag = $item.find("source").first().text().trim();
        if (!rawTitle || !link) return;
        if (seen.has(link)) return;

        let title = rawTitle;
        let source: string | null = sourceTag || null;
        const dashIdx = rawTitle.lastIndexOf(" - ");
        if (dashIdx > 0) {
          title = rawTitle.slice(0, dashIdx).trim();
          if (!source) source = rawTitle.slice(dashIdx + 3).trim();
        }
        seen.add(link);

        let iso = new Date().toISOString();
        if (pubDate) {
          const parsed = new Date(pubDate);
          if (!isNaN(parsed.getTime())) iso = parsed.toISOString();
        }
        all.push({ title, url: link, source, published_at: iso });
      });
    } catch (e) {
      console.warn(`[NEWS] Google RSS "${q}" 실패:`, (e as Error).message);
    }
  }

  if (all.length === 0) throw new Error("Google RSS 결과 0건");
  return all;
}

/** 기사 페이지에서 og:image(대표 이미지) 추출. 실패·타임아웃 시 null. */
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(4000),
      cache: "no-store"
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    const img =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $('meta[name="twitter:image:src"]').attr("content") ||
      null;
    const trimmed = img?.trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;
    return trimmed;
  } catch {
    return null;
  }
}

/** 이미지 없는 최신 기사의 og:image를 제한적으로 채운다.
 *  크롤당 상한(MAX)·동시성·타임아웃으로 Vercel 60초 안에 끝나게 통제. */
async function backfillImages(
  supabase: ReturnType<typeof createSupabaseAdminClient>
): Promise<number> {
  const MAX = 30; // 1회 크롤당 이미지 채울 최대 기사 수
  const CONCURRENCY = 6;

  const { data: rows, error } = await supabase
    .from("bp_news")
    .select("id, url")
    .is("image_url", null)
    .order("published_at", { ascending: false })
    .limit(MAX);
  if (error || !rows || rows.length === 0) return 0;

  let filled = 0;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (row) => {
        const img = await fetchOgImage(row.url);
        if (img) {
          await supabase.from("bp_news").update({ image_url: img }).eq("id", row.id);
          filled++;
        }
      })
    );
  }
  return filled;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  let newsItems: NewsItem[] = [];
  let strategy = "none";

  try {
    newsItems = await fetchNaverSearchApi();
    strategy = "NAVER_SEARCH_API";
  } catch (e) {
    console.warn("[NEWS] Naver Search 실패, Google RSS 폴백:", (e as Error).message);
    try {
      newsItems = await fetchGoogleNewsRss();
      strategy = "GOOGLE_RSS";
    } catch (err) {
      console.error("[NEWS] 모든 소스 실패:", err);
      return NextResponse.json(
        { success: false, error: "All news sources failed" },
        { status: 500 }
      );
    }
  }

  const { error: upsertErr } = await supabase
    .from("bp_news")
    .upsert(newsItems, { onConflict: "url", ignoreDuplicates: true });

  if (upsertErr) {
    console.error("[NEWS] Supabase upsert error:", upsertErr);
    return NextResponse.json({ success: false, error: upsertErr.message }, { status: 500 });
  }

  // 7일 이상 지난 뉴스 삭제 (실패해도 치명적이지 않음)
  const { error: rpcErr } = await supabase.rpc("bp_delete_old_news");
  if (rpcErr) console.warn("[NEWS] bp_delete_old_news RPC 경고:", rpcErr.message);

  // og:image 채우기 — 이미지 없는 최신 기사 일부만 (크롤당 제한)
  const imagesFilled = await backfillImages(supabase);

  return NextResponse.json({
    success: true,
    strategy,
    fetched: newsItems.length,
    imagesFilled,
    timestamp: new Date().toISOString()
  });
}
