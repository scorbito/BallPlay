import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enterPointPrize } from "@/lib/server/prizes";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { prizeId: string } }
) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) {
    return NextResponse.json(
      { ok: false, error: "경품 응모는 로그인 후 참여할 수 있어요." },
      { status: 401 }
    );
  }

  let quantity = 1;
  try {
    const body = await request.json().catch(() => ({}));
    const rawQuantity = Number((body as { quantity?: unknown }).quantity ?? 1);
    quantity = Number.isFinite(rawQuantity) ? Math.floor(rawQuantity) : 1;
  } catch {
    quantity = 1;
  }

  if (quantity < 1 || quantity > 10) {
    return NextResponse.json(
      { ok: false, error: "응모 수량은 1~10회까지 선택할 수 있어요." },
      { status: 400 }
    );
  }

  try {
    const result = await enterPointPrize({
      userId: user.id,
      prizeId: params.prizeId,
      quantity
    });
    return NextResponse.json({ ...result, ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "경품 응모에 실패했어요.";
    const status = message.includes("Insufficient BP") ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
