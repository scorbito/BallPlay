import { NextResponse, type NextRequest } from "next/server";
import * as cheerio from "cheerio";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function normalizeImageUrl(value: string | null | undefined, baseUrl?: string): string | null {
  const src = value?.trim();
  if (!src) return null;
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return null;
  }
}

async function fetchOgImage(articleUrl: string): Promise<string | null> {
  try {
    const res = await fetch(articleUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(4500),
      cache: "no-store"
    });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);
    return normalizeImageUrl(
      $('meta[property="og:image"]').attr("content") ||
        $('meta[name="twitter:image"]').attr("content") ||
        $('meta[name="twitter:image:src"]').attr("content"),
      articleUrl
    );
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const idParam = request.nextUrl.searchParams.get("id");
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ imageUrl: null }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: row, error } = await supabase
    .from("bp_news")
    .select("id, url, image_url")
    .eq("id", id)
    .maybeSingle();

  if (error || !row?.url) {
    return NextResponse.json({ imageUrl: null }, { status: 404 });
  }

  const existing = normalizeImageUrl(row.image_url);
  if (existing) {
    return NextResponse.json({ imageUrl: existing });
  }

  const imageUrl = await fetchOgImage(row.url);
  if (!imageUrl) {
    return NextResponse.json({ imageUrl: null }, { status: 404 });
  }

  await supabase.from("bp_news").update({ image_url: imageUrl }).eq("id", id);
  return NextResponse.json({ imageUrl });
}
