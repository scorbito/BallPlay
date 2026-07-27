"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Loader2, Ticket, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ModalShell } from "@/components/common/ModalShell";
import { useAppState } from "@/lib/state/AppState";

type Coupon = {
  id: string;
  title: string;
  source: string | null;
  note: string | null;
  issuedAt: string;
  expiresAt: string | null;
  viewedAt: string | null;
  viewUrl: string | null;
  downloadUrl: string | null;
};

function fmtKst(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(d);
}

function isExpired(iso: string | null): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t < Date.now();
}

export function CouponsScreen() {
  const { isAnonymous } = useAppState();
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [active, setActive] = useState<Coupon | null>(null);

  useEffect(() => {
    if (isAnonymous) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/coupons", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) setCoupons(Array.isArray(data.coupons) ? data.coupons : []);
      } catch {
        /* 실패해도 빈 목록으로 */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAnonymous]);

  const openCoupon = (c: Coupon) => {
    setActive(c);
    // 처음 여는 쿠폰이면 열람 표시(NEW 배지 해제).
    if (!c.viewedAt) {
      setCoupons((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, viewedAt: new Date().toISOString() } : x))
      );
      void fetch(`/api/coupons/${c.id}/seen`, { method: "POST" }).catch(() => {});
    }
  };

  return (
    <AppShell activeTab="settings" title="내 쿠폰함" theme="light" backHref="/my/settings">
      <section className="coupons-intro">
        <span className="coupons-intro-icon" aria-hidden="true">
          <Ticket size={22} />
        </span>
        <div>
          <h1>내 쿠폰함</h1>
          <p>이벤트 당첨 쿠폰을 여기에서 확인하고 저장할 수 있어요.</p>
        </div>
      </section>

      {isAnonymous ? (
        <section className="coupons-login-callout">
          <strong>쿠폰함은 로그인 계정에 보관돼요.</strong>
          <span>당첨 쿠폰을 안전하게 받으려면 로그인하세요.</span>
          <Link href="/login" prefetch={false}>
            로그인하기
          </Link>
        </section>
      ) : loading ? (
        <div className="coupons-loading">
          <Loader2 size={22} className="coupons-spin" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="coupons-empty">
          <Ticket size={26} />
          <strong>아직 받은 쿠폰이 없어요.</strong>
          <span>주간 예측왕 이벤트에 참여하고 쿠폰을 받아보세요.</span>
        </div>
      ) : (
        <section className="coupons-list" aria-label="쿠폰 목록">
          {coupons.map((c) => {
            const expired = isExpired(c.expiresAt);
            return (
              <button
                type="button"
                key={c.id}
                className={`coupon-card ${expired ? "coupon-card-expired" : ""}`}
                onClick={() => openCoupon(c)}
              >
                <span
                  className="coupon-card-thumb"
                  style={c.viewUrl ? { backgroundImage: `url(${c.viewUrl})` } : undefined}
                  aria-hidden="true"
                >
                  {!c.viewUrl ? <Ticket size={22} /> : null}
                </span>
                <span className="coupon-card-body">
                  <span className="coupon-card-title">
                    {c.title}
                    {!c.viewedAt ? <span className="coupon-card-new">NEW</span> : null}
                  </span>
                  <span className="coupon-card-date">{fmtKst(c.issuedAt)} 지급</span>
                  {c.expiresAt ? (
                    <span className={`coupon-card-expiry ${expired ? "is-expired" : ""}`}>
                      {expired ? "기간 만료" : `${fmtKst(c.expiresAt)}까지`}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </section>
      )}

      <ModalShell
        open={active !== null}
        title={active?.title ?? "쿠폰"}
        ariaLabel="쿠폰 보기"
        onClose={() => setActive(null)}
        panelClassName="coupon-view-panel"
      >
        {active ? (
          <div className="coupon-view">
            {active.viewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={active.viewUrl} alt={active.title} className="coupon-view-image" />
            ) : (
              <p className="coupon-view-error">이미지를 불러오지 못했어요.</p>
            )}
            {active.note ? <p className="coupon-view-note">{active.note}</p> : null}
            {active.expiresAt ? (
              <p className="coupon-view-expiry">
                {isExpired(active.expiresAt)
                  ? "사용 기간이 만료됐어요."
                  : `${fmtKst(active.expiresAt)}까지 사용 가능`}
              </p>
            ) : null}
            <div className="coupon-view-actions">
              {active.downloadUrl ? (
                <a className="coupon-view-download" href={active.downloadUrl}>
                  <Download size={18} />
                  이미지 저장
                </a>
              ) : null}
              <button type="button" className="coupon-view-close" onClick={() => setActive(null)}>
                <X size={18} />
                닫기
              </button>
            </div>
            <p className="coupon-view-hint">
              저장이 안 되면 이미지를 길게 눌러 저장하세요.
            </p>
          </div>
        ) : null}
      </ModalShell>
    </AppShell>
  );
}
