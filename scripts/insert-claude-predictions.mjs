// 2026-06-18 Claude 일일 예측 5건 INSERT. (claude 슬롯 전용 — 다른 provider 미변경)
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

const GAME_DATE = "2026-06-18";
const PUBLISHED_AT = "2026-06-18T09:00:00+09:00";
// ⚠️ INSERT 직전 확인: 현재 세션 모델과 일치하는가?
const MODEL = "claude-opus-4-8";

const rows = [
  {
    // kt(소형준) @ doosan(최민석) — 잠실
    game_id: "f032827f-712d-4f8f-bb0d-aea1790bc7a1",
    predicted_winner_team_id: "kt",
    confidence: 0.57,
    key_factor: "KT 리그 최강 출루 타선 + 최민석 볼넷 약점",
    one_liner:
      "두산 최민석이 평균 자책점 2점대의 호투형이지만 9이닝당 볼넷이 4개로 제구 기복이 있어, 출루율 리그 1위의 KT 타선이 사사구를 쌓아 공략하기 좋습니다. 안현민 복귀로 화력이 절정인 KT가 소형준의 안정된 선발까지 더해 잠실 원정에서 앞설 전망입니다.",
    detailed_analysis:
      "선발만 보면 박빙이지만 타선에서 KT가 앞섭니다. 두산 최민석(ERA 2.88, WHIP 1.24, K9 8.78, HR9 0.39)은 피홈런을 거의 내주지 않는 호투형이라 KT의 장타를 억제할 수 있지만, 9이닝당 볼넷이 4개로 제구 기복이 있는 점이 약점입니다. KT 소형준(ERA 3.69, WHIP 1.33, BB9 2.08)은 제구가 안정적이라 이닝을 책임질 카드입니다. 결정적 차이는 타선입니다. KT 라인업(평균 .311, 출루율 .401, 장타력 .444)은 안현민 복귀 후 출루율이 리그 1위까지 올라, 최민석의 볼넷을 골라 주자를 쌓기 좋은 구도입니다. 두산 라인업(평균 .274, 출루율 .366, 장타력 .413)도 양의지·카메론 중심으로 만만치 않지만, 누적 화력에서 KT에 밀립니다. 최민석이 볼넷을 줄이고 호투하면 두산 홈에서 충분히 가져갈 수 있어 박빙이지만, KT 타선의 깊이에 무게를 둬 0.57로 봅니다."
  },
  {
    // kiwoom(안우진) @ samsung(오러클린) — 대구
    game_id: "7c85856d-c387-4942-8627-864d644e229b",
    predicted_winner_team_id: "samsung",
    confidence: 0.60,
    key_factor: "삼성 타선 우위 vs 키움 리그 최약 화력",
    one_liner:
      "키움 안우진이 9이닝당 탈삼진 11개의 위력적인 구위로 삼성 타선을 묶을 수 있지만, 키움 타선은 장타력이 리그 최하위라 정작 득점으로 연결하기 어렵습니다. 오러클린이 안정적으로 버티는 삼성이 대구 홈에서 우위를 점할 전망입니다.",
    detailed_analysis:
      "선발 매치업만 보면 키움 안우진(ERA 3.82, WHIP 1.27, K9 11.18)이 9이닝당 탈삼진 11개의 압도적 구위로 삼성 타선을 한 경기 묶을 변수입니다. 삼성 오러클린(ERA 3.88, WHIP 1.23, K9 8.83)도 탈삼진과 제구가 안정적인 호투형이라 선발은 백중세입니다. 승부를 가르는 건 타선 격차입니다. 삼성 라인업(평균 .281, 출루율 .368, 장타력 .414)은 디아즈·최형우 중심으로 화력이 안정적인 반면, 키움 라인업(평균 .251, 출루율 .324, 장타력 .313, ISO .062)은 장타력이 리그 최하위라 안우진이 호투해도 그 경기를 득점으로 연결하기 어렵습니다. 즉 안우진이 삼성 타선을 묶더라도 키움이 오러클린을 상대로 점수를 뽑지 못하면 승리로 잇기 힘든 구도입니다. 대구 홈과 시즌 1위의 전력을 더해 삼성 쪽에 0.60으로 기웁니다."
  },
  {
    // hanwha(에르난데스) @ nc(테일러) — 창원
    game_id: "50a3bade-262c-40a4-b891-f1068acf9bd9",
    predicted_winner_team_id: "nc",
    confidence: 0.53,
    key_factor: "NC 홈·타선 흐름 + 양 선발 평범",
    one_liner:
      "에르난데스와 테일러 모두 평균 자책점 4~5점대의 평범한 선발이라 타선 싸움으로 흐를 공산이 큰데, 최근 타격이 살아난 NC가 창원 홈에서 근소하게 앞섭니다. 한화는 식었던 방망이를 깨워야 시리즈를 가져갈 수 있습니다.",
    detailed_analysis:
      "선발에서 뚜렷한 우위를 가린 팀이 없습니다. 한화 에르난데스(ERA 4.03, WHIP 1.41)가 NC 테일러(ERA 4.91, WHIP 1.41)보다 자책점은 약간 낮지만, 둘 다 이닝당 주자가 많은 평범한 카드라 불펜 싸움으로 넘어갈 가능성이 큽니다. 그래서 승부는 타선과 홈에서 갈린다고 봅니다. NC 라인업(평균 .284, 출루율 .362, 장타력 .428)은 박민우·박건우 중심으로 최근 타격이 살아난 흐름이고, 한화 라인업(평균 .269, 출루율 .352, 장타력 .404)은 노시환의 홈런처럼 한 방은 있지만 전반적으로 식어 6위로 처진 상태입니다. 창원 홈 이점과 최근 타격 흐름에서 NC에 아주 살짝 무게를 둬 0.53으로 봅니다. 한화 중심타선(강백호·노시환·페라자)이 살아나면 전력상 우위인 한화로 곧장 기울 수 있어 박빙입니다."
  },
  {
    // lg(톨허스트) @ kia(양현종) — 광주
    game_id: "185be50d-2170-4769-8aa1-e6e3229df918",
    predicted_winner_team_id: "lg",
    confidence: 0.59,
    key_factor: "톨허스트 제구 우위 + KIA 타선 침체",
    one_liner:
      "LG 톨허스트가 9이닝당 볼넷 2개대의 안정된 제구로, 볼넷과 피홈런이 모두 많은 KIA 양현종보다 단일 경기 신뢰도가 높습니다. 최근 6경기 팀 타율이 1할대로 식은 KIA를 상대로 출루율 상위의 LG 타선이 광주 원정에서도 앞서갈 전망입니다.",
    detailed_analysis:
      "선발과 타선 흐름이 모두 LG로 기웁니다. LG 톨허스트(ERA 3.99, WHIP 1.20, BB9 2.44)는 9이닝당 볼넷이 2개대로 제구가 안정적이라 이닝을 길게 끌 수 있는 반면, KIA 양현종(ERA 4.32, WHIP 1.44, BB9 4.17, HR9 1.54)은 볼넷과 피홈런을 함께 내주는 기복형이라 LG의 출루형 상위 타선에 빅이닝을 내줄 위험이 있습니다. 타선도 LG가 낫습니다. LG 라인업(평균 .281, 출루율 .373)은 홍창기·오스틴 중심의 출루가 안정적인 반면, KIA 라인업(평균 .254, 출루율 .331)은 최근 6경기 팀 타율이 1할대로 떨어져 윤도현을 1번에 올리는 등 타순을 흔들 만큼 침체돼 있습니다. 다만 20홈런의 김도영과 나성범의 장타력은 양현종을 받쳐 한 방으로 분위기를 바꿀 수 있고 광주 홈 이점도 있습니다. 그럼에도 선발 제구 우위와 타선 흐름에서 LG 쪽에 0.59로 기웁니다."
  },
  {
    // lotte(로드리게스) @ ssg(타케다) — 문학
    game_id: "4e20a640-4966-46e3-a706-8c2fc4a9a2dd",
    predicted_winner_team_id: "ssg",
    confidence: 0.56,
    key_factor: "양 선발 불안 → SSG 장타력 + 홈 이점",
    one_liner:
      "SSG 타케다가 평균 자책점 7점대의 극도로 불안한 선발이지만, 롯데 로드리게스도 피홈런이 잦은 기복형이라 화력전이 예상됩니다. 최정·김재환의 장타력을 갖춘 SSG가 문학 홈에서 한 발 앞섭니다.",
    detailed_analysis:
      "양 선발이 모두 불안해 타선 싸움으로 흐를 카드입니다. SSG 타케다(ERA 7.52, WHIP 1.94, BB9 4.78)는 이닝당 주자가 2개에 육박하는 극도로 불안한 상태라 롯데가 초반 점수를 낼 여지가 있지만, 롯데 로드리게스(ERA 5.17, WHIP 1.45, K9 9.76, HR9 1.44)도 9이닝당 피홈런이 1.4개로 잦아 SSG의 장타에 노출되기 쉽습니다. 결국 어느 타선이 상대 불안을 더 크게 응징하느냐인데, 여기서 SSG가 앞섭니다. SSG 라인업(평균 .285, 출루율 .364, 장타력 .460, ISO .175)은 최정·김재환·에레디아·고명준의 장타력이 리그 상위권이라 로드리게스의 피홈런을 한 방으로 응징할 힘이 크고, 롯데 라인업(평균 .268, 출루율 .330, 장타력 .412)은 콘택트는 있어도 장타에서 밀립니다. 타케다가 워낙 나빠 롯데가 가져갈 변수도 있지만, 장타력 우위와 문학 홈에 무게를 둬 SSG 쪽에 0.56으로 기웁니다."
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
