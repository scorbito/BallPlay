import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { POINT_CONTENT_REWARD_START_AT, POINT_REWARDS } from "@/lib/points/config";
import { awardPoints, getPointBalance, kstDateString } from "@/lib/server/points";

type Params = { params: { gameId: string } };

function getEligibilityStart(userCreatedAt?: string | null): string {
  if (!userCreatedAt) return POINT_CONTENT_REWARD_START_AT;
  return new Date(userCreatedAt).getTime() > new Date(POINT_CONTENT_REWARD_START_AT).getTime()
    ? userCreatedAt
    : POINT_CONTENT_REWARD_START_AT;
}

/** GET — 투표 집계 + 내 투표 여부 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { gameId } = params;
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("bp_ai_battle_votes")
    .select("voted_side")
    .eq("game_id", gameId);

  if (error) return NextResponse.json({ home: 0, away: 0, myVote: null }, { status: 200 });

  const home = data.filter((r) => r.voted_side === "home").length;
  const away = data.filter((r) => r.voted_side === "away").length;

  // 내 투표 확인
  const userClient = createSupabaseServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  const myVote = user
    ? (data.find(() => false) ?? null) // 아래에서 재조회
    : null;

  let myVoteSide: "home" | "away" | null = null;
  if (user) {
    const { data: mine } = await supabase
      .from("bp_ai_battle_votes")
      .select("voted_side")
      .eq("game_id", gameId)
      .eq("user_id", user.id)
      .maybeSingle();
    myVoteSide = (mine?.voted_side as "home" | "away") ?? null;
  }

  return NextResponse.json({ home, away, myVote: myVoteSide });
}

/** POST — 투표 제출 */
export async function POST(req: NextRequest, { params }: Params) {
  const { gameId } = params;
  const body = await req.json().catch(() => ({}));
  const side = body.side as string;

  if (side !== "home" && side !== "away") {
    return NextResponse.json({ error: "invalid side" }, { status: 400 });
  }

  const userClient = createSupabaseServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("bp_ai_battle_votes")
    .insert({ game_id: gameId, user_id: user.id, voted_side: side });

  if (error && error.code !== "23505") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let pointAward = null;
  if (!error) {
    const { data: published } = await supabase
      .from("bp_ai_battle_predictions")
      .select("published_at")
      .eq("game_id", gameId)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const publishedAt = published?.published_at ? String(published.published_at) : null;
    const rewardDate = publishedAt ? kstDateString(new Date(publishedAt)) : kstDateString();
    const eligibleFrom = getEligibilityStart(user.created_at);
    const eligible = publishedAt && new Date(publishedAt).getTime() >= new Date(eligibleFrom).getTime();
    const { data: claimedRows } = await supabase
      .from("point_reward_claims")
      .select("amount")
      .eq("user_id", user.id)
      .eq("reward_date", rewardDate)
      .like("reward_key", "ai_battle_vote:%");
    const earnedToday = ((claimedRows ?? []) as Array<{ amount: number | null }>)
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    if (eligible && earnedToday + POINT_REWARDS.aiBattleVotePerGame <= POINT_REWARDS.aiBattleVoteDailyMax) {
      pointAward = await awardPoints({
        userId: user.id,
        amount: POINT_REWARDS.aiBattleVotePerGame,
        reason: "ai_battle_vote",
        referenceType: "game",
        referenceId: gameId,
        rewardKey: `ai_battle_vote:${gameId}`,
        rewardDate
      }).catch(() => null);
    } else {
      pointAward = {
        awarded: false,
        amount: 0,
        balance: await getPointBalance(user.id),
        capped: true
      };
    }
  }

  // 최신 집계 반환
  const { data } = await supabase
    .from("bp_ai_battle_votes")
    .select("voted_side")
    .eq("game_id", gameId);

  const home = (data ?? []).filter((r) => r.voted_side === "home").length;
  const away = (data ?? []).filter((r) => r.voted_side === "away").length;

  return NextResponse.json({ home, away, myVote: side, pointAward });
}
