"use client";

import { useMemo, useState } from "react";

export type IssuedCoupon = {
  id: string;
  userId: string;
  title: string;
  source: string | null;
  issuedAt: string;
};

export type Winner = {
  userId: string;
  nickname: string | null;
  role: "main" | "coupon";
};

export type WinnerWeek = {
  weekStartDate: string;
  weekEndDate: string;
  source: string;
  winner: Winner | null;
  couponWinners: Winner[];
};

type Props = {
  weeks: WinnerWeek[];
  issued: IssuedCoupon[];
};

const DEFAULT_TITLE: Record<Winner["role"], string> = {
  main: "뿌링클 콤보 쿠폰",
  coupon: "메가커피 5,000원 쿠폰"
};

function mmdd(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}.${Number(d)}`;
}

const box: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
  marginBottom: 16
};
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#64748b" };
const input: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  fontSize: 13,
  marginTop: 4
};

function WinnerRow({
  winner,
  source,
  issuedTitle,
  onIssued
}: {
  winner: Winner;
  source: string;
  issuedTitle: string | null;
  onIssued: (c: IssuedCoupon) => void;
}) {
  const [title, setTitle] = useState(DEFAULT_TITLE[winner.role]);
  const [file, setFile] = useState<File | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleLabel = winner.role === "main" ? "예측왕(1등)" : "참여상";

  if (issuedTitle) {
    return (
      <div style={{ ...box, marginBottom: 10, borderColor: "#86efac", background: "#f0fdf4" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ ...label, color: "#16a34a" }}>{roleLabel} · 지급 완료 ✓</span>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>
              {winner.nickname ?? "익명"}
            </div>
          </div>
          <span style={{ fontSize: 12, color: "#64748b" }}>{issuedTitle}</span>
        </div>
      </div>
    );
  }

  const submit = async () => {
    if (busy) return;
    if (!file) {
      setError("쿠폰 이미지를 첨부하세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("userId", winner.userId);
      form.set("title", title.trim());
      form.set("source", source);
      if (note.trim()) form.set("note", note.trim());
      if (expiresAt) form.set("expiresAt", expiresAt);
      form.set("file", file);
      const res = await fetch("/api/admin/coupons/issue", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "지급에 실패했습니다.");
      }
      onIssued({
        id: data.couponId,
        userId: winner.userId,
        title: title.trim(),
        source,
        issuedAt: new Date().toISOString()
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "지급 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ ...box, marginBottom: 10 }}>
      <div style={{ marginBottom: 8 }}>
        <span style={label}>{roleLabel}</span>
        <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{winner.nickname ?? "익명"}</div>
        <div style={{ fontSize: 11, color: "#94a3b8", wordBreak: "break-all" }}>{winner.userId}</div>
      </div>
      <label style={label}>
        쿠폰 제목
        <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      </label>
      <div style={{ marginTop: 8 }}>
        <label style={label}>
          쿠폰 이미지 (JPG/PNG/WEBP)
          <input
            style={{ ...input, padding: 6 }}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      <div style={{ marginTop: 8 }}>
        <label style={label}>
          만료일 (선택)
          <input style={input} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </label>
      </div>
      <div style={{ marginTop: 8 }}>
        <label style={label}>
          운영 메모 (선택)
          <input style={input} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </label>
      </div>
      {error ? <p style={{ color: "#dc2626", fontSize: 12, margin: "8px 0 0" }}>{error}</p> : null}
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        style={{
          marginTop: 12,
          width: "100%",
          padding: "10px",
          border: "none",
          borderRadius: 8,
          background: busy ? "#94a3b8" : "#0f172a",
          color: "#fff",
          fontSize: 14,
          fontWeight: 800,
          cursor: busy ? "default" : "pointer"
        }}
      >
        {busy ? "지급 중..." : "쿠폰 지급"}
      </button>
    </div>
  );
}

export function CouponIssuePanel({ weeks, issued: initialIssued }: Props) {
  const [issued, setIssued] = useState<IssuedCoupon[]>(initialIssued);

  const issuedKey = useMemo(() => {
    const map = new Map<string, string>(); // `${userId}|${source}` -> title
    for (const c of issued) {
      if (c.source) map.set(`${c.userId}|${c.source}`, c.title);
    }
    return map;
  }, [issued]);

  const onIssued = (c: IssuedCoupon) => setIssued((prev) => [c, ...prev]);

  if (weeks.length === 0) {
    return (
      <p style={{ textAlign: "center", color: "#64748b", padding: "32px 0" }}>
        추첨된 당첨자가 없습니다. 먼저 이벤트 추첨을 진행하세요.
      </p>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
        당첨자에게 쿠폰 이미지를 지급하면 해당 계정의 <strong>설정 &gt; 내 쿠폰함</strong>에 저장됩니다.
      </p>
      {weeks.map((week) => {
        const rows: Winner[] = [
          ...(week.winner ? [week.winner] : []),
          ...week.couponWinners
        ];
        return (
          <section key={week.weekStartDate} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 900, margin: "0 0 10px" }}>
              🏆 {mmdd(week.weekStartDate)}~{mmdd(week.weekEndDate)}
            </h2>
            {rows.length === 0 ? (
              <p style={{ fontSize: 13, color: "#94a3b8" }}>당첨자 없음</p>
            ) : (
              rows.map((w) => (
                <WinnerRow
                  key={`${w.userId}-${w.role}`}
                  winner={w}
                  source={week.source}
                  issuedTitle={issuedKey.get(`${w.userId}|${week.source}`) ?? null}
                  onIssued={onIssued}
                />
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}
