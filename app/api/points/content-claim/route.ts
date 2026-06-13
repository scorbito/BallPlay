import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CONTENT_POINT_TYPES, type ContentPointType } from "@/lib/points/config";
import { claimContentPoints, getContentPointClaimStatus } from "@/lib/server/points";

function isContentPointType(value: string): value is ContentPointType {
  return value in CONTENT_POINT_TYPES;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const contentType = String(body.contentType ?? "");
    const contentId = String(body.contentId ?? "").trim();

    if (!isContentPointType(contentType) || !contentId) {
      return NextResponse.json({ ok: false, error: "invalid content" }, { status: 400 });
    }

    const client = createSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

    const result = await claimContentPoints({ userId: user.id, userCreatedAt: user.created_at, contentType, contentId });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "content point claim failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const contentType = String(searchParams.get("contentType") ?? "");
    const contentId = String(searchParams.get("contentId") ?? "").trim();

    if (!isContentPointType(contentType) || !contentId) {
      return NextResponse.json({ ok: false, error: "invalid content" }, { status: 400 });
    }

    const client = createSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: true, claimed: false, capped: false, balance: 0 });
    }

    const status = await getContentPointClaimStatus({ userId: user.id, userCreatedAt: user.created_at, contentType, contentId });
    return NextResponse.json({ ok: true, ...status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "content point status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
