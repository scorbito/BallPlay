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

export function saveLineupEntries(entries: LineupEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = entries.slice(0, MAX_LINEUP_ENTRIES);
    window.localStorage.setItem(MY_LINEUPS_STORAGE_KEY, JSON.stringify(trimmed));
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

export function createEmptyEntry(teamId: string, nameSuggestion?: string): LineupEntry {
  const team = getTeam(teamId);
  const now = new Date().toISOString();
  const sameTeamCount = loadLineupEntries().filter((e) => e.teamId === teamId).length;
  // 기본 팀명: KBO 정식 팀명. 동일 팀 여러 슬롯이면 #2, #3 식으로 분기.
  const defaultName = sameTeamCount > 0
    ? `${team.name} #${sameTeamCount + 1}`
    : team.name;
  return {
    entryId: newEntryId(),
    name: nameSuggestion?.trim() || defaultName,
    teamId,
    batting: { teamId, slots: [], useDH: true, updatedAt: now },
    pitching: null,
    updatedAt: now,
    isPublished: true // 디폴트 공개 — 사용자가 빌더에서 직접 비공개로 바꿀 수 있음
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
