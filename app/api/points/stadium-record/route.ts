import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: true,
    awarded: false,
    amount: 0,
    reason: "lineup_simulation_rewards_disabled"
  });
}
