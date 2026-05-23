"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Mail, CalendarDays, Camera, MessageSquareText, Share2, UserPlus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

type Faq = { q: string; a: string };

const features: { icon: typeof CalendarDays; title: string; desc: string }[] = [
  {
    icon: CalendarDays,
    title: "직관 등록",
    desc: "일정 탭에서 경기를 선택해 직관 기록을 남겨요. 자동으로 승률에 반영됩니다."
  },
  {
    icon: Camera,
    title: "티켓 인증",
    desc: "직관 등록 시 티켓 사진을 올리면 AI가 경기·날짜·구장을 자동으로 확인해 인증해드려요."
  },
  {
    icon: MessageSquareText,
    title: "후기 작성",
    desc: "직관한 경기에 대해 후기를 남기고, 사진을 1~3장 올려 친구·전체와 공유할 수 있어요."
  },
  {
    icon: UserPlus,
    title: "친구 관리",
    desc: "닉네임으로 친구를 검색해 신청하고, 양쪽이 수락하면 서로의 직관·후기를 확인할 수 있어요."
  },
  {
    icon: Share2,
    title: "공유",
    desc: "후기 카드를 이미지로 저장하거나 카카오톡으로 공유할 수 있어요."
  }
];

const faqs: Faq[] = [
  {
    q: "티켓 인증이 안 돼요",
    a: "티켓 사진의 경기 정보(날짜·홈팀·원정팀·구장)가 직관 등록 정보와 일치해야 인증돼요. 사진이 흐리거나 일부가 잘려있는 경우 인식이 어려울 수 있어요. 다시 또렷한 사진으로 등록해 보세요."
  },
  {
    q: "다른 기기에서도 내 기록을 보고 싶어요",
    a: "비로그인(체험)으로 시작하면 한 기기에만 저장돼요. 마이 → 설정에서 '정식 계정으로 전환'을 누르거나, 로그인 화면에서 카카오/Google/이메일로 연결하면 기록을 유지한 채 다른 기기에서도 볼 수 있어요."
  },
  {
    q: "응원팀을 잘못 등록했어요",
    a: "마이 → 프로필 편집에서 응원팀을 변경할 수 있어요. 단 정식 출시 후에는 하루 1회 변경 제한이 적용될 예정입니다."
  },
  {
    q: "후기를 친구한테만 보여주고 싶어요",
    a: "후기 작성 시 공개 범위를 '친구만 보기'로 선택하세요. 마이 → 설정 → 공개 범위에서 기본값을 바꾸면 매번 선택할 필요 없이 자동 적용됩니다."
  },
  {
    q: "직관 기록을 삭제하고 싶어요",
    a: "마이 → 내 직관 리스트에서 삭제할 경기를 선택해 삭제할 수 있어요. 연결된 후기와 티켓 사진도 함께 삭제됩니다."
  },
  {
    q: "친구 요청은 어떻게 보내요?",
    a: "마이 → 친구 관리에서 닉네임을 검색해 신청을 보낼 수 있어요. 양쪽 모두 수락하면 친구가 됩니다."
  }
];

export function HelpScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <AppShell activeTab="my" title="이용안내" theme="light" backHref="/my/settings">
      <section className="help-section">
        <h2 className="help-section-title">주요 기능</h2>
        <div className="help-feature-list">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <article key={f.title} className="help-feature">
                <span className="help-feature-icon"><Icon size={18} /></span>
                <div>
                  <strong>{f.title}</strong>
                  <p>{f.desc}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="help-section">
        <h2 className="help-section-title">자주 묻는 질문</h2>
        <div className="faq-list">
          {faqs.map((faq, i) => {
            const open = openIndex === i;
            return (
              <div key={i} className={`faq-item${open ? " faq-item-open" : ""}`}>
                <button
                  type="button"
                  className="faq-question"
                  aria-expanded={open}
                  onClick={() => setOpenIndex(open ? null : i)}
                >
                  <span>{faq.q}</span>
                  <ChevronDown size={17} className="faq-chevron" />
                </button>
                {open ? <div className="faq-answer">{faq.a}</div> : null}
              </div>
            );
          })}
        </div>
      </section>

      <Link className="help-contact-cta" href="/my/contact" prefetch>
        <Mail size={16} />
        <span>더 궁금한 게 있으면 문의하기</span>
      </Link>
    </AppShell>
  );
}
