"use client";

import { useEffect, useState } from "react";
import { Bookmark, Pencil, Plus, X } from "lucide-react";
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
  /** 빈 칸/저장 버튼 → 현재 라인업을 프리셋으로 저장 (이름 입력 모달은 부모가 띄움) */
  onSaveCurrent: () => void;
  /** 프리셋 칩 탭 → 적용 (부모가 덮어쓰기 확인 후 적용) */
  onApply: (preset: LineupPreset) => void;
  /** 프리셋 이름 변경 모달 열기 */
  onRename: (preset: LineupPreset) => void;
  /** 프리셋 삭제 확인 모달 열기 */
  onDelete: (preset: LineupPreset) => void;
};

/** 팀별 라인업 프리셋 바 — 현재 팀의 프리셋 3칸을 칩으로 노출.
 *  채워진 칸: 탭하면 적용 / ✎ 이름변경 / ✕ 삭제.
 *  빈 칸: "+ 저장"으로 현재 편집 중인 라인업을 새 프리셋으로 저장. */
export function LineupPresetBar({
  teamId,
  canSaveCurrent,
  onSaveCurrent,
  onApply,
  onRename,
  onDelete
}: LineupPresetBarProps) {
  const [presets, setPresets] = useState<LineupPreset[]>([]);

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

  const emptyCount = Math.max(0, MAX_PRESETS_PER_TEAM - presets.length);

  return (
    <div className="lineup-preset-bar" aria-label="라인업 프리셋">
      <span className="lineup-preset-bar-label">
        <Bookmark size={12} />
        프리셋
      </span>
      <div className="lineup-preset-chips">
        {presets.map((preset) => (
          <div key={preset.presetId} className="lineup-preset-chip">
            <button
              type="button"
              className="lineup-preset-chip-apply"
              onClick={() => onApply(preset)}
              title={`"${preset.name}" 라인업을 현재 편집본에 적용`}
            >
              <span className="lineup-preset-chip-name">{preset.name}</span>
            </button>
            <button
              type="button"
              className="lineup-preset-chip-icon"
              onClick={() => onRename(preset)}
              aria-label={`${preset.name} 이름 변경`}
              title="이름 변경"
            >
              <Pencil size={11} />
            </button>
            <button
              type="button"
              className="lineup-preset-chip-icon lineup-preset-chip-del"
              onClick={() => onDelete(preset)}
              aria-label={`${preset.name} 삭제`}
              title="삭제"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {emptyCount > 0 ? (
          <button
            type="button"
            className="lineup-preset-chip-add"
            onClick={onSaveCurrent}
            disabled={!canSaveCurrent}
            title={
              canSaveCurrent
                ? "현재 라인업을 프리셋으로 저장"
                : "저장할 라인업이 비어 있어요"
            }
          >
            <Plus size={12} />
            저장
          </button>
        ) : null}
      </div>
    </div>
  );
}
