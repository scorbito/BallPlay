// 라인업 빌더 onboarding 안내 모달 표시 이력 (localStorage).
// 슬롯(entryId) 단위로 step별 "이미 봤음" 플래그를 저장 → 같은 슬롯에선 안내 중복 X.
//   - step0: 첫 진입 안내 ("대기 풀에서 9명을 골라 타순을 채우세요") — 디바이스당 1회
//   - step1: 타순 9명 완성 직후 안내 ("필수 투수를 선택하면 공개 가능")
//   - step2: 선발/마무리/필수 불펜 선택 직후 안내 ("이제 공개해서 경기장에서 가상경기 가능")

const STORAGE_KEY = "ballplay:lineup-guides-seen";

// step0은 entry 무관(디바이스 1회) — 전용 sentinel id로 동일 데이터 구조 재사용.
const STEP0_GLOBAL_ID = "__device__";

type SeenMap = {
  step0?: string[];
  step1?: string[];
  step2?: string[];
};

function read(): SeenMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SeenMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(map: SeenMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // QuotaExceeded 등은 무시 — 안내는 다시 떠도 무해
  }
}

export type GuideStep = "step0" | "step1" | "step2";

export function hasSeenGuide(step: GuideStep, entryId: string): boolean {
  const map = read();
  return !!map[step]?.includes(entryId);
}

export function markGuideSeen(step: GuideStep, entryId: string) {
  const map = read();
  const list = map[step] ?? [];
  if (list.includes(entryId)) return;
  write({ ...map, [step]: [...list, entryId] });
}

/** step0(첫 진입 안내)는 디바이스 1회 노출 — entryId 무관 sentinel 사용. */
export function hasSeenStep0(): boolean {
  return hasSeenGuide("step0", STEP0_GLOBAL_ID);
}

export function markStep0Seen(): void {
  markGuideSeen("step0", STEP0_GLOBAL_ID);
}
