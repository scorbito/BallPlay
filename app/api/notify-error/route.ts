// 클라이언트 사이드 에러를 텔레그램으로 전달하는 통로.
// global-error.tsx, ErrorBoundary 등에서 POST.
//
// rate limit: IP당 분당 5건 정도 (in-memory). 봇 스팸 막기 위해.

import { NextResponse } from "next/server";
import { notifyTelegram, type NotifyPayload } from "@/lib/notify/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 가벼운 in-memory rate limit (서버리스 인스턴스 단위라 완벽 X — 우선 충분).
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
const ipBucket = new Map<string, number[]>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const arr = ipBucket.get(ip) ?? [];
  const recent = arr.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) return false;
  recent.push(now);
  ipBucket.set(ip, recent);
  return true;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!rateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  let body: Partial<NotifyPayload> = {};
  try {
    body = (await request.json()) as Partial<NotifyPayload>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (typeof body.message !== "string" || body.message.length === 0) {
    return NextResponse.json({ ok: false, error: "message_required" }, { status: 400 });
  }

  await notifyTelegram({
    message: body.message,
    source: body.source,
    stack: body.stack,
    meta: {
      ...body.meta,
      ip,
      ua: request.headers.get("user-agent") ?? undefined
    },
    level: body.level ?? "error"
  });

  return NextResponse.json({ ok: true });
}
