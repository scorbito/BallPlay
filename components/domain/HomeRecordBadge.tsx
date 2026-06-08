"use client";

// 홈 히어로의 "내 매치 기록" 뱃지 — 클라이언트 island.
// 홈 페이지가 force-dynamic 이라도 Next 클라이언트 라우터 캐시가 RSC 페이로드를
// 재사용해, 경기 후 뒤로가기/탭 이동으로 홈에 오면 전적이 안 바뀌어 보이던 문제 해결.
// 이 뱃지는 서버 초기값(빠른 첫 페인트)으로 시작하되, mount + focus/pageshow/
// visibilitychange 마다 bp_account_stats 를 직접 다시 읽어 항상 최신 전적을 표시한다.
//
// bp_account_stats RLS: select to anon, authenticated using(true) → 브라우저에서 읽기 가능.
// 순위는 wins 가 더 높은 user 수 +1 로 근사 (badge 용 — 정확 순위는 랭킹 페이지).

import { useEffect, useState } from "react";
import Link from "next/link";
import { AccountTierBadge } from "@/components/common/AccountTierBadge";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  initialWins: number;
  initialLosses: number;
  initialRank: number | null;
};

export function HomeRecordBadge({ initialWins, initialLosses, initialRank }: Props) {
  const [wins, setWins] = useState(initialWins);
  const [losses, setLosses] = useState(initialLosses);
  const [rank, setRank] = useState<number | null>(initialRank);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    let cancelled = false;

    const refresh = async () => {
      try {
        const {
          data: { user }
        } = await client.auth.getUser();
        if (!user || cancelled) return;

        const { data, error } = await client
          .from("bp_account_stats")
          .select("wins, losses")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error || cancelled) return;

        const w = data?.wins ?? 0;
        const l = data?.losses ?? 0;
        setWins(w);
        setLosses(l);

        if (w + l > 0) {
          // 순위 근사 — wins 가 더 높은 user 수 + 1. (정확 tiebreak 은 랭킹 페이지)
          const { count } = await client
            .from("bp_account_stats")
            .select("user_id", { count: "exact", head: true })
            .gt("wins", w);
          if (!cancelled) setRank((count ?? 0) + 1);
        } else if (!cancelled) {
          setRank(null);
        }
      } catch {
        // ignore — 실패 시 기존(서버 초기값) 유지
      }
    };

    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("pageshow", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const total = wins + losses;
  return (
    <Link href="/my" className="home-hero-record-badge" prefetch>
      {total > 0 ? (
        <>
          <AccountTierBadge wins={wins} size={24} />
          <span>
            내 매치 기록: {wins}승 {losses}패{rank !== null ? ` · ${rank}위` : ""}
          </span>
        </>
      ) : (
        <span>첫 매치 도전!</span>
      )}
    </Link>
  );
}
