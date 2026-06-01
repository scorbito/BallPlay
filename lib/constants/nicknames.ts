/**
 * 익명/신규 가입자 디폴트 닉네임 생성기.
 *
 * UUID 앞자리만 쓰면 무미건조한 "야구팬7a2f8" 같은 이름이 되니까,
 * 야구 관련 단어 풀에서 무작위 형용사·명사를 골라 더 다채롭게 만든다.
 *
 * 단어 풀이 작으면 중복 위험이 있으므로 UUID 3자리를 뒤에 덧붙여
 * 충돌 가능성을 거의 0으로 만든다. (단어 조합 540 × 16^3 ≈ 220만)
 *
 * 예: "홈런타자8f3", "응원단장4b2", "직관러d92"
 */

const NICKNAME_NOUNS = [
  // 포지션/역할
  "타자", "투수", "포수", "유격수", "좌익수", "우익수", "중견수", "내야수",
  // 야구 용어
  "홈런왕", "안타왕", "타격왕", "도루왕", "삼진왕", "구원왕",
  "직관러", "응원단장", "치어리더", "구장지기", "1루수", "3루타",
  // 관전 정체성
  "야구팬", "야구덕후", "직관덕후", "야빠", "야알못",
  "구장러", "베이스볼러", "스타플레이어",
  // 분위기
  "끝내기왕", "역전왕", "선두타자", "마무리투수", "타점왕"
];

const NICKNAME_ADJECTIVES = [
  "불꽃", "강력한", "빠른", "용감한", "엄청난", "전설의",
  "무적의", "야성적인", "신비한", "초신성", "다크호스", "철벽",
  "막강", "쾌속", "최강", "초고속", "전력투구", "필승"
];

/**
 * 야구 단어 풀 + UUID 6자리 조합으로 디폴트 닉네임 생성.
 * @param uuid - Supabase auth.user.id (또는 임의의 문자열)
 * @returns 예: "불꽃홈런왕7a2"
 */
export function generateDefaultNickname(uuid: string): string {
  // UUID에서 일관된 시드 추출 — 같은 UUID는 항상 같은 닉네임 (재로그인 시 동일)
  const sanitized = uuid.replace(/-/g, "");
  const seed1 = parseInt(sanitized.slice(0, 4), 16) || 0;
  const seed2 = parseInt(sanitized.slice(4, 8), 16) || 0;
  const suffix = sanitized.slice(0, 3);

  const adj = NICKNAME_ADJECTIVES[seed1 % NICKNAME_ADJECTIVES.length];
  const noun = NICKNAME_NOUNS[seed2 % NICKNAME_NOUNS.length];

  return `${adj}${noun}${suffix}`;
}
