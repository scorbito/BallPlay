"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Share2, Trophy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { LineupDiamond, type SwapTraveler } from "@/components/domain/LineupDiamond";
import { ShareLineupModal } from "@/components/domain/modals/ShareLineupModal";
import { RecentLineupPickerModal } from "@/components/domain/modals/RecentLineupPickerModal";
import { getTeam } from "@/lib/constants/teams";
import { useAppState } from "@/lib/state/AppState";
import { getEditableRoster, getSeededTeamIds } from "@/lib/rosters";
import {
  POSITION_SHORT,
  PITCHER_CLOSER_INDEX,
  PITCHER_REQUIRED_BULLPEN_INDEX,
  PITCHER_SLOTS_COUNT,
  PITCHER_STARTER_INDEX,
  normalizeKboPosition,
  type LineupEntry,
  type LineupMode,
  type LineupOrder,
  type LineupSlot,
  type Player,
  type Position
} from "@/lib/types/lineup";
import { createEmptyEntry, moveLineupEntryToTop } from "@/lib/storage/lineupEntries";
import { hasSeenGuide, markGuideSeen } from "@/lib/storage/lineupGuides";
import { useLineupSync } from "@/lib/storage/useLineupSync";
import { useUserTier } from "@/lib/auth/useUserTier";
import { getLineupSlotLimit } from "@/lib/auth/tierLimits";
import type { RecentLineupRow } from "@/lib/supabase/query-parts/bpRecentLineups";
import {
  fillMissingPitcherSlots,
  fillMissingPitcherSlotsFromStatsDirectory
} from "@/lib/sim/autoPitcherLineup";
import { buildStatsDirectoryForLineups } from "@/lib/sim/lineupStatsDirectory";
import {
  NATIONAL_LINEUP_ENTRY_ID,
  NATIONAL_LINEUP_ROSTER_SOURCE_ID,
  NATIONAL_LINEUP_TEAM_ID,
  getLineupType
} from "@/lib/lineup/lineupSource";
import {
  EMPTY_SLOTS,
  EMPTY_PITCHER_SLOTS,
  getFallbackOrder,
  type SlotState
} from "@/lib/lineup/swapHelpers";
import { useEntryStats } from "@/lib/lineup/useEntryStats";
import { useEntryAwayStats } from "@/lib/lineup/useEntryAwayStats";
import { useArchivedTeams } from "@/lib/lineup/useArchivedTeams";
import { ConfirmResetModal } from "@/components/domain/lineup/modals/ConfirmResetModal";
import { PositionPickerModal } from "@/components/domain/lineup/modals/PositionPickerModal";
import { ConfirmOverwriteRecentModal } from "@/components/domain/lineup/modals/ConfirmOverwriteRecentModal";
import { NewSlotModal } from "@/components/domain/lineup/modals/NewSlotModal";
import { RenameSlotModal } from "@/components/domain/lineup/modals/RenameSlotModal";
import {
  ConfirmDeleteSlotModal,
  DeleteSlotStatusModal,
  type DeleteStatus,
  type SlotRemoveMode
} from "@/components/domain/lineup/modals/DeleteSlotModals";
import { AutoFillPublishModal } from "@/components/domain/lineup/modals/AutoFillPublishModal";
import {
  GuideStep0Modal,
  GuideStep1Modal,
  GuideStep2Modal,
  GuideGoStadiumModal
} from "@/components/domain/lineup/modals/LineupGuideModals";
import { LineupSyncBadge } from "@/components/domain/lineup/LineupSyncBadge";
import { LineupSlotPicker } from "@/components/domain/lineup/LineupSlotPicker";
import { LineupActionRow } from "@/components/domain/lineup/LineupActionRow";
import { LineupPresetBar } from "@/components/domain/lineup/LineupPresetBar";
import { PresetNameModal } from "@/components/domain/lineup/modals/PresetNameModal";
import { ConfirmDeletePresetModal } from "@/components/domain/lineup/modals/ConfirmDeletePresetModal";
import {
  loadPresets,
  savePreset,
  renamePreset,
  deletePreset,
  type LineupPreset
} from "@/lib/storage/lineupPresets";
import { BatterSlotList } from "@/components/domain/lineup/BatterSlotList";
import { PitcherSlotList } from "@/components/domain/lineup/PitcherSlotList";
import { LineupPoolCard } from "@/components/domain/lineup/LineupPoolCard";
import { trackEvent } from "@/lib/analytics/events";

export function LineupBuilderScreen() {
  const { profile, showToast } = useAppState();
  const { tier } = useUserTier();
  const lineupLimit = getLineupSlotLimit(tier);
  const seededTeamIds = useMemo(() => getSeededTeamIds(), []);

  // 시드가 있는 팀으로 기본값 — 사용자의 메인팀이 시드 안 됐으면 두산
  const initialTeamId = seededTeamIds.has(profile.mainTeamId) ? profile.mainTeamId : "doosan";

  // 팀 슬롯 (entries) — useLineupSync가 localStorage + Supabase DB 양방향 sync.
  // 비로그인이면 localStorage만, 로그인이면 첫 진입 시 마이그레이션 + 이후 양방향.
  const {
    entries,
    status: syncStatus,
    syncedUpsert,
    syncedDelete,
    syncedRename,
    localUpsertEntry,
    replaceEntries,
    togglePublished
  } = useLineupSync();
  const router = useRouter();
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const currentEntry = useMemo(
    () => entries.find((e) => e.entryId === selectedEntryId) ?? null,
    [entries, selectedEntryId]
  );
  const regularEntries = useMemo(
    () => entries.filter((entry) => getLineupType(entry) === "kbo"),
    [entries]
  );
  const nationalEntry = useMemo(
    () => entries.find((entry) => entry.entryId === NATIONAL_LINEUP_ENTRY_ID || getLineupType(entry) === "national") ?? null,
    [entries]
  );
  const selectedTeamId = currentEntry?.teamId ?? initialTeamId;

  const [slotMenuOpen, setSlotMenuOpen] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  // 프리셋 드롭다운 — 팀 선택 드롭다운과 동시에 안 열리도록 하나만 연다.
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const [newSlotOpen, setNewSlotOpen] = useState(false);
  const [renamingEntryId, setRenamingEntryId] = useState<string | null>(null);
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState<string | null>(null);
  // 삭제 진행/결과 모달 — DB sync 완료까지 진행 상태 보여줌.
  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>({ phase: "idle" });
  // 진행/결과 모달에서도 같은 모드 문구를 쓰려고 확정 시점에 보존 (삭제/은퇴).
  const [removeMode, setRemoveMode] = useState<SlotRemoveMode>("delete");
  // 은퇴 직후 하단 "은퇴한 팀" 목록을 다시 불러오게 하는 트리거.
  const [archivedRefreshKey, setArchivedRefreshKey] = useState(0);

  const [mode, setMode] = useState<LineupMode>("batter");
  const [slots, setSlots] = useState<SlotState[]>(EMPTY_SLOTS);
  const [pitcherSlots, setPitcherSlots] = useState<(string | null)[]>(EMPTY_PITCHER_SLOTS);
  const useDH = true;
  const [positionPickerForOrder, setPositionPickerForOrder] = useState<LineupOrder | null>(null);
  /** 다이아몬드에서 첫 번째로 선택된 포지션 — 두 번째 클릭 시 교환 */
  const [swapSource, setSwapSource] = useState<Position | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [publishProcessing, setPublishProcessing] = useState(false);
  // 새 슬롯 onboarding 안내 — 슬롯별 한 번씩만 노출.
  //   step1: 타순 9명 채우면 "선발 투수만 선택하면 출전 가능"
  //   step2: 선발 투수까지 고르면 "이제 출전해서 가상경기 가능 — 마무리/불펜은 자동"
  const [guideStep0Open, setGuideStep0Open] = useState(false);
  const [guideStep1Open, setGuideStep1Open] = useState(false);
  const [guideStep2Open, setGuideStep2Open] = useState(false);
  // 출전 등록 성공 직후 "경기장 가기" 유도 모달
  const [guideGoStadiumOpen, setGuideGoStadiumOpen] = useState(false);
  // 팀 최근 라인업 불러오기 모달 + 덮어쓰기 확인 (pending: 선택한 row 임시 보관)
  const [recentPickerOpen, setRecentPickerOpen] = useState(false);
  const [pendingRecentLineup, setPendingRecentLineup] = useState<RecentLineupRow | null>(null);
  // 출전 등록 시 마무리/불펜 빈 자리 자동 채움 안내 모달
  const [confirmAutoFillOpen, setConfirmAutoFillOpen] = useState(false);
  // 라인업 프리셋 — 저장(이름 입력) / 적용(덮어쓰기 확인) / 이름변경 / 삭제 모달 상태.
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [renamingPreset, setRenamingPreset] = useState<LineupPreset | null>(null);
  const [deletingPreset, setDeletingPreset] = useState<LineupPreset | null>(null);
  // 프리셋 적용 — 현재 편집본이 차 있으면 덮어쓰기 확인 후 적용.
  const [pendingApplyPreset, setPendingApplyPreset] = useState<LineupPreset | null>(null);
  // 본인 팀별 전적 (entry_id → stats). 출전 등록된 팀만 매칭되는 stats 있음.
  const statsByEntryId = useEntryStats(entries, syncStatus);
  // 원정/방어 전적 (entry_id → stats) — 다른 유저가 내 팀을 도전한 경기.
  const awayStatsByEntryId = useEntryAwayStats(entries, syncStatus);
  // 은퇴(보관)한 팀 + 최종 전적 — 팀 관리 드롭다운 하단에 읽기 전용으로 표시.
  const archivedTeams = useArchivedTeams(syncStatus, archivedRefreshKey);
  /** entry 복원이 끝났는지 — 저장 effect가 마운트 직후 EMPTY로 entry를 덮어쓰는 레이스 차단 */
  const [hydratedEntryId, setHydratedEntryId] = useState<string | null>(null);
  const [swapTravelers, setSwapTravelers] = useState<SwapTraveler[]>([]);
  const swapTimerRef = useRef<number | null>(null);
  /** 타순 번호 뱃지로 두 슬롯의 선수를 교체할 때의 source 인덱스 (0-based) */
  const [swapOrderSourceIdx, setSwapOrderSourceIdx] = useState<number | null>(null);
  /** 직전에 swap된 두 인덱스 — 잠시 애니메이션 클래스를 부여하기 위함 */
  const [swapOrderAnimation, setSwapOrderAnimation] = useState<{ a: number; b: number } | null>(null);
  const swapOrderAnimTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setClientReady(true);
  }, []);

  // entries가 로드되면 첫 entry 자동 선택 (이미 선택된 게 있으면 유지)
  useEffect(() => {
    if (selectedEntryId) return;
    if (regularEntries.length > 0) setSelectedEntryId(regularEntries[0].entryId);
    else if (entries.length > 0) setSelectedEntryId(entries[0].entryId);
  }, [entries, regularEntries, selectedEntryId]);

  useEffect(() => {
    if (!clientReady || syncStatus === "loading") return;
    if (nationalEntry) {
      if (nationalEntry.name === "국가대표팀") {
        localUpsertEntry({
          ...nationalEntry,
          name: "아시안게임 국가대표팀",
          updatedAt: new Date().toISOString()
        });
      }
      return;
    }
    const national = {
      ...createEmptyEntry(
        NATIONAL_LINEUP_TEAM_ID,
        "아시안게임 국가대표팀",
        undefined,
        {
          lineupType: "national",
          rosterSourceId: NATIONAL_LINEUP_ROSTER_SOURCE_ID
        }
      ),
      entryId: NATIONAL_LINEUP_ENTRY_ID
    };
    localUpsertEntry(national);
  }, [clientReady, localUpsertEntry, nationalEntry, syncStatus]);

  // 첫 진입(슬롯 0개) 시 "새 팀 슬롯" 모달 자동 오픈.
  // - sync 완료(loading 외) + 진짜 entries 0개일 때만.
  // - 사용자가 모달을 취소하면 다시 자동 오픈하지 않음 (ref 잠금).
  // - 슬롯은 모달의 "만들기" 버튼으로 사용자가 명시적으로 생성 → "내 팀이 아닌 슬롯" 위화감 제거.
  const autoOpenAttemptedRef = useRef(false);
  useEffect(() => {
    if (autoOpenAttemptedRef.current) return;
    if (syncStatus === "loading") return; // sync 끝나기 전 race로 false-positive 차단
    if (entries.length > 0) {
      autoOpenAttemptedRef.current = true; // 기존 슬롯이 있으면 자동 오픈 안 함
      return;
    }
    autoOpenAttemptedRef.current = true;
    // 이미 다른 모달이 열려있으면 충돌 방지 — NewSlotModal 외 다른 모달 동시 오픈 시나리오는 없지만 가드.
    if (!newSlotOpen) {
      setNewSlotOpen(true);
    }
  }, [syncStatus, entries.length, newSlotOpen]);

  const roster = useMemo(() => getEditableRoster(currentEntry, selectedTeamId), [currentEntry, selectedTeamId]);
  const playersById = useMemo(() => {
    const map = new Map<string, Player>();
    roster.forEach((p) => map.set(p.id, p));
    return map;
  }, [roster]);

  // 이름 → 로스터 매핑 — KBO 라인업 sync 시점엔 로스터에 없던 선수(예: 군 전역 직후)도
  // 이후 _manual 로 추가되면 자동 채움에서 잡히도록 fallback.
  const playersByName = useMemo(() => {
    const map = new Map<string, Player>();
    roster.forEach((p) => map.set(p.name, p));
    return map;
  }, [roster]);

  // 선택된 슬롯 변경 시 swap 선택도 초기화
  useEffect(() => {
    setSwapSource(null);
    setSwapOrderSourceIdx(null);
  }, [selectedEntryId]);

  // 모드 전환 시 타순 swap 선택도 초기화
  useEffect(() => {
    setSwapOrderSourceIdx(null);
  }, [mode]);

  // 언마운트 시 swap 애니메이션 타이머 정리
  useEffect(() => {
    return () => {
      if (swapTimerRef.current !== null) window.clearTimeout(swapTimerRef.current);
      if (swapOrderAnimTimerRef.current !== null) window.clearTimeout(swapOrderAnimTimerRef.current);
    };
  }, []);

  // 선택된 슬롯(entry) 변경 시 batting/pitching 복원, 없으면 빈 슬롯
  useEffect(() => {
    setHydratedEntryId(null);
    if (!currentEntry) {
      setSlots(EMPTY_SLOTS);
      setPitcherSlots(EMPTY_PITCHER_SLOTS);
      return;
    }
    const stored = currentEntry.batting;
    if (stored && stored.slots.length > 0) {
      const next: SlotState[] = Array.from({ length: 9 }, () => null);
      stored.slots.forEach((s) => {
        if (s.order >= 1 && s.order <= 9) {
          next[s.order - 1] = s;
        }
      });
      setSlots(next);
    } else {
      setSlots(EMPTY_SLOTS);
    }

    const storedPitcher = currentEntry.pitching;
    if (storedPitcher && Array.isArray(storedPitcher.slots)) {
      const next = Array.from({ length: PITCHER_SLOTS_COUNT }, (_, i) => storedPitcher.slots[i] ?? null);
      setPitcherSlots(next);
    } else {
      setPitcherSlots(EMPTY_PITCHER_SLOTS);
    }
    setHydratedEntryId(currentEntry.entryId);
  }, [currentEntry?.entryId]);

  // 로스터(playersById)가 바뀌면 stale ID를 null 로 정리.
  // - 이적/은퇴/말소된 옛 선수 ID 가 슬롯에 남아 UI 에선 "(자동)" 으로 보이지만
  //   실제 값이 차 있어서 추가/자동 채움 모두 막혔던 문제 해결.
  // - 다음 저장 사이클에 정리된 상태가 그대로 storage 에 반영됨.
  useEffect(() => {
    setPitcherSlots((current) => {
      let changed = false;
      const next = current.map((id) => {
        if (id !== null && !playersById.has(id)) {
          changed = true;
          return null;
        }
        return id;
      });
      return changed ? next : current;
    });
    setSlots((current) => {
      let changed = false;
      const next = current.map((s) => {
        if (s !== null && !playersById.has(s.playerId)) {
          changed = true;
          return null;
        }
        return s;
      });
      return changed ? next : current;
    });
  }, [playersById]);

  // 타자/투수 라인업 변경 → 현재 entry 업데이트 + 저장. 복원 완료 전엔 skip.
  //
  // ⚠️ batter/pitcher를 하나의 effect로 묶음 (이전엔 2개로 분리).
  //    applyRecentLineup처럼 setSlots + setPitcherSlots를 동시에 부르면
  //    두 effect가 같은 render에 실행되면서 둘 다 stale closure currentEntry를
  //    spread해서 두 번째 write가 첫 번째 write의 필드를 덮어쓰는 race가 발생함.
  //    (구체적으로: batter effect가 batting=9를 쓴 직후, pitcher effect가
  //     batting=stale-empty를 다시 써서 batting이 비어버림 → 그 상태에서 출전 등록되면
  //     DB에도 빈 batting 저장됨.)
  //    하나의 effect로 합쳐 batter+pitcher 양쪽 모두 live state에서 동시에 읽고
  //    한 번에 write → 어떤 setter 조합이든 race 차단.
  useEffect(() => {
    if (!currentEntry || hydratedEntryId !== currentEntry.entryId) return;
    const filledSlots = slots.filter((s): s is LineupSlot => s !== null);
    const hasAnyPitcher = pitcherSlots.some(Boolean);
    const hasStarterForPublic = pitcherSlots[PITCHER_STARTER_INDEX] != null;
    const canStayPublished = filledSlots.length === 9 && hasStarterForPublic;
    const nextPublished = !!currentEntry.isPublished && canStayPublished;
    const now = new Date().toISOString();
    const updated: LineupEntry = {
      ...currentEntry,
      isPublished: nextPublished,
      batting: {
        teamId: currentEntry.teamId,
        slots: filledSlots,
        useDH,
        updatedAt: now,
        lineupType: currentEntry.lineupType,
        rosterSourceId: currentEntry.rosterSourceId
      },
      pitching: hasAnyPitcher
        ? {
            teamId: currentEntry.teamId,
            slots: pitcherSlots,
            updatedAt: now,
            lineupType: currentEntry.lineupType,
            rosterSourceId: currentEntry.rosterSourceId
          }
        : null,
      updatedAt: now
    };
    const becameUnpublished = !!currentEntry.isPublished && !canStayPublished;
    if (becameUnpublished) {
      showToast("필수 라인업이 부족해 출전 준비 상태로 바꿨어요. 전적은 유지됩니다.");
    }
    // 타선 9명 완성됐을 때만 DB 동기화. 미완성은 localStorage만 (호출 빈도 감소).
    // 단, 출전 중인 팀이 필수 조건 미달이 된 경우는 경기장 출전을 즉시 끄기 위해 DB에도 반영한다.
    if (filledSlots.length === 9 || becameUnpublished) {
      syncedUpsert(updated);
    } else {
      localUpsertEntry(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, pitcherSlots, useDH, hydratedEntryId]);

  // 모드별 배치된 선수 ID 집합 — 중복 방지에 사용
  const placedPlayerIds = useMemo(() => {
    if (mode === "batter") {
      return new Set(slots.filter((s): s is LineupSlot => s !== null).map((s) => s.playerId));
    }
    const ids = new Set<string>();
    pitcherSlots.forEach((id) => id && ids.add(id));
    return ids;
  }, [mode, slots, pitcherSlots]);

  const handleAddPlayer = (player: Player) => {
    if (placedPlayerIds.has(player.id)) {
      showToast("이미 라인업에 있어요.");
      return;
    }

    if (mode === "batter") {
      // 타자 모드: 투수는 추가 불가
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

        // 이미 쓰이는 포지션을 피해 자동 할당.
        // 선수 타입(내야/외야/포수)에 맞춰 같은 그룹부터 비어있는 포지션 탐색.
        // KBO 명단이 "내야수/외야수" 그룹으로만 표기되어 외야수 3명을 등록하면
        // 자연스럽게 LF → CF → RF 순으로 분배되도록 한다.
        const usedPositions = new Set(
          current.filter((s): s is LineupSlot => s !== null).map((s) => s.position)
        );
        const fallbackOrder = getFallbackOrder(player.primaryPosition);
        const assignedPosition: Position = usedPositions.has(player.primaryPosition)
          ? (fallbackOrder.find((p) => !usedPositions.has(p)) ?? player.primaryPosition)
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

    // 투수 모드: 선발(0번) → 마무리(1번) → 불펜(2~8번) 순으로 빈 자리 채우기
    if (player.primaryPosition !== "P") {
      showToast("야수는 타자 라인업에서 관리해주세요.");
      return;
    }
    // 빈 자리 = null 슬롯 OR 로스터에서 해석 안 되는 stale ID (현재 명단에서 빠진 선수).
    // stale ID는 UI에서 "(자동)" 으로 표시되지만 실제 값이 차 있어서 add 가 막혔던 버그.
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

  /** 타순 번호 뱃지 클릭 — 두 번 탭으로 두 슬롯의 선수를 교체.
   *  포지션은 각자 유지하고 슬롯(타순)만 swap. 타자 모드는 slots, 투수 모드는
   *  pitcherSlots에 동일 패턴 적용. */
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
        // 슬롯 통째 교환. order 필드는 인덱스+1로 재매핑.
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

    // 두 슬롯에 짧은 swap 애니메이션 (위/아래 방향까지 반영)
    setSwapOrderAnimation({ a: swapOrderSourceIdx, b: idx });
    if (swapOrderAnimTimerRef.current !== null) window.clearTimeout(swapOrderAnimTimerRef.current);
    swapOrderAnimTimerRef.current = window.setTimeout(() => {
      setSwapOrderAnimation(null);
      swapOrderAnimTimerRef.current = null;
    }, 450);

    setSwapOrderSourceIdx(null);
    showToast("타순을 바꿨어요.");
  };

  /** 팀 최근 라인업(bp_team_recent_lineups의 한 행)을 현재 entry에 적용.
   *  - 타순 9명: rosterId 매칭되는 선수만 채움. 매칭 실패 자리는 비워두고 토스트로 알림.
   *  - 선발 투수: starter_roster_id 매칭되면 pitcherSlots[0]에 세팅(나머지 불펜은 유지). */
  const applyRecentLineup = (row: RecentLineupRow) => {
    if (!currentEntry) return;

    const sorted = [...row.batting].sort((a, b) => a.order - b.order);
    const nextSlots: SlotState[] = Array.from({ length: 9 }, () => null);
    let missed = 0;
    sorted.forEach((b, idx) => {
      if (idx >= 9) return;
      // rosterId 우선, 없으면 이름으로 fallback (sync 시점 이후 로스터에 추가된 선수 대응).
      const player =
        (b.rosterId && playersById.get(b.rosterId)) ||
        (b.name ? playersByName.get(b.name) : undefined);
      if (player) {
        const fallback = player.primaryPosition;
        // 한자 표기("三一" 등 경기 중 포지션 교체) 첫 글자 매핑 + 영문 코드 통과.
        const pos: Position = normalizeKboPosition(b.position) ?? fallback;
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

    // 선발 — rosterId 우선, 없으면 이름으로 fallback.
    const resolvedStarter =
      (row.starter_roster_id && playersById.get(row.starter_roster_id)) ||
      (row.starter_name ? playersByName.get(row.starter_name) : undefined);
    if (resolvedStarter) {
      setPitcherSlots((current) =>
        current.map((id, i) => (i === PITCHER_STARTER_INDEX ? resolvedStarter.id : id))
      );
    }

    // 타자 9명 + 선발이 한 번에 채워지면 step1(타순 완성) 안내는 건너뛰고
    // step2(출전 준비 완료)만 뜨도록 step1을 미리 "본 것"으로 표시한다.
    if (resolvedStarter) {
      markGuideSeen("step1", currentEntry.entryId);
    }

    // 타자 모드로 전환해 적용 결과를 바로 확인할 수 있게 함
    setMode("batter");

    if (missed > 0) {
      showToast(`${9 - missed}명 적용. ${missed}자리는 로스터 변경으로 비워뒀어요.`);
    } else {
      showToast("최근 라인업을 불러왔어요.");
    }
  };

  /** "최근 라인업 불러오기" 모달에서 행을 선택했을 때. 기존 슬롯이 있으면 confirm 모달로 한 번 더 확인. */
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

  // ── 라인업 프리셋 ───────────────────────────────────────────────
  // 프리셋 = 현재 편집 중인 라인업(slots/pitcherSlots) 스냅샷. localStorage 전용.
  // 적용은 빌더의 기존 라인업 저장 흐름(slots/pitcherSlots setState → 저장 effect)을 그대로 탄다.

  /** 현재 편집본을 SavedLineup/SavedPitcherLineup 스냅샷으로 변환. */
  const buildCurrentSnapshot = () => {
    const now = new Date().toISOString();
    const filledSlots = slots.filter((s): s is LineupSlot => s !== null);
    const hasAnyPitcher = pitcherSlots.some(Boolean);
    return {
      batting: {
        teamId: selectedTeamId,
        slots: filledSlots,
        useDH,
        updatedAt: now,
        lineupType: currentEntry?.lineupType,
        rosterSourceId: currentEntry?.rosterSourceId
      },
      pitching: hasAnyPitcher
        ? {
            teamId: selectedTeamId,
            slots: pitcherSlots,
            updatedAt: now,
            lineupType: currentEntry?.lineupType,
            rosterSourceId: currentEntry?.rosterSourceId
          }
        : null
    };
  };

  /** 저장된 프리셋 스냅샷을 현재 편집본(slots/pitcherSlots)에 적용.
   *  hydration effect와 동일한 매핑으로 채운 뒤, 빌더의 저장 effect가 entry에 반영하게 한다. */
  const applyPreset = (preset: LineupPreset) => {
    if (!currentEntry) return;
    const nextSlots: SlotState[] = Array.from({ length: 9 }, () => null);
    preset.batting.slots.forEach((s) => {
      if (s.order >= 1 && s.order <= 9) {
        nextSlots[s.order - 1] = s;
      }
    });
    setSlots(nextSlots);

    const nextPitcher = Array.from(
      { length: PITCHER_SLOTS_COUNT },
      (_, i) => preset.pitching?.slots[i] ?? null
    );
    setPitcherSlots(nextPitcher);

    setSwapOrderSourceIdx(null);
    setSwapSource(null);
    setMode("batter");
    showToast(`"${preset.name}" 프리셋을 적용했어요.`);
  };

  /** 프리셋 칩 탭 → 현재 편집본이 차 있으면 덮어쓰기 확인, 비어 있으면 즉시 적용. */
  const handleApplyPreset = (preset: LineupPreset) => {
    const hasFilledBatter = slots.some((s) => s !== null);
    const hasAnyPitcher = pitcherSlots.some(Boolean);
    if (hasFilledBatter || hasAnyPitcher) {
      setPendingApplyPreset(preset);
    } else {
      applyPreset(preset);
    }
  };

  /** "+ 저장" → 현재 라인업을 새 프리셋으로 저장 (이름 입력 모달 오픈). */
  const handleOpenSavePreset = () => {
    if (!currentEntry) return;
    const existing = loadPresets(selectedTeamId);
    if (existing.length >= 3) {
      showToast("프리셋은 팀당 최대 3개까지 저장할 수 있어요.");
      return;
    }
    setSavePresetOpen(true);
  };

  const handleSavePresetSubmit = (name: string) => {
    if (!currentEntry) return;
    const snapshot = buildCurrentSnapshot();
    const res = savePreset(selectedTeamId, { name, ...snapshot });
    if (!res.ok) {
      showToast("프리셋은 팀당 최대 3개까지 저장할 수 있어요.");
      return;
    }
    showToast(`"${name}" 프리셋을 저장했어요.`);
  };

  /** 슬롯의 포지션 변경. 다른 슬롯이 이미 그 포지션을 쓰고 있으면 자동으로 swap.
   *  다이아몬드 직접 swap과 동일한 traveler 애니메이션을 재사용해 이동/교체를 시각화. */
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

    // 슬롯 상태 갱신
    setSlots((current) =>
      current.map((s, i) => {
        if (!s) return s;
        if (i === sourceIdx) return { ...s, position: newPosition };
        if (conflictIdx !== -1 && i === conflictIdx) return { ...s, position: oldPosition };
        return s;
      })
    );

    // 애니메이션 — 항상 source player가 이동, 충돌 있으면 conflict player도 같이 이동
    const travelers: SwapTraveler[] = [
      { playerId: sourceSlot.playerId, from: oldPosition, to: newPosition }
    ];
    if (conflictIdx !== -1) {
      const conflictSlot = slots[conflictIdx];
      if (conflictSlot) {
        travelers.push({
          playerId: conflictSlot.playerId,
          from: newPosition,
          to: oldPosition
        });
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

  const handleReset = () => {
    if (mode === "batter") {
      if (slots.every((s) => s === null)) return;
    } else {
      if (pitcherSlots.every((s) => s === null)) return;
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

  /** 다이아몬드 마커 클릭 — 두 번 클릭으로 두 포지션의 선수를 교환.
   *  - 첫 클릭: 해당 포지션을 source로 선택 (강조)
   *  - 같은 포지션 재클릭: 선택 취소
   *  - 다른 포지션 클릭: 두 포지션의 슬롯이 가진 position 값을 swap
   *    (양쪽 다 비어 있으면 무시, 한쪽만 있으면 그 선수가 이동)
   *  - swap 시 한 자리에서 다른 자리로 선수 이름이 날아가는 애니메이션 노출 */
  const handleDiamondPositionClick = (pos: Position) => {
    // 타자 모드에서 P(투수) 마커는 별도 라인업이라 swap 불가
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
      // 두 위치 모두 비어있음 — 단순 선택 갱신
      setSwapSource(pos);
      return;
    }

    // 애니메이션용 traveler 목록 — 비어있는 쪽은 제외
    const travelers: SwapTraveler[] = [];
    if (sourceIdx !== -1) {
      travelers.push({ playerId: slots[sourceIdx]!.playerId, from: swapSource, to: pos });
    }
    if (targetIdx !== -1) {
      travelers.push({ playerId: slots[targetIdx]!.playerId, from: pos, to: swapSource });
    }

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

    // 애니메이션 끝나면 traveler 정리 → 정적 이름 라벨 다시 노출
    if (swapTimerRef.current !== null) window.clearTimeout(swapTimerRef.current);
    swapTimerRef.current = window.setTimeout(() => {
      setSwapTravelers([]);
      swapTimerRef.current = null;
    }, 650);
  };


  const currentLineupType = currentEntry ? getLineupType(currentEntry) : "kbo";
  const isKboLineup = currentLineupType === "kbo";
  const selectedTeam = (() => {
    try {
      return getTeam(selectedTeamId);
    } catch {
      return {
        id: selectedTeamId,
        name: currentLineupType === "national" ? "아시안게임 국가대표팀" : "커스텀팀",
        shortName: currentLineupType === "national" ? "국대" : "커스텀",
        initial: currentLineupType === "national" ? "N" : "C",
        color: currentLineupType === "national" ? "#0f4c81" : "#475569",
        accent: currentLineupType === "national" ? "#d71920" : "#f59e0b"
      };
    }
  })();
  // stale ID(로스터에서 빠진 선수)는 UI에서 "(자동)" 으로 보이므로 카운트에서도 제외.
  const filledCount = slots.filter((s) => s !== null && playersById.has(s.playerId)).length;
  const pitcherFilled = pitcherSlots.filter((id) => id !== null && playersById.has(id)).length;
  // 출전 가능 조건 — 타선 9명 + 선발 1명. 마무리/불펜은 출전 등록 시 자동 채움.
  const hasStarter = pitcherSlots[PITCHER_STARTER_INDEX] != null;
  const hasCloser = pitcherSlots[PITCHER_CLOSER_INDEX] != null;
  const hasRequiredBullpen = pitcherSlots[PITCHER_REQUIRED_BULLPEN_INDEX] != null;
  const hasRequiredPitchers = hasStarter; // 가이드 트리거용 — 선발만 있으면 출전 가능
  const publishRequirementMessage = filledCount !== 9
    ? "타자 9명을 모두 채워야 출전할 수 있어요"
    : !hasStarter
      ? "선발 투수를 골라야 출전할 수 있어요"
      : null;
  const canPublish = publishRequirementMessage === null;
  // 마무리/불펜 중 하나라도 비어있으면 출전 등록 시 자동 채움 안내가 필요한 상태.
  const needsAutoFillNotice = canPublish && pitcherSlots.slice(PITCHER_CLOSER_INDEX).some((id) => !id);

  const fillPitchersForCurrentEntry = () => {
    if (!currentEntry) return null;
    if (isKboLineup) {
      return fillMissingPitcherSlots(
        currentEntry.teamId,
        pitcherSlots,
        new Set(playersById.keys())
      );
    }
    const stats = buildStatsDirectoryForLineups([
      { teamId: currentEntry.teamId, batting: currentEntry.batting, pitching: currentEntry.pitching }
    ]);
    return fillMissingPitcherSlotsFromStatsDirectory(
      currentEntry.teamId,
      pitcherSlots,
      stats,
      new Set(playersById.keys())
    );
  };

  // 슬롯별 가이드 트리거 상태 추적 — transition(0~8→9, false→true)만 캐치.
  // 첫 마운트(prev 없음)는 무시 → 기존 슬롯이 페이지 진입 시 즉시 popup되는 것 차단.
  const guideTrackRef = useRef<Map<string, { filledCount: number; hasRequiredPitchers: boolean }>>(new Map());

  useEffect(() => {
    if (!currentEntry) return;
    const key = currentEntry.entryId;
    const prev = guideTrackRef.current.get(key);
    guideTrackRef.current.set(key, { filledCount, hasRequiredPitchers });
    if (!prev) return; // 슬롯 첫 추적은 트리거 X (기존 슬롯 보호)

    // step1: 타순 미완성 → 9명 완성
    if (prev.filledCount < 9 && filledCount === 9 && !hasSeenGuide("step1", key)) {
      markGuideSeen("step1", key);
      setGuideStep1Open(true);
      return;
    }
    // step2: 필수 투수 슬롯이 모두 채워짐 (타순 9 + step1 안내 본 후)
    if (!prev.hasRequiredPitchers && hasRequiredPitchers && filledCount === 9
        && hasSeenGuide("step1", key) && !hasSeenGuide("step2", key)) {
      markGuideSeen("step2", key);
      setGuideStep2Open(true);
    }
  }, [currentEntry?.entryId, currentEntry?.isPublished, filledCount, hasRequiredPitchers]);


  // 선수 풀: 모드에 따라 야수만 / 투수만 노출. 이미 배치된 선수는 제외.
  // 정렬: 시즌 1군 출장 경기수(seasonGames) 내림차순 → 1군 주전이 위로.
  // 동률은 등번호 오름차순.
  const poolPlayers = useMemo(() => {
    const filtered = roster.filter((p) => !placedPlayerIds.has(p.id));
    const byMode = mode === "batter"
      ? filtered.filter((p) => p.primaryPosition !== "P")
      : filtered.filter((p) => p.primaryPosition === "P");
    return byMode.sort((a, b) => {
      const ga = a.seasonGames ?? 0;
      const gb = b.seasonGames ?? 0;
      if (ga !== gb) return gb - ga;
      return a.jerseyNumber - b.jerseyNumber;
    });
  }, [roster, placedPlayerIds, mode]);

  // 다이아몬드는 모드와 무관하게 항상 같은 풍경을 보여준다:
  // 타자 9명(각자 수비 위치) + 선발투수 1명(P 위치). 양쪽 라인업이 합쳐진 실제 출전 가능 라인업.
  const diamondSlots: SlotState[] = useMemo(() => {
    const combined: SlotState[] = [...slots];
    const starterId = pitcherSlots[PITCHER_STARTER_INDEX];
    if (starterId) {
      // 가상 슬롯 — 다이아몬드의 playerByPosition map에만 사용됨 (실제 slots/pitcherSlots와는 별개)
      combined.push({ order: 1 as LineupOrder, playerId: starterId, position: "P" });
    }
    return combined;
  }, [slots, pitcherSlots]);

  // 출전 요청 핸들러 — LineupActionRow가 호출. 마무리/불펜 빈 자리 있으면 자동 채움 모달로 분기.
  const handlePublishRequest = async () => {
    if (!currentEntry) return;
    if (!canPublish) {
      showToast(publishRequirementMessage ?? "출전 조건을 확인해주세요.");
      return;
    }
    if (needsAutoFillNotice) {
      setConfirmAutoFillOpen(true);
      return;
    }
    setPublishProcessing(true);
    const res = await togglePublished(currentEntry.entryId, true);
    setPublishProcessing(false);
    if (res.ok) {
      void trackEvent("lineup_published", {
        entryId: currentEntry.entryId,
        teamId: currentEntry.teamId,
        source: "manual"
      });
    }
    if (!res.ok) showToast(res.error ?? "공개 실패");
    else showToast("공개됐어요");
  };

  // 출전 철회 — 출전 중 → 출전 준비. 라인업/전적은 그대로 유지하고 매치 풀에서만 빠진다.
  // togglePublished(false) 는 이제 전적을 보존(unpublishLineup 수정됨). 언제든 다시 출전 가능.
  const handleWithdraw = async () => {
    if (!currentEntry?.isPublished) return;
    setPublishProcessing(true);
    const res = await togglePublished(currentEntry.entryId, false);
    setPublishProcessing(false);
    if (res.ok) {
      void trackEvent("lineup_withdrawn", {
        entryId: currentEntry.entryId,
        teamId: currentEntry.teamId
      });
      showToast("비공개로 전환했어요. 언제든 다시 공개할 수 있어요.");
    } else {
      showToast(res.error ?? "비공개 전환 실패");
    }
  };

  // 자동 채움 모달의 "자동 채움 + 출전" 클릭 — 빈 자리 채움 + entry 직접 upsert + 출전 등록.
  const handleAutoFillAndPublish = async () => {
    if (!currentEntry) return;
    const filled = fillPitchersForCurrentEntry();
    if (!filled) {
      showToast("투수 자동 채움 실패");
      return;
    }
    setPitcherSlots(filled.slots);
    setPublishProcessing(true);
    // pitcherSlots state는 비동기라 sync useEffect가 처리하기 전에 togglePublished가
    // 실행되면 빈 자리 그대로 DB에 남을 수 있다. 따라서 entry 전체를 직접 upsert.
    const now = new Date().toISOString();
    const updated: LineupEntry = {
      ...currentEntry,
      pitching: filled,
      updatedAt: now
    };
    syncedUpsert(updated);
    const res = await togglePublished(currentEntry.entryId, true);
    setPublishProcessing(false);
    setConfirmAutoFillOpen(false);
    if (res.ok) {
      void trackEvent("lineup_published", {
        entryId: currentEntry.entryId,
        teamId: currentEntry.teamId,
        source: "auto_fill"
      });
    }
    if (!res.ok) showToast(res.error ?? "공개 실패");
    else showToast("공개됐어요");
  };

  // 가이드 step2의 "확인" — 자동 채움(필요 시) + 공개.
  const handleGuideStep2Confirm = async () => {
    if (!currentEntry) return;
    setPublishProcessing(true);
    if (needsAutoFillNotice) {
      const filled = fillPitchersForCurrentEntry();
      if (filled) {
        setPitcherSlots(filled.slots);
        const now = new Date().toISOString();
        syncedUpsert({
          ...currentEntry,
          pitching: filled,
          updatedAt: now
        });
      }
    }
    const res = await togglePublished(currentEntry.entryId, true);
    setPublishProcessing(false);
    setGuideStep2Open(false);
    if (res.ok) {
      void trackEvent("lineup_published", {
        entryId: currentEntry.entryId,
        teamId: currentEntry.teamId,
        source: "guide"
      });
    }
    if (!res.ok) {
      showToast(res.error ?? "공개 실패");
    } else {
      showToast("공개됐어요");
      // 출전 등록 성공 직후 — 바로 "경기장 가기" 유도 (온보딩 마지막 단계).
      setGuideGoStadiumOpen(true);
    }
  };

  const isLocked = false;
  const noop = () => {};
  const usedTeamIds = useMemo(() => new Set(regularEntries.map((entry) => entry.teamId)), [regularEntries]);

  return (
    <AppShell activeTab="play" title="라인업 분석" theme="light" backHref="/" wide>
      <header className="lineup-header lineup-header-no-back">
        {/* 헤더 좌측: 동기화 상태 배지 */}
        <LineupSyncBadge syncStatus={syncStatus} />

        {/* 팀 슬롯 picker — 현재 팀 + 드롭다운으로 다른 팀 / 새 팀 / 이름 편집 / 삭제 */}
        <LineupSlotPicker
          entries={regularEntries}
          specialEntries={clientReady && nationalEntry ? [nationalEntry] : []}
          selectedEntryId={selectedEntryId}
          statsByEntryId={statsByEntryId}
          archivedTeams={archivedTeams}
          lineupLimit={lineupLimit}
          tier={tier}
          open={slotMenuOpen}
          setOpen={(open) => {
            setSlotMenuOpen(open);
            if (open) setPresetMenuOpen(false);
          }}
          onSelect={(entryId) => {
            setSelectedEntryId(entryId);
            // 선택한 팀을 목록 맨 위로 — 재진입 시 자동 선택 로직(entries[0])이 이 팀을 고른다.
            // 표시 순서만 바꾸므로 전적/랭킹/대표팀/가을야구엔 영향 없음.
            // localStorage 재정렬 + React 상태(replaceEntries)를 동시에 갱신해 드롭다운 순서 즉시 반영.
            const reordered = moveLineupEntryToTop(entryId);
            replaceEntries(reordered);
          }}
          onAddNew={() => {
            const hasAvailableTeam = Array.from(seededTeamIds).some((teamId) => !usedTeamIds.has(teamId));
            if (!hasAvailableTeam) {
              showToast("운영 가능한 팀을 모두 만들었어요.");
              return;
            }
            setNewSlotOpen(true);
          }}
          onRename={(entryId) => setRenamingEntryId(entryId)}
          onDelete={(entryId) => setConfirmDeleteEntryId(entryId)}
        />
        {/* 헤더 우측: 라인업 프리셋 드롭다운 (이전 공유 버튼 자리) */}
        {currentEntry ? (
          <div className="lineup-header-preset">
            <LineupPresetBar
              teamId={selectedTeamId}
              canSaveCurrent={slots.some((s) => s !== null) || pitcherSlots.some(Boolean)}
              open={presetMenuOpen}
              setOpen={(open) => {
                setPresetMenuOpen(open);
                if (open) setSlotMenuOpen(false);
              }}
              onSaveCurrent={handleOpenSavePreset}
              onApply={handleApplyPreset}
              onRename={(preset) => setRenamingPreset(preset)}
              onDelete={(preset) => setDeletingPreset(preset)}
            />
          </div>
        ) : null}
      </header>

      <div className={`lineup-layout ${isLocked ? "is-locked" : ""}`}>
        {/* 야구장 다이아몬드 — 타자 모드: 9수비, 투수 모드: 선발만 P 표시 */}
        <section
          className="lineup-diamond-card"
          aria-label={mode === "batter" ? "수비 위치" : "선발 투수"}
        >
          <LineupDiamond
            slots={diamondSlots}
            playersById={playersById}
            teamColor={selectedTeam.color}
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

        <LineupActionRow
          mode={mode}
          currentEntry={currentEntry}
          syncStatus={syncStatus}
          publishRequirementMessage={publishRequirementMessage}
          canPublish={canPublish}
          needsAutoFillNotice={needsAutoFillNotice}
          publishProcessing={publishProcessing}
          poolCount={poolPlayers.length}
          filledCount={filledCount}
          pitcherFilled={pitcherFilled}
          currentEntryStats={currentEntry ? statsByEntryId[currentEntry.entryId] : undefined}
          currentEntryAwayStats={currentEntry ? awayStatsByEntryId[currentEntry.entryId] : undefined}
          selectedTeamShortName={selectedTeam.shortName}
          enableTeamMatchActions
          onModeChange={(nextMode) => {
            setMode(nextMode);
            setSwapSource(null);
          }}
          onRecentOpen={() => setRecentPickerOpen(true)}
          onPublishRequest={handlePublishRequest}
          onWithdraw={handleWithdraw}
        />

        {/* 슬롯 카드 — 타자: 1~9 타순 / 투수: 선발 + 마무리 + 불펜 1~7 */}
        {mode === "batter" ? (
          <BatterSlotList
            slots={slots}
            filledCount={filledCount}
            playersById={playersById}
            swapOrderSourceIdx={swapOrderSourceIdx}
            swapOrderAnimation={swapOrderAnimation}
            isLocked={isLocked}
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
            isLocked={isLocked}
            onOrderClick={handleOrderClick}
            onRemove={handleRemovePitcher}
            onReset={handleReset}
          />
        )}

        <LineupPoolCard
          poolPlayers={poolPlayers}
          isLocked={isLocked}
          onAddPlayer={handleAddPlayer}
          onLockedClick={noop}
        />

        {/* 공유 — 자주 쓰지 않는 부가 기능이라 대기 풀 카드 아래로 강등 */}
        <button
          type="button"
          className="lineup-pool-share-btn"
          onClick={() => setShareOpen(true)}
        >
          <Share2 size={14} />
          라인업 공유하기
        </button>
      </div>

      {clientReady && nationalEntry ? (
        <section className="lineup-special-card" aria-label="아시안게임 국가대표팀 특별 라인업">
          <div className="lineup-special-main">
            <span className="lineup-special-icon" aria-hidden="true">
              <Trophy size={18} />
            </span>
            <div className="lineup-special-copy">
              <strong>{nationalEntry.name}</strong>
              <span>여러 팀 선수로 구성하는 특별 라인업</span>
            </div>
          </div>
          <div className="lineup-special-meta">
            <span>타자 {nationalEntry.batting.slots.length}/9</span>
            <span>투수 {nationalEntry.pitching?.slots.filter(Boolean).length ?? 0}/9</span>
          </div>
          <button
            type="button"
            className={`lineup-special-select ${selectedEntryId === nationalEntry.entryId ? "is-active" : ""}`}
            onClick={() => {
              setSelectedEntryId(nationalEntry.entryId);
              setMode("batter");
              setSwapSource(null);
              setSlotMenuOpen(false);
              setPresetMenuOpen(false);
            }}
          >
            {selectedEntryId === nationalEntry.entryId ? "편집 중" : "편집하기"}
          </button>
        </section>
      ) : null}

      <ConfirmResetModal
        open={confirmResetOpen}
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={confirmReset}
      />

      <PositionPickerModal
        order={positionPickerForOrder}
        slots={slots}
        onClose={() => setPositionPickerForOrder(null)}
        onPick={handleChangePosition}
      />

      {isKboLineup ? <ShareLineupModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        teamId={selectedTeamId}
        mode={mode}
        slots={slots}
        pitcherSlots={pitcherSlots}
        playersById={playersById}
      /> : null}

      {/* 팀 최근 라인업 불러오기 — bp_team_recent_lineups의 최근 10경기 표시 */}
      {isKboLineup ? <RecentLineupPickerModal
        open={recentPickerOpen}
        teamId={selectedTeamId}
        onClose={() => setRecentPickerOpen(false)}
        onPick={handleRecentLineupPick}
      /> : null}

      {/* 마무리/불펜 자동 채움 안내 모달 — 빈 자리만 자동 채워서 출전 등록 */}
      <AutoFillPublishModal
        open={confirmAutoFillOpen}
        publishProcessing={publishProcessing}
        onClose={() => setConfirmAutoFillOpen(false)}
        onConfirm={handleAutoFillAndPublish}
      />

      <ConfirmOverwriteRecentModal
        open={pendingRecentLineup !== null}
        onCancel={() => setPendingRecentLineup(null)}
        onConfirm={() => {
          if (pendingRecentLineup) applyRecentLineup(pendingRecentLineup);
          setPendingRecentLineup(null);
        }}
      />

      {/* 프리셋 적용 — 현재 편집본이 차 있을 때 덮어쓰기 확인 (최근 라인업과 동일 모달 재사용) */}
      <ConfirmOverwriteRecentModal
        open={pendingApplyPreset !== null}
        onCancel={() => setPendingApplyPreset(null)}
        onConfirm={() => {
          if (pendingApplyPreset) applyPreset(pendingApplyPreset);
          setPendingApplyPreset(null);
        }}
      />

      {/* 프리셋 저장 — 현재 라인업 스냅샷에 이름 붙여 저장 */}
      <PresetNameModal
        open={savePresetOpen}
        intent="save"
        placeholder={`${selectedTeam.shortName} 프리셋`}
        onClose={() => setSavePresetOpen(false)}
        onSubmit={handleSavePresetSubmit}
      />

      {/* 프리셋 이름 변경 */}
      <PresetNameModal
        open={renamingPreset !== null}
        intent="rename"
        initialName={renamingPreset?.name ?? ""}
        onClose={() => setRenamingPreset(null)}
        onSubmit={(name) => {
          if (renamingPreset) renamePreset(renamingPreset.presetId, name);
        }}
      />

      {/* 프리셋 삭제 확인 */}
      <ConfirmDeletePresetModal
        open={deletingPreset !== null}
        presetName={deletingPreset?.name ?? ""}
        onCancel={() => setDeletingPreset(null)}
        onConfirm={() => {
          if (deletingPreset) {
            deletePreset(deletingPreset.presetId);
            showToast("프리셋을 삭제했어요.");
          }
          setDeletingPreset(null);
        }}
      />

      {/* 첫 진입 step0 — 빈 슬롯 자동 생성 직후. 처음 사용자는 직접 짜기 어려우니
          "실제 경기 라인업 불러오기" 를 1순위로 유도 (누르면 최근 라인업 picker). */}
      <GuideStep0Modal
        open={guideStep0Open}
        teamShortName={selectedTeam.shortName}
        onClose={() => setGuideStep0Open(false)}
        onLoadRealLineup={() => {
          setGuideStep0Open(false);
          setRecentPickerOpen(true);
        }}
      />

      {/* 새 슬롯 onboarding step1 — 타순 9명 완성 직후, "다음은 필수 투수" 안내 */}
      <GuideStep1Modal
        open={guideStep1Open}
        onClose={() => setGuideStep1Open(false)}
        onStartPicking={() => {
          setGuideStep1Open(false);
          setMode("pitcher");
          setSwapSource(null);
        }}
      />

      {/* 새 슬롯 onboarding step2 — 선발 투수까지 선택 직후, "이제 출전해서 가상경기" 안내 + 자동 출전 등록.
          마무리/불펜이 비어있으면 saves/era 기준으로 자동 채워서 함께 저장. */}
      <GuideStep2Modal
        open={guideStep2Open}
        needsAutoFillNotice={needsAutoFillNotice}
        publishProcessing={publishProcessing}
        onClose={() => setGuideStep2Open(false)}
        onAutoFillAndPublish={handleGuideStep2Confirm}
      />

      {/* 출전 등록 완료 직후 — 경기장 가기 유도 (온보딩 마지막) */}
      <GuideGoStadiumModal
        open={guideGoStadiumOpen}
        onClose={() => setGuideGoStadiumOpen(false)}
        onGoStadium={() => {
          setGuideGoStadiumOpen(false);
          router.push("/stadium/lobby");
        }}
      />

      <NewSlotModal
        open={newSlotOpen}
        initialTeamId={initialTeamId}
        seededTeamIds={seededTeamIds}
        usedTeamIds={usedTeamIds}
        nickname={profile.nickname}
        onClose={() => setNewSlotOpen(false)}
        onCreate={(teamId, name) => {
          // 새 슬롯은 빈 라인업이므로 localStorage만 — 9명 채울 때 DB로 첫 commit.
          const newEntry = createEmptyEntry(
            teamId,
            name || undefined,
            profile.nickname
          );
          localUpsertEntry(newEntry);
          void trackEvent("lineup_created", {
            entryId: newEntry.entryId,
            teamId: newEntry.teamId
          });
          setSelectedEntryId(newEntry.entryId);
          setMode("batter"); // 새 슬롯은 타자부터 채우도록 토글 자동
          setNewSlotOpen(false);
          // 슬롯 생성 직후 항상 step0 안내 — "실제 경기 라인업 불러오기" 로 유도.
          // 빈 슬롯을 새로 만들 때마다(첫 진입 포함) 도움 되는 안내라 디바이스 1회 제한 없이 매번 노출.
          setGuideStep0Open(true);
        }}
      />

      <RenameSlotModal
        open={renamingEntryId !== null}
        initialName={
          renamingEntryId
            ? entries.find((e) => e.entryId === renamingEntryId)?.name ?? ""
            : ""
        }
        onClose={() => setRenamingEntryId(null)}
        onSubmit={(name) => {
          if (renamingEntryId) {
            syncedRename(renamingEntryId, name);
          }
        }}
      />

      <ConfirmDeleteSlotModal
        open={confirmDeleteEntryId !== null}
        mode={
          // 전적(홈경기) 있는 팀은 은퇴(보관), 0승 0패는 그냥 삭제.
          (confirmDeleteEntryId && (statsByEntryId[confirmDeleteEntryId]?.matches ?? 0) > 0)
            ? "archive"
            : "delete"
        }
        onCancel={() => setConfirmDeleteEntryId(null)}
        onConfirm={() => {
          if (!confirmDeleteEntryId) return;
          const entryToDelete = confirmDeleteEntryId;
          const mode: SlotRemoveMode =
            (statsByEntryId[entryToDelete]?.matches ?? 0) > 0 ? "archive" : "delete";
          setRemoveMode(mode);
          setConfirmDeleteEntryId(null);
          setDeleteStatus({ phase: "deleting" });
          const next = syncedDelete(entryToDelete, {
            archive: mode === "archive",
            onSyncResult: (res) => {
              if (res.ok) {
                setDeleteStatus({ phase: "success" });
                // 은퇴면 하단 "은퇴한 팀" 목록을 DB 반영 후 다시 불러옴.
                if (mode === "archive") setArchivedRefreshKey((k) => k + 1);
                // 1.5초 후 자동 닫기
                setTimeout(() => setDeleteStatus({ phase: "idle" }), 1500);
              } else {
                setDeleteStatus({ phase: "error", error: res.error });
              }
            }
          });
          if (selectedEntryId === entryToDelete) {
            setSelectedEntryId(next[0]?.entryId ?? null);
          }
        }}
      />

      <DeleteSlotStatusModal
        status={deleteStatus}
        mode={removeMode}
        onClose={() => setDeleteStatus({ phase: "idle" })}
      />
    </AppShell>
  );
}
