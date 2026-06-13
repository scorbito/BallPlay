import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { getHomePointAvailability } from "@/lib/server/homePointAvailability";

export const dynamic = "force-dynamic";

export async function GET() {
  const userClient = createSupabaseServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({
      ok: true,
      available: {}
    });
  }

  const admin = createSupabaseAdminClient();
  const available = await getHomePointAvailability(user.id, admin, user.created_at);

  return NextResponse.json({
    ok: true,
    available
  });
}
