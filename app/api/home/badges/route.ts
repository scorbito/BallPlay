import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHomeBadgeServerData } from "@/lib/server/homeBadges";
import { getLatestNoticePublishedAt } from "@/lib/supabase/query-parts/notices";

export const dynamic = "force-dynamic";

function hasSupabaseAuthCookie(): boolean {
  return cookies()
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token") && cookie.value.length > 0);
}

export async function GET() {
  const user = hasSupabaseAuthCookie()
    ? (await createSupabaseServerClient().auth.getUser()).data.user
    : null;

  const [noticeAt, badgeData] = await Promise.all([
    getLatestNoticePublishedAt(),
    getHomeBadgeServerData(user?.id)
  ]);

  return NextResponse.json(
    {
      ok: true,
      latestNoticeAt: noticeAt,
      badges: badgeData
    },
    {
      headers: {
        "Cache-Control": user
          ? "private, max-age=30"
          : "public, s-maxage=60, stale-while-revalidate=300"
      }
    }
  );
}
