"use client";

import Link from "next/link";
import { Trophy, Crown, Medal, Award } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { AccountTierBadge } from "@/components/common/AccountTierBadge";
import type {
  AccountRankingRow,
  MyAccountRank
} from "@/lib/supabase/query-parts/bpAccountRanking";

type Props = {
  ranking: AccountRankingRow[];
  myRank: MyAccountRank | null;
  myUserId: string | null;
  isLoggedIn: boolean;
  /** 뒤로가기 목적지 — 페이지 진입 시점의 출처 따라 결정 (?from=). 기본 /records. */
  backHref?: string;
};

// 0.857 형식, 단 정수형 .000 처리 — LineupRankingScreen 패턴과 동일.
function formatRate(rate: number): string {
  return rate.toFixed(3).replace(/^0/, "");
}

// 상위 3위는 아이콘만, 4위부터는 숫자.
function renderRankBadge(rank: number) {
  if (rank === 1) return <Crown size={22} strokeWidth={2.2} aria-hidden />;
  if (rank === 2) return <Medal size={20} strokeWidth={2.2} aria-hidden />;
  if (rank === 3) return <Award size={18} strokeWidth={2.2} aria-hidden />;
  return rank;
}

export function AccountRankingScreen({
  ranking,
  myRank,
  myUserId,
  isLoggedIn,
  backHref = "/records"
}: Props) {
  // 본인이 상위 100위 안에 들어 있는지 — 들어 있으면 별도 내 순위 카드 노출 생략.
  const myRowInTop = myUserId
    ? ranking.find((r) => r.ownerUserId === myUserId) ?? null
    : null;

  return (
    <AppShell activeTab="play" title="계정 누적 랭킹" theme="light" backHref={backHref} wide>
      {/* 안내 한 줄 */}
      <div className="account-rank-hint-row">
        <p className="account-rank-hint">공식 경기에서 누적된 계정별 전적 순위입니다.</p>
      </div>

      {/* 목록 */}
      {ranking.length === 0 ? (
        <div className="account-rank-empty">
          <Trophy size={28} aria-hidden />
          <p>아직 집계된 공식 경기가 없어요.</p>
          <p className="account-rank-empty-sub">
            경기장에서 공식 경기를 진행하면 계정 전적이 랭킹에 등록됩니다.
          </p>
        </div>
      ) : (
        <ol className="account-rank-list">
          {ranking.map((row) => {
            const isMe = myUserId !== null && row.ownerUserId === myUserId;
            return (
              <li
                key={row.ownerUserId}
                className={`account-rank-item ${isMe ? "is-me" : ""}`}
              >
                <span
                  className={`account-rank-position ${
                    row.rank <= 3 ? `is-top is-top-${row.rank}` : ""
                  }`}
                  aria-label={`${row.rank}위`}
                >
                  {renderRankBadge(row.rank)}
                </span>
                {/* 누적 승수 마일스톤 뱃지 — 랭킹 진입 자체가 wins >= 1 보장이라 항상 렌더됨. */}
                <AccountTierBadge wins={row.wins} size={32} />
                <div className="account-rank-body">
                  <span className="account-rank-nickname">
                    {row.nickname}
                    {isMe ? <span className="account-rank-me-tag">나</span> : null}
                  </span>
                </div>
                <div className="account-rank-stats">
                  <span className="account-rank-wl">
                    <strong>{row.wins}</strong>승 {row.losses}패
                  </span>
                  <span className="account-rank-rate">({formatRate(row.winRate)})</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* 하단 본인 카드 — 정식 로그인이면서 100위 밖일 때만.
          본인이 상위 100위 안에 있으면(myRowInTop) 위에서 이미 강조 처리됨. */}
      {isLoggedIn && myRank && !myRowInTop ? (
        <section className="account-rank-my-card" aria-label="내 순위">
          <div className="account-rank-my-card-inner">
            <span className="account-rank-my-card-label">내 순위</span>
            <strong className="account-rank-my-card-rank">{myRank.rank}위</strong>
            <span className="account-rank-my-card-wl">
              <strong>{myRank.wins}</strong>승 {myRank.losses}패
              <span className="account-rank-my-card-rate"> ({formatRate(myRank.winRate)})</span>
            </span>
          </div>
        </section>
      ) : null}

      {/* 정식 로그인인데 공개 매치 기록이 아직 없을 때 — 안내만 표시 */}
      {isLoggedIn && !myRank && ranking.length > 0 ? (
        <section className="account-rank-my-card" aria-label="내 순위">
          <div className="account-rank-my-card-inner is-empty">
            <span className="account-rank-my-card-label">내 순위</span>
            <span className="account-rank-my-card-empty">아직 공식 경기 기록이 없어요</span>
          </div>
        </section>
      ) : null}

      {/* 비로그인/익명 — 로그인 CTA */}
      {!isLoggedIn ? (
        <section className="account-rank-login-cta" aria-label="로그인 안내">
          <p>로그인하면 내 순위를 볼 수 있어요.</p>
          <Link href="/login?next=/play/account-ranking" prefetch className="account-rank-login-cta-btn">
            로그인하러 가기
          </Link>
        </section>
      ) : null}
    </AppShell>
  );
}
