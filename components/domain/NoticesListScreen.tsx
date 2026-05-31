"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import type { Notice } from "@/lib/types/domain";

type Props = {
  notices: Notice[];
};

const LAST_SEEN_KEY = "notices.lastSeenAt";

function formatDate(iso: string) {
  const d = new Date(iso);
  const yy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${yy}.${mm}.${dd}`;
}

function summarize(body: string, limit = 80) {
  const flat = body.replace(/\n+/g, " ").trim();
  return flat.length > limit ? `${flat.slice(0, limit)}…` : flat;
}

export function NoticesListScreen({ notices }: Props) {
  useEffect(() => {
    if (notices.length === 0) return;
    const latest = notices.reduce((acc, n) => (n.publishedAt > acc ? n.publishedAt : acc), "");
    if (latest) {
      try {
        window.localStorage.setItem(LAST_SEEN_KEY, latest);
      } catch {
        // localStorage 불가 환경 무시
      }
    }
  }, [notices]);

  return (
    <AppShell activeTab="my" title="공지사항" theme="light" backHref="/">
      {notices.length === 0 ? (
        <div className="empty-state-large">
          <div className="empty-state-icon"><Megaphone size={28} /></div>
          <p>아직 등록된 공지가 없어요.</p>
        </div>
      ) : (
        <section className="notice-list">
          {notices.map((notice, idx) => (
            <Link key={notice.id} className="notice-card" href={`/my/notices/${notice.id}`} prefetch>
              <div className="notice-card-head">
                {idx === 0 ? (
                  <span className="notice-new" aria-label="최신 공지">NEW</span>
                ) : null}
                <span className="notice-date">{formatDate(notice.publishedAt)}</span>
              </div>
              <strong className="notice-title">{notice.title}</strong>
              <p className="notice-summary">{summarize(notice.body)}</p>
            </Link>
          ))}
        </section>
      )}
    </AppShell>
  );
}
