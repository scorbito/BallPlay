"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { decodeTokenToMatch } from "@/lib/sim/matchShare";
import { saveMatchSession } from "@/lib/sim/matchSession";

// 공유 URL(/stadium/replay?m=<token>)을 받아 매치업을 디코딩하고,
// matchSession에 저장한 뒤 /stadium/play로 redirect.
// 디코딩 실패(엔진/스냅샷 불일치 등) 시 안내 메시지 표시.

export function ReplayScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get("m");
    if (!token) {
      setError("공유 링크에 매치 정보가 없습니다.");
      return;
    }
    const result = decodeTokenToMatch(token);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    saveMatchSession({
      myTeamId: result.input.home.teamId,
      opponentTeamId: result.input.away.teamId,
      seed: result.seed,
      input: result.input,
      startedAt: new Date().toISOString()
    });
    router.replace("/stadium/play");
  }, [params, router]);

  if (error) {
    return (
      <AppShell activeTab="stadium" title="공유 매치" backHref="/stadium/lobby" theme="dark" wide>
        <section className="stadium-replay-error">
          <AlertCircle size={28} />
          <strong>매치를 재생할 수 없어요</strong>
          <p>{error}</p>
          <Link href="/stadium/lobby" className="stadium-cta-secondary" prefetch>
            <ArrowLeft size={14} />
            매칭풀로 돌아가기
          </Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab="stadium" title="공유 매치" backHref="/stadium/lobby" theme="dark" wide>
      <p className="stadium-loading">공유 매치 불러오는 중...</p>
    </AppShell>
  );
}
