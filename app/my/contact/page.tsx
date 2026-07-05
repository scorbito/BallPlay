import { ContactScreen } from "@/components/domain/ContactScreen";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InquiryCategory, InquiryRow } from "@/lib/inquiries";

// 본인 문의 내역을 세션 기준으로 조회 → 유저별로 달라 캐시 금지.
export const dynamic = "force-dynamic";

export default async function ContactPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 익명 포함 현재 세션의 문의 내역만 조회(RLS 로 본인만). 세션 없으면 빈 목록.
  let inquiries: InquiryRow[] = [];
  if (user) {
    const { data } = await supabase
      .from("bp_inquiries")
      .select("id, user_id, nickname, category, content, status, admin_reply, replied_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    inquiries = (data ?? []) as InquiryRow[];
  }

  const initialCategory = (["prize", "general", "bug", "etc"] as const).includes(
    searchParams.category as InquiryCategory
  )
    ? (searchParams.category as InquiryCategory)
    : undefined;

  return <ContactScreen inquiries={inquiries} initialCategory={initialCategory} />;
}
