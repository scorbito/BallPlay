// KBO 구장별 효과. HR·안타 곱셈 factor.
// AI 매치 / 1000판 시뮬에서만 적용 — 공개매치는 parkId 미전달 → neutral 1.0.
// 값은 KBO 최근 3시즌 평균 park factor (대략치). 운영 데이터 누적 시 보정 가능.

export type ParkFactor = {
  /** HR 발생 확률 곱. 잠실·고척처럼 큰 구장은 <1, 사직·대팍은 >1 */
  hr: number;
  /** 1B/2B/3B 발생 확률 곱. 대체로 좌우 펜스 거리와 외야 깊이 반영 */
  hits: number;
};

export const NEUTRAL_PARK: ParkFactor = { hr: 1.0, hits: 1.0 };

/** KBO 9개 구장 + 임시 구장. key = games.stadium (한국어). */
export const PARK_FACTORS: Record<string, ParkFactor> = {
  사직: { hr: 1.1, hits: 1.03 },
  잠실: { hr: 0.92, hits: 0.97 },
  대전: { hr: 1.05, hits: 1.02 },
  광주: { hr: 1.0, hits: 1.0 },
  대구: { hr: 1.08, hits: 1.03 },
  수원: { hr: 1.02, hits: 1.01 },
  문학: { hr: 1.05, hits: 1.02 },
  창원: { hr: 0.98, hits: 0.99 },
  // 고척은 돔구장이라 바람 변수 없고 좌우 펜스 거리가 멀어 HR·장타 둘 다 깎임
  고척: { hr: 0.85, hits: 0.95 }
};

/** parkId (또는 stadium 이름) → factor. 미지정·매칭 실패 시 neutral. */
export function getParkFactor(parkId: string | null | undefined): ParkFactor {
  if (!parkId) return NEUTRAL_PARK;
  return PARK_FACTORS[parkId] ?? NEUTRAL_PARK;
}
