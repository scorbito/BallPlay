// 팀별 라인업 프리셋 storage. localStorage 전용 (DB 동기화 없음, 비로그인도 사용 가능).
// 프리셋 = 라인업 스냅샷(batting + pitching). 팀(teamId)당 최대 3개.
// 전적/랭킹/팀-슬롯 모델과 완전히 분리된 별도 저장소 — 적용은 빌더 UI에서 현재 편집본에만 반영.

import type { SavedLineup, SavedPitcherLineup } from "@/lib/types/lineup";

export type LineupPreset = {
  presetId: string;
  teamId: string;
  name: string;
  batting: SavedLineup;
  pitching: SavedPitcherLineup | null;
  updatedAt: string;
};

/** teamId → 프리셋 배열 (팀당 최대 3) */
type PresetStore = Record<string, LineupPreset[]>;

export const LINEUP_PRESETS_STORAGE_KEY = "ballplay:lineup-presets";
export const MAX_PRESETS_PER_TEAM = 3;

// 같은 탭 내 다른 컴포넌트가 프리셋 변경을 즉시 알 수 있게 하는 커스텀 이벤트.
// (storage 이벤트는 다른 탭에서만 발화하므로 같은 탭 reactive 갱신용으로 별도 발사.)
export const LINEUP_PRESETS_CHANGED_EVENT = "ballplay:lineup-presets-changed";

// ============================================================
// Read
// ============================================================

function readStore(): PresetStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LINEUP_PRESETS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PresetStore;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

export function loadPresets(teamId: string): LineupPreset[] {
  const store = readStore();
  const list = store[teamId];
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_PRESETS_PER_TEAM);
}

// ============================================================
// Write
// ============================================================

function writeStore(store: PresetStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LINEUP_PRESETS_STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new Event(LINEUP_PRESETS_CHANGED_EVENT));
  } catch {
    // ignore quota
  }
}

function newPresetId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type SavePresetResult =
  | { ok: true; preset: LineupPreset; presets: LineupPreset[] }
  | { ok: false; reason: "limit" };

/** 현재 라인업 스냅샷을 새 프리셋으로 저장. 팀당 3개를 초과하면 거부(가장 오래된 것 교체 안 함). */
export function savePreset(
  teamId: string,
  input: { name: string; batting: SavedLineup; pitching: SavedPitcherLineup | null }
): SavePresetResult {
  const store = readStore();
  const list = Array.isArray(store[teamId]) ? store[teamId].slice(0, MAX_PRESETS_PER_TEAM) : [];
  if (list.length >= MAX_PRESETS_PER_TEAM) {
    return { ok: false, reason: "limit" };
  }
  const now = new Date().toISOString();
  const preset: LineupPreset = {
    presetId: newPresetId(),
    teamId,
    name: input.name,
    batting: input.batting,
    pitching: input.pitching,
    updatedAt: now
  };
  const nextList = [...list, preset];
  writeStore({ ...store, [teamId]: nextList });
  return { ok: true, preset, presets: nextList };
}

/** 프리셋 이름 변경. presetId로 전 팀에서 탐색. */
export function renamePreset(presetId: string, name: string): void {
  const store = readStore();
  let changed = false;
  const now = new Date().toISOString();
  const next: PresetStore = {};
  for (const [teamId, list] of Object.entries(store)) {
    if (!Array.isArray(list)) continue;
    next[teamId] = list.map((p) => {
      if (p.presetId === presetId) {
        changed = true;
        return { ...p, name, updatedAt: now };
      }
      return p;
    });
  }
  if (changed) writeStore(next);
}

/** 프리셋 삭제. presetId로 전 팀에서 탐색. */
export function deletePreset(presetId: string): void {
  const store = readStore();
  let changed = false;
  const next: PresetStore = {};
  for (const [teamId, list] of Object.entries(store)) {
    if (!Array.isArray(list)) continue;
    const filtered = list.filter((p) => p.presetId !== presetId);
    if (filtered.length !== list.length) changed = true;
    next[teamId] = filtered;
  }
  if (changed) writeStore(next);
}
