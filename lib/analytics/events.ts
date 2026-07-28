"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeUserAgent } from "@/lib/utils/navigator";

export type AnalyticsEventName =
  | "lineup_created"
  | "lineup_published"
  | "lineup_withdrawn"
  | "match_started"
  | "match_completed"
  /** 관전형 가상경기(경기 시뮬) 시작. properties.from 으로 진입 화면 구분. */
  | "spectator_match_started"
  | "prediction_submitted"
  | "prediction_correct"
  | "ai_prediction_viewed"
  | "sim1000_viewed"
  | "quiz_started"
  | "quiz_completed"
  | "video_submitted"
  | "point_earned"
  | "point_spent";

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

const ANONYMOUS_ID_KEY = "ballplay:analytics:anonymous-id";

function getAnonymousId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(ANONYMOUS_ID_KEY);
    if (existing) return existing;
    const next =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(ANONYMOUS_ID_KEY, next);
    return next;
  } catch {
    return null;
  }
}

export async function trackEvent(
  eventName: AnalyticsEventName,
  properties: AnalyticsProperties = {}
): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const client = createSupabaseBrowserClient() as any;
    await client.from("bp_events").insert({
      event_name: eventName,
      anonymous_id: getAnonymousId(),
      properties,
      pathname: window.location.pathname,
      user_agent: safeUserAgent()
    });
  } catch {
    // Analytics must never block the user flow.
  }
}


