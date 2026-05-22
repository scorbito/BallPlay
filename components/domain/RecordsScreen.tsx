"use client";

import Link from "next/link";
import { History } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

export function RecordsScreen() {
  return (
    <AppShell activeTab="records" title="내 기록" theme="dark" hideHeader>
      <header className="play-hub-header">
        <h1>내 기록</h1>
        <p>지금까지의 경기 결과와 리플레이를 한 곳에서</p>
      </header>

      <section className="records-empty">
        <span className="records-empty-icon">
          <History size={28} />
        </span>
        <strong>아직 저장된 경기가 없어요</strong>
        <p>경기장에서 친구 대결이나 시뮬을 하면 여기에 쌓여요.</p>
        <Link className="records-empty-cta" href="/stadium/lobby" prefetch>
          경기장으로 가기
        </Link>
      </section>
    </AppShell>
  );
}
