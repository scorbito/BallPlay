import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { generateDefaultNickname } from "@/lib/constants/nicknames";

// 첫 진입(비인증) 사용자에게 자동으로 익명 Supabase 세션을 발급하고 기본 프로필 row를 만든다.
// 미들웨어에서 "/"에 비인증 진입 시 이 라우트로 보낸 뒤, 여기서 다시 next(기본 "/")로 redirect.
// 랜딩 페이지 없이도 사용자가 곧장 메인으로 진입할 수 있게 하기 위한 부트스트랩.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const nextParam = searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/";

  const supabase = createSupabaseServerClient();

  // 이미 세션이 있다면 (race로 다른 탭에서 만들어졌거나, signOut 직후 재진입 등) 그대로 통과.
  const { data: existing } = await supabase.auth.getUser();
  if (existing?.user) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data?.user) {
    // 익명 가입이 막혀 있는 등 실패 시 — 로그인 페이지로 폴백.
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error?.message ?? "익명 세션 생성에 실패했습니다.")}`
    );
  }

  // 기본 프로필 생성 (RLS 우회를 위해 admin client). 닉네임/팀은 사용자가 나중에 설정에서 변경.
  const admin = createSupabaseAdminClient();
  await admin.from("profiles").upsert(
    {
      id: data.user.id,
      nickname: generateDefaultNickname(data.user.id),
      main_team_id: "doosan",
      interest_team_ids: [],
      notifications_enabled: true,
      default_public_scope: "public"
    },
    { onConflict: "id" }
  );

  return NextResponse.redirect(`${origin}${next}`);
}
