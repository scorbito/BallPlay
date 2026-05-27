import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import Image from "next/image";
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

const noticeMessages: Record<string, string> = {
  "check-email": "이메일 인증 링크를 확인한 뒤 다시 로그인해주세요.",
  "logged-out": "로그아웃되었습니다. 다른 계정으로 로그인할 수 있어요."
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  // 정식 user는 redirect, 익명 user는 upgrade 모드로 페이지 그대로 표시
  if (data.user && !data.user.is_anonymous) {
    // 이미 가진 user.id 전달 → 중복 auth.getUser() 제거
    const profile = await getCurrentProfileFromDb(data.user.id).catch(() => null);
    redirect(profile ? "/" : "/onboarding");
  }

  const upgradeMode = Boolean(data.user?.is_anonymous);
  const noticeMessage = searchParams?.notice ? noticeMessages[searchParams.notice] ?? searchParams.notice : "";

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
                <span>지금까지 만든 라인업이 그대로 옮겨오고, 다른 기기에서도 사용할 수 있어요.</span>
                <Link className="login-upgrade-skip" href="/" prefetch>지금은 그냥 사용하기 →</Link>
              </div>
            ) : null}
            <div className="login-mascot" aria-hidden="true">
              <Image
                src="/assets/mascot-bat.png"
                alt=""
                width={140}
                height={140}
                priority
              />
            </div>
            <h1 className="login-title">
              {upgradeMode
                ? <>계정을 연동하고<br />내 라인업을 공유해보세요</>
                : <>로그인하고<br />다른 사람 라인업과 대결해보세요</>}
            </h1>
            {!upgradeMode ? (
              <p className="login-sub">
                내 라인업을 공개하면 다른 플레이어가 도전할 수 있고,<br />
                공개 라인업과 매칭해서 시즌 실데이터 시뮬도 즐길 수 있어요.
              </p>
            ) : null}
            <OAuthButtons />
            <LoginForm error={searchParams?.error} />
            {!upgradeMode ? (
              <Link className="oauth-button oauth-guest" href="/" prefetch>
                게스트로 계속하기
              </Link>
            ) : null}
            {noticeMessage ? <p className="login-message">{noticeMessage}</p> : null}
            <p className="login-footnote">
              로그인하면 서비스 이용약관 및 개인정보처리방침에<br />
              동의하는 것으로 간주됩니다.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
