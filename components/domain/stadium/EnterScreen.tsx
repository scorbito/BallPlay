"use client";

// /stadium/enter?opponent=… 진입점 — 기존 deep link 호환용.
// 현재는 LobbyScreen 의 AI 카드가 직접 AiChallengeModal 을 띄우는 것을 권장하지만,
// 외부 링크/북마크 호환을 위해 이 라우트도 유지. 내용은 AiChallengeBody 재사용.

import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { AiChallengeBody } from "./AiChallengeBody";

export function EnterScreen() {
  const params = useSearchParams();
  const opponentTeamId = params.get("opponent") ?? "lg";

  return (
    <AppShell activeTab="stadium" title="경기장 입장" backHref="/stadium/lobby" theme="light" wide>
      <AiChallengeBody opponentTeamId={opponentTeamId} />
    </AppShell>
  );
}
