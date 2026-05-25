#!/usr/bin/env node
// @ts-check
/**
 * YouTube 인기 야구 영상 자동 큐레이션.
 *
 * 키워드별로 search.list → 조회수/길이 필터 → bp_videos INSERT.
 * 봇 user_id로 INSERT하므로 service_role 키 필요 (RLS 우회).
 * 중복은 (owner_user_id, url_hash) unique index가 걸러줌 → 23505 무시.
 *
 * 사용법:
 *   node scripts/curate-youtube.mjs              # 실제 INSERT
 *   node scripts/curate-youtube.mjs --dry-run    # INSERT 안 함, 결과만 로그
 *   node scripts/curate-youtube.mjs --keyword="KBO 끝내기"   # 특정 키워드만
 *
 * 필수 환경변수 (.env.local 또는 GitHub Actions secrets):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   YOUTUBE_API_KEY
 *   BALLPLAY_BOT_USER_ID    — Supabase Authentication에 만든 놀이터봇 계정의 user_id
 *
 * YouTube Data API v3 quota:
 *   search.list = 100 units / 호출 (한 키워드당 결과 50개)
 *   videos.list = 1 unit / 호출 (영상 50개 메타 한번에 조회 가능)
 *   하루 free quota 10,000 units → 키워드 5개 × 100 = 500 + videos.list 한두번 = 충분.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// 설정
// ---------------------------------------------------------------------------

const KEYWORDS = [
  "야구 재밌는 장면",
  "프로야구",
  "야구쇼츠",
  "야구 응원가",
  "야구 명장면",
  "끝내기 홈런",
  "호수비",
  "야구 직캠",
  "KBO 하이라이트"
];

// 키워드당 가져올 최대 결과 (YouTube API 최대 50)
const MAX_RESULTS_PER_KEYWORD = 25;

// 필터: 최소 조회수 (인기 영상만)
const MIN_VIEW_COUNT = 10_000;

// 필터: 업로드 후 N일 이내 (너무 오래된 영상 배제)
const MAX_AGE_DAYS = 60;

// 필터: 영상 길이 (초). 너무 짧거나 너무 긴 거 제외.
const MIN_DURATION_SEC = 10;
const MAX_DURATION_SEC = 1800; // 30분

// 1회 실행당 INSERT 비율 — orientation별로 따로 cap.
// 페이지 레이아웃: 쇼츠는 3개/줄, 가로는 1개/줄.
// 쇼츠 12 → 4줄, 가로 3 → 3줄. 총 15개/일, 7줄.
// 첫 실행만 영상이 우르르 쏟아지지 않게, 매일 이 만큼만 추가됨.
// 둘째 날부터는 dedup으로 자연스럽게 더 적게 들어옴.
const MAX_VERTICAL_PER_RUN = 12;
const MAX_HORIZONTAL_PER_RUN = 3;

// ---------------------------------------------------------------------------
// env 로드 — sync-standings.mjs 패턴 (dotenv 없이 .env.local 직접 파싱)
// ---------------------------------------------------------------------------

function loadEnv() {
  const merged = { ...process.env };
  const envPath = resolve(process.cwd(), ".env.local");
  if (existsSync(envPath)) {
    const txt = readFileSync(envPath, "utf8");
    for (const line of txt.split(/\r?\n/)) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
      if (merged[k] == null) merged[k] = v;
    }
  }
  return merged;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
const YOUTUBE_API_KEY = env.YOUTUBE_API_KEY;
const BOT_USER_ID = env.BALLPLAY_BOT_USER_ID;

const DRY_RUN = process.argv.includes("--dry-run");
const KEYWORD_ARG = process.argv.find((a) => a.startsWith("--keyword="))?.split("=")[1];

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  process.exit(1);
}
if (!YOUTUBE_API_KEY) {
  console.error("ERROR: YOUTUBE_API_KEY missing");
  process.exit(1);
}
if (!BOT_USER_ID) {
  console.error("ERROR: BALLPLAY_BOT_USER_ID missing — Supabase에 놀이터봇 계정 만들고 user_id를 등록하세요");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false }
});

// ---------------------------------------------------------------------------
// YouTube Data API 호출
// ---------------------------------------------------------------------------

const YT_BASE = "https://www.googleapis.com/youtube/v3";

async function ytFetch(path, params) {
  const url = new URL(`${YT_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  url.searchParams.set("key", YOUTUBE_API_KEY);
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube ${path} ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * 키워드로 검색해서 video id 리스트만 받음 (search.list는 조회수 등 메타 안 줌).
 */
async function searchVideos(keyword, publishedAfterISO) {
  const data = await ytFetch("search", {
    part: "id",
    q: keyword,
    type: "video",
    maxResults: MAX_RESULTS_PER_KEYWORD,
    order: "viewCount",
    regionCode: "KR",
    relevanceLanguage: "ko",
    safeSearch: "moderate",
    publishedAfter: publishedAfterISO
  });
  const ids = (data.items ?? [])
    .map((it) => it.id?.videoId)
    .filter((id) => typeof id === "string");
  return ids;
}

/**
 * videos.list로 메타데이터 (조회수, 길이, 제목, 업로드일) 일괄 조회.
 * 최대 50개씩.
 */
async function fetchVideoDetails(ids) {
  if (ids.length === 0) return [];
  const data = await ytFetch("videos", {
    part: "snippet,statistics,contentDetails",
    id: ids.join(","),
    maxResults: 50
  });
  return data.items ?? [];
}

// ISO 8601 duration (PT1M30S) → seconds
function parseDuration(iso) {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const h = parseInt(m[1] ?? "0", 10);
  const min = parseInt(m[2] ?? "0", 10);
  const s = parseInt(m[3] ?? "0", 10);
  return h * 3600 + min * 60 + s;
}

// ---------------------------------------------------------------------------
// URL → orientation 판정
// YouTube videos.list는 shorts 여부를 직접 알려주지 않음.
// 휴리스틱: 길이 60초 이하 + 세로 비율(필요시 추가) → shorts URL로 등록.
// ---------------------------------------------------------------------------
function buildVideoRow(videoItem, keyword) {
  const id = videoItem.id;
  const snippet = videoItem.snippet ?? {};
  const stats = videoItem.statistics ?? {};
  const details = videoItem.contentDetails ?? {};
  const durationSec = parseDuration(details.duration ?? "PT0S");
  const viewCount = parseInt(stats.viewCount ?? "0", 10);

  // 60초 이하 = 쇼츠 가능성 높음 → shorts URL 사용 (orientation=vertical)
  const isShort = durationSec > 0 && durationSec <= 60;
  const url = isShort
    ? `https://www.youtube.com/shorts/${id}`
    : `https://www.youtube.com/watch?v=${id}`;
  const orientation = isShort ? "vertical" : "horizontal";

  return {
    owner_user_id: BOT_USER_ID,
    url,
    platform: "youtube",
    external_id: id,
    orientation,
    url_hash: hashUrl(url),
    is_auto_curated: true,
    curated_keyword: keyword,
    view_count: viewCount,
    published_at: snippet.publishedAt ?? null,
    // 디버그용
    _title: snippet.title ?? "",
    _channel: snippet.channelTitle ?? "",
    _durationSec: durationSec
  };
}

// bpVideos.ts와 동일한 djb2 해시
function hashUrl(url) {
  const trimmed = url.trim().toLowerCase();
  let h = 5381;
  for (let i = 0; i < trimmed.length; i++) {
    h = ((h << 5) + h + trimmed.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

// ---------------------------------------------------------------------------
// 메인
// ---------------------------------------------------------------------------

async function main() {
  const keywords = KEYWORD_ARG ? [KEYWORD_ARG] : KEYWORDS;
  const publishedAfter = new Date(Date.now() - MAX_AGE_DAYS * 86400_000).toISOString();

  console.log(`[curate-youtube] start — keywords=${keywords.length}, dry-run=${DRY_RUN}`);
  console.log(`[curate-youtube] publishedAfter=${publishedAfter}`);

  /** @type {Map<string, any>} */
  const collected = new Map(); // dedup by video id

  for (const keyword of keywords) {
    try {
      const ids = await searchVideos(keyword, publishedAfter);
      console.log(`[search] "${keyword}" → ${ids.length} candidates`);
      const details = await fetchVideoDetails(ids);
      let kept = 0;
      for (const item of details) {
        const durationSec = parseDuration(item.contentDetails?.duration ?? "PT0S");
        const viewCount = parseInt(item.statistics?.viewCount ?? "0", 10);
        if (viewCount < MIN_VIEW_COUNT) continue;
        if (durationSec < MIN_DURATION_SEC || durationSec > MAX_DURATION_SEC) continue;
        if (collected.has(item.id)) continue;
        collected.set(item.id, buildVideoRow(item, keyword));
        kept++;
      }
      console.log(`[filter] "${keyword}" → ${kept} kept (after view/duration/dedup)`);
    } catch (e) {
      console.error(`[error] keyword "${keyword}":`, e.message);
    }
  }

  const allRows = [...collected.values()];
  // orientation별로 분리 후 각각 조회수 내림차순 정렬 → 상위 N개씩
  const verticals = allRows
    .filter((r) => r.orientation === "vertical")
    .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
    .slice(0, MAX_VERTICAL_PER_RUN);
  const horizontals = allRows
    .filter((r) => r.orientation === "horizontal")
    .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
    .slice(0, MAX_HORIZONTAL_PER_RUN);
  const rows = [...verticals, ...horizontals];
  console.log(
    `[curate-youtube] collected=${allRows.length} ` +
    `(vertical=${allRows.filter((r) => r.orientation === "vertical").length}, ` +
    `horizontal=${allRows.filter((r) => r.orientation === "horizontal").length}) ` +
    `→ insert: ${verticals.length} shorts + ${horizontals.length} long = ${rows.length}`
  );

  if (DRY_RUN) {
    console.log("--- SHORTS ---");
    for (const r of verticals) {
      console.log(`  - ${r._title} (${r._channel}, ${r.view_count} views) ${r.url}`);
    }
    console.log("--- HORIZONTAL ---");
    for (const r of horizontals) {
      console.log(`  - ${r._title} (${r._channel}, ${r.view_count} views) ${r.url}`);
    }
    return;
  }

  // INSERT — 중복은 23505로 실패하므로 한 건씩 시도해 무시
  let inserted = 0;
  let skipped = 0;
  for (const r of rows) {
    const { _title, _channel, _durationSec, ...payload } = r;
    const { error } = await sb.from("bp_videos").insert(payload);
    if (error) {
      if (error.code === "23505") {
        skipped++;
        continue;
      }
      console.error(`[insert error] ${payload.url}:`, error.message);
      continue;
    }
    inserted++;
    console.log(`  + inserted: ${_title} (${payload.view_count} views)`);
  }
  console.log(`[curate-youtube] done — inserted=${inserted}, skipped(dup)=${skipped}`);
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
