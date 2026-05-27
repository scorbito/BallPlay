import type { Notice } from "@/lib/types/domain";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

function toNotice(row: {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  published_at: string;
}): Notice {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    isPinned: row.is_pinned,
    publishedAt: row.published_at
  };
}

export async function listNoticesFromDb(): Promise<Notice[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("bp_notices")
    .select("id, title, body, is_pinned, published_at")
    .lte("published_at", new Date().toISOString())
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false });

  if (error) throw new Error(`공지 조회 실패: ${error.message}`);
  return (data ?? []).map(toNotice);
}

export async function getNoticeByIdFromDb(id: string): Promise<Notice | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("bp_notices")
    .select("id, title, body, is_pinned, published_at")
    .eq("id", id)
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error(`공지 조회 실패: ${error.message}`);
  return data ? toNotice(data) : null;
}

/** 홈 헤더 공지 배지용 — 가장 최근 게시된 공지의 published_at. 없으면 null.
 *  조회 실패해도 홈은 떠야 하므로 throw 대신 null 반환. */
export async function getLatestNoticePublishedAt(): Promise<string | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("bp_notices")
      .select("published_at")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return data?.published_at ?? null;
  } catch {
    return null;
  }
}
