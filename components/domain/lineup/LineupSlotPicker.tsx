"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronDown, LogIn, Pencil, Plus, Trash2 } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { TIER_LABEL, type UserTier } from "@/lib/auth/userTier";
import { getLineupSlotLimit } from "@/lib/auth/tierLimits";
import type { LineupEntry } from "@/lib/types/lineup";
import type { LineupStats } from "@/lib/supabase/query-parts/bpLineups";

type LineupSlotPickerProps = {
  entries: LineupEntry[];
  selectedEntryId: string | null;
  statsByEntryId: Record<string, LineupStats>;
  lineupLimit: number;
  tier: UserTier;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSelect: (entryId: string) => void;
  onAddNew: () => void;
  onRename: (entryId: string) => void;
  onDelete: (entryId: string) => void;
};

/** 라인업 슬롯 picker — 현재 슬롯 + 드롭다운으로 다른 슬롯 / 새 슬롯 / 이름 편집 / 삭제 */
export function LineupSlotPicker({
  entries,
  selectedEntryId,
  statsByEntryId,
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
  const currentEntry = entries.find((e) => e.entryId === selectedEntryId) ?? null;

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
            <TeamBadge teamId={currentEntry.teamId} size="sm" />
            <strong className="lineup-slot-trigger-name">{currentEntry.name}</strong>
          </>
        ) : (
          <strong className="lineup-slot-trigger-empty">슬롯을 만드세요</strong>
        )}
        <ChevronDown size={16} className={open ? "lineup-slot-chevron-open" : ""} />
      </button>
      {open ? (
        <ul className="lineup-slot-menu" role="listbox" aria-label="라인업 슬롯">
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
                    <span className="lineup-slot-menu-badge is-public" title="공개 중">공개</span>
                  ) : (
                    <span className="lineup-slot-menu-badge" title="비공개">비공개</span>
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
                    aria-label="삭제"
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
          {/* 슬롯 여유 있으면 "새 라인업 슬롯" (정상 추가) */}
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
                <span>새 라인업 슬롯</span>
              </button>
            </li>
          ) : null}

          {/* 비로그인/익명 — 슬롯 여유와 무관하게 항상 "로그인해서 슬롯 추가" 노출
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
                <span>로그인해서 슬롯 추가</span>
                <span className="lineup-slot-menu-login-hint">
                  로그인하면 {getLineupSlotLimit("free")}개까지
                </span>
              </Link>
            </li>
          ) : entries.length >= lineupLimit ? (
            <li className="lineup-slot-menu-cap">
              {TIER_LABEL[tier]} 등급은 최대 {lineupLimit}개까지 저장
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
