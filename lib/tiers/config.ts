// 계정 승수 등급(신인 → 주전 → … → 영구결번) 노출 플래그.
//
// false = 탈-게임 방향: 승수 기반 등급 뱃지·승급 모달을 전부 숨긴다.
//   - 데이터(bp_account_stats.wins)는 보존 — 나중에 되살리려면 true 로만 바꾸면 됨.
//   - 게이팅 지점은 딱 2곳: AccountTierBadge(뱃지 표시), TierUpHost(승급 모달).
//     5개 화면(마이/랭킹/홈기록/내팀/라인업랭킹)이 모두 AccountTierBadge를 거치므로
//     이 두 곳만 막으면 등급 노출이 일괄 사라진다.
export const SHOW_ACCOUNT_TIER: boolean = false;
