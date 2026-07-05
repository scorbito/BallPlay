"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, HelpCircle, Mail, MessageSquarePlus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { createInquiryAction } from "@/lib/actions/inquiry";
import {
  INQUIRY_CATEGORY_LABEL,
  type InquiryCategory,
  type InquiryRow,
} from "@/lib/inquiries";

const SUPPORT_EMAIL = "daedanbiz@gmail.com";

const CATEGORY_OPTIONS: InquiryCategory[] = ["prize", "general", "bug", "etc"];

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
  loggedIn: boolean;
  inquiries: InquiryRow[];
  initialCategory?: InquiryCategory;
};

export function ContactScreen({ loggedIn, inquiries, initialCategory }: Props) {
  const router = useRouter();
  const [category, setCategory] = useState<InquiryCategory>(initialCategory ?? "general");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    setDone(false);
    if (!content.trim()) {
      setError("문의 내용을 입력해주세요.");
      return;
    }
    startTransition(async () => {
      const res = await createInquiryAction({ category, content });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setContent("");
      setDone(true);
      router.refresh();
    });
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 클립보드 권한 없으면 무시 */
    }
  };

  return (
    <AppShell activeTab="my" title="문의하기" theme="light" backHref="/my/settings">
      <section className="contact-intro">
        <MessageSquarePlus size={30} className="contact-icon" />
        <h2>문의를 남겨주세요</h2>
        <p>남기신 문의는 운영팀이 확인 후 이 화면에서 답변드립니다.</p>
        <Link className="contact-faq-link" href="/my/help" prefetch>
          <HelpCircle size={15} />
          <span>이용안내 / 자주 묻는 질문 보기</span>
        </Link>
      </section>

      {loggedIn ? (
        <section className="inquiry-form">
          <label className="inquiry-label" htmlFor="inquiry-category">
            문의 유형
          </label>
          <select
            id="inquiry-category"
            className="inquiry-select"
            value={category}
            onChange={(e) => setCategory(e.target.value as InquiryCategory)}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {INQUIRY_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>

          <label className="inquiry-label" htmlFor="inquiry-content">
            문의 내용
          </label>
          <textarea
            id="inquiry-content"
            className="inquiry-textarea"
            placeholder={
              category === "prize"
                ? "경품 받을 이메일 주소 또는 카카오톡 ID를 적어주세요."
                : "문의하실 내용을 자세히 적어주세요."
            }
            value={content}
            maxLength={2000}
            rows={5}
            onChange={(e) => setContent(e.target.value)}
          />

          {error ? <p className="inquiry-error">{error}</p> : null}
          {done ? <p className="inquiry-success">문의가 접수됐어요. 답변은 이 화면에서 확인할 수 있어요.</p> : null}

          <button type="button" className="inquiry-submit" onClick={submit} disabled={pending}>
            {pending ? "접수 중…" : "문의 남기기"}
          </button>
        </section>
      ) : (
        <section className="inquiry-form">
          <p className="inquiry-login-note">문의 작성과 답변 확인은 로그인 후 이용할 수 있어요.</p>
          <Link className="inquiry-submit inquiry-login-link" href="/login" prefetch>
            로그인하기
          </Link>
        </section>
      )}

      {loggedIn && inquiries.length > 0 ? (
        <section className="inquiry-list">
          <h3 className="inquiry-list-title">내 문의 내역</h3>
          {inquiries.map((q) => (
            <article key={q.id} className="inquiry-card">
              <div className="inquiry-card-head">
                <span className="inquiry-cat">{INQUIRY_CATEGORY_LABEL[q.category] ?? "문의"}</span>
                <span className={`inquiry-status ${q.status === "answered" ? "answered" : "open"}`}>
                  {q.status === "answered" ? "답변 완료" : "접수됨"}
                </span>
                <time className="inquiry-date">{formatDate(q.created_at)}</time>
              </div>
              <p className="inquiry-content-text">{q.content}</p>
              {q.admin_reply ? (
                <div className="inquiry-reply">
                  <span className="inquiry-reply-label">운영팀 답변</span>
                  <p>{q.admin_reply}</p>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      <section className="contact-section contact-email-fallback">
        <h3>메일로도 문의할 수 있어요</h3>
        <div className="contact-email-row">
          <span className="contact-email-text">{SUPPORT_EMAIL}</span>
          <button type="button" className="contact-email-copy" onClick={copyEmail} aria-label="이메일 주소 복사">
            {copied ? (
              <>
                <Check size={14} /> 복사됨
              </>
            ) : (
              <>
                <Copy size={14} /> 복사
              </>
            )}
          </button>
        </div>
        <a className="contact-mail-secondary" href={`mailto:${SUPPORT_EMAIL}`}>
          <Mail size={14} />
          <span>메일 앱으로 작성</span>
        </a>
      </section>
    </AppShell>
  );
}
