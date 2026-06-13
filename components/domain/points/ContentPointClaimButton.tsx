"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureAnonymousClient } from "@/lib/supabase/ensureAnonymousClient";
import { POINT_LABEL, getContentPointAmount, type ContentPointType } from "@/lib/points/config";
import { useAppState } from "@/lib/state/AppState";
import { emitPointBalanceUpdated } from "./pointEvents";
import { PointBaseballIcon } from "./PointBaseballIcon";

type Props = {
  contentType: ContentPointType;
  contentId: string;
  className?: string;
};

async function readJsonResponse(res: Response) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: "BP 응답을 읽지 못했어요." };
  }
}

export function ContentPointClaimButton({ contentType, contentId, className }: Props) {
  const { showToast } = useAppState();
  const amount = getContentPointAmount(contentType);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ contentType, contentId });

    void (async () => {
      try {
        const res = await fetch(`/api/points/content-claim?${params.toString()}`, { cache: "no-store" });
        const data = await readJsonResponse(res);
        if (!cancelled && res.ok && data.ok && (data.claimed || data.capped || data.eligible === false)) {
          setHidden(true);
        }
      } finally {
        if (!cancelled) setCheckingStatus(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contentId, contentType]);

  const handleClaim = async () => {
    if (claiming || hidden) return;
    setClaiming(true);
    try {
      const client = createSupabaseBrowserClient();
      await ensureAnonymousClient(client);
      const res = await fetch("/api/points/content-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, contentId })
      });
      const data = await readJsonResponse(res);
      if (!res.ok || !data.ok) throw new Error(data.error ?? "BP 획득에 실패했어요.");
      emitPointBalanceUpdated(data.balance);
      setHidden(true);
      if (data.awarded) {
        showToast(`+${data.amount}${POINT_LABEL} 획득!`);
      } else {
        showToast(data.ineligibleReason ?? "이 콘텐츠의 BP는 이미 받았어요.");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "BP 획득 중 오류가 발생했어요.");
    } finally {
      setClaiming(false);
    }
  };

  if (checkingStatus || hidden) return null;

  return (
    <div className={`content-point-claim ${className ?? ""}`.trim()}>
      <button
        type="button"
        className="content-point-claim-btn"
        onClick={handleClaim}
        disabled={claiming}
      >
        <PointBaseballIcon size={16} className="content-point-ball-icon" />
        <span>{claiming ? "획득 중..." : `+${amount}${POINT_LABEL} 받기`}</span>
      </button>
      <span className="content-point-claim-hint">콘텐츠별 1회</span>
    </div>
  );
}
