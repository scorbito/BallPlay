import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      skipped: true,
      error: "Daily reports are generated only by the local sync:kbo-day command."
    },
    { status: 403 }
  );
}
