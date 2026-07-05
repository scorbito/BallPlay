"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureAnonymousSession } from "@/lib/actions/ensureAnonymousSession";
import { getUserTier } from "@/lib/auth/userTier";
import { type InquiryCategory, VALID_INQUIRY_CATEGORIES } from "@/lib/inquiries";

type ActionResult = { ok: true } | { ok: false; error: string };

/** 문의 작성 — 비로그인(익명 포함) 누구나 가능. 세션 없으면 익명 계정 lazy 생성. */
export async function createInquiryAction(input: {
  category: InquiryCategory;
  content: string;
}): Promise<ActionResult> {
  const content = input.content.trim();
  if (!content) return { ok: false, error: "문의 내용을 입력해주세요." };
  if (content.length > 2000) return { ok: false, error: "문의는 2000자 이내로 입력해주세요." };
  const category = VALID_INQUIRY_CATEGORIES.includes(input.category) ? input.category : "general";

  // 세션 보장(없으면 익명 계정 생성) → 그 계정에 문의를 묶는다.
  const session = await ensureAnonymousSession();
  if (!session) return { ok: false, error: "잠시 후 다시 시도해주세요." };

  // 서비스롤로 insert (검증된 userId 로 기록). 닉네임 스냅샷 포함.
  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("nickname")
    .eq("id", session.userId)
    .maybeSingle();

  const { error } = await admin.from("bp_inquiries").insert({
    user_id: session.userId,
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
