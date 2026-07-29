// 첫 추측 유도용 추천 선수.
//
// 빈 격자만 보고 "뭘 입력해야 하지?"에서 멈추는 걸 막는 장치다. 워들에서 첫 수는
// 정답을 노리는 게 아니라 단서를 뽑는 프로브라, 아무 선수나 넣어도 되는데
// 처음 접하는 사람은 그걸 모른다. 탭 한 번으로 시작되게 만든다.
//
// 후보는 팀별 최다 출장 선수 + 상위 출장 선수로 구성했다(인지도 프록시).
// 10개 구단을 모두 넣어 특정 팀 팬에게만 익숙한 목록이 되지 않게 했다.

import { dayIndexFor } from "./daily";
import { findPlayerById, type WordlePlayer } from "./pool";

const STARTER_IDS: readonly string[] = [
  "ssg-2", // 박성한
  "kia-5", // 김도영
  "lg-23", // 오스틴
  "doosan-7", // 박찬호
  "samsung-0", // 디아즈
  "hanwha-30", // 페라자
  "lotte-13", // 전민재
  "kt-10", // 김현수
  "nc-7", // 김주원
  "kiwoom-12", // 김건희
  "ssg-54", // 최지훈
  "lg-17", // 박해민
  "kia-27", // 김호령
  "samsung-58" // 김지찬
];

/**
 * 해당 날짜의 추천 선수. 날짜별로 목록을 회전시켜 매일 같은 이름만 보이지 않게 한다.
 *
 * 정답과 같은 선수는 제외한다 — 추천을 탭했더니 1수에 끝나면 그날 퍼즐이 전원 무의미해진다.
 * 회전 때문에 "원래 나올 이름이 빠졌다"는 식의 역추론도 성립하지 않는다.
 */
export function getStarterSuggestions(
  dateISO: string,
  answerId: string | null,
  count = 3
): WordlePlayer[] {
  const pool = STARTER_IDS;
  const offset = ((dayIndexFor(dateISO) % pool.length) + pool.length) % pool.length;
  const picked: WordlePlayer[] = [];

  for (let step = 0; step < pool.length && picked.length < count; step++) {
    const id = pool[(offset + step) % pool.length];
    if (id === answerId) continue;
    const player = findPlayerById(id);
    // 로스터에서 빠진 선수(이적·은퇴)는 조용히 건너뛴다.
    if (player) picked.push(player);
  }

  return picked;
}
