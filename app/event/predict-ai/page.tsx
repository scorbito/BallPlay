import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { WEEKLY_EVENT_ACTIVE } from "@/lib/predict/eventConfig";
import bannerSrc from "@/data/Images/ad-banner/예측왕이벤트.png";
import bhcSrc from "@/data/Images/ad-banner/뿌링클콤보.webp";
import megaSrc from "@/data/Images/ad-banner/메가커피5000.webp";

export const revalidate = 300;

export const metadata = {
  title: "주간 예측왕 이벤트",
  description: "한 주 동안 승리팀 예측을 가장 잘 맞히면 상품을 드려요!"
};

export default async function PredictAiEventPage() {
  // 이벤트 중단 기간에는 안내 페이지 접근 차단 → 홈으로.
  if (!WEEKLY_EVENT_ACTIVE) redirect("/");

  return (
    <AppShell activeTab="home" title="주간 예측왕 이벤트" theme="light" backHref="/">
      <section className="event-screen">
        <Image
          src={bannerSrc}
          alt="주간 예측왕 이벤트 — 1등 하고 치킨 먹자"
          className="event-banner"
          sizes="(max-width: 640px) 100vw, 640px"
          priority
        />

        <div className="event-intro">
          <span className="event-badge">주간 예측왕</span>
          <h1>이번 주 예측왕이 되어보세요!</h1>
          <p>
            매주 화~일, 승리팀 예측 적중률 <strong>1위</strong>가 예측왕! 단, 3개 AI(GPT·Gemini·Claude)를
            <strong> 모두 이겨야</strong> 해요.
          </p>
        </div>

        <p className="event-section-label">🎁 경품</p>
        <div className="event-prizes">
          <div className="event-prize event-prize-main">
            <Image src={bhcSrc} alt="뿌링클 콤보" width={92} height={92} className="event-prize-img" />
            <div className="event-prize-body">
              <span className="event-prize-tag">예측왕 · 1명</span>
              <strong>뿌링클 콤보</strong>
              <p>
                한 주 30경기 중 20경기(2/3) 이상 예측 + <strong>3개 AI 모두</strong>보다 높은 적중률 → 그중{" "}
                <strong>적중률 1위</strong> 1명
                <br />
                <span style={{ opacity: 0.75 }}>
                  적중률이 같으면 예측한 경기 수가 많은 분, 그래도 같으면 추첨합니다.
                </span>
              </p>
            </div>
          </div>

          <div className="event-prize">
            <Image src={megaSrc} alt="메가커피 5,000원 쿠폰" width={92} height={92} className="event-prize-img" />
            <div className="event-prize-body">
              <span className="event-prize-tag">참여상 · 3명</span>
              <strong>메가커피 5,000원 쿠폰</strong>
              <p>한 주 5경기 이상 예측한 참여자 전원 중 추첨 3명 (1등 당첨자 제외)</p>
            </div>
          </div>
        </div>

        <div className="event-info">
          <h2>📅 기간</h2>
          <ul>
            <li>매주 화요일 ~ 일요일 (한 주 6일, 30경기 기준)</li>
          </ul>

          <h2>✅ 참여 방법</h2>
          <ul>
            <li>‘승리팀 예측하기’에서 경기별 승리팀을 예측하세요.</li>
            <li>많이 예측할수록 유리해요 — 적중률이 같으면 예측 경기 수가 많은 분이 앞섭니다.</li>
            <li>당첨 대상이 되려면 반드시 로그인이 필요합니다.</li>
          </ul>

          <h2>🎟 당첨자 발표 · 쿠폰 전달</h2>
          <ul>
            <li>한 주가 끝난 뒤 집계하여 당첨자분께 쿠폰을 보내드립니다.</li>
            <li>
              <strong>구글 로그인</strong>으로 참여하신 분은 가입하신 <strong>이메일</strong>로 보내드려요.
            </li>
            <li>
              <strong>카카오 로그인</strong>은 연락처를 알 수 없어요. <strong>설정 &gt; 문의하기</strong>에서
              쿠폰 받으실 <strong>이메일 또는 휴대폰 번호</strong>를 남겨주세요.
            </li>
            <li>당첨 대상이 되려면 로그인이 꼭 필요해요.</li>
          </ul>
          <Link href="/my/contact" className="event-inline-link" prefetch={false}>
            연락처 남기러 가기
            <ArrowRight size={14} strokeWidth={2.5} />
          </Link>

          <h2>ℹ️ 안내</h2>
          <ul>
            <li>AI도 참가자예요. 아무도 3개 AI를 모두 이기지 못한 주에는 예측왕(1등)을 뽑지 않습니다. 참여상 3분은 그대로 드려요.</li>
            <li>참여가 많으면 경품을 늘려갈 예정입니다.</li>
          </ul>
        </div>

        <Link href="/predict/winner" className="event-cta" prefetch={false}>
          승리팀 예측하러 가기
          <ArrowRight size={18} strokeWidth={2.5} />
        </Link>
      </section>
    </AppShell>
  );
}
