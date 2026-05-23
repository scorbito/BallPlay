// 엔진 버전. 엔진 로직(추첨 순서·룰 분기)이 바뀌면 bump.
// 캐싱 키에 포함되어, 버전 변경 시 기존 캐시가 무효화됨.
export const SIM_ENGINE_VERSION = "0.1.1" as const;
