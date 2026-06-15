import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "1000-game simulations are generated only by the local sync:kbo-day command."
    },
    { status: 403 }
  );
}
