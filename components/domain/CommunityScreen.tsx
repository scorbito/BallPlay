"use client";

import { AppShell } from "@/components/layout/AppShell";
import { MatchTalkFeed } from "@/components/domain/MatchTalkFeed";
import type { MatchPost } from "@/lib/types/domain";

type CommunityScreenProps = {
  initialMatchPosts?: MatchPost[];
  currentUserId?: string | null;
  initialMatchTalkGameId?: string;
  initialMatchTalkDate?: string;
};

export function CommunityScreen({
  initialMatchPosts = [],
  currentUserId = null,
  initialMatchTalkGameId,
  initialMatchTalkDate
}: CommunityScreenProps) {
  return (
    <AppShell activeTab="home" title="경기톡" theme="dark" hideHeader>
      <MatchTalkFeed
        initialPosts={initialMatchPosts}
        currentUserId={currentUserId}
        initialGameId={initialMatchTalkGameId}
        initialDate={initialMatchTalkDate}
      />
    </AppShell>
  );
}
