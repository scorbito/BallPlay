#!/usr/bin/env node
// @ts-check

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const MAX_RESULTS_PER_KEYWORD = 25;
const MIN_VIEW_COUNT = 10_000;
const MAX_AGE_DAYS = 60;
const MIN_DURATION_SEC = 10;
const MAX_DURATION_SEC = 1800;
const MAX_VERTICAL_PER_RUN = 30;
const MAX_HORIZONTAL_PER_RUN = 0;
const DB_LOOKUP_CHUNK_SIZE = 100;

function loadEnv() {
  const merged = { ...process.env };
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return merged;

  const txt = readFileSync(envPath, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
    if (merged[key] == null) merged[key] = value;
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
  console.error("ERROR: BALLPLAY_BOT_USER_ID missing");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false }
});

const YT_BASE = "https://www.googleapis.com/youtube/v3";

async function ytFetch(path, params) {
  const url = new URL(`${YT_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set("key", YOUTUBE_API_KEY);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube ${path} ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

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

  return (data.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id) => typeof id === "string");
}

async function fetchVideoDetails(ids) {
  if (ids.length === 0) return [];
  const data = await ytFetch("videos", {
    part: "snippet,statistics,contentDetails",
    id: ids.join(","),
    maxResults: 50
  });
  return data.items ?? [];
}

function parseDuration(iso) {
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const hours = parseInt(match[1] ?? "0", 10);
  const minutes = parseInt(match[2] ?? "0", 10);
  const seconds = parseInt(match[3] ?? "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

function hashUrl(url) {
  const trimmed = url.trim().toLowerCase();
  let hash = 5381;
  for (let i = 0; i < trimmed.length; i++) {
    hash = ((hash << 5) + hash + trimmed.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function buildVideoRow(videoItem, keyword) {
  const id = videoItem.id;
  const snippet = videoItem.snippet ?? {};
  const stats = videoItem.statistics ?? {};
  const details = videoItem.contentDetails ?? {};
  const durationSec = parseDuration(details.duration ?? "PT0S");
  const viewCount = parseInt(stats.viewCount ?? "0", 10);
  const isShort = durationSec > 0 && durationSec <= 60;
  const url = isShort
    ? `https://www.youtube.com/shorts/${id}`
    : `https://www.youtube.com/watch?v=${id}`;

  return {
    owner_user_id: BOT_USER_ID,
    url,
    platform: "youtube",
    external_id: id,
    orientation: isShort ? "vertical" : "horizontal",
    url_hash: hashUrl(url),
    is_auto_curated: true,
    curated_keyword: keyword,
    view_count: viewCount,
    published_at: snippet.publishedAt ?? null,
    _title: snippet.title ?? "",
    _channel: snippet.channelTitle ?? "",
    _durationSec: durationSec
  };
}

async function listExistingVideoKeys(rows) {
  const externalIds = rows.map((row) => row.external_id).filter(Boolean);
  const urlHashes = rows.map((row) => row.url_hash).filter(Boolean);
  const existingExternalIds = new Set();
  const existingUrlHashes = new Set();

  for (let i = 0; i < externalIds.length; i += DB_LOOKUP_CHUNK_SIZE) {
    const chunk = externalIds.slice(i, i + DB_LOOKUP_CHUNK_SIZE);
    const { data, error } = await sb.from("bp_videos").select("external_id").in("external_id", chunk);
    if (error) throw new Error(`existing external_id lookup failed: ${error.message}`);
    for (const row of data ?? []) {
      if (row.external_id) existingExternalIds.add(row.external_id);
    }
  }

  for (let i = 0; i < urlHashes.length; i += DB_LOOKUP_CHUNK_SIZE) {
    const chunk = urlHashes.slice(i, i + DB_LOOKUP_CHUNK_SIZE);
    const { data, error } = await sb.from("bp_videos").select("url_hash").in("url_hash", chunk);
    if (error) throw new Error(`existing url_hash lookup failed: ${error.message}`);
    for (const row of data ?? []) {
      if (row.url_hash) existingUrlHashes.add(row.url_hash);
    }
  }

  return { existingExternalIds, existingUrlHashes };
}

function pickRows(rows, orientation, limit) {
  // 검색 풀은 조회수 기준(품질 필터 역할)으로 가져왔고, 최종 선정은 최신 발행순.
  // published_at 없는 행은 맨 뒤로.
  return rows
    .filter((row) => row.orientation === orientation)
    .sort((a, b) => {
      const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
      const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
      return tb - ta;
    })
    .slice(0, limit);
}

async function collectCandidates(keywords, publishedAfter) {
  const collected = new Map();

  for (const keyword of keywords) {
    try {
      const ids = await searchVideos(keyword, publishedAfter);
      console.log(`[search] "${keyword}" -> ${ids.length} candidates`);
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

      console.log(`[filter] "${keyword}" -> ${kept} kept (after view/duration/dedup)`);
    } catch (error) {
      console.error(`[error] keyword "${keyword}":`, error.message);
    }
  }

  return [...collected.values()];
}

async function main() {
  const keywords = KEYWORD_ARG ? [KEYWORD_ARG] : KEYWORDS;
  const publishedAfter = new Date(Date.now() - MAX_AGE_DAYS * 86400_000).toISOString();

  console.log(`[curate-youtube] start - keywords=${keywords.length}, dry-run=${DRY_RUN}`);
  console.log(`[curate-youtube] publishedAfter=${publishedAfter}`);

  const allRows = await collectCandidates(keywords, publishedAfter);
  const { existingExternalIds, existingUrlHashes } = await listExistingVideoKeys(allRows);
  const newRows = allRows.filter(
    (row) => !existingExternalIds.has(row.external_id) && !existingUrlHashes.has(row.url_hash)
  );

  const verticals = pickRows(newRows, "vertical", MAX_VERTICAL_PER_RUN);
  const horizontals = pickRows(newRows, "horizontal", MAX_HORIZONTAL_PER_RUN);
  const rows = [...verticals, ...horizontals];

  console.log(
    `[curate-youtube] collected=${allRows.length} ` +
    `(vertical=${allRows.filter((row) => row.orientation === "vertical").length}, ` +
    `horizontal=${allRows.filter((row) => row.orientation === "horizontal").length}) ` +
    `new=${newRows.length}, duplicate(existing)=${allRows.length - newRows.length} ` +
    `-> insert: ${verticals.length} shorts + ${horizontals.length} long = ${rows.length}`
  );

  if (DRY_RUN) {
    console.log("--- SHORTS ---");
    for (const row of verticals) {
      console.log(`  - ${row._title} (${row._channel}, ${row.view_count} views) ${row.url}`);
    }
    console.log("--- HORIZONTAL ---");
    for (const row of horizontals) {
      console.log(`  - ${row._title} (${row._channel}, ${row.view_count} views) ${row.url}`);
    }
    return;
  }

  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const { _title, _channel, _durationSec, ...payload } = row;
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

  console.log(`[curate-youtube] done - inserted=${inserted}, skipped(dup race)=${skipped}`);
}

main().catch((error) => {
  console.error("[fatal]", error);
  process.exit(1);
});
