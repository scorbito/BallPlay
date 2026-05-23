import { redirect } from "next/navigation";

// 온보딩 스킵 — BallPlay에선 가입 시 닉네임/팀은 디폴트로 자동 부여하고 바로 홈으로.
// 직접 /onboarding URL로 들어와도 홈으로 리다이렉트.
export default function OnboardingPage() {
  redirect("/");
}
