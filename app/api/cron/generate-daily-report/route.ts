import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      skipped: true,
      error: "Daily reports are authored manually and inserted only with npm run report:daily:upsert."
    },
    { status: 403 }
  );
}
