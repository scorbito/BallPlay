"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Gift, Ticket, Trophy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/common/Button";
import { POINT_LABEL, SHOW_BP } from "@/lib/points/config";
import type { PointPrize } from "@/lib/server/prizes";
import { useAppState } from "@/lib/state/AppState";
import { emitPointBalanceUpdated } from "@/components/domain/points/pointEvents";

type RewardsScreenProps = {
  prizes: PointPrize[];
  canEnter: boolean;
  setupError?: string | null;
};

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function getPrizeState(prize: PointPrize, now: number): {
  label: string;
  open: boolean;
  drawn: boolean;
} {
  const startsAt = new Date(prize.startsAt).getTime();
  const endsAt = new Date(prize.endsAt).getTime();
  if (prize.status === "drawn") return { label: "추첨 완료", open: false, drawn: true };
  if (prize.status === "closed") return { label: "응모 마감", open: false, drawn: false };
  if (prize.status !== "active") return { label: "준비중", open: false, drawn: false };
  if (now < startsAt) return { label: "오픈 예정", open: false, drawn: false };
  if (now >= endsAt) return { label: "응모 마감", open: false, drawn: false };
  return { label: "응모 가능", open: true, drawn: false };
}

function formatPrizeItemLabel(item: PointPrize["prizeItems"][number], index: number): string {
  const label = item.rankLabel?.trim() || `${index + 1}등`;
  return `${label} ${item.title} ${item.winnerCount.toLocaleString()}명`;
}

export function RewardsScreen({ prizes, canEnter, setupError = null }: RewardsScreenProps) {
  const { showToast } = useAppState();
  const [items, setItems] = useState(prizes);
  const [enteringId, setEnteringId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const now = useMemo(() => Date.now(), []);
  const router = useRouter();

  // BP 숨김 — 경품 기능 비노출. 직접 URL 진입 시 마이페이지로 돌려보냄.
  useEffect(() => {
    if (!SHOW_BP) router.replace("/my");
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/points/balance", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setBalance(Number(data.balance ?? 0));
      })
      .catch(() => {
        if (!cancelled) setBalance(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEnter = async (prize: PointPrize) => {
    if (enteringId) return;
    setEnteringId(prize.id);
    try {
      const res = await fetch(`/api/prizes/${prize.id}/enter`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quantity: 1 })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "경품 응모에 실패했어요.");
      }

      setItems((current) => current.map((item) => (
        item.id === prize.id
          ? {
              ...item,
              myEntries: item.myEntries + Number(data.quantity ?? 1),
              totalEntries: item.totalEntries + Number(data.quantity ?? 1)
            }
          : item
      )));
      const nextBalance = Number(data.balance);
      setBalance(nextBalance);
      emitPointBalanceUpdated(nextBalance);
      showToast(`경품 응모 완료!\n-${Number(data.spent).toLocaleString()}${POINT_LABEL} 사용`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "경품 응모 중 오류가 발생했어요.");
    } finally {
      setEnteringId(null);
    }
  };

  if (!SHOW_BP) return null;

  return (
    <AppShell activeTab="my" title="경품 응모" theme="light" backHref="/my">
      <section className="rewards-summary">
        <div>
          <span className="rewards-eyebrow">BP REWARDS</span>
          <h1>모은 BP로 경품에 응모해요</h1>
          <p>응모권은 취소되지 않고, 추첨 시간이 지나면 당첨자가 확정돼요.</p>
        </div>
        <span className="rewards-summary-icon" aria-hidden="true">
          <Gift size={30} />
        </span>
      </section>

      {!canEnter ? (
        <section className="rewards-login-callout">
          <strong>경품 응모는 로그인이 필요해요.</strong>
          <span>BP는 익명 상태에서도 모을 수 있지만, 당첨자 확인을 위해 응모는 로그인 후 가능해요.</span>
          <Link href="/login" prefetch={false}>로그인하고 응모하기</Link>
        </section>
      ) : null}

      {setupError ? (
        <section className="rewards-login-callout rewards-setup-callout">
          <strong>경품 응모 DB 설정이 필요해요.</strong>
          <span>supabase/add-point-prize-raffles.sql, supabase/point-prize-05-multi-items.sql 실행 후 경품을 등록하면 목록이 표시돼요.</span>
        </section>
      ) : null}

      <section className="rewards-list" aria-label="경품 목록">
        {items.length === 0 ? (
          <div className="rewards-empty">
            <Gift size={24} />
            <strong>진행 중인 경품이 없어요.</strong>
            <span>새 경품이 열리면 여기에서 응모할 수 있어요.</span>
          </div>
        ) : items.map((prize) => {
          const state = getPrizeState(prize, now);
          const insufficient = canEnter && state.open && balance !== null && balance < prize.entryCost;
          const disabled = !canEnter || !state.open || insufficient || enteringId === prize.id;
          const buttonLabel = enteringId === prize.id
            ? "응모 중..."
            : insufficient
              ? "BP 부족"
              : "1회 응모";
          return (
            <article className="reward-card" key={prize.id}>
              <div className="reward-card-media">
                {prize.imageUrl ? (
                  <span
                    className="reward-card-image"
                    style={{ backgroundImage: `url(${prize.imageUrl})` }}
                    aria-hidden="true"
                  />
                ) : (
                  <Gift size={34} />
                )}
              </div>
              <div className="reward-card-body">
                <div className="reward-card-top">
                  <span className={`reward-status reward-status-${prize.status}`}>
                    {state.label}
                  </span>
                  <span className="reward-cost">
                    <Ticket size={13} />
                    {prize.entryCost.toLocaleString()}{POINT_LABEL}
                  </span>
                </div>
                <h2>{prize.title}</h2>
                {prize.description ? <p>{prize.description}</p> : null}
                {prize.prizeItems.length > 0 ? (
                  <div className="reward-prize-items" aria-label="경품 구성">
                    {prize.prizeItems.map((item, index) => (
                      <span key={item.id}>
                        {formatPrizeItemLabel(item, index)}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="reward-meta-grid">
                  <span>
                    <Ticket size={14} />
                    내 응모 {prize.myEntries.toLocaleString()}회
                  </span>
                  <span>
                    <Trophy size={14} />
                    당첨 {prize.winnerCount.toLocaleString()}명
                  </span>
                  <span>
                    <Clock size={14} />
                    마감 {formatDateTime(prize.endsAt)}
                  </span>
                  <span>
                    <Clock size={14} />
                    추첨 {formatDateTime(prize.drawAt)}
                  </span>
                </div>
                <div className="reward-entry-row">
                  <span>총 응모 {prize.totalEntries.toLocaleString()}회</span>
                  <Button
                    className="reward-enter-button"
                    disabled={disabled}
                    onClick={() => handleEnter(prize)}
                  >
                    {buttonLabel}
                  </Button>
                </div>
                {state.drawn ? (
                  <div className="reward-winners">
                    {prize.winners.length > 0 ? (
                      prize.winners.map((winner) => (
                        <span
                          className={winner.isMe ? "is-me" : ""}
                          key={winner.id}
                        >
                          {winner.rankLabel ?? `${winner.winnerRank}등`} {winner.prizeItemTitle ?? "경품"} 당첨{winner.isMe ? " - 나" : ""}
                        </span>
                      ))
                    ) : (
                      <span>응모자가 없어 당첨자가 없어요.</span>
                    )}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
    </AppShell>
  );
}
