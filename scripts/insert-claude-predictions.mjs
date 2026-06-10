// 2026-06-10 Claude 예측 5건 INSERT.
// ai_provider='claude', published_at=09:00 KST.
// 월요일 갱신된 최신 스냅샷 스탯 + 선발 + 뉴스 기반. 근거는 확인된 사실만.

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

const GAME_DATE = "2026-06-10";
const PUBLISHED_AT = "2026-06-10T09:00:00+09:00";
// ⚠️ Claude 본인이 INSERT 직전 확인: 현재 자기 모델이 이 값과 일치하는가?
const MODEL = "claude-opus-4-8";

const rows = [
  {
    // nc(구창모) @ kiwoom(하영민) — 고척
    game_id: "4cd88a7e-31d9-4a49-a777-01329a19eef2",
    predicted_winner_team_id: "nc",
    confidence: 0.62,
    key_factor: "NC 타선 우위 + 구창모 제구",
    one_liner:
      "NC 픽. 구창모가 키움 하영민보다 이닝당 주자와 볼넷을 확실히 적게 내주는 안정형 선발이고, NC 타선이 시즌 평균 3할대에 키움은 삼진 비율이 가장 높은 리그 최약체 화력이라 고척 원정이라도 방망이 격차가 큽니다.",
    detailed_analysis:
      "타선 격차가 가장 뚜렷한 카드입니다. NC 라인업(평균 .302, 출루율 .377, 장타력 .455)이 김주원·박민우·박건우·데이비슨 중심으로 살아 있는 반면, 키움 라인업(평균 .221, 출루율 .288, 장타력 .302, 삼진 비율 27.0%)은 리그 최약체 화력에 삼진 비율까지 가장 높아 빅이닝을 만들기 어렵습니다. 선발도 NC 우위. 구창모(ERA 4.04, WHIP 1.27, BB9 3.03)가 62이닝 표본의 안정형인 반면 하영민(ERA 4.53, WHIP 1.49, BB9 4.32)은 9이닝당 볼넷이 4개를 넘는 제구 변동형이라 NC 타선의 출루 능력에 노출되기 쉽습니다. 다만 키움이 어제 최주환 끝내기로 NC를 꺾고 2연승 분위기인 점, 고척 돔 홈 이점은 변수라 confidence는 0.62. 매치업 자체는 선발·타선 양쪽 모두 NC 쪽으로 기울었다고 봅니다."
  },
  {
    // samsung(원태인) @ kt(사우어) — 수원
    game_id: "3747cd83-415d-45fd-a780-aeb31f8b0535",
    predicted_winner_team_id: "samsung",
    confidence: 0.57,
    key_factor: "원태인 제구 + 삼성 상위타선",
    one_liner:
      "삼성 픽. 원태인이 9이닝당 볼넷 2개의 정교한 제구로 KT 사우어보다 단일 경기 안정성이 높고, 김지찬·구자욱·최형우로 이어지는 삼성 상위 타선이 리그 1위 팀의 화력을 받쳐줍니다.",
    detailed_analysis:
      "선발 매치업은 삼성 원태인(ERA 3.68, WHIP 1.29, BB9 2.11, HR9 0.53)이 한 끗 위입니다. 볼넷과 피홈런을 모두 적게 내주는 제구형이라 단일 경기 기복이 작은 카드이고, KT 사우어(ERA 4.54, WHIP 1.36, BB9 3.51)는 볼넷이 더 많아 출루 허용 리스크가 큽니다. 타선은 양 팀 모두 콘택트 강점 그룹이라 우열이 팽팽합니다. KT 라인업(평균 .304, 출루율 .388, 삼진 비율 16.5%)이 평균은 약간 높지만, 삼성 라인업(평균 .284, 출루율 .380, 장타력 .427)이 구자욱·최형우·디아즈의 중심 장타력에서 앞서 원태인의 호투를 받쳐줄 화력이 충분합니다. KT가 어제 고영표·김현수를 앞세워 삼성을 5-2로 꺾고 2위를 수성한 직후라 수원 홈 분위기와 KT 타선의 반등 가능성은 분명한 변수. 다만 시즌 1위 팀의 전력과 원태인의 제구 우위를 더 무겁게 보아 삼성 쪽에 0.57로 살짝 기웁니다."
  },
  {
    // doosan(잭로그) @ lotte(김진욱) — 사직
    game_id: "2d6545fd-ffb7-44aa-b409-e5b658ffabe4",
    predicted_winner_team_id: "doosan",
    confidence: 0.54,
    key_factor: "잭로그 제구 + 롯데 수비 붕괴",
    one_liner:
      "두산 픽. 잭로그가 9이닝당 볼넷 1.6개의 최상급 제구로 경기를 안정시키는 선발이고, 롯데가 5연패 중에 어제 7실책 난타전을 내줄 만큼 수비가 흔들리고 있어 사직 홈 이점만으로 메우기 어렵습니다.",
    detailed_analysis:
      "선발은 거의 백중세입니다. 롯데 김진욱(ERA 3.48, WHIP 1.19)이 시즌 수치는 약간 앞서지만, 두산 잭로그(ERA 3.97, WHIP 1.37, K9 8.21, BB9 1.59)는 9이닝당 볼넷이 1.6개에 불과한 최상급 제구에 탈삼진 능력까지 갖춰 단일 경기 결정력에서 밀리지 않습니다. 승부를 가르는 건 최근 흐름과 수비입니다. 롯데는 5연패에 빠진 데다 어제 7실책 난타전 끝에 두산에 5-6으로 무너지며 수비가 크게 흔들린 상태이고, 두산은 그 경기를 잡고 분위기를 탔습니다. 타선은 롯데(평균 .276, 출루율 .333, 장타력 .405)가 두산(평균 .260, 출루율 .339, 삼진 비율 14.4%)보다 장타력에서 약간 앞서지만, 두산은 삼진을 거의 당하지 않는 콘택트 강점으로 잭로그의 호투를 받쳐줄 수 있습니다. 사직 홈 이점과 김진욱의 좌완 카드, 롯데 톱타선의 반등 가능성이 변수라 confidence는 0.54로 박빙. 다만 제구·흐름·수비 안정성에서 두산 쪽에 살짝 무게를 둡니다."
  },
  {
    // kia(시라카와) @ hanwha(화이트) — 대전
    game_id: "f43c0c1a-dac6-4fc3-9fbe-c4703ec1987d",
    predicted_winner_team_id: "hanwha",
    confidence: 0.54,
    key_factor: "화이트 검증 + 시라카와 표본 부족",
    one_liner:
      "한화 픽. 화이트가 이닝당 주자 1.01의 검증된 안정형 선발인 반면 KIA 시라카와는 1군 표본이 5이닝뿐이라 변동성이 크고, 강백호·노시환 중심 한화 타선이 대전 홈에서 우세를 점합니다.",
    detailed_analysis:
      "선발 신뢰도에서 한화가 앞섭니다. 한화 화이트(ERA 3.04, WHIP 1.01, BB9 1.69)는 이닝당 주자를 1개 수준으로 묶는 검증된 안정형 카드인 반면, KIA 시라카와(ip 5.0)는 1군 표본이 5이닝뿐이라 호투든 난조든 어느 쪽도 단정하기 어려운 변동성 큰 선발입니다. 타선은 양 팀 모두 장타력이 살아 있어 팽팽합니다. KIA 라인업(평균 .269, 장타력 .456, ISO .187)이 김도영·나성범·아데를린 클린업의 장타력에서 리그 최상위지만 삼진 비율(24.1%)이 높고, 한화 라인업(평균 .291, 출루율 .370, 장타력 .454)은 강백호·페라자·노시환의 콘택트와 장타가 균형 잡혀 화이트의 호투를 받쳐줄 화력이 충분합니다. KIA가 어제 김도영의 시즌 19호 홈런으로 한화를 6-4로 꺾고 2연승 중이라 타선 상승세는 분명한 변수. 다만 검증된 선발과 대전 홈 이점을 가진 한화 쪽에 0.54로 아주 살짝 기웁니다. 시라카와가 짧은 표본에서 깜짝 호투하면 흐름은 KIA로 넘어갑니다."
  },
  {
    // ssg(최민준) @ lg(웰스) — 잠실
    game_id: "bec1a2b0-735b-4d43-b642-933a79830ac0",
    predicted_winner_team_id: "lg",
    confidence: 0.65,
    key_factor: "웰스 에이스급 + LG 홈",
    one_liner:
      "LG 픽. 웰스가 평균 자책점 2점 미만에 이닝당 주자 1개 미만의 에이스급 선발인 반면 SSG 최민준은 9이닝당 볼넷 4개가 넘는 제구 불안형이라, 잠실 홈에서 시즌 선두 LG가 우세를 점합니다.",
    detailed_analysis:
      "선발 격차가 가장 큰 카드입니다. LG 웰스(ERA 1.97, WHIP 0.95, BB9 2.15, HR9 0.18)는 이닝당 주자를 1개 미만으로 억제하고 피홈런까지 거의 내주지 않는 에이스급 선발입니다. 반대로 SSG 최민준(ERA 4.38, WHIP 1.38, BB9 4.38)은 9이닝당 볼넷이 4개를 넘는 제구 불안형이라 박해민·문성주·오스틴·문보경으로 이어지는 LG의 출루형 상위 타선(출루율 .376)에 볼넷을 헌납하기 쉬운 구도입니다. SSG 타선은 최근 라인업 시즌 능력치가 높게 잡히지만 표본·구성 변동이 커 그대로 신뢰하기는 조심스럽고, 무엇보다 웰스의 이닝당 주자 0.95라는 억제력이 그 화력을 묶는 그림입니다. LG가 시즌 선두에 어제 임찬규의 호투로 SSG를 잡고 2연패를 탈출한 직후라 잠실 홈 분위기까지 우호적입니다. SSG가 어제 2-8로 크게 진 점도 흐름상 불리. 선발·타선·홈·분위기가 일관되게 LG 쪽이라 confidence 0.65. SSG 타선의 한 방 폭발 가능성만 변수로 인정합니다."
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
