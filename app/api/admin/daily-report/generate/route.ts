import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Daily reports are generated only by the local sync:kbo-day command."
    },
    { status: 403 }
  );
}
