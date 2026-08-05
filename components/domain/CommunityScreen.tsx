"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { MatchTalkFeed } from "@/components/domain/MatchTalkFeed";
import type { MatchPost } from "@/lib/types/domain";

type CommunityScreenProps = {
  initialFreePosts?: MatchPost[];
  initialMatchPosts?: MatchPost[];
  currentUserId?: string | null;
};

export function CommunityScreen({
  initialFreePosts = [],
  initialMatchPosts = [],
  currentUserId = null
}: CommunityScreenProps) {
  // ?tab= 로 진입 탭 결정 — 경기톡 상세 redirect(/community?tab=match-talk) 등에서 올바른 탭으로 열리도록.
  const tabParam = useSearchParams().get("tab");
  const initialTab: "free" | "match_talk" =
    tabParam === "match-talk" || tabParam === "match_talk" ? "match_talk" : "free";
  const [tab, setTab] = useState<"free" | "match_talk">(initialTab);

  return (
    <AppShell activeTab="community" title="커뮤니티" theme="light" backHref="/">
      <section className="community-page">
        <div className="community-tabs" role="tablist" aria-label="커뮤니티 분류">
          <button type="button" role="tab" aria-selected={tab === "free"} className={tab === "free" ? "community-tab community-tab-active" : "community-tab"} onClick={() => setTab("free")}>자유</button>
          <button type="button" role="tab" aria-selected={tab === "match_talk"} className={tab === "match_talk" ? "community-tab community-tab-active" : "community-tab"} onClick={() => setTab("match_talk")}>경기톡</button>
        </div>
        {tab === "free" ? (
          <MatchTalkFeed key="free" postType="free" initialPosts={initialFreePosts} currentUserId={currentUserId} />
        ) : (
          <MatchTalkFeed key="match-talk" postType="match_talk" initialPosts={initialMatchPosts} currentUserId={currentUserId} />
        )}
      </section>
    </AppShell>
  );
}
