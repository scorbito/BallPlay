import Link from "next/link";
import { ArrowRight, Trophy, Ticket } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { createSupabaseCacheClient } from "@/lib/supabase/server";
import { listEventDraws, isWeekFullyIssued, type EventDraw } from "@/lib/server/predict/weeklyContest";

export const revalidate = 300;

export const metadata = {
  title: "주간 예측왕 당첨자 발표",
  description: "주간 예측왕 이벤트 당첨자를 확인하세요."
};

function mmdd(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export default async function PredictKingWinnersPage() {
  const supabase = createSupabaseCacheClient(300);
  const draws = await listEventDraws(supabase).catch(() => [] as EventDraw[]);
  // 실제로 추첨된 주(당첨자 있음)만.
  const drawn = draws.filter((d) => d.winnerUserId || d.couponWinners.length > 0);
  const latest = drawn[0] ?? null;
  // 쿠폰이 전부 전달됐으면 안내 문구를 "전달 예정" → "지급 완료"로 전환.
  const issued = latest ? await isWeekFullyIssued(supabase, latest) : false;

  return (
    <AppShell activeTab="home" title="주간 예측왕 당첨자" theme="light" backHref="/">
      <section className="event-screen">
        <div className="event-intro">
          <span className="event-badge">🎉 당첨자 발표</span>
          <h1>주간 예측왕 당첨자</h1>
          <p>매주 화~일 승리팀 예측왕과 참여상 당첨자를 발표합니다.</p>
        </div>

        {latest ? (
          <>
            <p className="event-section-label">
              🏆 이번 발표 · {mmdd(latest.weekStartDate)}~{mmdd(latest.weekEndDate)}
            </p>

            {/* 예측왕 */}
            <div className="winners-card winners-card-main">
              <Trophy size={22} className="winners-card-icon" />
              <div className="winners-card-body">
                <span className="winners-card-role">예측왕 · 뿌링클 콤보</span>
                {latest.winnerNickname ? (
                  <>
                    <strong className="winners-card-name">{latest.winnerNickname}</strong>
                    {latest.winnerTotal && latest.winnerRate !== null ? (
                      <span className="winners-card-stat">
                        {latest.winnerTotal}경기 참여 · {Math.round(latest.winnerRate * 100)}% 적중
                      </span>
                    ) : null}
                  </>
                ) : (
                  <strong className="winners-card-name winners-card-none">
                    이번 주는 예측왕 없음 (AI 승)
                  </strong>
                )}
              </div>
            </div>

            {/* 참여상 */}
            {latest.couponWinners.length > 0 ? (
              <div className="winners-card winners-card-coupon">
                <Ticket size={20} className="winners-card-icon" />
                <div className="winners-card-body">
                  <span className="winners-card-role">참여상 · 메가커피 5,000원 ({latest.couponWinners.length}명)</span>
                  <div className="winners-card-names">
                    {latest.couponWinners.map((w) => (
                      <span key={w.userId} className="winners-chip">
                        {w.nickname ?? "익명"}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {/* 쿠폰 전달 안내 + 쿠폰함 바로가기 (공지와 동일 내용) */}
            <div className="winners-notice">
              <h2>{issued ? "✅ 쿠폰 지급 완료" : "🎟 쿠폰 전달 안내"}</h2>
              <ul>
                {issued ? (
                  <>
                    <li>당첨자 전원에게 쿠폰을 보내드렸어요. <strong>설정 &gt; 내 쿠폰함</strong>에서 확인하세요.</li>
                    <li>내 쿠폰함에서 언제든 확인하고 이미지로 저장할 수 있어요.</li>
                  </>
                ) : (
                  <>
                    <li>쿠폰은 늦어도 이번 주 수요일 전까지 <strong>설정 &gt; 내 쿠폰함</strong>으로 보내드립니다.</li>
                    <li>도착하면 홈 알림과 설정 탭 배지로 알려드려요.</li>
                    <li>내 쿠폰함에서 언제든 확인하고 이미지로 저장할 수 있어요.</li>
                  </>
                )}
              </ul>
              <Link href="/my/coupons" className="event-cta" prefetch={false}>
                내 쿠폰함 열기
                <ArrowRight size={18} strokeWidth={2.5} />
              </Link>
            </div>

            {/* 역대 예측왕 → 명예의 전당 */}
            <Link href="/event/hall-of-fame" className="winners-hof-link" prefetch={false}>
              🏅 역대 예측왕 명예의 전당 보기
              <ArrowRight size={18} strokeWidth={2.5} />
            </Link>
          </>
        ) : (
          <p className="winners-empty">아직 발표된 당첨자가 없어요. 첫 주가 끝나면 이곳에서 발표됩니다.</p>
        )}

        <Link href="/predict/winner" className="event-cta event-cta-ghost" prefetch={false}>
          이번 주 예측하러 가기
          <ArrowRight size={18} strokeWidth={2.5} />
        </Link>
      </section>
    </AppShell>
  );
}
