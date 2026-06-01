import type { Metadata } from "next";
import { RecordsScreen } from "@/components/domain/RecordsScreen";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getUserPublicMatchRecord } from "@/lib/supabase/query-parts/bpUserRecords";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내 기록",
  description: "야구놀이터에서 짠 라인업과 예측 기록을 한눈에 확인하세요.",
  alternates: { canonical: "/records" }
};

export default async function RecordsPage() {
  // 누적 공개 매치 전적 — 상단 카드 표시용. 익명 사용자도 본인 기록 집계.
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const record = user
    ? await getUserPublicMatchRecord(createSupabaseAdminClient(), user.id)
    : { wins: 0, losses: 0, total: 0, winRate: 0 };
  const isAnonymous = Boolean(user?.is_anonymous);

  return <RecordsScreen userRecord={record} isAnonymous={isAnonymous} />;
}
