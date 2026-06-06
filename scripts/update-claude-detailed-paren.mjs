// 2026-06-06 Claude 본문(detailed_analysis) 5건을 괄호 수치 형식으로 UPDATE.
// 영상 나레이션 시 괄호만 건너뛰면 자연 문장 — 사이트엔 정밀 수치 그대로 노출.

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

const updates = [
  {
    game_id: "a5e0f78f-dc79-4c49-9557-088dfafe6f10",
    detailed_analysis:
      "선발 둘 다 시즌 흐름이 좋지 않습니다. KT 배제성(ERA 7.71, WHIP 1.82, BB9 5.81)은 1군 표본 자체가 적고 제구도 흔들리는 카드, SSG 타케다(ERA 8.10, WHIP 1.92)는 누적이 더 길어 외인 카드로서 안정성이 한 단계 떨어지는 상태입니다. 결국 양 팀 불펜이 일찍 가동될 가능성이 높고 그 차이를 결정하는 건 타선과 분위기. KT 라인업(평균 .298, 출루율 .376, 삼진 비율 15.8%)은 KBO 상위급 콘택트 그룹이지만 어제 SSG 에 5-6 으로 패하며 분위기가 가라앉았고, 1위 LG 와의 격차가 2.5G 로 벌어진 점도 라커룸에 부담입니다. SSG 는 정반대. 13연패 끝에 3연승을 묶으며 최지훈 멀티 홈런·박성한 1번 회복이 동시에 나왔고 최정·김재환·에레디아 클린업 폼도 살아 있습니다. 문학 홈 + 직전 KT 격파의 자신감까지 더해 신뢰도 0.55, 박빙은 박빙으로 솔직히 잡고 한 끗 SSG 쪽."
  },
  {
    game_id: "d33582a9-a456-48d1-92aa-8638b8da9bd3",
    detailed_analysis:
      "양쪽 모두 호각에 가까운 매치업이라 단판 변동성이 큰 카드입니다. 두산 최민석(ERA 3.29, WHIP 1.37)은 안정형 영건으로 직전 등판도 안정 흐름, 잠실 홈에서 5~6이닝 가져갈 가능성이 충분합니다. 그래도 키움 안우진(ERA 2.25, WHIP 1.04, K9 11.63)이 한 끗 위. 표본은 짧지만 등판마다 압도력이 강하고 직전 등판도 깨끗하게 마쳤습니다. 타선 격차도 의외로 키움 쪽이 살짝 위인 구간. 키움 최근 라인업(평균 .272, 출루율 .357, 장타력 .453)이 시즌 누적보다 높은 흐름을 히우라 합류 + 라인업 회전 덕에 유지 중이고, 두산은 시즌 라인업(평균 .248, 장타력 .360)으로 콘택트는 강해도 장타력이 떨어집니다. 단, 두산 콘택트(삼진 비율 15.7%)가 안우진의 탈삼진을 어느 정도 견디는 그림이 가능하고 잠실 홈 이점도 무시할 수 없어 신뢰도는 0.55 로 박빙 인정."
  },
  {
    game_id: "4cd3e8a3-a58c-4ff9-9db4-da6992faf0b5",
    detailed_analysis:
      "오늘 다섯 경기 중 선발 격차가 가장 명확한 카드입니다. 한화 에르난데스(ERA 4.47, WHIP 1.49, BB9 3.91)는 안정형 외인으로 직전 일주일 추가 6이닝 2자책의 살아 있는 폼. 반대편 롯데 이민석(ERA 8.78, WHIP 1.73, BB9 6.09)은 표본이 짧을 뿐 아니라 제구 불안이 누적된 영건 카드라 한화 클린업 상대 매치업이 매우 불리. 라인업도 한화 쪽 우위. 한화는 어제 사직 첫 경기에서 9-2 대승하며 페라자·문현빈·노시환 라인이 시즌 평균(.277, 출루율 .370)의 상위급 폼을 그대로 보였고 유민·이도윤 하위까지 콘택트 안정. 롯데는 어제 2-9 대패 후 손호영·전민재 변동이 다시 이어지는 상태이고 라인업 길이가 6번 이후 OPS .650 안팎으로 끊깁니다. 사직 홈과 단판 변동성을 인정해 0.66 정도가 균형."
  },
  {
    game_id: "b00f2dfe-b643-46fe-ac62-ce30c4f8b075",
    detailed_analysis:
      "선발 매치업은 표면 호각. 삼성 장찬희(ERA 4.24, WHIP 1.47)와 KIA 양현종(ERA 4.84, WHIP 1.45) 둘 다 평이형이고 K9 도 6점대 안팎으로 유사합니다. 갈리는 곳은 양현종의 피홈런(HR9 1.68) — 시즌 누적 피홈런이 KBO 평균 1.0 보다 65% 높아 장타력 강한 라인업 상대 약점이 크게 노출됩니다. 삼성 라인업(평균 .307, 출루율 .390, 장타력 .472)이 정확히 그 구간을 공략하기 좋은 그룹. KBO 최상위 화력에 김지찬(좌)-구자욱(좌)-디아즈(우)-최형우(좌)-박승규(우) 좌·우 분포까지 균형 잡혀 양현종 좌완 상대 대응에도 무리 없습니다. KIA(평균 .260, 장타력 .432, ISO .172)도 박재현·김도영·나성범·아데를린 클린업이 장타력 그룹이라 장찬희의 피홈런(HR9 1.06)을 흔들 가능성이 있지만 어제 올러에게 0-7 완패 후 분위기가 한 끗 다운된 상태. 광주 홈 이점은 인정해 0.56 박빙."
  },
  {
    game_id: "50f2f2fa-6d05-4183-b1a6-85d6105bd3c7",
    detailed_analysis:
      "오늘 다섯 경기 중 선발·타선 모두 한쪽으로 일관되게 기운 카드입니다. LG 톨허스트(ERA 3.24, WHIP 1.15, BB9 2.78)는 외인 1선발급이고 직전 일주일 추가 6이닝 1자책 안정 흐름. 반대편 NC 테일러(ERA 5.44, WHIP 1.47, BB9 4.53)는 외인 카드 중에서 변동성이 큰 쪽, 단일 경기 5이닝조차 불투명한 그림입니다. 타선도 LG 우위. 시즌 평균(.279, 출루율 .380, 장타력 .413)의 출루·콘택트 균형 라인업에 홍창기·박해민·오스틴·문보경·오지환 톱5가 좌·우 균형까지 잡혀 테일러 우완 매치업이 어렵지 않습니다. NC 는 KBO 최고 삼진율(K% 28.7)이 톨허스트의 탈삼진 능력(K9 7.41) 정도로도 충분히 흔들릴 수 있는 구조라 다타선 모드 진입이 어렵습니다. 창원 NC 홈 + 테일러 깜짝 호투 변동성만 인정해 0.66, 매치업 자체는 LG 쪽으로 명확."
  }
];

console.log(`Updating ${updates.length} detailed_analysis rows...`);
let ok = 0;
for (const u of updates) {
  const { error } = await sb
    .from("bp_ai_predictions")
    .update({ detailed_analysis: u.detailed_analysis })
    .eq("game_id", u.game_id)
    .eq("ai_provider", "claude");
  if (error) {
    console.log(`  ✗ ${u.game_id}: ${error.message}`);
    continue;
  }
  console.log(`  ✓ ${u.game_id}`);
  ok++;
}
console.log(`\n결과: ${ok}/${updates.length}`);
