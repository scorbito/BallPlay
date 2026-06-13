"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type PageViewCounterProps = {
  pullUp?: boolean;
  viewKey?: string;
};

export function PageViewCounter({ pullUp = false, viewKey: viewKeyOverride }: PageViewCounterProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [count, setCount] = useState<number | null>(null);

  const date = searchParams.get("date");
  const viewKey = viewKeyOverride ?? (date ? `${pathname}?date=${date}` : pathname);

  useEffect(() => {
    if (!viewKey) return;

    setCount(null);
    const supabase = createSupabaseBrowserClient();

    async function handlePageView() {
      try {
        // 1. 브라우저 세션 스토리지에서 이미 방문한 경로인지 확인
        const sessionKey = "bp_visited_paths";
        let visitedPaths: string[] = [];

        try {
          const stored = sessionStorage.getItem(sessionKey);
          if (stored) {
            visitedPaths = JSON.parse(stored);
          }
        } catch (e) {
          console.warn("[PageViewCounter] sessionStorage read error:", e);
        }

        const isVisited = visitedPaths.includes(viewKey);

        if (!isVisited) {
          // React 개발 모드의 effect 재실행에서도 중복 증가하지 않도록 먼저 방문 처리합니다.
          try {
            visitedPaths.push(viewKey);
            sessionStorage.setItem(sessionKey, JSON.stringify(visitedPaths));
          } catch (e) {
            console.warn("[PageViewCounter] sessionStorage write error:", e);
          }

          // 1-1. 미방문인 경우: RPC 함수를 실행해 DB 조회수를 1 올리고 최신 카운트를 반환받음
          const { data, error } = await supabase.rpc("increment_page_view", {
            p_path: viewKey,
          });

          if (error) {
            console.error("[PageViewCounter] RPC increment failed:", error.message);
            // 에러가 나면 일반 SELECT로 폴백 시도
            fetchCountOnly(supabase);
            return;
          }

          if (data !== null && data !== undefined) {
            const newCount = typeof data === "string" ? parseInt(data, 10) : Number(data);
            setCount(newCount);
          } else {
            fetchCountOnly(supabase);
          }
        } else {
          // 1-2. 이미 방문한 경우: 단순히 DB에서 현재 카운트만 읽어옴 (쓰기 발생 안 함)
          await fetchCountOnly(supabase);
        }
      } catch (err) {
        console.error("[PageViewCounter] Error handling page view count:", err);
      }
    }

    async function fetchCountOnly(client: any) {
      const { data, error } = await client
        .from("page_views")
        .select("view_count")
        .eq("page_path", viewKey)
        .maybeSingle();

      if (error) {
        console.error("[PageViewCounter] SELECT count failed:", error.message);
        return;
      }

      if (data) {
        setCount(Number(data.view_count));
      } else {
        // 데이터가 아예 없는 초기 페이지라면 0으로 렌더링
        setCount(0);
      }
    }

    void handlePageView();
  }, [viewKey]);

  return (
    <div className={`${pullUp ? "-mt-6 sm:-mt-10" : "mt-1"} mb-0 sm:-mb-8 text-center text-[10px] leading-none text-gray-400/60 select-none`}>
      <span>조회수 {count !== null ? count.toLocaleString() : "..."}회</span>
    </div>
  );
}
