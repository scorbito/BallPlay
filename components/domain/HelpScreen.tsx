"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Mail, ListChecks, Swords, History, CalendarDays, Share2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

type Faq = { q: string; a: string };

const features: { icon: typeof ListChecks; title: string; desc: string }[] = [
  {
    icon: ListChecks,
    title: "팀 라인업 짜기",
    desc: "KBO 10팀 실선수 데이터로 9인 타순과 수비 위치를 직접 구성해요. 저장하면 경기장에서 바로 대결에 쓸 수 있어요."
  },
  {
    icon: Swords,
    title: "경기장 — 시뮬 대결",
    desc: "내 라인업으로 친구·다른 사용자 라인업과 9이닝 가상 대결. 친구 대결(4자리 초대 코드), 공개 라인업 도전, AI 자동 생성 라인업 중에서 선택."
  },
  {
    icon: History,
    title: "내 기록 & 리플레이",
    desc: "친구 대결·공개 매칭 결과가 자동 저장돼요. 7일 안에는 같은 매치를 다시 재생해 이닝별 진행을 볼 수 있어요."
  },
  {
    icon: CalendarDays,
    title: "경기일정 · 팀순위",
    desc: "오늘과 이번 주 KBO 경기 일정, 정규시즌 팀 순위와 최근 5경기 폼을 한눈에 확인."
  },
  {
    icon: Share2,
    title: "라인업 공유",
    desc: "만든 라인업을 이미지로 저장하거나 카카오톡·링크로 공유. 친구가 코드로 들어와 바로 도전 가능."
  }
];

const faqs: Faq[] = [
  {
    q: "시뮬 결과는 어떻게 결정되나요?",
    a: "선수 스탯(타율·출루율·장타율·투수 ERA 등)과 시드(seed) 값을 입력으로 받아 코드 로직이 9이닝을 결정합니다. 같은 라인업·같은 시드는 항상 같은 결과(결정적 시뮬). '다시 대결'은 새 시드를 써서 매번 다른 결과가 나와요."
  },
  {
    q: "친구한테 대결 어떻게 보내요?",
    a: "경기장 → '매치 만들기'를 누르면 4자리 숫자 초대 코드가 발급돼요. 친구가 경기장 → '코드로 참여'에 입력하면 자동으로 매치에 들어와 양쪽이 라인업을 올린 뒤 시작합니다."
  },
  {
    q: "AI 대결도 내 기록에 남나요?",
    a: "친구 대결과 공개 라인업 매칭만 기록에 저장됩니다. AI(자동 생성) 라인업과의 대결은 연습용이라 저장되지 않아요."
  },
  {
    q: "라인업/기록을 다른 기기에서도 보고 싶어요",
    a: "비로그인(체험)이나 익명 로그인 상태에서는 한 기기에만 저장돼요. 설정 → 정식 계정 연동(Google/카카오/이메일)으로 전환하면 라인업과 경기 기록이 DB에 동기화되어 다른 기기에서도 그대로 볼 수 있어요."
  },
  {
    q: "기록 재생이 안 돼요 (재생 불가 표시)",
    a: "재생 데이터는 매치 종료 후 7일간 보관돼요. 7일이 지나면 점수·MVP 같은 결과 요약은 남지만 이닝별 진행 재생은 불가합니다. 또 시뮬 엔진이 업데이트(버전 변경)되면 옛 기록은 재생이 막힐 수 있어요 — 룰 변경 시 결과가 달라지지 않도록 보호하는 장치입니다."
  },
  {
    q: "응원팀은 어디서 변경하나요?",
    a: "BallPlay에서는 응원팀이 표시만 돼요. 변경은 본진인 '오늘은 승요' 앱에서 하면 자동으로 BallPlay에도 반영됩니다 (같은 계정 공유)."
  },
  {
    q: "공개 라인업이 뭐예요?",
    a: "내가 만든 라인업을 '공개'로 설정하면 다른 사용자가 경기장 → 공개 라인업 목록에서 보고 도전할 수 있어요. 공개해두면 더 많은 매칭 기회 + 내 라인업으로 다른 사람이 대결한 결과까지 누적됩니다."
  },
  {
    q: "라인업 슬롯에 등급 제한이 있나요?",
    a: "주전·1군·2군·내야 등 등급별로 한 라인업에 들어갈 수 있는 인원 한도가 있어요. 너무 주전으로만 채워 '슈퍼팀'을 만드는 걸 막아 다양한 라인업을 유도하기 위함입니다. 슬롯 선택 시 안내가 떠요."
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
