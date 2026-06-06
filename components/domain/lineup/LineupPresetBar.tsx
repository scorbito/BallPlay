"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, ChevronDown, Pencil, Plus, X } from "lucide-react";
import {
  LINEUP_PRESETS_CHANGED_EVENT,
  MAX_PRESETS_PER_TEAM,
  loadPresets,
  type LineupPreset
} from "@/lib/storage/lineupPresets";

type LineupPresetBarProps = {
  teamId: string;
  /** 현재 편집 중인 라인업에 저장할 게 하나라도 있는지 (빈 라인업 저장 방지용 hint) */
  canSaveCurrent: boolean;
  /** 드롭다운 열림 상태 — 팀 선택 드롭다운과 같은 패턴으로 부모가 제어 */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** 빈 칸/저장 버튼 → 현재 라인업을 프리셋으로 저장 (이름 입력 모달은 부모가 띄움) */
  onSaveCurrent: () => void;
  /** 프리셋 칩 탭 → 적용 (부모가 덮어쓰기 확인 후 적용) */
  onApply: (preset: LineupPreset) => void;
  /** 프리셋 이름 변경 모달 열기 */
  onRename: (preset: LineupPreset) => void;
  /** 프리셋 삭제 확인 모달 열기 */
  onDelete: (preset: LineupPreset) => void;
};

/** 팀별 라인업 프리셋 드롭다운 — 헤더의 팀 선택 드롭다운 옆 칩.
 *  칩 탭 → 패널 열림. 패널: 현재 팀의 프리셋(최대 3) 목록.
 *  각 항목 탭 → 적용 / ✎ 이름변경 / ✕ 삭제.
 *  3개 미만이면 "+ 현재 라인업 저장". 0개면 안내 + 저장 버튼. */
export function LineupPresetBar({
  teamId,
  canSaveCurrent,
  open,
  setOpen,
  onSaveCurrent,
  onApply,
  onRename,
  onDelete
}: LineupPresetBarProps) {
  const [presets, setPresets] = useState<LineupPreset[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // 팀 변경 + 같은 탭 프리셋 변경 이벤트에 reactive 하게 재로드.
  useEffect(() => {
    const refresh = () => setPresets(loadPresets(teamId));
    refresh();
    window.addEventListener(LINEUP_PRESETS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh); // 다른 탭 변경 반영
    return () => {
      window.removeEventListener(LINEUP_PRESETS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [teamId]);

  // 외부 클릭 시 드롭다운 닫기 (팀 선택 드롭다운과 동일 패턴)
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

  // ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  const canAddMore = presets.length < MAX_PRESETS_PER_TEAM;

  const handleSave = () => {
    setOpen(false);
    onSaveCurrent();
  };

  return (
    <div className="lineup-preset-picker" ref={rootRef}>
      <button
        type="button"
        className="lineup-preset-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        title="라인업 프리셋"
      >
        <Bookmark size={13} />
        <span className="lineup-preset-trigger-label">프리셋</span>
        {presets.length > 0 ? (
          <span className="lineup-preset-trigger-count">{presets.length}</span>
        ) : null}
        <ChevronDown size={14} className={open ? "lineup-slot-chevron-open" : ""} />
      </button>
      {open ? (
        <div className="lineup-preset-menu" role="menu" aria-label="라인업 프리셋">
          {presets.length === 0 ? (
            <p className="lineup-preset-empty">
              저장된 프리셋이 없어요. 현재 라인업을 저장해보세요.
            </p>
          ) : (
            <ul className="lineup-preset-list">
              {presets.map((preset) => (
                <li key={preset.presetId} className="lineup-preset-item-wrap">
                  <button
                    type="button"
                    role="menuitem"
                    className="lineup-preset-item"
                    onClick={() => {
                      setOpen(false);
                      onApply(preset);
                    }}
                    title={`"${preset.name}" 라인업을 현재 편집본에 적용`}
                  >
                    <Bookmark size={12} className="lineup-preset-item-icon" />
                    <span className="lineup-preset-item-name">{preset.name}</span>
                  </button>
                  <div className="lineup-preset-item-actions">
                    <button
                      type="button"
                      className="lineup-preset-item-btn"
                      aria-label={`${preset.name} 이름 변경`}
                      title="이름 변경"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpen(false);
                        onRename(preset);
                      }}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      className="lineup-preset-item-btn lineup-preset-item-btn-danger"
                      aria-label={`${preset.name} 삭제`}
                      title="삭제"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpen(false);
                        onDelete(preset);
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {canAddMore ? (
            <button
              type="button"
              className="lineup-preset-save"
              onClick={handleSave}
              disabled={!canSaveCurrent}
              title={
                canSaveCurrent
                  ? "현재 라인업을 프리셋으로 저장"
                  : "저장할 라인업이 비어 있어요"
              }
            >
              <Plus size={14} />
              현재 라인업 저장
            </button>
          ) : (
            <p className="lineup-preset-cap">프리셋은 팀당 최대 {MAX_PRESETS_PER_TEAM}개예요.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
