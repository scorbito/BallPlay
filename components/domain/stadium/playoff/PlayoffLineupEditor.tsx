"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { History } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { LineupDiamond, type SwapTraveler } from "@/components/domain/LineupDiamond";
import { BatterSlotList } from "@/components/domain/lineup/BatterSlotList";
import { PitcherSlotList } from "@/components/domain/lineup/PitcherSlotList";
import { LineupPoolCard } from "@/components/domain/lineup/LineupPoolCard";
import { ConfirmResetModal } from "@/components/domain/lineup/modals/ConfirmResetModal";
import { PositionPickerModal } from "@/components/domain/lineup/modals/PositionPickerModal";
import { ConfirmOverwriteRecentModal } from "@/components/domain/lineup/modals/ConfirmOverwriteRecentModal";
import { RecentLineupPickerModal } from "@/components/domain/modals/RecentLineupPickerModal";
import { useAppState } from "@/lib/state/AppState";
import { getTeam } from "@/lib/constants/teams";
import { getRoster } from "@/lib/rosters";
import { loadLineupEntries } from "@/lib/storage/lineupEntries";
import { updatePlayoffLineup } from "@/lib/actions/playoff";
import type { RecentLineupRow } from "@/lib/supabase/query-parts/bpRecentLineups";
import {
  POSITION_SHORT,
  PITCHER_STARTER_INDEX,
  normalizeKboPosition,
  type Player,
  type Position,
  type LineupSlot,
  type LineupOrder,
  type LineupMode,
  type SavedLineup,
  type SavedPitcherLineup
} from "@/lib/types/lineup";
import {
  EMPTY_SLOTS,
  EMPTY_PITCHER_SLOTS,
  getFallbackOrder,
  type SlotState
} from "@/lib/lineup/swapHelpers";
import type { PlayoffRun } from "@/lib/supabase/query-parts/bpPlayoff";

/** 가을야구 전용 라인업 편집기 — 팀 관리 빌더의 편집 모듈을 격리해 재사용.
 *  state.myLineup(플레이오프 전용)만 수정. 실제 팀·경기장 출전 라인업 무영향. */
export function PlayoffLineupEditor({ run }: { run: PlayoffRun }) {
  const router = useRouter();
  const { showToast } = useAppState();
  const teamId = run.teamId;
  const team = getTeam(teamId);
  const roster = useMemo(() => getRoster(teamId), [teamId]);
  const playersById = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster]);
  // 이름 → 로스터 매핑 — 최근 라인업의 rosterId 매칭 실패 시 이름으로 fallback.
  const playersByName = useMemo(() => new Map(roster.map((p) => [p.name, p])), [roster]);

  const [mode, setMode] = useState<LineupMode>("batter");
  const [slots, setSlots] = useState<SlotState[]>(EMPTY_SLOTS);
  const [pitcherSlots, setPitcherSlots] = useState<(string | null)[]>(EMPTY_PITCHER_SLOTS);
  const [swapSource, setSwapSource] = useState<Position | null>(null);
  const [swapOrderSourceIdx, setSwapOrderSourceIdx] = useState<number | null>(null);
  const [swapOrderAnimation, setSwapOrderAnimation] = useState<{ a: number; b: number } | null>(null);
  const [swapTravelers, setSwapTravelers] = useState<SwapTraveler[]>([]);
  const [positionPickerForOrder, setPositionPickerForOrder] = useState<LineupOrder | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // 팀 최근 라인업 불러오기 모달 + 덮어쓰기 확인 (pending: 선택한 row 임시 보관)
  const [recentPickerOpen, setRecentPickerOpen] = useState(false);
  const [pendingRecentLineup, setPendingRecentLineup] = useState<RecentLineupRow | null>(null);
  const swapTimerRef = useRef<number | null>(null);
  const swapOrderAnimTimerRef = useRef<number | null>(null);

  // 초기화: state.myLineup(편집본) 또는 팀 현재 라인업.
  useEffect(() => {
    let src = run.state.myLineup ?? null;
    if (!src) {
      const e = loadLineupEntries().find((x) => x.entryId === run.state.myEntryId);
      if (e?.pitching) src = { batting: e.batting, pitching: e.pitching };
    }
    if (!src) {
      showToast("라인업을 불러올 수 없어요.");
      router.push("/stadium/playoff");
      return;
    }
    const next: SlotState[] = Array.from({ length: 9 }, () => null);
    src.batting.slots.forEach((s) => {
      if (s.order >= 1 && s.order <= 9) next[s.order - 1] = s;
    });
    setSlots(next);
    setPitcherSlots([...src.pitching.slots]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const placedPlayerIds = useMemo(() => {
    if (mode === "batter") {
      return new Set(slots.filter((s): s is LineupSlot => s !== null).map((s) => s.playerId));
    }
    const ids = new Set<string>();
    pitcherSlots.forEach((id) => id && ids.add(id));
    return ids;
  }, [mode, slots, pitcherSlots]);

  const poolPlayers = useMemo(() => {
    const filtered = roster.filter((p) => !placedPlayerIds.has(p.id));
    const byMode =
      mode === "batter"
        ? filtered.filter((p) => p.primaryPosition !== "P")
        : filtered.filter((p) => p.primaryPosition === "P");
    return byMode.sort((a, b) => {
      const ga = a.seasonGames ?? 0;
      const gb = b.seasonGames ?? 0;
      if (ga !== gb) return gb - ga;
      return a.jerseyNumber - b.jerseyNumber;
    });
  }, [roster, placedPlayerIds, mode]);

  const diamondSlots: SlotState[] = useMemo(() => {
    const combined: SlotState[] = [...slots];
    const starterId = pitcherSlots[PITCHER_STARTER_INDEX];
    if (starterId) combined.push({ order: 1 as LineupOrder, playerId: starterId, position: "P" });
    return combined;
  }, [slots, pitcherSlots]);

  const filledCount = slots.filter((s) => s !== null && playersById.has(s.playerId)).length;
  const pitcherFilled = pitcherSlots.filter((id) => id !== null && playersById.has(id)).length;

  // ── 핸들러 (빌더 편집 코어 복제) ──
  const handleAddPlayer = (player: Player) => {
    if (placedPlayerIds.has(player.id)) {
      showToast("이미 라인업에 있어요.");
      return;
    }
    if (mode === "batter") {
      if (player.primaryPosition === "P") {
        showToast("투수는 투수 라인업에서 관리해주세요.");
        return;
      }
      setSlots((current) => {
        const firstEmpty = current.findIndex((s) => s === null);
        if (firstEmpty === -1) {
          showToast("타순이 모두 찼어요.");
          return current;
        }
        const usedPositions = new Set(
          current.filter((s): s is LineupSlot => s !== null).map((s) => s.position)
        );
        const fallbackOrder = getFallbackOrder(player.primaryPosition);
        const assignedPosition: Position = usedPositions.has(player.primaryPosition)
          ? fallbackOrder.find((p) => !usedPositions.has(p)) ?? player.primaryPosition
          : player.primaryPosition;
        const next = [...current];
        next[firstEmpty] = {
          order: (firstEmpty + 1) as LineupOrder,
          playerId: player.id,
          position: assignedPosition
        };
        return next;
      });
      return;
    }
    if (player.primaryPosition !== "P") {
      showToast("야수는 타자 라인업에서 관리해주세요.");
      return;
    }
    const emptyIdx = pitcherSlots.findIndex((id) => id === null || !playersById.has(id));
    if (emptyIdx === -1) {
      showToast("투수 자리가 모두 찼어요.");
      return;
    }
    setPitcherSlots((current) => current.map((id, i) => (i === emptyIdx ? player.id : id)));
  };

  const handleRemoveSlot = (order: LineupOrder) => {
    setSlots((current) => current.map((s, i) => (i === order - 1 ? null : s)));
    setSwapOrderSourceIdx(null);
  };

  const handleRemovePitcher = (idx: number) => {
    setPitcherSlots((current) => current.map((id, i) => (i === idx ? null : id)));
    setSwapOrderSourceIdx(null);
  };

  const handleOrderClick = (idx: number) => {
    if (swapOrderSourceIdx === null) {
      setSwapOrderSourceIdx(idx);
      return;
    }
    if (swapOrderSourceIdx === idx) {
      setSwapOrderSourceIdx(null);
      return;
    }
    if (mode === "batter") {
      setSlots((current) => {
        const a = current[swapOrderSourceIdx];
        const b = current[idx];
        const next = [...current];
        next[swapOrderSourceIdx] = b ? { ...b, order: (swapOrderSourceIdx + 1) as LineupOrder } : null;
        next[idx] = a ? { ...a, order: (idx + 1) as LineupOrder } : null;
        return next;
      });
    } else {
      setPitcherSlots((current) => {
        const next = [...current];
        [next[swapOrderSourceIdx], next[idx]] = [next[idx], next[swapOrderSourceIdx]];
        return next;
      });
    }
    setSwapOrderAnimation({ a: swapOrderSourceIdx, b: idx });
    if (swapOrderAnimTimerRef.current !== null) window.clearTimeout(swapOrderAnimTimerRef.current);
    swapOrderAnimTimerRef.current = window.setTimeout(() => {
      setSwapOrderAnimation(null);
      swapOrderAnimTimerRef.current = null;
    }, 450);
    setSwapOrderSourceIdx(null);
    showToast("타순을 바꿨어요.");
  };

  const handleChangePosition = (order: LineupOrder, newPosition: Position) => {
    const sourceIdx = order - 1;
    const sourceSlot = slots[sourceIdx];
    if (!sourceSlot || sourceSlot.position === newPosition) {
      setPositionPickerForOrder(null);
      return;
    }
    const conflictIdx = slots.findIndex(
      (s, i) => s !== null && i !== sourceIdx && s.position === newPosition
    );
    const oldPosition = sourceSlot.position;
    setSlots((current) =>
      current.map((s, i) => {
        if (!s) return s;
        if (i === sourceIdx) return { ...s, position: newPosition };
        if (conflictIdx !== -1 && i === conflictIdx) return { ...s, position: oldPosition };
        return s;
      })
    );
    const travelers: SwapTraveler[] = [
      { playerId: sourceSlot.playerId, from: oldPosition, to: newPosition }
    ];
    if (conflictIdx !== -1) {
      const conflictSlot = slots[conflictIdx];
      if (conflictSlot) {
        travelers.push({ playerId: conflictSlot.playerId, from: newPosition, to: oldPosition });
      }
    }
    setSwapTravelers(travelers);
    if (swapTimerRef.current !== null) window.clearTimeout(swapTimerRef.current);
    swapTimerRef.current = window.setTimeout(() => {
      setSwapTravelers([]);
      swapTimerRef.current = null;
    }, 650);
    setPositionPickerForOrder(null);
  };

  const handleDiamondPositionClick = (pos: Position) => {
    if (pos === "P") {
      showToast("투수는 투수 라인업에서 관리해주세요.");
      setSwapSource(null);
      return;
    }
    if (swapSource === null) {
      setSwapSource(pos);
      return;
    }
    if (swapSource === pos) {
      setSwapSource(null);
      return;
    }
    const sourceIdx = slots.findIndex((s) => s !== null && s.position === swapSource);
    const targetIdx = slots.findIndex((s) => s !== null && s.position === pos);
    if (sourceIdx === -1 && targetIdx === -1) {
      setSwapSource(pos);
      return;
    }
    const travelers: SwapTraveler[] = [];
    if (sourceIdx !== -1) travelers.push({ playerId: slots[sourceIdx]!.playerId, from: swapSource, to: pos });
    if (targetIdx !== -1) travelers.push({ playerId: slots[targetIdx]!.playerId, from: pos, to: swapSource });
    setSlots((current) =>
      current.map((s, i) => {
        if (!s) return s;
        if (i === sourceIdx && i === targetIdx) return s;
        if (i === sourceIdx) return { ...s, position: pos };
        if (i === targetIdx) return { ...s, position: swapSource };
        return s;
      })
    );
    setSwapSource(null);
    setSwapTravelers(travelers);
    showToast("포지션을 바꿨어요.");
    if (swapTimerRef.current !== null) window.clearTimeout(swapTimerRef.current);
    swapTimerRef.current = window.setTimeout(() => {
      setSwapTravelers([]);
      swapTimerRef.current = null;
    }, 650);
  };

  /** 팀의 실제 최근 경기 라인업(한 행)을 편집기 임시 slots/pitcherSlots에 적용.
   *  - 타순 9명: rosterId 우선, 없으면 이름으로 매칭. 매칭 실패 자리는 비워두고 토스트 알림.
   *  - 선발 투수: starter 매칭되면 pitcherSlots[0]에 세팅(나머지 불펜은 유지).
   *  실제 팀 라인업에는 영향 없음 — run.state.myLineup 편집본에만 반영(저장 시). */
  const applyRecentLineup = (row: RecentLineupRow) => {
    const sorted = [...row.batting].sort((a, b) => a.order - b.order);
    const nextSlots: SlotState[] = Array.from({ length: 9 }, () => null);
    let missed = 0;
    sorted.forEach((b, idx) => {
      if (idx >= 9) return;
      const player =
        (b.rosterId && playersById.get(b.rosterId)) ||
        (b.name ? playersByName.get(b.name) : undefined);
      if (player) {
        const pos: Position = normalizeKboPosition(b.position) ?? player.primaryPosition;
        nextSlots[idx] = {
          order: (idx + 1) as LineupOrder,
          playerId: player.id,
          position: pos
        };
      } else {
        missed += 1;
      }
    });
    setSlots(nextSlots);
    setSwapOrderSourceIdx(null);
    setSwapSource(null);

    const resolvedStarter =
      (row.starter_roster_id && playersById.get(row.starter_roster_id)) ||
      (row.starter_name ? playersByName.get(row.starter_name) : undefined);
    if (resolvedStarter) {
      setPitcherSlots((current) =>
        current.map((id, i) => (i === PITCHER_STARTER_INDEX ? resolvedStarter.id : id))
      );
    }

    setMode("batter");

    if (missed > 0) {
      showToast(`${9 - missed}명 적용. ${missed}자리는 로스터 변경으로 비워뒀어요.`);
    } else {
      showToast("최근 라인업을 불러왔어요.");
    }
  };

  /** 모달에서 행 선택 — 기존 슬롯이 차 있으면 덮어쓰기 확인 후 적용. */
  const handleRecentLineupPick = (row: RecentLineupRow) => {
    const hasFilledBatter = slots.some((s) => s !== null);
    const hasStarter = pitcherSlots[PITCHER_STARTER_INDEX] !== null;
    setRecentPickerOpen(false);
    if (hasFilledBatter || hasStarter) {
      setPendingRecentLineup(row);
    } else {
      applyRecentLineup(row);
    }
  };

  const handleReset = () => {
    if (mode === "batter") {
      if (slots.every((s) => s === null)) return;
    } else if (pitcherSlots.every((s) => s === null)) {
      return;
    }
    setConfirmResetOpen(true);
  };

  const confirmReset = () => {
    if (mode === "batter") {
      setSlots(EMPTY_SLOTS);
      setSwapSource(null);
    } else {
      setPitcherSlots(EMPTY_PITCHER_SLOTS);
    }
    setConfirmResetOpen(false);
    showToast("라인업을 비웠어요.");
  };

  const handleSave = () => {
    if (filledCount !== 9 || !pitcherSlots[PITCHER_STARTER_INDEX]) {
      showToast("타자 9명과 선발 투수를 채워주세요.");
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const batting: SavedLineup = {
      teamId,
      slots: slots.filter((s): s is LineupSlot => s !== null),
      useDH: true,
      updatedAt: now
    };
    const pitching: SavedPitcherLineup = { teamId, slots: pitcherSlots, updatedAt: now };
    void (async () => {
      const res = await updatePlayoffLineup({ runId: run.id, batting, pitching });
      setSaving(false);
      if (res.ok) {
        showToast("가을야구 라인업을 저장했어요.");
        router.push("/stadium/playoff");
      } else {
        showToast(res.error);
      }
    })();
  };

  const noop = () => {};

  return (
    <AppShell activeTab="stadium" title="가을야구 라인업" backHref="/stadium/playoff" theme="light" wide hideBottomTabs>
      <p className="playoff-edit-banner">상대를 보고 자유롭게 바꾸세요. 실제 팀 라인업에는 영향이 없어요.</p>

      <div className="lineup-layout">
        <section className="lineup-diamond-card" aria-label={mode === "batter" ? "수비 위치" : "선발 투수"}>
          <LineupDiamond
            slots={diamondSlots}
            playersById={playersById}
            teamColor={team.color}
            selectedPosition={mode === "batter" ? swapSource : null}
            onPositionClick={mode === "batter" ? handleDiamondPositionClick : undefined}
            travelers={mode === "batter" ? swapTravelers : []}
          />
          {swapSource ? (
            <div className="lineup-field-hint" role="status">
              <strong>{POSITION_SHORT[swapSource]}</strong> 선택됨 · 교환할 다른 포지션을 탭하세요
              <button type="button" className="lineup-field-hint-cancel" onClick={() => setSwapSource(null)}>
                취소
              </button>
            </div>
          ) : null}
        </section>

        {/* 그라운드 ↔ 타순 사이 액션 행 — 팀 관리 빌더와 동일 배치.
            좌: 실제 경기 라인업 불러오기(넓게) / 타자·투수 토글 / 저장하기 */}
        <div className="lineup-action-row playoff-edit-actionrow">
          <button
            type="button"
            className="lineup-recent-load-btn"
            onClick={() => setRecentPickerOpen(true)}
            title={`${team.shortName}이(가) 최근 경기에서 실제로 쓴 선발 라인업으로 자동 세팅`}
          >
            <History size={12} />
            <span>실제 경기 라인업 불러오기</span>
          </button>
          <div className="lineup-action-buttons">
            <div
              className="lineup-mode-toggle lineup-mode-toggle-inline"
              role="tablist"
              aria-label="라인업 종류"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "batter"}
                className={mode === "batter" ? "lineup-mode-tab lineup-mode-tab-active" : "lineup-mode-tab"}
                onClick={() => {
                  setMode("batter");
                  setSwapSource(null);
                }}
              >
                타자
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "pitcher"}
                className={mode === "pitcher" ? "lineup-mode-tab lineup-mode-tab-active" : "lineup-mode-tab"}
                onClick={() => {
                  setMode("pitcher");
                  setSwapSource(null);
                }}
              >
                투수
              </button>
            </div>
            <button
              type="button"
              className="playoff-edit-save-btn"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "저장 중" : "저장하기"}
            </button>
          </div>
        </div>

        {mode === "batter" ? (
          <BatterSlotList
            slots={slots}
            filledCount={filledCount}
            playersById={playersById}
            swapOrderSourceIdx={swapOrderSourceIdx}
            swapOrderAnimation={swapOrderAnimation}
            isLocked={false}
            onOrderClick={handleOrderClick}
            onPositionPickerOpen={(order) => setPositionPickerForOrder(order)}
            onRemove={handleRemoveSlot}
            onReset={handleReset}
            onLockedClick={noop}
          />
        ) : (
          <PitcherSlotList
            pitcherSlots={pitcherSlots}
            pitcherFilled={pitcherFilled}
            playersById={playersById}
            swapOrderSourceIdx={swapOrderSourceIdx}
            swapOrderAnimation={swapOrderAnimation}
            isLocked={false}
            onOrderClick={handleOrderClick}
            onRemove={handleRemovePitcher}
            onReset={handleReset}
          />
        )}

        <LineupPoolCard poolPlayers={poolPlayers} isLocked={false} onAddPlayer={handleAddPlayer} onLockedClick={noop} />
      </div>

      <ConfirmResetModal open={confirmResetOpen} onCancel={() => setConfirmResetOpen(false)} onConfirm={confirmReset} />
      <PositionPickerModal
        order={positionPickerForOrder}
        slots={slots}
        onClose={() => setPositionPickerForOrder(null)}
        onPick={handleChangePosition}
      />

      {/* 팀 최근 라인업 불러오기 — bp_team_recent_lineups의 최근 경기 표시. 편집기 임시 라인업에만 적용. */}
      <RecentLineupPickerModal
        open={recentPickerOpen}
        teamId={teamId}
        onClose={() => setRecentPickerOpen(false)}
        onPick={handleRecentLineupPick}
      />

      <ConfirmOverwriteRecentModal
        open={pendingRecentLineup !== null}
        onCancel={() => setPendingRecentLineup(null)}
        onConfirm={() => {
          if (pendingRecentLineup) applyRecentLineup(pendingRecentLineup);
          setPendingRecentLineup(null);
        }}
      />
    </AppShell>
  );
}
