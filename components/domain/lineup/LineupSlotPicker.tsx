"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronDown, LogIn, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { TIER_LABEL, type UserTier } from "@/lib/auth/userTier";
import { getLineupSlotLimit } from "@/lib/auth/tierLimits";
import type { LineupEntry } from "@/lib/types/lineup";
import type { LineupStats } from "@/lib/supabase/query-parts/bpLineups";
import type { ArchivedTeam } from "@/lib/lineup/useArchivedTeams";

type LineupSlotPickerProps = {
  entries: LineupEntry[];
  specialEntries?: LineupEntry[];
  selectedEntryId: string | null;
  statsByEntryId: Record<string, LineupStats>;
  archivedTeams: ArchivedTeam[];
  lineupLimit: number;
  tier: UserTier;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSelect: (entryId: string) => void;
  onAddNew: () => void;
  onRename: (entryId: string) => void;
  onDelete: (entryId: string) => void;
};

/** 팀 슬롯 picker — 현재 팀 + 드롭다운으로 다른 팀 / 새 팀 / 이름 편집 / 삭제 */
export function LineupSlotPicker({
  entries,
  specialEntries = [],
  selectedEntryId,
  statsByEntryId,
  archivedTeams,
  lineupLimit,
  tier,
  open,
  setOpen,
  onSelect,
  onAddNew,
  onRename,
  onDelete
}: LineupSlotPickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const allEntries = [...entries, ...specialEntries];
  const currentEntry = allEntries.find((e) => e.entryId === selectedEntryId) ?? null;
  const currentIsSpecial = specialEntries.some((e) => e.entryId === selectedEntryId);

  // 외부 클릭 시 슬롯 드롭다운 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, setOpen]);

  return (
    <div className="lineup-slot-picker" ref={rootRef}>
      <button
        type="button"
        className="lineup-slot-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {currentEntry ? (
          <>
            {currentIsSpecial ? (
              <span className="lineup-special-mini-badge" aria-hidden="true">N</span>
            ) : (
              <TeamBadge teamId={currentEntry.teamId} size="sm" />
            )}
            <strong className="lineup-slot-trigger-name">{currentEntry.name}</strong>
          </>
        ) : (
          <strong className="lineup-slot-trigger-empty">팀을 만드세요</strong>
        )}
        <ChevronDown size={16} className={open ? "lineup-slot-chevron-open" : ""} />
      </button>
      {open ? (
        <ul className="lineup-slot-menu" role="listbox" aria-label="팀 슬롯">
          {entries.map((entry) => {
            const active = entry.entryId === selectedEntryId;
            const stats = statsByEntryId[entry.entryId];
            return (
              <li key={entry.entryId} className="lineup-slot-menu-item-wrap">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`lineup-slot-menu-item ${active ? "is-active" : ""}`}
                  onClick={() => {
                    onSelect(entry.entryId);
                    setOpen(false);
                  }}
                >
                  <TeamBadge teamId={entry.teamId} size="sm" />
                  <span className="lineup-slot-menu-name">{entry.name}</span>
                  <span className="lineup-slot-menu-record">
                    {stats && stats.matches > 0
                      ? `${stats.wins}승 ${stats.losses}패`
                      : "0승 0패"}
                  </span>
                  {entry.isPublished ? (
                    <span className="lineup-slot-menu-badge is-public" title="경기장 출전 중">출전</span>
                  ) : (
                    <span className="lineup-slot-menu-badge" title="필수 라인업 완성 후 출전할 수 있습니다">출전 준비</span>
                  )}
                </button>
                <div className="lineup-slot-menu-actions">
                  <button
                    type="button"
                    className="lineup-slot-action-btn"
                    aria-label="이름 변경"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRename(entry.entryId);
                      setOpen(false);
                    }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    className="lineup-slot-action-btn lineup-slot-action-btn-danger"
                    aria-label={stats && stats.matches > 0 ? "은퇴" : "삭제"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(entry.entryId);
                      setOpen(false);
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </li>
            );
          })}
          {/* 슬롯 여유 있으면 "새 팀 슬롯" (정상 추가) */}
          {specialEntries.length > 0 ? (
            <>
              <li className="lineup-slot-special-head">특별 라인업</li>
              {specialEntries.map((entry) => {
                const active = entry.entryId === selectedEntryId;
                return (
                  <li key={entry.entryId} className="lineup-slot-menu-item-wrap">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`lineup-slot-menu-item lineup-slot-menu-special ${active ? "is-active" : ""}`}
                      onClick={() => {
                        onSelect(entry.entryId);
                        setOpen(false);
                      }}
                    >
                      <span className="lineup-special-mini-badge" aria-hidden="true">
                        <Trophy size={13} />
                      </span>
                      <span className="lineup-slot-menu-name">{entry.name}</span>
                      <span className="lineup-slot-menu-record">타자 {entry.batting.slots.length}/9</span>
                      <span className="lineup-slot-menu-badge is-special">특별</span>
                    </button>
                  </li>
                );
              })}
            </>
          ) : null}

          {entries.length < lineupLimit ? (
            <li>
              <button
                type="button"
                className="lineup-slot-menu-item lineup-slot-menu-add"
                onClick={() => {
                  onAddNew();
                  setOpen(false);
                }}
              >
                <Plus size={14} />
                <span>새 팀 슬롯</span>
              </button>
            </li>
          ) : null}

          {/* 비로그인/익명 — 슬롯 여유와 무관하게 항상 "로그인해서 팀 추가" 노출
              (전환 유도). 로그인하면 5개까지. free/pro 가 한도 도달 시엔 캡 문구. */}
          {tier === "guest" ? (
            <li>
              <Link
                href={`/login?next=${encodeURIComponent("/play/lineup")}`}
                className="lineup-slot-menu-item lineup-slot-menu-add lineup-slot-menu-login"
                prefetch={false}
                onClick={() => setOpen(false)}
              >
                <LogIn size={14} />
                <span>로그인해서 팀 추가</span>
                <span className="lineup-slot-menu-login-hint">
                  로그인하면 {getLineupSlotLimit("free")}팀까지
                </span>
              </Link>
            </li>
          ) : entries.length >= lineupLimit ? (
            <li className="lineup-slot-menu-cap">
              {TIER_LABEL[tier]} 등급은 최대 {lineupLimit}팀까지 운영
            </li>
          ) : null}

          {/* 은퇴한 팀 — 읽기 전용. 전적은 보존되지만 편집/출전 불가. 슬롯 한도엔 미포함. */}
          {archivedTeams.length > 0 ? (
            <>
              <li className="lineup-slot-archived-head">은퇴한 팀</li>
              {archivedTeams.map((t) => {
                const s = t.stats;
                return (
                  <li key={t.entry.entryId} className="lineup-slot-archived-item">
                    <TeamBadge teamId={t.entry.teamId} size="sm" />
                    <span className="lineup-slot-menu-name">{t.entry.name}</span>
                    <span className="lineup-slot-menu-record">
                      {s && s.matches > 0 ? `${s.wins}승 ${s.losses}패` : "기록 없음"}
                    </span>
                    <span className="lineup-slot-menu-badge is-retired" title="은퇴한 팀">
                      은퇴
                    </span>
                  </li>
                );
              })}
            </>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
