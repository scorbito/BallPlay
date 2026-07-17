"use client";

import { useState } from "react";
import Link from "next/link";
import { SHOW_BP } from "@/lib/points/config";
import { BarChart3, Bot, CalendarDays, ChevronDown, FileText, LineChart, Mail, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

type Faq = { q: string; a: string };

const features: { icon: typeof Bot; title: string; desc: string }[] = [
  {
    icon: Bot,
    title: "AI 승리팀 예측",
    desc: "오늘 열리는 프로야구 경기의 AI 예측과 주요 관전 포인트를 경기별로 확인할 수 있어요."
  },
  {
    icon: Sparkles,
    title: "AI 승부 맞대결",
    desc: "서로 다른 AI 분석 의견을 비교하고, 어느 쪽 예측이 더 설득력 있는지 함께 확인할 수 있어요."
  },
  {
    icon: FileText,
    title: "일일 · 주간 리포트",
    desc: "경기 결과, 주요 이슈, 팀 흐름을 AI가 정리한 리포트로 한눈에 볼 수 있어요."
  },
  {
    icon: CalendarDays,
    title: "프로야구 정보",
    desc: "경기 일정, 경기 결과, 팀 순위, 뉴스처럼 자주 찾는 정보를 메뉴에서 바로 확인할 수 있어요."
  },
  {
    icon: LineChart,
    title: "라인업 분석",
    desc: "팀별 라인업을 직접 구성해보고, 조합을 바꿔가며 전력 구성을 비교해볼 수 있어요."
  },
  {
    icon: BarChart3,
    title: "라인업 시뮬레이션",
    desc: "구성한 라인업이나 실제 경기 라인업을 바탕으로 시뮬레이션 결과를 참고용 분석 자료로 확인할 수 있어요."
  }
];

const faqs: Faq[] = [
  {
    q: "야구놀이터는 어떤 서비스인가요?",
    a: "야구놀이터는 프로야구 경기 정보, AI 예측, 경기 리포트, 라인업 분석을 한곳에서 확인할 수 있는 정보·분석 중심 서비스입니다."
  },
  {
    q: "AI 승리팀 예측은 어떻게 이용하나요?",
    a: "홈의 AI 승리팀 예측 메뉴에서 오늘 경기별 예측, 분석 근거, 관련 데이터를 확인할 수 있습니다. 경기 전에는 예측을 보고, 경기 후에는 결과와 함께 흐름을 다시 살펴볼 수 있어요."
  },
  {
    q: "AI 승부 맞대결은 무엇인가요?",
    a: "AI 승부 맞대결은 서로 다른 AI 분석 의견을 나란히 비교하는 메뉴입니다. 한쪽 예측만 보는 것이 아니라 여러 관점의 분석을 함께 참고할 수 있도록 구성했습니다."
  },
  {
    q: "일일 리포트와 주간 리포트는 어떤 내용인가요?",
    a: "일일 리포트는 하루 경기 결과와 주요 이슈를 정리하고, 주간 리포트는 한 주간의 팀 흐름과 경기 내용을 묶어 보여줍니다. 경기 후 정보를 빠르게 복습할 때 유용합니다."
  },
  {
    q: "라인업 분석은 계속 사용할 수 있나요?",
    a: "네. 라인업 분석은 계속 이용할 수 있습니다. 팀별 라인업을 직접 구성하고, 실제 경기 라인업과 비교하거나 여러 조합을 바꿔보며 참고용 분석을 할 수 있어요."
  },
  {
    q: "라인업 시뮬레이션은 게임인가요?",
    a: "라인업 시뮬레이션은 경쟁이나 보상 목적의 게임이 아니라, 라인업 조합을 비교해보는 참고용 분석 도구입니다. 시뮬레이션 결과로 BP가 지급되거나 승패 전적이 공개 집계되지 않습니다."
  },
  {
    q: "가을야구와 승패 전적은 어디로 갔나요?",
    a: "서비스 방향을 정보와 분석 중심으로 맞추기 위해 게임성이 강한 가을야구 메뉴와 승패 전적 요소는 공개 메뉴에서 제외했습니다."
  },
  {
    q: "BP 포인트는 어디에 사용하나요?",
    a: "BP는 야구놀이터 활동 참여를 위한 무료 포인트입니다. 현금으로 구매하거나 환전할 수 없으며, 경품 이벤트 응모 등 서비스 내 이벤트 참여 용도로만 사용할 예정입니다."
  },
  {
    q: "다른 기기에서도 이용하려면 어떻게 하나요?",
    a: "설정에서 Google, 카카오, 이메일 계정으로 로그인하면 라인업과 참여 정보가 계정 기준으로 관리됩니다. 비로그인 상태에서는 일부 정보가 기기별로만 남을 수 있습니다."
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
          {faqs
            .filter((faq) => SHOW_BP || !faq.q.includes("BP"))
            .map((faq, i) => {
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
