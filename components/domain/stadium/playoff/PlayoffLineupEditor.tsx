"use client";

import { useEffect, useMemo, useState } from "react";
import { ModalShell } from "@/components/common/ModalShell";
import { Button } from "@/components/common/Button";
import { useAppState } from "@/lib/state/AppState";
import { getRoster } from "@/lib/rosters";
import { loadLineupEntries } from "@/lib/storage/lineupEntries";
import { updatePlayoffLineup } from "@/lib/actions/playoff";
import {
  PITCHER_STARTER_INDEX,
  POSITION_SHORT,
  formatHandBadge,
  type Player,
  type Position,
  type SavedLineup,
  type SavedPitcherLineup,
  type LineupOrder
} from "@/lib/types/lineup";
import type { PlayoffRun } from "@/lib/supabase/query-parts/bpPlayoff";

type Props = {
  open: boolean;
  run: PlayoffRun;
  onClose: () => void;
  onSaved: (run: PlayoffRun) => void;
};

type OrderItem = { playerId: string; position: Position };

function handLabel(p: Player | undefined | null): string {
  if (!p) return "";
  return formatHandBadge(p)?.label ?? "";
}

/** 플레이오프 전용 임시 라인업 편집 — 타순 탭-스왑 + 선발 교체. 실제 팀 무영향. */
export function PlayoffLineupEditor({ open, run, onClose, onSaved }: Props) {
  const { showToast } = useAppState();
  const teamId = run.teamId;
  const playersById = useMemo(
    () => new Map(getRoster(teamId).map((p) => [p.id, p])),
    [teamId]
  );

  const [order, setOrder] = useState<OrderItem[]>([]);
  const [pitcherSlots, setPitcherSlots] = useState<(string | null)[]>([]);
  const [useDH, setUseDH] = useState(true);
  const [swapSel, setSwapSel] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // open 시 임시본(state.myLineup) 또는 팀 현재 라인업으로 초기화.
  useEffect(() => {
    if (!open) return;
    let src = run.state.myLineup ?? null;
    if (!src) {
      const e = loadLineupEntries().find((x) => x.entryId === run.state.myEntryId);
      if (e?.pitching) src = { batting: e.batting, pitching: e.pitching };
    }
    if (!src) {
      showToast("라인업을 불러올 수 없어요.");
      onClose();
      return;
    }
    const sorted = [...src.batting.slots].sort((a, b) => a.order - b.order);
    setOrder(sorted.map((s) => ({ playerId: s.playerId, position: s.position })));
    setPitcherSlots([...src.pitching.slots]);
    setUseDH(src.batting.useDH);
    setSwapSel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, run]);

  const onRowTap = (i: number) => {
    if (swapSel === null) {
      setSwapSel(i);
      return;
    }
    if (swapSel === i) {
      setSwapSel(null);
      return;
    }
    setOrder((prev) => {
      const next = [...prev];
      [next[i], next[swapSel]] = [next[swapSel], next[i]];
      return next;
    });
    setSwapSel(null);
  };

  const swapStarter = (slotIdx: number) => {
    setPitcherSlots((prev) => {
      const next = [...prev];
      [next[PITCHER_STARTER_INDEX], next[slotIdx]] = [next[slotIdx], next[PITCHER_STARTER_INDEX]];
      return next;
    });
  };

  const handleSave = () => {
    if (order.length !== 9) {
      showToast("타순이 9명이 아니에요.");
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const batting: SavedLineup = {
      teamId,
      useDH,
      updatedAt: now,
      slots: order.map((o, idx) => ({
        order: (idx + 1) as LineupOrder,
        playerId: o.playerId,
        position: o.position
      }))
    };
    const pitching: SavedPitcherLineup = { teamId, slots: pitcherSlots, updatedAt: now };
    void (async () => {
      const res = await updatePlayoffLineup({ runId: run.id, batting, pitching });
      setSaving(false);
      if (res.ok) {
        onSaved(res.run);
        onClose();
      } else {
        showToast(res.error);
      }
    })();
  };

  const starterId = pitcherSlots[PITCHER_STARTER_INDEX];
  const starter = starterId ? playersById.get(starterId) : null;
  const bullpen = pitcherSlots
    .map((id, idx) => ({ id, idx }))
    .filter((x) => x.idx !== PITCHER_STARTER_INDEX && x.id);

  return (
    <ModalShell open={open} title="내 라인업 수정" onClose={onClose} panelClassName="playoff-edit-modal-panel">
      <div className="playoff-edit">
        <p className="playoff-edit-hint">
          상대를 보고 타순을 바꾸거나 선발을 교체하세요. 실제 팀에는 영향이 없어요.
        </p>

        <div className="playoff-edit-section-title">
          타순 <span>두 선수를 차례로 누르면 순서가 바뀌어요</span>
        </div>
        <ul className="playoff-edit-order">
          {order.map((o, i) => {
            const p = playersById.get(o.playerId);
            return (
              <li key={o.playerId}>
                <button
                  type="button"
                  className={`playoff-edit-row ${swapSel === i ? "is-sel" : ""}`}
                  onClick={() => onRowTap(i)}
                >
                  <span className="playoff-edit-num">{i + 1}</span>
                  <span className="playoff-edit-name">{p?.name ?? o.playerId}</span>
                  <span className="playoff-edit-pos">{POSITION_SHORT[o.position] ?? o.position}</span>
                  <span className="playoff-edit-hand">{handLabel(p)}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="playoff-edit-section-title">선발 투수</div>
        <div className="playoff-edit-starter">{starter?.name ?? "-"}</div>
        {bullpen.length > 0 ? (
          <>
            <div className="playoff-edit-bullpen-label">불펜에서 선발로 교체</div>
            <div className="playoff-edit-bullpen">
              {bullpen.map(({ id, idx }) => {
                const p = id ? playersById.get(id) : null;
                return (
                  <button
                    key={id}
                    type="button"
                    className="playoff-edit-pitcher"
                    onClick={() => swapStarter(idx)}
                  >
                    {p?.name ?? id}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        <Button disabled={saving} onClick={handleSave}>
          {saving ? "저장 중" : "저장하기"}
        </Button>
      </div>
    </ModalShell>
  );
}
