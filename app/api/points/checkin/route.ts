import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { claimDailyCheckin } from "@/lib/server/points";

export async function POST() {
  const client = createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  const result = await claimDailyCheckin(user.id);
  return NextResponse.json({ ok: true, ...result });
}
