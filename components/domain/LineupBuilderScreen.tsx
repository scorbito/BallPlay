"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { ModalShell } from "@/components/common/ModalShell";
import { LineupDiamond } from "@/components/domain/LineupDiamond";
import { getTeam, teams } from "@/lib/constants/teams";
import { useAppState } from "@/lib/state/AppState";
import { getRoster, getSeededTeamIds } from "@/lib/rosters";
import {
  LINEUP_STORAGE_PREFIX,
  POSITIONS,
  POSITION_LABEL,
  POSITION_SHORT,
  type LineupOrder,
  type LineupSlot,
  type Player,
  type Position,
  type SavedLineup
} from "@/lib/types/lineup";

const ORDERS: LineupOrder[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function storageKey(teamId: string) {
  return `${LINEUP_STORAGE_PREFIX}${teamId}`;
}

function loadLineup(teamId: string): SavedLineup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(teamId));
    if (!raw) return null;
    return JSON.parse(raw) as SavedLineup;
  } catch {
    return null;
  }
}

function saveLineup(lineup: SavedLineup) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(lineup.teamId), JSON.stringify(lineup));
  } catch {
    // ignore quota errors
  }
}

type SlotState = LineupSlot | null;
const EMPTY_SLOTS: SlotState[] = Array.from({ length: 9 }, () => null);

export function LineupBuilderScreen() {
  const { profile, showToast } = useAppState();
  const seededTeamIds = useMemo(() => getSeededTeamIds(), []);

  // 시드가 있는 팀으로 기본값 — 사용자의 메인팀이 시드 안 됐으면 두산
  const initialTeamId = seededTeamIds.has(profile.mainTeamId) ? profile.mainTeamId : "doosan";

  const [selectedTeamId, setSelectedTeamId] = useState(initialTeamId);
  const [slots, setSlots] = useState<SlotState[]>(EMPTY_SLOTS);
  const [useDH, setUseDH] = useState(true);
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const teamPickerRef = useRef<HTMLDivElement | null>(null);
  const [positionPickerForOrder, setPositionPickerForOrder] = useState<LineupOrder | null>(null);

  // 외부 클릭 시 팀 드롭다운 닫기
  useEffect(() => {
    if (!teamMenuOpen) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && teamPickerRef.current && !teamPickerRef.current.contains(target)) {
        setTeamMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [teamMenuOpen]);

  const roster = useMemo(() => getRoster(selectedTeamId), [selectedTeamId]);
  const playersById = useMemo(() => {
    const map = new Map<string, Player>();
    roster.forEach((p) => map.set(p.id, p));
    return map;
  }, [roster]);

  // 팀 변경 시 저장된 라인업 복원, 없으면 빈 슬롯
  useEffect(() => {
    const stored = loadLineup(selectedTeamId);
    if (stored && stored.slots.length > 0) {
      // 저장된 슬롯을 9칸 배열로 매핑
      const next: SlotState[] = Array.from({ length: 9 }, () => null);
      stored.slots.forEach((s) => {
        if (s.order >= 1 && s.order <= 9) {
          next[s.order - 1] = s;
        }
      });
      setSlots(next);
      setUseDH(stored.useDH);
    } else {
      setSlots(EMPTY_SLOTS);
      setUseDH(true);
    }
  }, [selectedTeamId]);

  // 변경 시 localStorage 즉시 저장
  useEffect(() => {
    const filledSlots = slots.filter((s): s is LineupSlot => s !== null);
    if (filledSlots.length === 0) {
      // 빈 라인업은 저장된 것도 지움
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(storageKey(selectedTeamId));
      }
      return;
    }
    saveLineup({
      teamId: selectedTeamId,
      slots: filledSlots,
      useDH,
      updatedAt: new Date().toISOString()
    });
  }, [slots, selectedTeamId, useDH]);

  const placedPlayerIds = useMemo(
    () => new Set(slots.filter((s): s is LineupSlot => s !== null).map((s) => s.playerId)),
    [slots]
  );

  const handleAddPlayer = (player: Player) => {
    if (placedPlayerIds.has(player.id)) {
      showToast("이미 라인업에 있어요.");
      return;
    }
    // DH 사용 중이고 투수면 라인업에 못 들어감 — 안내
    if (useDH && player.primaryPosition === "P") {
      showToast("DH 사용 중에는 투수가 타순에 들어가지 않아요.");
      return;
    }
    setSlots((current) => {
      const firstEmpty = current.findIndex((s) => s === null);
      if (firstEmpty === -1) {
        showToast("타순이 모두 찼어요. 슬롯을 비우고 다시 시도해 주세요.");
        return current;
      }
      const next = [...current];
      next[firstEmpty] = {
        order: (firstEmpty + 1) as LineupOrder,
        playerId: player.id,
        position: player.primaryPosition === "P" && !useDH ? "P" : player.primaryPosition
      };
      return next;
    });
  };

  const handleRemoveSlot = (order: LineupOrder) => {
    setSlots((current) => current.map((s, i) => (i === order - 1 ? null : s)));
  };

  const handleChangePosition = (order: LineupOrder, position: Position) => {
    setSlots((current) =>
      current.map((s, i) => (i === order - 1 && s ? { ...s, position } : s))
    );
    setPositionPickerForOrder(null);
  };

  const handleReset = () => {
    if (slots.every((s) => s === null)) return;
    if (typeof window !== "undefined") {
      if (!window.confirm("라인업을 모두 비우시겠어요?")) return;
    }
    setSlots(EMPTY_SLOTS);
    showToast("라인업을 비웠어요.");
  };

  const handleToggleDH = () => {
    setUseDH((current) => {
      const next = !current;
      // DH 끄는 순간 라인업에 DH 슬롯이 있다면 P로 표시되도록 안내만
      if (current === true) {
        // DH → 일반 타순. 슬롯의 DH는 그대로 두고 사용자가 직접 바꾸도록.
      }
      return next;
    });
  };

  const selectedTeam = getTeam(selectedTeamId);
  const filledCount = slots.filter((s) => s !== null).length;

  // 선수 풀: 라인업에 없는 선수 (DH 사용 중에는 투수는 보여주지만 추가 안 됨)
  const poolPlayers = useMemo(
    () => roster.filter((p) => !placedPlayerIds.has(p.id)),
    [roster, placedPlayerIds]
  );

  return (
    <AppShell activeTab="play" title="라인업 짜기" theme="dark" hideHeader>
      <header className="lineup-header">
        <Link className="lineup-back" href="/play" aria-label="놀이 허브로 돌아가기" prefetch>
          <ArrowLeft size={20} />
        </Link>
        <h1>라인업 짜기</h1>
        <button type="button" className="lineup-reset-btn" onClick={handleReset} aria-label="라인업 초기화">
          <RotateCcw size={16} />
        </button>
      </header>

      {/* 팀 드롭다운 */}
      <div className="lineup-top-bar">
        <div className="sched-team-picker" ref={teamPickerRef}>
          <button
            type="button"
            className="sched-team-picker-trigger"
            aria-haspopup="listbox"
            aria-expanded={teamMenuOpen}
            onClick={() => setTeamMenuOpen((open) => !open)}
          >
            <TeamBadge teamId={selectedTeamId} size="sm" />
            <strong>{selectedTeam.shortName}</strong>
            <ChevronDown size={16} className={teamMenuOpen ? "sched-team-picker-chevron-open" : ""} />
          </button>
          {teamMenuOpen ? (
            <ul className="sched-team-picker-menu" role="listbox" aria-label="팀 선택">
              {teams.map((team) => {
                const active = team.id === selectedTeamId;
                const seeded = seededTeamIds.has(team.id);
                return (
                  <li key={team.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={!seeded}
                      className={`sched-team-picker-item ${active ? "sched-team-picker-item-active" : ""} ${!seeded ? "sched-team-picker-item-disabled" : ""}`}
                      onClick={() => {
                        if (!seeded) return;
                        setSelectedTeamId(team.id);
                        setTeamMenuOpen(false);
                      }}
                    >
                      <TeamBadge teamId={team.id} size="sm" />
                      <span>{team.name}</span>
                      {active ? <Check size={14} strokeWidth={3} className="sched-team-picker-check" /> : null}
                      {!seeded ? <span className="lineup-pool-soon">준비중</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <label className="lineup-dh-toggle">
          <input type="checkbox" checked={useDH} onChange={handleToggleDH} />
          <span>DH 사용</span>
        </label>
      </div>

      {/* 야구장 다이아몬드 (상단, 전체 폭) */}
      <section className="lineup-diamond-card" aria-label="수비 위치">
        <LineupDiamond slots={slots} playersById={playersById} teamColor={selectedTeam.color} />
      </section>

      {/* 타순 + 대기 선수 좌우 */}
      <div className="lineup-row">
        <section className="lineup-slots-card" aria-label="타순">
          <div className="lineup-section-head">
            <strong>타순</strong>
            <span className="lineup-section-count">{filledCount} / 9</span>
          </div>
          <ol className="lineup-slots">
            {ORDERS.map((order) => {
              const slot = slots[order - 1];
              const player = slot ? playersById.get(slot.playerId) : undefined;
              return (
                <li key={order} className={`lineup-slot ${slot ? "lineup-slot-filled" : "lineup-slot-empty"}`}>
                  <span className="lineup-slot-order">{order}</span>
                  {slot && player ? (
                    <>
                      <button
                        type="button"
                        className="lineup-slot-player"
                        onClick={() => handleRemoveSlot(order)}
                        aria-label={`${player.name} 라인업에서 빼기`}
                      >
                        <span className="lineup-slot-name">{player.name}</span>
                      </button>
                      <button
                        type="button"
                        className="lineup-slot-pos"
                        onClick={() => setPositionPickerForOrder(order)}
                        aria-label="포지션 변경"
                      >
                        {POSITION_SHORT[slot.position]}
                      </button>
                    </>
                  ) : (
                    <span className="lineup-slot-placeholder">선택</span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="lineup-pool-card lineup-pool-card-side" aria-label="대기 선수">
          <div className="lineup-section-head">
            <strong>대기</strong>
            <span className="lineup-section-count">{poolPlayers.length}</span>
          </div>
          {poolPlayers.length === 0 ? (
            <p className="lineup-pool-empty">전원 출장 중</p>
          ) : (
            <ul className="lineup-pool-list">
              {poolPlayers.map((player) => {
                const dhBlocked = useDH && player.primaryPosition === "P";
                return (
                  <li key={player.id}>
                    <button
                      type="button"
                      className={`lineup-pool-row ${dhBlocked ? "lineup-pool-row-blocked" : ""}`}
                      onClick={() => handleAddPlayer(player)}
                      disabled={dhBlocked}
                      title={dhBlocked ? "DH 사용 중에는 투수가 타순에 들어가지 않아요" : undefined}
                    >
                      <span className="lineup-pool-pos">{POSITION_SHORT[player.primaryPosition]}</span>
                      <span className="lineup-pool-row-name">{player.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* 포지션 변경 모달 */}
      <ModalShell
        open={positionPickerForOrder !== null}
        title="포지션 변경"
        onClose={() => setPositionPickerForOrder(null)}
        panelClassName="lineup-pos-modal-panel"
        closeOnBackdrop
      >
        <div className="lineup-pos-grid">
          {POSITIONS.map((pos) => {
            const active = positionPickerForOrder !== null
              && slots[positionPickerForOrder - 1]?.position === pos;
            return (
              <button
                key={pos}
                type="button"
                className={`lineup-pos-choice ${active ? "lineup-pos-choice-active" : ""}`}
                onClick={() => {
                  if (positionPickerForOrder !== null) {
                    handleChangePosition(positionPickerForOrder, pos);
                  }
                }}
              >
                <strong>{POSITION_SHORT[pos]}</strong>
                <span>{POSITION_LABEL[pos]}</span>
                {active ? <Check size={12} strokeWidth={3} className="lineup-pos-check" /> : null}
              </button>
            );
          })}
        </div>
      </ModalShell>
    </AppShell>
  );
}
