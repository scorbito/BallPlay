"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import type { LineupEntry } from "@/lib/types/lineup";
import { loadLineupEntries } from "@/lib/storage/lineupEntries";
import { buildSharedTeamFromEntry } from "@/lib/sim/matchShare";
import { generateSeed } from "@/lib/sim/matchSession";
import { getOrCreateGuestId } from "@/lib/sim/guestId";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createMatch, type BpMatchMode } from "@/lib/supabase/query-parts/bpMatches";
import { listMyLineups } from "@/lib/supabase/query-parts/bpLineups";

// "친구와 대결" — 내 라인업으로 매치 생성 → invite_code 발급 → /stadium/live/[code] 이동
// 호스트는 home 슬롯 고정 (단순화).
export function CreateLiveMatchScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<LineupEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // 진행 속도 — 방장이 선택. 양쪽 클라이언트 동일하게 진행. 기본 fast(빠른).
  const [mode, setMode] = useState<BpMatchMode>("fast");
  // entry_id → bp_lineups.id 매핑 (공개 등록된 라인업만). 정식 매치 판정·전적 집계에 사용.
  const [publishedLineupIdByEntry, setPublishedLineupIdByEntry] = useState<Record<string, string>>({});

  useEffect(() => {
    const ready = loadLineupEntries().filter((e) => e.batting.slots.length === 9);
    setEntries(ready);
    if (ready.length > 0) setSelectedEntryId(ready[0].entryId);

    // 공개 라인업 ID 미리 로드 — 매치 생성 시 lineup_id 즉시 첨부 가능.
    void (async () => {
      const client = createSupabaseBrowserClient();
      const { data } = await client.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;
      const res = await listMyLineups(client, userId);
      if (!res.ok) return;
      const map: Record<string, string> = {};
      for (const row of res.rows) {
        if (row.is_published) map[row.entry_id] = row.id;
      }
      setPublishedLineupIdByEntry(map);
    })();
  }, []);

  const selectedEntry = useMemo(
    () => entries.find((e) => e.entryId === selectedEntryId) ?? null,
    [entries, selectedEntryId]
  );

  const handleCreate = async () => {
    if (!selectedEntry) {
      setError("출전할 라인업을 선택해주세요.");
      return;
    }
    setError(null);
    setCreating(true);

    const shared = buildSharedTeamFromEntry(selectedEntry);
    if (!shared.ok) {
      setError(shared.error);
      setCreating(false);
      return;
    }

    const client = createSupabaseBrowserClient();
    const {
      data: { user }
    } = await client.auth.getUser();

    const seed = generateSeed();
    const guestId = getOrCreateGuestId();

    const lineupId = publishedLineupIdByEntry[selectedEntry.entryId] ?? null;
    const result = await createMatch(client, {
      ownerSide: "home",
      ownerId: user?.id ?? null,
      guestId,
      team: shared.team,
      seed,
      mode,
      lineupId
    });

    if (!result.ok) {
      setError(result.error);
      setCreating(false);
      return;
    }

    router.replace(`/stadium/live/${result.row.invite_code}`);
  };

  return (
    <AppShell activeTab="stadium" title="친구와 대결" backHref="/stadium/lobby" theme="light" wide>
      <section className="stadium-live-create">
        <header className="stadium-enter-head">
          <h1 className="stadium-h1">친구와 실시간 대결</h1>
          <p className="stadium-sub">
            매치를 만들면 초대 링크가 생성됩니다. 친구가 접속하고 라인업을 등록하면 같은 결과를 동시에 시청합니다.
          </p>
        </header>

        {entries.length > 0 ? (
          <div className="stadium-enter-picker">
            <span className="stadium-enter-picker-label">내 라인업 선택</span>
            <div className="stadium-enter-picker-row">
              {entries.map((entry) => {
                const active = entry.entryId === selectedEntryId;
                const pitcherAuto = entry.pitching === null;
                const isPublished = entry.entryId in publishedLineupIdByEntry;
                return (
                  <button
                    key={entry.entryId}
                    type="button"
                    className={`stadium-enter-picker-item ${active ? "is-active" : ""}`}
                    onClick={() => setSelectedEntryId(entry.entryId)}
                    title={entry.name}
                  >
                    <TeamBadge teamId={entry.teamId} size="sm" />
                    <span className="stadium-enter-picker-name">{entry.name}</span>
                    {isPublished ? (
                      <span className="stadium-enter-picker-tag stadium-enter-picker-tag-published">공개 등록</span>
                    ) : null}
                    {pitcherAuto ? (
                      <span className="stadium-enter-picker-tag">투수 자동</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="stadium-enter-picker-hint">
              양쪽 모두 <strong>공개 등록</strong> 라인업이면 <strong>정식 매치</strong>로 기록돼요. 한쪽이라도 비등록이면 <strong>연습 매치</strong>.
            </p>
            {Object.keys(publishedLineupIdByEntry).length === 0 ? (
              <Link href="/play/lineup" className="stadium-enter-picker-cta" prefetch>
                라인업 공개 등록하고 정식 매치로 진행 →
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="stadium-enter-empty-box">
            <p>출전 가능한 라인업이 없습니다.</p>
            <p className="stadium-enter-empty-hint">라인업 빌더에서 9명 타순을 모두 채워야 매치를 만들 수 있어요.</p>
            <Link href="/play/lineup" className="stadium-cta-secondary" prefetch>
              라인업 만들러 가기
            </Link>
          </div>
        )}

        <div className="stadium-live-speed">
          <span className="stadium-live-speed-label">진행 속도</span>
          <div className="stadium-live-speed-row" role="radiogroup" aria-label="진행 속도">
            {([
              { value: "live" as const, label: "중계" },
              { value: "normal" as const, label: "보통" },
              { value: "fast" as const, label: "빠른" }
            ]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={mode === opt.value}
                className={`stadium-live-speed-item ${mode === opt.value ? "is-active" : ""}`}
                onClick={() => setMode(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="stadium-live-speed-hint">방장이 선택한 속도로 양쪽 동일하게 진행돼요.</p>
        </div>

        <div className="stadium-live-rules">
          <Users size={14} />
          <ul>
            <li>호스트: 홈 슬롯 고정</li>
            <li>친구가 라인업을 등록하면 자동으로 카운트다운 시작</li>
            <li>같은 엔진 버전·선수 스냅샷일 때만 매치 진행</li>
          </ul>
        </div>

        {error ? <p className="stadium-error">{error}</p> : null}

        <button
          type="button"
          className="stadium-cta-primary"
          onClick={handleCreate}
          disabled={!selectedEntry || creating}
        >
          <Users size={16} />
          <span>{creating ? "매치 생성 중..." : "매치 만들기"}</span>
          <ArrowRight size={16} />
        </button>
      </section>
    </AppShell>
  );
}
