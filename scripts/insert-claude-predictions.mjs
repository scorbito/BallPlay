// 2026-07-05 Claude 일일 예측 5건 INSERT. (claude 슬롯 전용 — 다른 provider 미변경)
// 선발 상대전적 과의존 반성 → 타선·불펜·홈·최근 흐름 종합 분석.
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

const GAME_DATE = "2026-07-05";
const PUBLISHED_AT = "2026-07-05T09:00:00+09:00";
// ⚠️ INSERT 직전 확인: 현재 세션 모델과 일치하는가?
const MODEL = "claude-opus-4-8";

const rows = [
  {
    // doosan(최민석) @ kiwoom(김윤하) — 고척
    game_id: "b3377316-f148-48bb-a73c-6b794d5233d4",
    predicted_winner_team_id: "doosan",
    confidence: 0.64,
    key_factor: "최민석 에이스 + 김윤하 피홈런 위험",
    one_liner:
      "두산 최민석이 평균 자책점 2점대 초반의 에이스로 키움 상대로도 강했던 반면 키움 선발 김윤하는 9이닝당 피홈런이 3개를 넘는 검증 부족 카드라, 두산이 타선 우위까지 더해 고척 원정에서 앞섭니다.",
    detailed_analysis:
      "선발과 타선이 모두 두산으로 크게 기우는 카드입니다. 두산 최민석(ERA 2.39, WHIP 1.18, HR9 0.31)은 피홈런이 거의 없는 에이스급 선발로 키움 상대 16.2이닝 평균 자책점 2.7로 강했습니다. 반면 키움 김윤하(ERA 6.75, 8이닝, HR9 3.38)는 1군 표본이 짧고 9이닝당 피홈런이 3개를 넘는 위험한 카드입니다. 타선은 두산 라인업(평균 .272, 출루율 .340, 장타력 .399)이 키움 라인업(평균 .253, 출루율 .336, 장타력 .369)의 리그 최하위 빈타를 앞섭니다. 불펜도 두산이 안정적입니다. 키움은 데이비슨 합류로 라인업에 변화를 줬지만 고척 홈 이점 외에는 두산을 넘어설 요소가 적습니다. 최민석의 에이스 등판과 김윤하의 피홈런 위험, 두산 타선 우위에 무게를 둬 0.64로 봅니다. 김윤하가 표본을 뒤엎는 호투를 하면 변수가 됩니다."
  },
  {
    // nc(테일러) @ kia(김태형) — 광주
    game_id: "2887af9e-be3b-4b2c-b999-1445c0194393",
    predicted_winner_team_id: "kia",
    confidence: 0.54,
    key_factor: "KIA 장타 타선 + 광주 홈",
    one_liner:
      "KIA가 김도영 중심의 시즌 장타력 최상위 타선과 광주 홈, 2위의 전력을 앞세워 앞섭니다. 다만 NC 테일러가 KIA 상대 평균 자책점 1점대로 강했던 점이 변수입니다.",
    detailed_analysis:
      "타선과 홈은 KIA, 선발 이력은 NC가 앞서는 박빙 카드입니다. 선발은 NC 테일러(ERA 4.48, HR9 0.34)가 KIA 상대 11이닝 평균 자책점 1.64로 강했던 반면, KIA 김태형(ERA 4.86, HR9 1.75)은 피홈런이 잦아 불안합니다. 그러나 타선에서 KIA가 앞섭니다. KIA 라인업(평균 .289, 출루율 .365, 장타력 .455, ISO .166)은 김도영·나성범·카스트로의 장타력이 리그 최상위로, NC 라인업(평균 .279, 출루율 .366, 장타력 .430)보다 한 방이 강합니다. KIA는 광주 홈 이점과 2위(0.587)의 전력을 갖췄고, 불펜도 안정적입니다. 김태형이 흔들려도 KIA 타선이 테일러의 피홈런 억제력을 넘어 화력을 낼 여지가 큽니다. KIA의 타선·홈·순위 우위에 살짝 무게를 둬 0.54의 박빙으로 봅니다. 테일러가 KIA전 강세를 이어가고 NC 타선이 폭발하면 곧장 뒤집힐 수 있습니다."
  },
  {
    // hanwha(류현진) @ lg(톨허스트) — 잠실
    game_id: "6ee9b095-038c-43a5-9a81-2cb673a5a2d9",
    predicted_winner_team_id: "hanwha",
    confidence: 0.57,
    key_factor: "류현진 에이스 + 한화 장타력 폭발",
    one_liner:
      "한화 류현진이 평균 자책점 2점대 후반에 볼넷이 거의 없는 최정상 에이스로 톨허스트보다 앞서고, 강백호·노시환의 한화 타선이 시즌 장타력 리그 1위로 폭발 중입니다. 다만 LG의 잠실 홈과 강한 불펜이 변수입니다.",
    detailed_analysis:
      "선발과 타선이 모두 한화로 기우는 카드입니다. 한화 류현진(ERA 2.67, WHIP 1.06, BB9 1.13)은 볼넷이 거의 없는 최정상 에이스로, LG 톨허스트(ERA 4.02, WHIP 1.23)를 평균 자책점에서 크게 앞섭니다. 타선은 한화 라인업(평균 .281, 출루율 .354, 장타력 .485, ISO .204)이 강백호·노시환·페라자의 장타력으로 시즌 장타력 리그 1위이고, LG 라인업(평균 .277, 출루율 .368, 장타력 .438)보다 한 방에서 앞섭니다. 다만 LG는 승률 1위(0.622)의 전력에 잠실 홈, 어제 필승조가 지켜낸 강한 불펜, 한화의 3연승을 저지한 흐름이 있습니다. 류현진의 에이스 등판과 한화 장타력에 무게를 둬 0.57로 봅니다. 톨허스트가 한화 장타를 억제하고 LG 불펜이 잠그면 접전이 됩니다."
  },
  {
    // samsung(양창섭) @ ssg(김건우) — 문학
    game_id: "7b2dd201-fe0c-4414-a4fc-e1ab1e00e46a",
    predicted_winner_team_id: "samsung",
    confidence: 0.6,
    key_factor: "삼성 타선·흐름 + SSG 8연패",
    one_liner:
      "2위 삼성이 출루율 높은 타선과 2연승 흐름을 앞세워 앞서고, SSG는 8연패 수렁에 김건우마저 평균 자책점 6점대로 불안합니다. 삼성이 문학 원정에서도 우위를 점합니다.",
    detailed_analysis:
      "타선과 흐름이 삼성으로 크게 기우는 카드입니다. 선발은 삼성 양창섭(ERA 4.37)이 SSG 상대 부진했던 이력이 있지만 표본이 작고, SSG 김건우(ERA 6.19, BB9 4.87)는 평균 자책점이 6점대에 제구가 불안합니다. 타선은 삼성 라인업(평균 .282, 출루율 .380, 장타력 .416)이 김지찬·구자욱 중심의 리그 최상위 출루 그룹으로, SSG 라인업(평균 .272, 출루율 .351, 장타력 .410)보다 출루에서 앞섭니다. 결정적인 건 흐름입니다. 삼성은 어제 SSG를 13-7로 역전하며 2연승, 2위로 1위 LG를 추격 중인 반면, SSG는 어제 실책 3개로 8연패 수렁에 빠져 분위기가 최악입니다. 삼성의 타선·흐름 우위와 김건우의 불안에 무게를 둬 0.60으로 봅니다. SSG가 문학 홈에서 연패를 끊고 삼성 마운드를 흔들면 변수가 됩니다."
  },
  {
    // lotte(박세웅) @ kt(사우어) — 수원
    game_id: "6ad8013e-9ab4-4036-91f6-8e8004cb70c0",
    predicted_winner_team_id: "lotte",
    confidence: 0.57,
    key_factor: "롯데 장타·불펜·연승 흐름 + KT 타선 부진",
    one_liner:
      "롯데가 시즌 장타력에서 KT를 앞서고 짠물 불펜과 함께 이틀 연속 KT를 완파한 상승세입니다. KT 타선이 최근 장타력이 크게 떨어진 점도 롯데에 유리합니다.",
    detailed_analysis:
      "선발이 비슷한 가운데 타선·불펜·흐름이 롯데로 기우는 카드입니다. 선발은 롯데 박세웅(ERA 4.75, K9 8.43)과 KT 사우어(ERA 4.48, WHIP 1.36)가 평균 자책점에서 비슷하고 상대 전적은 둘 다 없습니다. 타선은 롯데 라인업(평균 .288, 출루율 .342, 장타력 .432, ISO .144)이 최근 KT 라인업(평균 .274, 출루율 .364, 장타력 .376)보다 장타에서 크게 앞섭니다. KT는 시즌 내내 콘택트가 강했지만 최근 장타력이 .376까지 떨어진 상태입니다. 결정적인 건 흐름과 불펜입니다. 롯데는 어제 비슬리의 호투와 이이무라·최준용·김원중으로 이어지는 짠물 불펜으로 KT를 이틀 연속 완파하며 위닝 시리즈를 확보한 상승세입니다. 롯데의 장타력·불펜·연승 흐름에 무게를 두되, KT의 수원 홈과 반등 가능성을 인정해 0.57로 봅니다. KT 타선이 홈에서 살아나면 접전이 됩니다."
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
