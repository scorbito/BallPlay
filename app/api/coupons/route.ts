import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";

// 본인 쿠폰함 — 유저별로 달라 캐시 금지.
export const dynamic = "force-dynamic";

const SIGNED_URL_TTL = 60 * 60; // 1시간

type CouponRow = {
  id: string;
  title: string;
  image_path: string;
  source: string | null;
  note: string | null;
  issued_at: string;
  expires_at: string | null;
  viewed_at: string | null;
};

function extOf(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  return ext && /^[a-z0-9]+$/.test(ext) ? ext : "png";
}

/** 로그인(비익명) 사용자의 쿠폰 목록 + 서명 URL(열람/다운로드). */
export async function GET() {
  const server = createSupabaseServerClient();
  const { data: authData } = await server.auth.getUser();
  const user = authData.user;
  if (!user || user.is_anonymous) {
    return NextResponse.json({ coupons: [], unseen: 0 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("bp_coupons")
    .select("id, title, image_path, source, note, issued_at, expires_at, viewed_at")
    .eq("user_id", user.id)
    .order("issued_at", { ascending: false });

  if (error || !data) {
    return NextResponse.json({ coupons: [], unseen: 0 });
  }

  const rows = data as CouponRow[];
  const bucket = admin.storage.from("coupon-images");

  const coupons = await Promise.all(
    rows.map(async (row) => {
      const [view, download] = await Promise.all([
        bucket.createSignedUrl(row.image_path, SIGNED_URL_TTL),
        bucket.createSignedUrl(row.image_path, SIGNED_URL_TTL, {
          download: `${row.title}.${extOf(row.image_path)}`
        })
      ]);
      return {
        id: row.id,
        title: row.title,
        source: row.source,
        note: row.note,
        issuedAt: row.issued_at,
        expiresAt: row.expires_at,
        viewedAt: row.viewed_at,
        viewUrl: view.data?.signedUrl ?? null,
        downloadUrl: download.data?.signedUrl ?? null
      };
    })
  );

  const unseen = rows.filter((r) => !r.viewed_at).length;
  return NextResponse.json({ coupons, unseen });
}
