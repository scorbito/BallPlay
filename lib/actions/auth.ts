"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { generateDefaultNickname } from "@/lib/constants/nicknames";
import { ensureProfile } from "@/lib/actions/ensureProfile";

type AuthMode = "sign-in" | "sign-up";
type OAuthProvider = "google" | "kakao";

function getRequestOrigin() {
  const headerList = headers();
  const origin = headerList.get("origin");
  if (origin) return origin;

  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (host) {
    const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : headerList.get("x-forwarded-proto") ?? "https";
    return `${protocol}://${host}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function emailAuthAction(formData: FormData) {
  const mode = formData.get("mode")?.toString() as AuthMode | undefined;
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    redirect("/login?error=missing");
  }

  if (password.length < 6) {
    redirect("/login?error=short-password");
  }

  const supabase = createSupabaseServerClient();

  // 익명 user인 경우 → 정식 전환(link)으로 분기
  const { data: existing } = await supabase.auth.getUser();
  if (existing?.user?.is_anonymous) {
    return linkAnonymousToEmailAction(formData);
  }

  if (mode === "sign-up") {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }

    if (!data.session) {
      redirect("/login?notice=check-email");
    }

    if (data.user) await ensureProfile(data.user.id).catch(() => {});
    redirect("/");
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "로그인에 실패했습니다.")}`);
  }

  await ensureProfile(data.user.id).catch(() => {});
  redirect("/");
}

export async function signOutAction() {
  const supabase = createSupabaseServerClient();
  // scope: 'local'로 로컬 세션만 즉시 클리어 — 서버에 refresh token revoke 호출 안 함.
  // 계정 전환을 위해 로그아웃하는 경우가 많으므로 여기서는 새 익명 세션을 만들지 않는다.
  await supabase.auth.signOut({ scope: "local" });

  redirect("/login?notice=logged-out");
}

/**
 * 익명 로그인 시작 — Supabase 익명 user 생성 + 기본 프로필 row 생성.
 * 첫 진입 사용자의 가입 마찰을 0으로 만들어 "체험 → 가입" 흐름을 가능하게 함.
 * 온보딩 스킵 — 바로 홈으로.
 */
export async function signInAnonymouslyAction() {
  const supabase = createSupabaseServerClient();

  // 이미 세션이 있으면 그대로 홈으로 (중복 익명 user 방지)
  const { data: existing } = await supabase.auth.getUser();
  if (existing?.user) {
    await ensureProfile(existing.user.id).catch(() => {});
    redirect("/");
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data?.user) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "체험하기 시작에 실패했습니다.")}`);
  }

  // profiles 행 자동 생성 (admin client로 RLS 우회)
  const admin = createSupabaseAdminClient();
  await admin.from("profiles").upsert({
    id: data!.user!.id,
    nickname: generateDefaultNickname(data!.user!.id),
    main_team_id: "doosan",
    interest_team_ids: [],
    notifications_enabled: true,
    default_public_scope: "public"
  }, { onConflict: "id" });

  redirect("/");
}

/** Google/카카오 OAuth 로그인 시작 — Supabase가 발급한 provider URL로 redirect.
 *  익명 user인 경우 자동으로 linkIdentity 흐름 사용 → user.id 유지하며 정식 전환. */
export async function signInWithOAuthAction(provider: OAuthProvider) {
  const supabase = createSupabaseServerClient();
  const origin = getRequestOrigin();

  // 카카오는 비즈 앱 인증 전이라 account_email 동의 항목을 받을 수 없음.
  // → email 빼고 닉네임/프로필 사진만 요청.
  const scopes = provider === "kakao" ? "profile_nickname profile_image" : undefined;

  // 다른 계정으로 로그인 가능하게 강제 — provider 측에 활성 세션이 있어도
  // 자동 sign-in이 아니라 사용자가 계정을 선택/입력하도록 함.
  // - Google: `prompt=select_account` → 계정 선택 화면
  // - 카카오: `prompt=login` → 로그인 화면 강제 (자동 통과 방지)
  const queryParams = provider === "google"
    ? { prompt: "select_account" }
    : provider === "kakao"
      ? { prompt: "login" }
      : undefined;

  // 익명 세션이 있으면 먼저 정리 — linkIdentity는 콜백 단계에서 'already linked'
  // 에러가 잘 발생함. 우리 정책상 익명은 DB 데이터 없음(RLS 차단), localStorage만 사용.
  // user.id를 유지할 이유가 없어 그냥 익명 세션 폐기 + 정식 user로 새로 sign-in.
  // 라인업은 localStorage 그대로 남아있어 정식 로그인 후 자동 DB sync.
  const { data: authData } = await supabase.auth.getUser();
  if (authData?.user?.is_anonymous) {
    await supabase.auth.signOut().catch(() => {});
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback`,
      scopes,
      queryParams
    }
  });

  if (error || !data?.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "OAuth 로그인 시작에 실패했습니다.")}`);
  }

  redirect(data.url);
}

/** 익명 user를 이메일/비번으로 정식 전환. user.id 유지. */
export async function linkAnonymousToEmailAction(formData: FormData) {
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    redirect("/login?error=missing");
  }
  if (password.length < 6) {
    redirect("/login?error=short-password");
  }

  const supabase = createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData?.user) {
    redirect("/login?error=auth-required");
  }
  if (!authData.user.is_anonymous) {
    // 이미 정식 user — 일반 흐름으로
    redirect("/");
  }

  // 1) 이메일·비번 부착 (Supabase가 verification 메일 발송)
  const { error } = await supabase.auth.updateUser({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // 익명 → 정식 전환 후엔 그대로 사용 가능 (메일 인증은 추후 회복용)
  await ensureProfile(authData.user.id).catch(() => {});
  redirect("/?notice=upgraded");
}
