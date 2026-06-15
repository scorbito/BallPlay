"use client";

import { useEffect, useState } from "react";
import { ensureAnonymousClient } from "@/lib/supabase/ensureAnonymousClient";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PointBaseballIcon } from "./PointBaseballIcon";

const POINT_CARD_IDS = new Set([
  "ai-predict",
  "ai-battle",
  "winner-predict",
  "daily-report",
  "quiz"
]);

type HomeAvailabilityResponse = {
  ok?: boolean;
  available?: Record<string, boolean>;
};

type Props = {
  cardId: string;
  initialAvailable?: boolean;
};

let availabilityPromise: Promise<HomeAvailabilityResponse> | null = null;

async function fetchHomeAvailability(): Promise<HomeAvailabilityResponse> {
  const client = createSupabaseBrowserClient();
  await ensureAnonymousClient(client);
  const res = await fetch("/api/points/home-availability", { cache: "no-store" });
  if (!res.ok) return { ok: false };
  return res.json();
}

function getHomeAvailability() {
  if (!availabilityPromise) {
    availabilityPromise = fetchHomeAvailability()
      .catch(() => ({ ok: false }))
      .finally(() => {
        availabilityPromise = null;
      });
  }
  return availabilityPromise;
}

export function HomePointBadge({ cardId, initialAvailable }: Props) {
  const [visible, setVisible] = useState(Boolean(initialAvailable));

  useEffect(() => {
    if (!POINT_CARD_IDS.has(cardId)) return;
    if (typeof initialAvailable === "boolean") {
      setVisible(initialAvailable);
      return;
    }
    let cancelled = false;

    getHomeAvailability()
      .then((data: HomeAvailabilityResponse) => {
        if (!cancelled) {
          setVisible(Boolean(data.ok && data.available?.[cardId]));
        }
      })
      .catch(() => {
        if (!cancelled) setVisible(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cardId, initialAvailable]);

  if (!visible) return null;

  return (
    <span className="play-hub-card-bp-badge" aria-label="BP 획득 가능" title="BP 획득 가능">
      <PointBaseballIcon size={11} className="play-hub-card-bp-badge-icon" />
      <span className="play-hub-card-bp-badge-text">BP</span>
    </span>
  );
}
