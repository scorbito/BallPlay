import Link from "next/link";
import { ArrowRight, Crown, Trophy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { createSupabaseCacheClient } from "@/lib/supabase/server";
import { listEventDraws, buildHallOfFame, type EventDraw } from "@/lib/server/predict/weeklyContest";

export const revalidate = 300;

export const metadata = {
  title: "예측왕 명예의 전당",
  description: "매주 승리팀 예측왕에 오른 분들을 기록합니다."
};

function mmdd(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export default async function HallOfFamePage() {
  const supabase = createSupabaseCacheClient(300);
  const draws = await listEventDraws(supabase, { publishedOnly: true }).catch(() => [] as EventDraw[]);

  // 서수·누적 우승 집계는 적중률 랭킹 탭과 공유(최신순 반환).
  const entries = buildHallOfFame(draws);

  return (
    <AppShell activeTab="home" title="예측왕 명예의 전당" theme="light" backHref="/event/winners">
      <section className="event-screen">
        <div className="hof-hero">
          <Crown size={30} className="hof-hero-icon" />
          <h1>예측왕 명예의 전당</h1>
          <p>매주 승리팀 예측왕에 오른 분들을 기록합니다.</p>
        </div>

        {entries.length === 0 ? (
          <p className="winners-empty">아직 등재된 예측왕이 없어요. 첫 예측왕이 나오면 이곳에 새겨집니다.</p>
        ) : (
          <div className="hof-list">
            {entries.map((e) => (
              <div key={e.weekStartDate} className="hof-card">
                <div className="hof-card-ordinal">
                  <Trophy size={16} />
                  <span>제{e.ordinal}대</span>
                </div>
                <div className="hof-card-body">
                  <div className="hof-card-name-row">
                    <strong className="hof-card-name">{e.nickname ?? "익명"}</strong>
                    {e.winCount > 1 ? <span className="hof-card-wins">🏆 {e.winCount}회 우승</span> : null}
                  </div>
                  <span className="hof-card-meta">
                    {mmdd(e.weekStartDate)}~{mmdd(e.weekEndDate)}
                    {e.total && e.rate !== null ? ` · ${e.total}경기 · ${Math.round(e.rate * 100)}% 적중` : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <Link href="/predict/winner" className="event-cta event-cta-ghost" prefetch={false}>
          이번 주 예측하러 가기
          <ArrowRight size={18} strokeWidth={2.5} />
        </Link>
      </section>
    </AppShell>
  );
}
