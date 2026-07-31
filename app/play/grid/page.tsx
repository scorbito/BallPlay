import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUserTierByIdentity } from "@/lib/auth/userTier";
import { getRequestIdentity } from "@/lib/auth/requestUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GridScreen } from "@/components/domain/grid/GridScreen";

// 표시명은 명령형("9칸을 채워라!")으로 두고, 검색 유입용 "이매큘럿 그리드"는
// 메타데이터에만 넣는다 — 처음 보는 사용자에게는 뜻이 통하지 않는 말이다.
export const metadata: Metadata = {
  title: "9칸을 채워라! - KBO 이매큘럿 그리드",
  description: "두 팀에서 모두 뛴 KBO 선수를 찾아 9칸을 채우세요. 하루 한 판, 9번의 기회.",
  alternates: { canonical: "/play/grid" },
  robots: { index: false, follow: false }
};

// 운영자 테스트 단계 — 티어 확인 때문에 동적 렌더가 된다.
// 공개 전환 시 이 게이트와 force-dynamic 을 함께 걷어내면 정적 페이지로 돌아간다
// (게임 로직에 서버 호출이 없어서 그대로 정적화된다).
export const dynamic = "force-dynamic";

export default async function GridPage() {
  const client = createSupabaseServerClient();
  const identity = getRequestIdentity();
  const { tier } = await getUserTierByIdentity(client, identity);
  if (tier !== "admin") notFound();

  return <GridScreen />;
}
