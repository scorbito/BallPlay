import Link from "next/link";
import { ArrowRight, Trophy, Ticket } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { createSupabaseCacheClient } from "@/lib/supabase/server";
import { listEventDraws, type EventDraw } from "@/lib/server/predict/weeklyContest";

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
  const past = drawn.slice(1);

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
                  <strong className="winners-card-name">{latest.winnerNickname}</strong>
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

            {/* 쿠폰 전달 안내 + 문의 바로가기 */}
            <div className="winners-notice">
              <h2>📮 쿠폰을 못 받으셨나요?</h2>
              <ul>
                <li>구글 로그인은 가입하신 이메일로 보내드려요.</li>
                <li>카카오 로그인 등 연락처가 필요하면 아래에서 남겨주세요.</li>
                <li>다른 이메일·휴대폰으로 받고 싶어도 문의로 알려주세요.</li>
              </ul>
              <Link href="/my/contact" className="event-cta" prefetch={false}>
                문의로 연락처 남기기
                <ArrowRight size={18} strokeWidth={2.5} />
              </Link>
            </div>

            {/* 지난 주차 */}
            {past.length > 0 ? (
              <>
                <p className="event-section-label">📜 지난 당첨자</p>
                <div className="winners-history">
                  {past.map((d) => (
                    <div key={d.weekStartDate} className="winners-history-row">
                      <span className="winners-history-week">
                        {mmdd(d.weekStartDate)}~{mmdd(d.weekEndDate)}
                      </span>
                      <span className="winners-history-detail">
                        🏆 {d.winnerNickname ?? "—"}
                        {d.couponWinners.length > 0
                          ? ` · 🎟 ${d.couponWinners.map((w) => w.nickname ?? "익명").join(", ")}`
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
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
