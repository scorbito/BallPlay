"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Globe } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PublishedLineupList } from "./PublishedLineupList";

export function DiscoverScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    void (async () => {
      const { data } = await client.auth.getUser();
      // 익명 로그인은 비로그인 취급
      const user = data.user;
      setUserId(user && !user.is_anonymous ? user.id : null);
      setChecked(true);
    })();
  }, []);

  // 로그인 안 됨 — 로그인 게이트
  if (checked && !userId) {
    return (
      <AppShell activeTab="stadium" title="공개 라인업 도전" backHref="/stadium" theme="light" wide>
        <section className="stadium-discover-gate">
          <Globe size={40} />
          <h2>로그인이 필요합니다</h2>
          <p>공개된 다른 사용자의 라인업과 매칭하려면 먼저 로그인해주세요.</p>
          <Link href="/login" className="stadium-cta-primary">로그인</Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab="stadium" title="공개 라인업 도전" backHref="/stadium" theme="light" wide>
      <header className="stadium-enter-head">
        <h1 className="stadium-h1">공개 라인업</h1>
        <p className="stadium-sub">
          다른 플레이어가 공개한 라인업과 매칭해서 시뮬을 돌립니다.
        </p>
      </header>

      <PublishedLineupList maxItems={50} />
    </AppShell>
  );
}
