import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getUserTierByIdentity } from "@/lib/auth/userTier";
import { getRequestIdentity } from "@/lib/auth/requestUser";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { AdminInquiriesScreen } from "@/components/domain/admin/AdminInquiriesScreen";
import type { InquiryRow } from "@/lib/inquiries";

export const dynamic = "force-dynamic";

export default async function AdminInquiriesPage() {
  noStore();

  const serverClient = createSupabaseServerClient();
  const identity = getRequestIdentity();
  const { tier } = await getUserTierByIdentity(serverClient, identity);
  if (tier !== "admin") notFound();

  const admin = createSupabaseAdminClient();
  const { data: rows } = await admin
    .from("bp_inquiries")
    .select("id, user_id, nickname, category, content, status, admin_reply, replied_at, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  const inquiries = (rows ?? []) as InquiryRow[];

  // 최신 추첨 당첨자 — 문의자가 당첨자인지 뱃지로 표시.
  const { data: draw } = await admin
    .from("bp_predict_event_draws")
    .select("winner_user_id, coupon_winners")
    .order("week_start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const winnerIds = new Set<string>();
  if (draw?.winner_user_id) winnerIds.add(String(draw.winner_user_id));
  const couponWinners = Array.isArray(draw?.coupon_winners) ? draw?.coupon_winners : [];
  for (const c of couponWinners as Array<{ userId?: string }>) {
    if (c?.userId) winnerIds.add(String(c.userId));
  }

  return <AdminInquiriesScreen inquiries={inquiries} winnerIds={Array.from(winnerIds)} />;
}
