"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AccountTierBadge } from "@/components/common/AccountTierBadge";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  initialWins: number;
  initialLosses: number;
};

export function HomeRecordBadge({ initialWins, initialLosses }: Props) {
  const [wins, setWins] = useState(initialWins);
  const [losses, setLosses] = useState(initialLosses);

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

        setWins(data?.wins ?? 0);
        setLosses(data?.losses ?? 0);
      } catch {
        // Keep the server-rendered initial record if refresh fails.
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
            공개매치 기록: {wins}승 {losses}패
          </span>
        </>
      ) : (
        <span>첫 매치 도전!</span>
      )}
    </Link>
  );
}
