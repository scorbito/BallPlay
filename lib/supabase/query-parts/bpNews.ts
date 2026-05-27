// bp_news 조회 — 뉴스 페이지 + AI 예측 입력 양쪽에서 사용.
//   - listBpNews(): 최신순 목록 (UI는 이걸 받아 클라이언트에서 팀 필터)
//   - listBpNewsByTeam(): 특정 팀 키워드로 서버 필터 (예측 워크플로용)

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { teamKeywords } from "@/lib/news/teamFilter";

export type BpNewsRow = {
  id: number;
  title: string;
  url: string;
  source: string | null;
  published_at: string | null;
  image_url: string | null;
};

const COLUMNS = "id, title, url, source, published_at, image_url";

/** 최신 뉴스 목록 (게시시각 내림차순). 실패해도 빈 배열 반환. */
export async function listBpNews(limit = 100): Promise<BpNewsRow[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("bp_news")
      .select(COLUMNS)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("[bp_news] 조회 실패:", error.message);
      return [];
    }
    return (data ?? []) as BpNewsRow[];
  } catch (e) {
    console.warn("[bp_news] 조회 예외:", (e as Error).message);
    return [];
  }
}

/** 특정 팀 관련 뉴스 — 제목에 팀 키워드 포함. AI 예측 컨텍스트 빌더용. */
export async function listBpNewsByTeam(teamId: string, limit = 30): Promise<BpNewsRow[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const kws = teamKeywords(teamId);
    const orExpr = kws.map((k) => `title.ilike.%${k}%`).join(",");
    const { data, error } = await supabase
      .from("bp_news")
      .select(COLUMNS)
      .or(orExpr)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("[bp_news] 팀 조회 실패:", error.message);
      return [];
    }
    return (data ?? []) as BpNewsRow[];
  } catch (e) {
    console.warn("[bp_news] 팀 조회 예외:", (e as Error).message);
    return [];
  }
}
