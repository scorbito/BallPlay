import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listPointPrizes, type PointPrize } from "@/lib/server/prizes";
import { RewardsScreen } from "@/components/domain/rewards/RewardsScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "경품 응모",
  alternates: { canonical: "/rewards" }
};

export default async function RewardsPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  let prizes: PointPrize[] = [];
  let setupError: string | null = null;
  try {
    prizes = await listPointPrizes(user?.id ?? null);
  } catch (err) {
    setupError = err instanceof Error ? err.message : "경품 응모 테이블을 확인할 수 없어요.";
  }

  return (
    <RewardsScreen
      prizes={prizes}
      canEnter={Boolean(user && !user.is_anonymous)}
      setupError={setupError}
    />
  );
}
