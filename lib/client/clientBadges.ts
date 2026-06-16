import type { HomeBadgeServerData } from "@/lib/server/homeBadges";

type BadgesResponse = {
  ok: boolean;
  latestNoticeAt: string | null;
  badges: HomeBadgeServerData;
};

let badgeCache: BadgesResponse | null = null;
let badgeCacheAt = 0;
let fetchPromise: Promise<BadgesResponse> | null = null;

const BADGE_CACHE_KEY = "ballplay:home-badges-cache";
const BADGE_CACHE_TTL_MS = 60_000;

type StoredBadgeCache = {
  cachedAt: number;
  data: BadgesResponse;
};

function isFresh(cachedAt: number): boolean {
  return Date.now() - cachedAt <= BADGE_CACHE_TTL_MS;
}

function readStoredBadgeCache(): BadgesResponse | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(BADGE_CACHE_KEY);
    if (!raw) return null;

    const stored = JSON.parse(raw) as StoredBadgeCache;
    if (!stored.data?.ok || !isFresh(stored.cachedAt)) return null;

    badgeCache = stored.data;
    badgeCacheAt = stored.cachedAt;
    return stored.data;
  } catch {
    return null;
  }
}

function writeStoredBadgeCache(data: BadgesResponse): void {
  if (typeof window === "undefined") return;

  try {
    const stored: StoredBadgeCache = {
      cachedAt: badgeCacheAt,
      data
    };
    window.sessionStorage.setItem(BADGE_CACHE_KEY, JSON.stringify(stored));
  } catch {
    // sessionStorage is an optimization only.
  }
}

export function fetchHomeBadges(): Promise<BadgesResponse> {
  if (badgeCache && isFresh(badgeCacheAt)) return Promise.resolve(badgeCache);

  const storedCache = readStoredBadgeCache();
  if (storedCache) return Promise.resolve(storedCache);

  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch("/api/home/badges")
    .then((res) => {
      if (!res.ok) throw new Error("HTTP error");
      return res.json();
    })
    .then((data: BadgesResponse) => {
      if (data.ok) {
        badgeCache = data;
        badgeCacheAt = Date.now();
        writeStoredBadgeCache(data);
        fetchPromise = null;
        return data;
      }
      throw new Error("Failed to load badges");
    })
    .catch((err) => {
      console.error("[clientBadges] Error loading badges:", err);
      fetchPromise = null;
      return {
        ok: false,
        latestNoticeAt: null,
        badges: {
          todayDate: "",
          todayGamesTotal: 0,
          todayGamesFinished: 0,
          userPredictionsToday: 0,
          aiPredictionsToday: 0,
          simResultsToday: 0,
          latestVideoAt: null,
          latestNewsAt: null
        }
      };
    });

  return fetchPromise;
}
