// 엔진 버전. 엔진 로직(추첨 순서·룰 분기)이 바뀌면 bump.
// 캐싱 키에 포함되어, 버전 변경 시 기존 캐시가 무효화됨.
// 0.2.0: 좌/우 매치업(platoon) + 구장 효과(park factor) 추가 — atBat 추첨 로직 변경.
export const SIM_ENGINE_VERSION = "0.2.0" as const;
