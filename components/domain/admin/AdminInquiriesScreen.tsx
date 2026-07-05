"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { replyInquiryAction } from "@/lib/actions/inquiry";
import { INQUIRY_CATEGORY_LABEL, type InquiryRow } from "@/lib/inquiries";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

type Props = {
  inquiries: InquiryRow[];
  winnerIds: string[];
};

export function AdminInquiriesScreen({ inquiries, winnerIds }: Props) {
  const router = useRouter();
  const winnerSet = useMemo(() => new Set(winnerIds), [winnerIds]);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const openCount = inquiries.filter((q) => q.status !== "answered").length;
  const visible = onlyOpen ? inquiries.filter((q) => q.status !== "answered") : inquiries;

  const submitReply = (id: string) => {
    const reply = (drafts[id] ?? "").trim();
    setError(null);
    if (!reply) {
      setError("답변 내용을 입력해주세요.");
      return;
    }
    setPendingId(id);
    startTransition(async () => {
      const res = await replyInquiryAction(id, reply);
      setPendingId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDrafts((prev) => ({ ...prev, [id]: "" }));
      router.refresh();
    });
  };

  return (
    <AppShell activeTab="my" title="문의 관리" theme="light" backHref="/admin/events" wide>
      <section className="admin-events-hero">
        <div>
          <span className="admin-events-kicker">운영자 전용</span>
          <h1>문의 관리</h1>
          <p>미답변 {openCount}건 · 전체 {inquiries.length}건</p>
        </div>
      </section>

      <label className="inquiry-admin-filter">
        <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
        미답변만 보기
      </label>

      {error ? <p className="inquiry-error">{error}</p> : null}

      <section className="inquiry-list">
        {visible.length === 0 ? (
          <p className="admin-events-empty">표시할 문의가 없습니다.</p>
        ) : (
          visible.map((q) => (
            <article key={q.id} className="inquiry-card">
              <div className="inquiry-card-head">
                <span className="inquiry-cat">{INQUIRY_CATEGORY_LABEL[q.category] ?? "문의"}</span>
                {winnerSet.has(q.user_id) ? <span className="inquiry-winner-badge">🎯 당첨자</span> : null}
                <span className={`inquiry-status ${q.status === "answered" ? "answered" : "open"}`}>
                  {q.status === "answered" ? "답변 완료" : "미답변"}
                </span>
                <time className="inquiry-date">{formatDate(q.created_at)}</time>
              </div>

              <div className="inquiry-admin-meta">
                <strong>{q.nickname ?? "(닉네임 없음)"}</strong>
                <code>{q.user_id.slice(0, 8)}</code>
              </div>

              <p className="inquiry-content-text">{q.content}</p>

              {q.admin_reply ? (
                <div className="inquiry-reply">
                  <span className="inquiry-reply-label">운영팀 답변</span>
                  <p>{q.admin_reply}</p>
                </div>
              ) : null}

              <textarea
                className="inquiry-textarea"
                placeholder={q.admin_reply ? "답변 수정…" : "답변 작성…"}
                rows={2}
                value={drafts[q.id] ?? ""}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
              />
              <button
                type="button"
                className="inquiry-submit"
                onClick={() => submitReply(q.id)}
                disabled={pendingId === q.id}
              >
                {pendingId === q.id ? "저장 중…" : q.admin_reply ? "답변 수정" : "답변 등록"}
              </button>
            </article>
          ))
        )}
      </section>
    </AppShell>
  );
}
