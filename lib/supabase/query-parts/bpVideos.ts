// bp_videos CRUD — 사용자 등록 야구 영상.
// 모든 인증 사용자가 SELECT, 본인만 INSERT/DELETE.

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseVideoUrl, type VideoOrientation, type VideoPlatform } from "@/lib/utils/videoUrl";

const TABLE = "bp_videos";

export type BpVideoRow = {
  id: string;
  owner_user_id: string;
  url: string;
  platform: VideoPlatform;
  external_id: string | null;
  orientation: VideoOrientation;
  url_hash: string;
  created_at: string;
  is_auto_curated: boolean;
  curated_keyword: string | null;
  view_count: number | null;
  published_at: string | null;
};

export type BpVideoWithOwnerRow = BpVideoRow & {
  owner_nickname: string | null;
};

// 단순 해시 — 본인 중복 URL 등록 차단용 (충돌 무시 가능 수준)
function hashUrl(url: string): string {
  const trimmed = url.trim().toLowerCase();
  let h = 5381;
  for (let i = 0; i < trimmed.length; i++) {
    h = ((h << 5) + h + trimmed.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

export async function createVideo(
  client: SupabaseClient,
  params: { userId: string; url: string }
): Promise<{ ok: true; row: BpVideoRow } | { ok: false; error: string; code?: "duplicate" | "invalid" | "unknown" }> {
  const trimmed = params.url.trim();
  if (!trimmed) return { ok: false, error: "URL이 비어있어요", code: "invalid" };
  const parsed = parseVideoUrl(trimmed);
  // YouTube만 허용 — 다른 플랫폼은 페이지 내 재생 불가
  if (parsed.platform !== "youtube") {
    return { ok: false, error: "유튜브 URL만 등록 가능합니다 (쇼츠 포함)", code: "invalid" };
  }
  const { data, error } = await client
    .from(TABLE)
    .insert({
      owner_user_id: params.userId,
      url: trimmed,
      platform: parsed.platform,
      external_id: parsed.externalId,
      orientation: parsed.orientation,
      url_hash: hashUrl(trimmed)
    })
    .select()
    .single();
  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "이미 같은 URL을 등록했어요", code: "duplicate" };
    }
    return { ok: false, error: error?.message ?? "영상 등록 실패", code: "unknown" };
  }
  return { ok: true, row: data as BpVideoRow };
}

export async function listVideos(
  client: SupabaseClient,
  limit: number = 50
): Promise<{ ok: true; rows: BpVideoWithOwnerRow[] } | { ok: false; error: string }> {
  // 1차로 created_at 기준으로 limit*1.5만큼 가져오고 (큐레이션·유저 업로드 둘 다 포함),
  // 클라에서 effective_time = published_at ?? created_at 기준으로 재정렬해 상위 limit개 사용.
  // 큐레이션 영상은 published_at(YouTube 발행 시각) 기준으로 정렬되어 최신 발행이 위로 오고,
  // 유저 업로드(published_at null)는 created_at 기준으로 자연히 함께 뒤섞임.
  const fetchSize = Math.max(limit, Math.ceil(limit * 1.5));
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(fetchSize);
  if (error) return { ok: false, error: error.message };
  const allRows = (data ?? []) as BpVideoRow[];
  const sorted = [...allRows].sort((a, b) => {
    const ta = new Date(a.published_at ?? a.created_at).getTime();
    const tb = new Date(b.published_at ?? b.created_at).getTime();
    return tb - ta;
  });
  const rows = sorted.slice(0, limit);

  // 닉네임 별도 fetch — profiles join은 FK 이슈 가능성으로 분리
  const ownerIds = Array.from(new Set(rows.map((r) => r.owner_user_id)));
  let nicknameMap: Record<string, string | null> = {};
  if (ownerIds.length > 0) {
    const { data: profileData } = await client
      .from("profiles")
      .select("id, nickname")
      .in("id", ownerIds);
    for (const p of (profileData ?? []) as Array<{ id: string; nickname: string | null }>) {
      nicknameMap[p.id] = p.nickname ?? null;
    }
  }

  const enriched: BpVideoWithOwnerRow[] = rows.map((r) => ({
    ...r,
    owner_nickname: nicknameMap[r.owner_user_id] ?? null
  }));
  return { ok: true, rows: enriched };
}

export async function deleteVideo(
  client: SupabaseClient,
  videoId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client.from(TABLE).delete().eq("id", videoId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
