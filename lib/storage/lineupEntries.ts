// 다중 라인업 슬롯 storage. localStorage에 단일 JSON 배열로 저장.
// 기존 ballplay:lineup:{teamId} / ballplay:lineup:pitcher:{teamId} 데이터는
// 첫 read 시 자동으로 entry 배열로 마이그레이션.

import { getTeam } from "@/lib/constants/teams";
import {
  LINEUP_STORAGE_PREFIX,
  MAX_LINEUP_ENTRIES,
  MY_LINEUPS_STORAGE_KEY,
  PITCHER_STORAGE_PREFIX,
  type LineupEntry,
  type SavedLineup,
  type SavedPitcherLineup
} from "@/lib/types/lineup";

// ============================================================
// Read
// ============================================================

export function loadLineupEntries(): LineupEntry[] {
  if (typeof window === "undefined") return [];
  // 마이그레이션 — 첫 호출이거나 새 키가 비어있으면 레거시 키 흡수
  migrateLegacyIfNeeded();
  try {
    const raw = window.localStorage.getItem(MY_LINEUPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LineupEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_LINEUP_ENTRIES);
  } catch {
    return [];
  }
}

export function getLineupEntry(entryId: string): LineupEntry | null {
  return loadLineupEntries().find((e) => e.entryId === entryId) ?? null;
}

// ============================================================
// Write
// ============================================================

// 같은 탭/윈도우 내 다른 컴포넌트가 라인업 변경을 즉시 알 수 있게 발사하는 이벤트.
// (storage 이벤트는 다른 탭에서만 발화 → 같은 탭 내 빌더 publish → 경기장 mount 케이스에선
//  무력. 이 커스텀 이벤트로 같은 탭에서도 reactive하게 재로드 가능.)
export const LINEUP_ENTRIES_CHANGED_EVENT = "ballplay:lineup-entries-changed";

export function saveLineupEntries(entries: LineupEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = entries.slice(0, MAX_LINEUP_ENTRIES);
    window.localStorage.setItem(MY_LINEUPS_STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new Event(LINEUP_ENTRIES_CHANGED_EVENT));
  } catch {
    // ignore quota
  }
}

export function upsertLineupEntry(entry: LineupEntry): LineupEntry[] {
  const current = loadLineupEntries();
  const idx = current.findIndex((e) => e.entryId === entry.entryId);
  const next = idx >= 0
    ? current.map((e, i) => (i === idx ? entry : e))
    : [...current, entry];
  saveLineupEntries(next);
  return next;
}

// 선택한 팀(슬롯)을 목록 맨 앞으로 이동 — 표시 순서(localStorage 배열 순서)만 바꾼다.
// 전적/랭킹/대표팀/가을야구는 entryId·teamId 기준이라 순서에 영향받지 않는다.
// 재진입 시 자동 선택 로직이 entries[0]을 고르므로, 마지막 선택 팀이 자동 선택된다.
// 없는 id면 무변경.
export function moveLineupEntryToTop(entryId: string): LineupEntry[] {
  const current = loadLineupEntries();
  const idx = current.findIndex((e) => e.entryId === entryId);
  if (idx <= 0) return current; // 없거나(-1) 이미 맨 앞(0)이면 무변경
  const next = [current[idx], ...current.slice(0, idx), ...current.slice(idx + 1)];
  saveLineupEntries(next);
  return next;
}

export function deleteLineupEntry(entryId: string): LineupEntry[] {
  const next = loadLineupEntries().filter((e) => e.entryId !== entryId);
  saveLineupEntries(next);
  return next;
}

export function renameLineupEntry(entryId: string, name: string): LineupEntry[] {
  const next = loadLineupEntries().map((e) =>
    e.entryId === entryId ? { ...e, name, updatedAt: new Date().toISOString() } : e
  );
  saveLineupEntries(next);
  return next;
}

// ============================================================
// 신규 entry 생성
// ============================================================

export function newEntryId(): string {
  // UUID v4 시도 후 폴백 (browser-only OK)
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyEntry(teamId: string, nameSuggestion?: string, nicknameForDefault?: string): LineupEntry {
  const team = getTeam(teamId);
  const now = new Date().toISOString();
  // 기본 팀명: "{닉네임}의 {팀 약칭}" (예: "야구노리의 두산").
  // 신규 생성에서는 같은 팀 중복을 막으므로 별도 번호를 붙이지 않는다.
  const trimmedNick = nicknameForDefault?.trim();
  const base = trimmedNick ? `${trimmedNick}의 ${team.shortName}` : team.name;
  return {
    entryId: newEntryId(),
    name: nameSuggestion?.trim() || base,
    teamId,
    batting: { teamId, slots: [], useDH: true, updatedAt: now },
    pitching: null,
    updatedAt: now,
    isPublished: false // 경기장 노출은 라인업 완성 후 등록한다. 팀 자체는 슬롯 생성 즉시 운영 시작.
  };
}

// ============================================================
// 마이그레이션 (legacy `ballplay:lineup:{teamId}` → 신 키)
// ============================================================

function migrateLegacyIfNeeded(): void {
  if (typeof window === "undefined") return;
  // 이미 신규 키가 있으면 마이그 불필요
  if (window.localStorage.getItem(MY_LINEUPS_STORAGE_KEY) !== null) return;

  const legacyBatting = new Map<string, SavedLineup>();
  const legacyPitching = new Map<string, SavedPitcherLineup>();
  const keysToRemove: string[] = [];

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;

    if (key.startsWith(PITCHER_STORAGE_PREFIX)) {
      const teamId = key.slice(PITCHER_STORAGE_PREFIX.length);
      try {
        const raw = window.localStorage.getItem(key);
        if (raw) legacyPitching.set(teamId, JSON.parse(raw) as SavedPitcherLineup);
      } catch {
        // skip
      }
      keysToRemove.push(key);
      continue;
    }

    // PITCHER prefix는 LINEUP prefix를 포함하므로 위 분기 먼저 처리.
    if (key.startsWith(LINEUP_STORAGE_PREFIX)) {
      const teamId = key.slice(LINEUP_STORAGE_PREFIX.length);
      // pitcher key는 위에서 처리됐으므로 이 시점엔 batting만 들어옴 (예외: "pitcher:..."가 LINEUP prefix로도 매치되는 케이스 차단)
      if (teamId.startsWith("pitcher:")) continue;
      try {
        const raw = window.localStorage.getItem(key);
        if (raw) legacyBatting.set(teamId, JSON.parse(raw) as SavedLineup);
      } catch {
        // skip
      }
      keysToRemove.push(key);
    }
  }

  if (legacyBatting.size === 0 && legacyPitching.size === 0) {
    // 마이그할 게 없어도 빈 신규 키를 만들어 "마이그 완료" 마킹
    saveLineupEntries([]);
    return;
  }

  // batting을 기준으로 entry 생성. pitching은 같은 teamId만 매칭.
  const entries: LineupEntry[] = [];
  const battingEntries = Array.from(legacyBatting.entries());
  for (const [teamId, batting] of battingEntries) {
    if (entries.length >= MAX_LINEUP_ENTRIES) break;
    const team = (() => {
      try {
        return getTeam(teamId);
      } catch {
        return null;
      }
    })();
    if (!team) continue;
    entries.push({
      entryId: newEntryId(),
      name: `${team.shortName} 라인업`,
      teamId,
      batting,
      pitching: legacyPitching.get(teamId) ?? null,
      updatedAt: batting.updatedAt ?? new Date().toISOString()
    });
  }

  saveLineupEntries(entries);

  // 마이그 성공 시 레거시 키 제거
  for (const k of keysToRemove) {
    try {
      window.localStorage.removeItem(k);
    } catch {
      // ignore
    }
  }
}

// ============================================================
// 공개 유도 모달 추적 — 한 슬롯당 한 번만 띄움
// ============================================================

const PUBLISH_PROMPT_KEY = "ballplay:publish-prompt-dismissed";

export function isPublishPromptDismissed(entryId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(PUBLISH_PROMPT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) && parsed.includes(entryId);
  } catch {
    return false;
  }
}

export function dismissPublishPrompt(entryId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(PUBLISH_PROMPT_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    const next = Array.isArray(parsed) ? parsed : [];
    if (next.includes(entryId)) return;
    next.push(entryId);
    window.localStorage.setItem(PUBLISH_PROMPT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

// 타자 9명 채움 안내 모달 — 선발 안 골랐을 때 한 번
const BATTER_DONE_PROMPT_KEY = "ballplay:batter-done-prompt-dismissed";

export function isBatterDonePromptDismissed(entryId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(BATTER_DONE_PROMPT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) && parsed.includes(entryId);
  } catch {
    return false;
  }
}

export function dismissBatterDonePrompt(entryId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(BATTER_DONE_PROMPT_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    const next = Array.isArray(parsed) ? parsed : [];
    if (next.includes(entryId)) return;
    next.push(entryId);
    window.localStorage.setItem(BATTER_DONE_PROMPT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}
