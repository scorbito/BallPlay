import type { HomeBadgeServerData } from "@/lib/server/homeBadges";

type BadgesResponse = {
  ok: boolean;
  latestNoticeAt: string | null;
  badges: HomeBadgeServerData;
};

let badgeCache: BadgesResponse | null = null;
let fetchPromise: Promise<BadgesResponse> | null = null;

export function fetchHomeBadges(): Promise<BadgesResponse> {
  if (badgeCache) return Promise.resolve(badgeCache);
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch("/api/home/badges")
    .then((res) => {
      if (!res.ok) throw new Error("HTTP error");
      return res.json();
    })
    .then((data: BadgesResponse) => {
      if (data.ok) {
        badgeCache = data;
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
