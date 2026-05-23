"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, HelpCircle, Mail } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

const SUPPORT_EMAIL = "daedanbiz@gmail.com";

export function ContactScreen() {
  const [copied, setCopied] = useState(false);

  const subject = "[야구놀이터] 문의드립니다";
  const body =
    "안녕하세요, 야구놀이터 운영팀입니다. 아래 양식으로 작성해 주시면 빠르게 답변드릴게요.\n\n" +
    "■ 사용 기기 / 브라우저:\n■ 닉네임:\n■ 발생한 상황:\n■ 기대했던 동작:\n■ 스크린샷 (있다면 첨부):\n\n--- 위 안내 문구는 자유롭게 지우고 작성해 주세요 ---";

  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const gmailCompose = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한 없으면 무시 (사용자가 직접 선택해서 복사)
    }
  };

  return (
    <AppShell activeTab="my" title="문의하기" theme="light" backHref="/my/settings">
      <section className="contact-intro">
        <Mail size={32} className="contact-icon" />
        <h2>문의 전, 자주 묻는 질문부터 확인해 보세요</h2>
        <p>비슷한 문제가 이미 안내되어 있을 수 있어요. 그래도 해결되지 않으면 언제든 메일로 알려주세요.</p>
        <Link className="contact-faq-link" href="/my/help" prefetch>
          <HelpCircle size={15} />
          <span>이용안내 / 자주 묻는 질문 보기</span>
        </Link>
      </section>

      <section className="contact-section">
        <h3>이메일로 문의</h3>
        <p className="contact-help">답변은 보통 1~3일 내에 드립니다.</p>

        <div className="contact-email-row">
          <span className="contact-email-text">{SUPPORT_EMAIL}</span>
          <button type="button" className="contact-email-copy" onClick={copyEmail} aria-label="이메일 주소 복사">
            {copied ? <><Check size={14} /> 복사됨</> : <><Copy size={14} /> 복사</>}
          </button>
        </div>

        <a className="contact-mail-button" href={mailto}>
          <Mail size={16} />
          <span>메일 앱으로 작성</span>
        </a>

        <a className="contact-mail-secondary" href={gmailCompose} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} />
          <span>Gmail 웹으로 작성</span>
        </a>

        <p className="contact-fineprint">
          메일 앱·Gmail 모두 안 되면 위 주소를 복사해서 사용하시는 메일 서비스에서 직접 보내주세요.
        </p>
      </section>
    </AppShell>
  );
}
