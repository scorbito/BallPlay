// 2026-06-20 Claude 일일 예측 5건 INSERT. (claude 슬롯 전용 — 다른 provider 미변경)
// 시즌 스탯 베이스 + 상대팀 전적(bp_pitcher_vs_team_stats) 보조 반영.
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

const GAME_DATE = "2026-06-20";
const PUBLISHED_AT = "2026-06-20T09:00:00+09:00";
// ⚠️ INSERT 직전 확인: 현재 세션 모델과 일치하는가?
const MODEL = "claude-opus-4-8";

const rows = [
  {
    // doosan(곽빈) @ lg(임찬규) — 잠실
    game_id: "02da3571-0e3a-453a-af94-4a6ffc0c0926",
    predicted_winner_team_id: "lg",
    confidence: 0.57,
    key_factor: "임찬규의 두산전 강세 + LG 타선·홈",
    one_liner:
      "두산 곽빈이 탈삼진 능력은 앞서지만, LG 임찬규가 두산 상대 통산 평균 자책점 1.54로 유독 강했고 LG 타선의 장타력과 잠실 홈 이점까지 더해집니다. 어제 역전승으로 1위를 지킨 LG가 흐름을 이어갈 전망입니다.",
    detailed_analysis:
      "선발 색깔이 다른 카드입니다. 두산 곽빈(ERA 3.22, WHIP 1.33, K9 10.65)은 9이닝당 탈삼진 10개를 넘는 파워형이고, LG 임찬규(ERA 3.48, WHIP 1.48, K9 4.73)는 탈삼진은 적어도 맞춰 잡으며 실점을 억제하는 유형입니다. 상대팀 전적이 임찬규에 힘을 싣습니다. 임찬규는 두산 상대 2선발 11.2이닝에서 평균 자책점 1.54, 이닝당 주자 1.29로 강세를 보여 왔고, 곽빈은 LG 상대 기록이 없습니다. 타선도 LG가 낫습니다. LG 라인업(평균 .286, 출루율 .363, 장타력 .441, ISO .155)은 오스틴·문보경 중심의 장타력이 두산 라인업(평균 .262, 출루율 .332, 장타력 .385)보다 앞섭니다. 어제 송찬의의 역전포로 두산을 꺾고 1위를 지킨 흐름과 잠실 홈까지 더해 LG 쪽에 0.57로 기웁니다. 곽빈의 구위가 폭발하면 두산이 가져갈 수 있는 매치업입니다."
  },
  {
    // kia(황동하) @ kt(배제성) — 수원
    game_id: "42120c3c-4d72-4f7c-bdfb-7ae5b2791c34",
    predicted_winner_team_id: "kia",
    confidence: 0.58,
    key_factor: "KIA 타선 폭발(카스트로 복귀) + 배제성 제구 불안",
    one_liner:
      "카스트로 복귀로 타선이 폭발하며 3연승 중인 KIA가, 9이닝당 볼넷이 5개를 넘는 KT 배제성의 제구 불안을 공략하기 좋습니다. 황동하도 KT 상대 호투 이력이 있어 수원 원정에서 KIA가 앞설 전망입니다.",
    detailed_analysis:
      "흐름과 선발이 모두 KIA로 기웁니다. KIA는 카스트로 복귀 직후 어제 KT를 11-3으로 완파하며 3연승에 올라 타선이 절정입니다. KT 배제성(ERA 4.58, WHIP 1.68, BB9 5.48)은 표본이 20이닝 안팎으로 짧고 9이닝당 볼넷이 5개를 넘는 제구 불안형이라, 살아난 KIA 타선에 출루를 헌납하기 쉽습니다. KIA 황동하(ERA 4.09, HR9 1.64)는 피홈런이 잦은 점이 약점이지만, 상대팀 전적에서 KT 상대 1선발 7이닝 무실점(이닝당 주자 0.57)으로 강한 모습을 보인 이력이 있습니다. 표본이 1경기로 작아 과신은 금물이나 긍정적 신호입니다. 타선은 어제 대량 득점한 KIA의 기세가, 출루·장타가 모두 평범한 KT 라인업(평균 .272, 출루율 .350, 장타력 .375)보다 위력적입니다. 배제성이 제구를 잡고 KT가 수원 홈에서 반등하면 변수지만, KIA의 타격 흐름과 상대 전적에 무게를 둬 0.58로 봅니다."
  },
  {
    // ssg(해치) @ nc(김준원) — 창원
    game_id: "f91f93b9-2b5a-464a-9893-c7b1db596787",
    predicted_winner_team_id: "nc",
    confidence: 0.54,
    key_factor: "양 선발 미지수 → NC 홈·4연승 흐름",
    one_liner:
      "SSG 해치와 NC 김준원 모두 1군 표본이 5이닝 안팎인 미지수 선발이라 타선·불펜 싸움으로 흐를 공산이 큰데, 4연승으로 분위기가 오른 NC가 창원 홈에서 근소하게 앞섭니다. 다만 SSG의 장타력이 변수입니다.",
    detailed_analysis:
      "양 선발 모두 표본이 거의 없는 변동성 카드입니다. SSG 해치(ERA 8.31, 4.3이닝)는 한국 무대 적응이 안 된 신인 외인이고, NC 김준원(ERA 0, 5.7이닝)도 표본이 너무 짧아 어느 쪽도 단정하기 어렵습니다. 상대팀 전적도 둘 다 기록이 없어 참고할 수 없습니다. 그래서 승부는 타선과 흐름, 홈에서 갈린다고 봅니다. SSG 라인업(평균 .289, 출루율 .367, 장타력 .455, ISO .166)은 최정·에레디아·고명준의 장타력이 NC 라인업(평균 .278, 출루율 .359, 장타력 .418)보다 한 방 폭발력에서 앞서, SSG가 일찍 리드를 잡으면 경기를 가져갈 수 있습니다. 다만 NC는 4연승으로 분위기가 올라 있고 창원 홈인 데다, 해치가 김준원보다 더 불안해 NC 타선이 초반 점수를 낼 여지가 큽니다. 홈과 상승세에서 NC에 살짝 무게를 두되, SSG 장타력 변수를 인정해 0.54로 봅니다."
  },
  {
    // lotte(나균안) @ kiwoom(로젠버그) — 고척
    game_id: "43be989a-e191-49a0-b11d-07ca3d71ae8c",
    predicted_winner_team_id: "lotte",
    confidence: 0.53,
    key_factor: "양 팀 빈타 → 나균안 검증 + 롯데 3연승 흐름",
    one_liner:
      "나균안과 로젠버그 모두 평균 자책점 4점대의 평범한 선발이지만, 나균안이 표본과 안정성에서 한 끗 앞섭니다. 최근 3연승으로 8위까지 오른 롯데가 고척 원정에서 분위기를 이어갈 가능성이 있습니다.",
    detailed_analysis:
      "양 팀 모두 타선이 빈약해 박빙이 예상되는 카드입니다. 롯데 나균안(ERA 4.06, 68.7이닝, HR9 1.31)은 피홈런이 잦지만 이닝을 책임지는 검증된 카드이고, 키움 로젠버그(ERA 4.33, 27이닝, K9 10)는 탈삼진은 많아도 표본이 짧고 이닝당 주자가 많습니다. 상대팀 전적은 둘 다 기록이 없어 참고할 수 없습니다. 타선은 양쪽 모두 약합니다. 롯데 라인업(평균 .241, 출루율 .300)은 출루율이 리그 최하위권이지만 최근 3연승으로 분위기가 살아나는 흐름이고, 키움 라인업(평균 .240, 출루율 .342, 장타력 .352)도 장타력이 빈약합니다. 결국 검증된 선발과 상승세에서 롯데에 아주 살짝 무게를 둬 0.53으로 봅니다. 로젠버그의 탈삼진이 살아나거나 키움이 고척 홈에서 일찍 리드를 잡으면 곧장 뒤집힐 수 있는 동전 던지기에 가깝습니다."
  },
  {
    // samsung(장찬희) @ hanwha(왕옌청) — 대전
    game_id: "d5b06ec2-30c9-48fc-88ef-bdbb3e8b53a2",
    predicted_winner_team_id: "hanwha",
    confidence: 0.56,
    key_factor: "왕옌청의 삼성전 강세 + 한화 장타·홈",
    one_liner:
      "한화 왕옌청이 삼성 상대 통산 평균 자책점 0.90으로 유독 강했고, 강백호·노시환의 장타력을 갖춘 한화 타선이 대전 홈에서 받쳐줍니다. 삼성 장찬희가 제구와 피홈런에 기복이 있어 한화가 근소하게 앞설 전망입니다.",
    detailed_analysis:
      "선발과 상대 전적이 한화로 기웁니다. 한화 왕옌청(ERA 3.50, WHIP 1.47, BB9 4.0)은 볼넷이 다소 많지만, 상대팀 전적에서 삼성 상대 2선발 10이닝 평균 자책점 0.90으로 유독 강한 모습을 보여 왔습니다. 반면 삼성 장찬희(ERA 4.05, WHIP 1.35, BB9 4.05, HR9 1.35)는 볼넷과 피홈런이 함께 많은 기복형이고, 한화 상대 전적도 평균 자책점 4.91로 평범합니다. 타선은 팽팽합니다. 한화 라인업(평균 .288, 출루율 .369, 장타력 .445, ISO .157)은 강백호·노시환·페라자의 장타력이 강점이고, 삼성 라인업(평균 .292, 출루율 .377, 장타력 .423)은 출루와 콘택트가 안정적이라 장찬희가 흔들려도 받쳐줄 화력이 됩니다. 어제 우천 무승부로 시리즈가 원점인 가운데, 왕옌청의 삼성전 강세와 대전 홈, 한화의 장타력에 무게를 둬 0.56으로 기웁니다. 삼성의 출루형 타선이 왕옌청의 볼넷을 응징하면 접전이 됩니다."
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
