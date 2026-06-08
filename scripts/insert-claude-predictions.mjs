// 2026-06-09 Claude 예측 5건 INSERT.
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

const GAME_DATE = "2026-06-09";
const PUBLISHED_AT = "2026-06-09T09:00:00+09:00";
// ⚠️ Claude 본인이 INSERT 직전 확인: 현재 자기 모델이 이 값과 일치하는가?
const MODEL = "claude-opus-4-8";

const rows = [
  {
    game_id: "cf3ad074-cf17-40f7-8c5d-4974ab453149",
    predicted_winner_team_id: "doosan",
    confidence: 0.6,
    key_factor: "곽빈 탈삼진 + 두산 콘택트",
    one_liner:
      "두산 픽. 곽빈이 9이닝당 탈삼진 11.1개로 나균안을 압도하는 선발 카드이고, 롯데가 닷새 만에 또 엔트리를 대폭 바꾸며 벤치가 흔들리는 상황이라 사직 홈 이점만으로 메우기는 어렵습니다.",
    detailed_analysis:
      "선발 매치업에서 두산 곽빈(ERA 3.26, WHIP 1.34, K9 11.12, HR9 0.44)이 한 끗 위입니다. 롯데 나균안(ERA 3.53, WHIP 1.32, K9 7.49)도 안정형 토종 카드이지만 곽빈의 탈삼진 능력과 피홈런 억제력이 단일 경기 결정력에서 앞섭니다. 타선도 두산 우위. 두산 라인업(평균 .272, 출루율 .358, 삼진 비율 16.1%)이 콘택트 강점 그룹인 반면 롯데(평균 .248, 출루율 .309)는 출루 자체가 떨어지고, 어제 '닷새 만에 또 교체'·'엔트리 대폭 변화'·'벤치 흔들린다'는 보도가 잇따를 만큼 라인업이 안정되지 않은 상태입니다. 다만 사직 홈 이점과 황성빈·고승민·레이예스·나승엽 톱4가 곽빈을 상대로 1~2점은 만들 수 있는 점, 나균안이 5이닝 이상 버티면 접전이 될 수 있는 점은 변수라 confidence는 0.6 정도. 매치업 자체는 두산 쪽으로 기울었다고 봅니다."
  },
  {
    game_id: "d455847a-e366-4627-bc16-a8d9ef01d2ac",
    predicted_winner_team_id: "kt",
    confidence: 0.58,
    key_factor: "고영표 제구 + KT 콘택트",
    one_liner:
      "KT 픽. 고영표가 직전 등판 7이닝 2자책에 9이닝당 볼넷 1.6개의 정교한 제구를 보였고, KT 타선이 시즌 평균 .299·출루율 .385의 KBO 최상위 콘택트 그룹이라 수원 홈에서 1위 삼성 추격 흐름이 이어집니다.",
    detailed_analysis:
      "선발 매치업은 KT 고영표(ERA 4.79, WHIP 1.31, K9 10.45, BB9 1.60)가 한 끗 위입니다. 시즌 ERA는 높아 보이지만 직전 일주일 7이닝 2자책으로 폼이 올라왔고 볼넷이 매우 적은 제구형이라 단일 경기 안정성이 높습니다. 삼성 최원태(ERA 4.75, WHIP 1.53, BB9 3.74)는 제구 변동이 더 커 5이닝 이전 강판 리스크가 있습니다. 타선 격차도 KT 쪽. KT 라인업(평균 .299, 출루율 .385, 삼진 비율 16.9%)이 KBO 최상위 콘택트 그룹이라 최원태의 평이한 구위를 상대로 다득점 모드 진입이 자연스럽습니다. 삼성은 최근 라인업(평균 .271, 출루율 .358)이 최형우 등 핵심이 빠진 구성으로 화력이 한 단계 내려온 상태. KT가 1위 삼성을 1.5게임 차로 추격하는 동기 부여 + 수원 홈 + 콘택트 우위로 KT 쪽에 무게를 두지만, 삼성 김지찬·구자욱·디아즈 상위 타선의 폭발 가능성을 인정해 confidence 0.58."
  },
  {
    game_id: "d6c9efc1-38c4-4aae-8e36-298d42c10b62",
    predicted_winner_team_id: "hanwha",
    confidence: 0.62,
    key_factor: "왕옌청 안정 + 황동하 피홈런",
    one_liner:
      "한화 픽. 왕옌청이 평균 자책점 3.13의 안정형인 반면 KIA 황동하는 9이닝당 피홈런 1.84개의 큰 약점을 안고 있어, 5월 최우수선수 강백호와 페라자·노시환 중심 한화 타선이 대전 홈에서 공략하기 좋은 매치업입니다.",
    detailed_analysis:
      "선발 매치업이 한화 쪽으로 분명히 기운 카드입니다. 한화 왕옌청(ERA 3.13, WHIP 1.41, HR9 0.57)이 시즌 안정대에 피홈런 억제력이 강한 반면, KIA 황동하(ERA 4.41, HR9 1.84)는 피홈런이 KBO 평균의 거의 두 배에 가까운 큰 약점입니다. 타선 매치업에서 이 약점이 그대로 노출됩니다. 한화 라인업(평균 .280, 출루율 .366, 장타력 .426)에 5월 최우수선수로 선정된 강백호(시즌 타율 4할대 보도)가 복귀해 페라자·문현빈·노시환 클린업과 함께 장타력이 살아 있어 황동하 피홈런 구간을 공략하기 좋습니다. 반대로 KIA 라인업(평균 .280, 장타력 .470, ISO .189)도 김도영·나성범·아데를린 클린업의 장타력이 KBO 최상위라 왕옌청을 상대로 1~2개의 장타는 가능하지만, 왕옌청의 HR9 0.57이 그 폭발을 억제하는 그림. 대전 홈 만원 분위기 + 선발·타선 매치업 우위가 일관되게 한화 쪽이라 confidence 0.62."
  },
  {
    game_id: "c83b23f9-3a85-45ee-b35e-ff854a113c95",
    predicted_winner_team_id: "nc",
    confidence: 0.56,
    key_factor: "NC 타선 화력 + 김태경 변수",
    one_liner:
      "NC 픽. NC 타선이 시즌 평균 .297·장타력 .444로 살아난 상태이고 키움 라인업은 삼진 비율 23.5%의 KBO 최약체 화력이라, 고척 원정이지만 NC 방망이가 시리즈 흐름을 가져올 가능성이 높습니다.",
    detailed_analysis:
      "타선 화력 격차가 분명한 카드입니다. NC 최근 라인업(평균 .297, 출루율 .374, 장타력 .444)이 김주원·박건우·데이비슨·권희동 중심으로 살아난 상태이고, 5월 MVP 투수 토다·내야수 김주원이 동시에 선정될 만큼 팀 전체 흐름이 중위권 도약을 정조준하는 분위기입니다. 반대로 키움 라인업(평균 .247, 출루율 .338, 삼진 비율 23.5%)은 KBO 최약체 화력에 삼진 비율이 가장 높아 단일 경기 빅이닝을 만들기 어렵습니다. 선발은 변수. NC 김태경(ERA 4.64, HR9 1.69)이 피홈런 약점이 있고, 키움 로젠버그(ERA 3.18, K9 10.06)는 표본이 ip 17로 짧지만 탈삼진 능력이 높아 NC 타선을 일부 묶을 수 있는 카드입니다. 고척 돔 홈 이점 + 로젠버그 탈삼진이 NC의 약점이지만, 김태경이 5이닝만 버텨주면 NC 타선 화력이 키움 약체 라인업과의 격차를 만든다는 판단으로 NC 쪽에 0.56. 로젠버그 호투 시 접전 가능성은 인정합니다."
  },
  {
    game_id: "583ecf6c-f87f-4c68-87e6-29add37a77fa",
    predicted_winner_team_id: "lg",
    confidence: 0.58,
    key_factor: "LG 홈 + 김민준 표본 부족",
    one_liner:
      "LG 픽. SSG 선발 김민준이 1군 표본 6이닝대로 검증이 부족한 카드이고, LG가 시즌 공동 1위에 홈 잠실 이점까지 안고 있어 SSG의 약한 타선 상대로 우세를 점합니다.",
    detailed_analysis:
      "선발 표본의 불확실성이 큰 카드입니다. SSG 김민준(ERA 1.42, WHIP 0.79)은 수치가 좋아 보이지만 시즌 ip 6.3에 불과해 1군 검증이 부족한 카드로, 단일 경기 변동성이 매우 큽니다. LG 임찬규(ERA 3.88, WHIP 1.54, K9 4.93)는 탈삼진이 적은 콘택트 허용형이라 SSG 타선이 맞혀 나갈 여지는 있지만, SSG 라인업(평균 .261, 출루율 .333)이 출루·콘택트 모두 평균 이하라 그 여지를 살리기 어렵습니다. 타선 격차는 LG 우위. LG 라인업(평균 .267, 출루율 .358)이 홍창기·박해민·오스틴·문보경 톱4의 출루 능력으로 김민준의 짧은 표본을 흔들기 좋은 구도입니다. LG가 시즌 공동 1위(0.610)에 잠실 홈, SSG는 13연패에서 회복했지만 화력이 아직 평균 이하라 LG 쪽으로 0.58. 김민준이 짧은 표본에서 깜짝 호투할 가능성만 변수로 인정합니다."
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
