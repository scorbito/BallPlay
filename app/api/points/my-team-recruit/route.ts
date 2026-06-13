import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { spendPoints } from "@/lib/server/points";

const SINGLE_RECRUIT_COST = 100;
const TEN_RECRUIT_COST = 900;

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "BP 사용을 위해 로그인이 필요해요." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const count = Number((body as { count?: unknown }).count);
  if (count !== 1 && count !== 10) {
    return NextResponse.json({ ok: false, error: "영입 수량이 올바르지 않아요." }, { status: 400 });
  }

  const cost = count === 10 ? TEN_RECRUIT_COST : SINGLE_RECRUIT_COST;

  try {
    const result = await spendPoints({
      userId: user.id,
      amount: cost,
      reason: "my_team_recruit",
      referenceType: "my_team",
      referenceId: `recruit_${count}`,
      metadata: { count }
    });

    return NextResponse.json({
      ok: true,
      count,
      spent: result.spent,
      balance: result.balance
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "선수 영입 BP 차감에 실패했어요.";
    const status = message.includes("Insufficient BP") ? 400 : 500;
    return NextResponse.json({
      ok: false,
      error: message.includes("Insufficient BP") ? "BP가 부족해요." : message
    }, { status });
  }
}
