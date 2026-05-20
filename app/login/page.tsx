import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/components/domain/LoginForm";
import { OAuthButtons } from "@/components/domain/OAuthButtons";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfileFromDb } from "@/lib/supabase/queries";

type LoginPageProps = {
  searchParams?: {
    error?: string;
    notice?: string;
  };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  // 정식 user는 redirect, 익명 user는 upgrade 모드로 페이지 그대로 표시
  if (data.user && !data.user.is_anonymous) {
    const profile = await getCurrentProfileFromDb().catch(() => null);
    redirect(profile ? "/" : "/onboarding");
  }

  const upgradeMode = Boolean(data.user?.is_anonymous);

  return (
    <main className="app-backdrop">
      <section className="phone-frame phone-frame-dark login-frame" aria-label={upgradeMode ? "정식 계정 전환" : "로그인"}>
        <div className="app-scroll">
          <header className="app-header login-header">
            {upgradeMode ? (
              <Link className="login-back" href="/" aria-label="뒤로" prefetch>
                <ArrowLeft size={20} />
              </Link>
            ) : <span />}
            <Link className="brand" href="/" prefetch>야구놀이터</Link>
            <span />
          </header>
          <div className="login-bg-area" aria-hidden="true" />
          <div className="login-content">
            {upgradeMode ? (
              <div className="login-upgrade-banner">
                <strong>정식 계정으로 전환</strong>
                <span>지금까지 쌓은 직관·후기·사진은 그대로 유지돼요.</span>
                <Link className="login-upgrade-skip" href="/" prefetch>지금은 그냥 사용하기 →</Link>
              </div>
            ) : null}
            <div className="login-mascot" aria-hidden="true">
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="44" fill="#0d1a30" stroke="#ff6a2b" strokeWidth="2.5" />
                <path d="M 18 26 Q 30 50 18 74" fill="none" stroke="#e63946" strokeWidth="1.2" />
                <g stroke="#e63946" strokeWidth="1.4" strokeLinecap="round">
                  <line x1="14" y1="33" x2="20.5" y2="35.5" />
                  <line x1="13" y1="40" x2="19.5" y2="41.5" />
                  <line x1="12.5" y1="48" x2="19" y2="48.5" />
                  <line x1="12.5" y1="56" x2="19" y2="55.5" />
                  <line x1="13" y1="64" x2="19.5" y2="62.5" />
                  <line x1="14" y1="71" x2="20.5" y2="68.5" />
                </g>
                <path d="M 82 26 Q 70 50 82 74" fill="none" stroke="#e63946" strokeWidth="1.2" />
                <g stroke="#e63946" strokeWidth="1.4" strokeLinecap="round">
                  <line x1="86" y1="33" x2="79.5" y2="35.5" />
                  <line x1="87" y1="40" x2="80.5" y2="41.5" />
                  <line x1="87.5" y1="48" x2="81" y2="48.5" />
                  <line x1="87.5" y1="56" x2="81" y2="55.5" />
                  <line x1="87" y1="64" x2="80.5" y2="62.5" />
                  <line x1="86" y1="71" x2="79.5" y2="68.5" />
                </g>
                <text x="50" y="64" textAnchor="middle" fontSize="44" fontWeight="900" fill="#ffffff" fontFamily="Pretendard, sans-serif">S</text>
              </svg>
            </div>
            <h1 className="login-title">
              {upgradeMode
                ? <>계정을 연동하고<br />내 기록을 안전하게 보관하세요</>
                : <>로그인하고<br />내 기록을 시작하세요</>}
            </h1>
            <OAuthButtons />
            <LoginForm error={searchParams?.error} notice={searchParams?.notice} />
            <p className="login-footnote">
              로그인하면 서비스 이용약관 및 개인정보처리방침에<br />동의하신 것 됩니다.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
