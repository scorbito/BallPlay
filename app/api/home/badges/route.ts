import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHomeBadgeServerData } from "@/lib/server/homeBadges";
import { getLatestNoticePublishedAt } from "@/lib/supabase/query-parts/notices";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const [noticeAt, badgeData] = await Promise.all([
    getLatestNoticePublishedAt(),
    getHomeBadgeServerData(user?.id)
  ]);

  return NextResponse.json({
    ok: true,
    latestNoticeAt: noticeAt,
    badges: badgeData
  });
}
