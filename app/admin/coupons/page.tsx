import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getUserTierByIdentity } from "@/lib/auth/userTier";
import { getRequestIdentity } from "@/lib/auth/requestUser";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { listEventDraws } from "@/lib/server/predict/weeklyContest";
import { CouponIssuePanel, type IssuedCoupon, type WinnerWeek } from "@/components/domain/admin/CouponIssuePanel";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const serverClient = createSupabaseServerClient();
  const identity = getRequestIdentity();
  const { tier } = await getUserTierByIdentity(serverClient, identity);
  if (tier !== "admin") notFound();

  const admin = createSupabaseAdminClient();

  const [draws, couponRes] = await Promise.all([
    listEventDraws(admin),
    admin
      .from("bp_coupons")
      .select("id, user_id, title, source, issued_at")
      .order("issued_at", { ascending: false })
  ]);

  const issued: IssuedCoupon[] = (couponRes.data ?? []).map((c) => ({
    id: c.id as string,
    userId: c.user_id as string,
    title: c.title as string,
    source: (c.source as string | null) ?? null,
    issuedAt: c.issued_at as string
  }));

  // 최근 추첨된 주만 노출 (당첨자 존재).
  const weeks: WinnerWeek[] = draws
    .filter((d) => d.winnerUserId || d.couponWinners.length > 0)
    .slice(0, 8)
    .map((d) => ({
      weekStartDate: d.weekStartDate,
      weekEndDate: d.weekEndDate,
      source: `predict-king-${d.weekStartDate}`,
      winner: d.winnerUserId
        ? { userId: d.winnerUserId, nickname: d.winnerNickname, role: "main" as const }
        : null,
      couponWinners: d.couponWinners.map((w) => ({
        userId: w.userId,
        nickname: w.nickname,
        role: "coupon" as const
      }))
    }));

  return (
    <AppShell activeTab="settings" title="쿠폰 지급" theme="light" backHref="/admin/events" wide>
      <CouponIssuePanel weeks={weeks} issued={issued} />
    </AppShell>
  );
}
