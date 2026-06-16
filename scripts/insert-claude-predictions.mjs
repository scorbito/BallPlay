// 2026-06-17 Claude 일일 예측 5건 INSERT. (claude 슬롯 전용 — 다른 provider 미변경)
// ai_provider='claude', published_at=09:00 KST.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
    })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const GAME_DATE = "2026-06-17";
const PUBLISHED_AT = "2026-06-17T09:00:00+09:00";
// ⚠️ INSERT 직전 확인: 현재 세션 모델과 일치하는가?
const MODEL = "claude-opus-4-8";

const rows = [
  {
    // kiwoom(박준현) @ samsung(최원태) — 대구
    game_id: "5e4e05f4-7773-432c-bc2c-eae1e5e94188",
    predicted_winner_team_id: "samsung",
    confidence: 0.63,
    key_factor: "삼성 타선 우위 + 박준현 극심한 제구 난조",
    one_liner:
      "키움 박준현이 평균 자책점은 낮지만 9이닝당 볼넷이 6개를 넘는 극심한 제구 불안형이라, 출루율 리그 상위의 삼성 타선이 볼넷을 골라 빅이닝을 만들기 좋은 구도입니다. 시즌 1위 삼성이 대구 홈에서 연승 흐름을 이어갈 가능성이 큽니다.",
    detailed_analysis:
      "양 선발 모두 볼넷이 많아 타선 싸움으로 흐를 카드입니다. 삼성 최원태(ERA 4.83, WHIP 1.53, BB9 3.92)도 제구가 정교하진 않지만, 키움 박준현(ERA 3.51, WHIP 1.59, BB9 6.22)은 9이닝당 볼넷이 6개를 넘어 자멸 위험이 훨씬 큽니다. 결정적 차이는 타선입니다. 삼성 라인업(평균 .287, 출루율 .374, 장타력 .422)은 디아즈·최형우 중심으로 출루와 콘택트가 안정적이라 박준현의 볼넷을 응징하기 좋고, 키움 라인업(평균 .248, 출루율 .337, 장타력 .341)은 장타력이 리그 최하위권이라 최원태의 제구 난조를 큰 점수로 연결하기 어렵습니다. 삼성은 디아즈의 부활과 이틀 연속 역전승으로 분위기가 올라 있고 대구 홈에서 시즌 1위의 안정감을 더합니다. 안우진이 아닌 박준현 등판이라 키움 카드가 약한 점도 삼성에 유리해 0.63으로 봅니다."
  },
  {
    // lotte(박세웅) @ ssg(김건우) — 문학
    game_id: "0649dc96-3770-4e96-8004-a680040ca8bf",
    predicted_winner_team_id: "ssg",
    confidence: 0.54,
    key_factor: "양 선발 불안 → SSG 최정 장타 + 홈 이점",
    one_liner:
      "박세웅과 김건우 모두 평균 자책점 5점대의 불안한 선발이라 타선 싸움으로 흐를 공산이 큰데, 최정의 장타력이 살아 있는 SSG가 문학 홈에서 근소하게 앞섭니다. 다만 양 팀 화력이 비슷해 박빙이 예상됩니다.",
    detailed_analysis:
      "선발에서 뚜렷한 우위를 가린 팀이 없습니다. 롯데 박세웅(ERA 5.15, WHIP 1.58, BB9 4.31)과 SSG 김건우(ERA 5.66, WHIP 1.53, BB9 4.79, HR9 1.16) 모두 이닝당 주자가 많고 볼넷이 잦아 길게 끌기보다 불펜 싸움으로 넘어갈 가능성이 큽니다. 그래서 승부는 타선과 홈에서 갈린다고 봅니다. SSG 라인업(평균 .277, 출루율 .358, 장타력 .426)은 홈런 1위 경쟁 중인 최정의 장타력이 살아 있어 김건우의 부진을 만회할 화력이 되고, 롯데 라인업(평균 .285, 출루율 .339, 장타력 .407)도 콘택트는 좋지만 장타에서 한 끗 밀립니다. 롯데는 전민재의 만루포처럼 한 방 변수가 있고 문학에서 최근 SSG와 접전을 벌이고 있어, 시리즈 흐름은 팽팽합니다. 문학 홈과 최정의 장타력에 아주 살짝 무게를 둬 SSG 쪽에 0.54로 기웁니다."
  },
  {
    // lg(장현식) @ kia(올러) — 광주
    game_id: "c5f5f2bc-3ae2-4b2d-8998-3017d215d008",
    predicted_winner_team_id: "kia",
    confidence: 0.56,
    key_factor: "올러 에이스 구위 vs LG 불펜데이(장현식)",
    one_liner:
      "KIA 올러가 이닝당 주자 0.95의 리그 정상급 에이스인 반면, LG는 정규 선발이 아닌 장현식을 올리는 불펜데이로 맞서 선발 안정성에서 크게 밀립니다. 20호 홈런의 김도영이 버틴 KIA 타선이 광주 홈에서 우위를 점할 전망입니다.",
    detailed_analysis:
      "선발 매치업이 이 경기의 핵심입니다. KIA 올러(ERA 2.66, WHIP 0.95, K9 9.52)는 이닝당 주자를 1명 아래로 묶고 탈삼진까지 갖춘 리그 정상급 에이스입니다. 반면 LG는 정규 선발이 빠져 롱릴리프 장현식(ERA 4.30, HR9 1.23)을 올리는 불펜데이로 맞서, 경기 대부분을 불펜으로 끌어야 하는 부담이 큽니다. 타선은 LG가 낫습니다. LG 라인업(평균 .283, 출루율 .380)은 홍창기·오스틴 중심의 출루 능력이 리그 최상위라 올러를 상대로도 주자를 쌓을 수 있고, KIA 라인업(평균 .252, 출루율 .314)은 최근 타격이 식었지만 20호 홈런의 김도영과 나성범의 장타력(장타력 .405)이 한 방을 갖췄습니다. LG가 출루로 올러를 흔들면 1위의 저력이 나올 수 있지만, 올러의 억제력과 LG의 불펜데이 부담, 광주 홈 이점을 더 무겁게 보아 KIA 쪽에 0.56으로 기웁니다."
  },
  {
    // hanwha(류현진) @ nc(라일리) — 창원
    game_id: "818ac493-7e1c-4ff0-a237-de08e5212b44",
    predicted_winner_team_id: "hanwha",
    confidence: 0.56,
    key_factor: "류현진 안정감 + 한화 장타 vs 라일리 피홈런",
    one_liner:
      "한화 류현진과 NC 라일리가 맞붙는 에이스 빅매치인데, 9이닝당 볼넷 1.3개의 류현진이 탈삼진형 라일리보다 안정감에서 앞섭니다. 강백호·노시환의 장타력이 라일리의 잦은 피홈런을 응징하면 한화가 우위를 가져갈 수 있습니다.",
    detailed_analysis:
      "양 팀 에이스가 맞붙는 빅매치입니다. 한화 류현진(ERA 2.84, WHIP 1.03, BB9 1.29, HR9 0.52)은 9이닝당 볼넷 1.3개에 피홈런까지 적은 최상급 제구가 강점이고, NC 라일리(ERA 3.40, WHIP 1.08, K9 12.47, HR9 1.59)는 9이닝당 탈삼진이 12개를 넘는 파워형이지만 피홈런이 잦은 점이 약점입니다. 이 약점이 승부처입니다. 한화 라인업(평균 .284, 출루율 .364, 장타력 .442, ISO .158)은 강백호·노시환·페라자의 장타력이 NC 라인업(평균 .279, 출루율 .353, 장타력 .422)보다 앞서, 라일리의 실투를 한 방으로 응징할 힘이 큽니다. 다만 라일리의 탈삼진이 폭발하면 한화 타선이 묶일 수 있고, 한화는 최근 타격이 식어 6위로 처진 데다 전날 NC에 패해 분위기가 무겁고 경기도 창원 원정입니다. 그래도 류현진의 안정감과 중심타선의 장타력에 무게를 둬 한화 쪽에 0.56으로 살짝 기웁니다."
  },
  {
    // kt(사우어) @ doosan(타카다) — 잠실
    game_id: "d0a414db-7141-4e63-a235-c6cf0d20770f",
    predicted_winner_team_id: "kt",
    confidence: 0.64,
    key_factor: "KT 리그 최강 타선 + 타카다 제구 붕괴",
    one_liner:
      "두산 타카다가 표본 4이닝에 9이닝당 볼넷이 11개에 달하는 제구 붕괴 상태인 반면, KT는 안현민 복귀로 출루율 리그 최상위의 타선을 갖췄습니다. 사우어가 이닝만 버텨주면 KT가 잠실 원정에서 대량 득점으로 앞서갈 가능성이 큽니다.",
    detailed_analysis:
      "선발과 타선 모두 KT로 크게 기우는 카드입니다. KT 사우어(ERA 4.42, WHIP 1.30, BB9 3.59)는 화려하진 않아도 이닝을 책임지는 카드인 반면, 두산 타카다(ERA 11.25, 4이닝, BB9 11.25)는 1군 표본이 4이닝에 불과하고 9이닝당 볼넷이 11개에 달하는 제구 붕괴 상태라, 등판 즉시 두산이 불펜데이로 전환할 가능성이 높습니다. 여기에 KT 타선이 절정입니다. KT 라인업(평균 .298, 출루율 .399, 장타력 .453)은 안현민의 복귀로 출루율이 리그 최상위까지 올라, 타카다의 볼넷과 두산 불펜을 상대로 빅이닝을 만들기 좋은 구도입니다. 두산 라인업(평균 .287, 출루율 .367, 장타력 .420)도 양의지·카메론 중심으로 사우어를 공략할 힘은 있지만, 선발 매치업의 격차가 워낙 커 잠실 홈 이점만으로 메우기 어렵습니다. 선발·타선 우위로 KT 쪽에 0.64로 무게를 둡니다."
  }
];

console.log(`Inserting ${rows.length} predictions as ai_provider='claude' (${MODEL}) for ${GAME_DATE}...`);

let okCount = 0;
let failCount = 0;
for (const r of rows) {
  const payload = {
    game_id: r.game_id,
    game_date: GAME_DATE,
    ai_provider: "claude",
    model_name: MODEL,
    predicted_winner_team_id: r.predicted_winner_team_id,
    confidence: r.confidence,
    key_factor: r.key_factor,
    one_liner: r.one_liner,
    detailed_analysis: r.detailed_analysis,
    published_at: PUBLISHED_AT
  };
  const { data, error } = await sb
    .from("bp_ai_predictions")
    .insert(payload)
    .select("id, game_id, predicted_winner_team_id, confidence")
    .single();
  if (error) {
    console.log(`  ✗ ${r.game_id} → ${r.predicted_winner_team_id}: ${error.message}`);
    failCount++;
  } else {
    console.log(`  ✓ ${data.predicted_winner_team_id.padEnd(8)} conf=${data.confidence} | row id=${data.id}`);
    okCount++;
  }
}

console.log(`\n결과: 성공 ${okCount}건 / 실패 ${failCount}건`);
