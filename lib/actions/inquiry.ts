"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getUserTier } from "@/lib/auth/userTier";
import { type InquiryCategory, VALID_INQUIRY_CATEGORIES } from "@/lib/inquiries";

type ActionResult = { ok: true } | { ok: false; error: string };

/** 사용자: 본인 계정으로 문의 작성 (RLS 로 본인만 insert). */
export async function createInquiryAction(input: {
  category: InquiryCategory;
  content: string;
}): Promise<ActionResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return { ok: false, error: "로그인이 필요합니다." };

  const content = input.content.trim();
  if (!content) return { ok: false, error: "문의 내용을 입력해주세요." };
  if (content.length > 2000) return { ok: false, error: "문의는 2000자 이내로 입력해주세요." };
  const category = VALID_INQUIRY_CATEGORIES.includes(input.category) ? input.category : "general";

  // 닉네임 스냅샷 — 목록/운영자 화면 표시용.
  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("bp_inquiries").insert({
    user_id: user.id,
    nickname: profile?.nickname ?? null,
    category,
    content,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/my/contact");
  return { ok: true };
}

/** 운영자: 문의에 답변 (service_role 로 RLS 우회 update). */
export async function replyInquiryAction(id: string, reply: string): Promise<ActionResult> {
  const serverClient = createSupabaseServerClient();
  const { tier } = await getUserTier(serverClient);
  if (tier !== "admin") return { ok: false, error: "운영자 권한이 필요합니다." };

  const trimmed = reply.trim();
  if (!trimmed) return { ok: false, error: "답변 내용을 입력해주세요." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("bp_inquiries")
    .update({
      admin_reply: trimmed,
      status: "answered",
      replied_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/inquiries");
  return { ok: true };
}
