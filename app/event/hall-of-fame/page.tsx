import Link from "next/link";
import { ArrowRight, Crown, Trophy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { createSupabaseCacheClient } from "@/lib/supabase/server";
import { listEventDraws, type EventDraw } from "@/lib/server/predict/weeklyContest";

export const revalidate = 300;

export const metadata = {
  title: "예측왕 명예의 전당",
  description: "매주 승리팀 예측왕에 오른 분들을 기록합니다."
};

function mmdd(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

type HofEntry = EventDraw & { ordinal: number; winCount: number };

export default async function HallOfFamePage() {
  const supabase = createSupabaseCacheClient(300);
  const draws = await listEventDraws(supabase).catch(() => [] as EventDraw[]);

  // 예측왕(메인 당첨자)이 있는 주만. AI가 이긴 주(당첨자 없음)는 제외.
  const winnerWeeks = draws.filter((d) => d.winnerUserId);

  // 오래된 주부터 "제N대" 서수 부여 + 유저별 누적 우승 횟수 집계.
  const ascending = [...winnerWeeks].sort((a, b) =>
    a.weekStartDate < b.weekStartDate ? -1 : a.weekStartDate > b.weekStartDate ? 1 : 0
  );
  const winCount = new Map<string, number>();
  for (const d of ascending) {
    const id = d.winnerUserId as string;
    winCount.set(id, (winCount.get(id) ?? 0) + 1);
  }
  const ordinalOf = new Map<string, number>();
  ascending.forEach((d, i) => ordinalOf.set(d.weekStartDate, i + 1));

  // 화면은 최신순.
  const entries: HofEntry[] = [...winnerWeeks]
    .sort((a, b) => (a.weekStartDate < b.weekStartDate ? 1 : a.weekStartDate > b.weekStartDate ? -1 : 0))
    .map((d) => ({
      ...d,
      ordinal: ordinalOf.get(d.weekStartDate) ?? 0,
      winCount: winCount.get(d.winnerUserId as string) ?? 1
    }));

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
                    <strong className="hof-card-name">{e.winnerNickname ?? "익명"}</strong>
                    {e.winCount > 1 ? <span className="hof-card-wins">🏆 {e.winCount}회 우승</span> : null}
                  </div>
                  <span className="hof-card-meta">
                    {mmdd(e.weekStartDate)}~{mmdd(e.weekEndDate)}
                    {e.winnerTotal && e.winnerRate !== null
                      ? ` · ${e.winnerTotal}경기 · ${Math.round(e.winnerRate * 100)}% 적중`
                      : ""}
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
