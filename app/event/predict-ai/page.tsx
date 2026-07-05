import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { WEEKLY_EVENT_ACTIVE } from "@/lib/predict/eventConfig";
import { createSupabaseCacheClient } from "@/lib/supabase/server";
import { getAiOverallStats } from "@/lib/supabase/query-parts/bpAiPredictions";
import { kstWeekStartTuesday } from "@/lib/server/predict/weeklyContest";
import bannerSrc from "@/data/Images/ad-banner/승부예측_배너광고.png";
import bhcSrc from "@/data/Images/ad-banner/뿌링클콤보.webp";
import megaSrc from "@/data/Images/ad-banner/메가커피5000.webp";

export const revalidate = 300;

export const metadata = {
  title: "승부예측 AI 대결 이벤트",
  description: "AI보다 승부예측을 잘 맞히면 상품을 드려요!"
};

// AI 적중률은 RPC(POST)라 정적 생성에서 동적을 유발할 수 있어 unstable_cache 로 결과를 캐시.
const getCachedWeeklyAiAvg = unstable_cache(
  async (weekStartISO: string) => {
    const supabase = createSupabaseCacheClient(300);
    const result = await getAiOverallStats(supabase, weekStartISO);
    return result.ok ? result.stats.accuracy : null;
  },
  ["event-predict-ai-weekly-ai-avg"],
  { revalidate: 300, tags: ["ai-winner-stats"] }
);

export default async function PredictAiEventPage() {
  // 이벤트 중단 기간에는 안내 페이지 접근 차단 → 홈으로.
  if (!WEEKLY_EVENT_ACTIVE) redirect("/");

  // 동기 부여용 — 이번 주 AI 평균 적중률(공개 데이터, 비로그인 OK).
  const aiAvg = await getCachedWeeklyAiAvg(kstWeekStartTuesday());

  return (
    <AppShell activeTab="home" title="승부예측 AI 대결 이벤트" theme="light" backHref="/">
      <section className="event-screen">
        <Image
          src={bannerSrc}
          alt="승부예측 AI 대결 이벤트"
          className="event-banner"
          sizes="(max-width: 640px) 100vw, 640px"
          priority
        />

        <div className="event-intro">
          <span className="event-badge">이번 주 시범 운영</span>
          <h1>AI보다 잘 맞히면 상품을 드려요!</h1>
          <p>매주 화~일, 승리팀 예측으로 3개 AI(GPT·Gemini·Claude)의 주간 평균 적중률을 이겨보세요.</p>
          {aiAvg !== null ? (
            <div className="event-ai-now">
              이번 주 AI 평균 적중률 <strong>{aiAvg}%</strong> — 이걸 넘기면 도전 성공!
            </div>
          ) : null}
        </div>

        <p className="event-section-label">🎁 경품</p>
        <div className="event-prizes">
          <div className="event-prize event-prize-main">
            <Image src={bhcSrc} alt="뿌링클 콤보" width={92} height={92} className="event-prize-img" />
            <div className="event-prize-body">
              <span className="event-prize-tag">1등 · 1명</span>
              <strong>뿌링클 콤보</strong>
              <p>한 주 30경기 중 20경기(2/3) 이상 예측 + AI 주간 평균 적중률 초과 → 추첨 1명</p>
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
            <li>추첨 대상이 되려면 반드시 로그인이 필요합니다.</li>
          </ul>

          <h2>🎟 당첨자 발표 · 쿠폰 전달</h2>
          <ul>
            <li>한 주가 끝난 뒤 추첨하여, 당첨자분께 가입하신 메일 또는 카카오 계정으로 쿠폰을 보내드립니다.</li>
            <li>쿠폰 전달을 위해 로그인(이메일/카카오)이 꼭 필요해요.</li>
          </ul>

          <h2>ℹ️ 안내</h2>
          <ul>
            <li>이번 주는 시범 운영이며, 참여가 많으면 매주 진행하고 경품도 늘려갈 예정입니다.</li>
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
