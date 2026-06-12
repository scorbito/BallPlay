import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPointBalance } from "@/lib/server/points";

export async function GET() {
  const client = createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ balance: 0, authenticated: false });

  const balance = await getPointBalance(user.id);
  return NextResponse.json({ balance, authenticated: true, isAnonymous: user.is_anonymous });
}
