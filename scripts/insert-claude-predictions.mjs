// 2026-06-14 Claude 예측 5건 INSERT.
// ai_provider='claude', published_at=09:00 KST.
// 월요일 갱신된 최신 스냅샷 스탯 + 선발 + 타선 시즌능력 + 뉴스 기반. 근거는 확인된 사실만.

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

const GAME_DATE = "2026-06-14";
const PUBLISHED_AT = "2026-06-14T09:00:00+09:00";
// ⚠️ Claude 본인이 INSERT 직전 확인: 현재 자기 모델이 이 값과 일치하는가?
const MODEL = "claude-opus-4-8";

const rows = [
  {
    // hanwha(왕옌청) @ kiwoom(로젠버그) — 고척
    game_id: "b8065d15-4b6e-4b74-a29c-155969d0e90d",
    predicted_winner_team_id: "hanwha",
    confidence: 0.60,
    key_factor: "한화 타선 화력 우위 + 왕옌청 선발 안정성",
    one_liner:
      "한화가 이번 시리즈 연패로 방망이가 식었지만 강백호·노시환·페라자로 이어지는 타선의 누적 화력이 리그 최약체 키움 타선을 크게 앞서고, 왕옌청이 평균 자책점 3점대 중반의 안정형이라 식은 타선만 깨어나면 원정에서도 우위를 가져갑니다.",
    detailed_analysis:
      "전력만 보면 한화가 분명히 위입니다. 한화 라인업(평균 .296, 출루율 .371, 장타력 .464, ISO .168)은 강백호·노시환·페라자의 콘택트와 장타가 모두 살아 있어, 키움 라인업(평균 .251, 출루율 .323, 장타력 .341, 삼진 비율 24.1%)의 리그 최약체 화력과는 격차가 큽니다. 선발도 한화 왕옌청(ERA 3.49, WHIP 1.46, K9 7.66)이 67이닝의 검증된 안정형인 반면, 키움 로젠버그(ERA 4.50, WHIP 1.64, BB9 3.27)는 표본이 22이닝으로 짧고 이닝당 주자가 많아 한화 중심타선에 노출되기 쉽습니다. 그럼에도 confidence를 0.60에 묶는 이유는 흐름입니다. 한화는 어제 데뷔 첫 퀄리티스타트를 한 박준영을 두고도 타선 침묵 속에 키움에 3-1로 져 연패에 빠졌고, 키움은 알칸타라의 호투로 위닝시리즈를 선점하며 한화를 이틀 연속 잡아 분위기가 올라 있습니다. 다만 이틀간 잠잠했던 한화 타선의 평균 회귀와 선발 우위를 더 무겁게 보아 한화 쪽에 기웁니다. 한화 방망이가 사흘째 침묵하고 키움이 고척 홈에서 일찍 리드를 잡으면 이변은 충분히 가능합니다."
  },
  {
    // ssg(해치) @ samsung(양창섭) — 대구
    game_id: "9904dc32-7256-4402-bc69-afd1941cb8dd",
    predicted_winner_team_id: "samsung",
    confidence: 0.57,
    key_factor: "삼성 홈·검증된 선발 vs SSG 신인 외인 미지수",
    one_liner:
      "SSG 선발 해치가 1군 데뷔 무대라 호투든 난조든 가늠하기 어려운 미지수인 반면 삼성 양창섭은 9이닝당 볼넷 2개의 검증된 제구를 갖췄고, 어제 6점 차를 뒤집은 시즌 1위 삼성이 대구 홈에서 분위기를 이어갑니다.",
    detailed_analysis:
      "이 카드의 가장 큰 변수는 SSG 선발입니다. 새 외국인 투수 해치는 시즌 누적 스냅샷이 잡히지 않을 만큼 1군 표본이 없어, 한국 무대 적응 여부에 따라 결과가 크게 갈리는 변동성 큰 카드입니다. 반면 삼성 양창섭(ERA 4.43, WHIP 1.23, BB9 2.21, HR9 1.11)은 9이닝당 볼넷이 2개대로 제구가 안정적이라 단일 경기 기복이 작은 편이고, 피홈런이 다소 많은 점이 유일한 불안입니다. 타선은 성격이 갈립니다. SSG 최근 라인업(평균 .261, 출루율 .333, 장타력 .465, ISO .204)은 최정·김재환·에레디아의 장타력이 돋보이지만 출루가 낮고, 삼성 라인업(평균 .277, 출루율 .364, 장타력 .417)은 출루와 콘택트가 더 균형 잡혀 양창섭을 받쳐줄 화력이 됩니다. 흐름도 삼성이 좋습니다. 삼성은 어제 SSG에 6점 차로 뒤지다 전병우의 3점포와 박승규의 결승타로 7-6 대역전승을 거두며 3위를 지켰고, SSG는 다 잡은 경기를 내줬습니다. 시즌 1위 팀의 대구 홈 이점과 검증된 선발을 더 무겁게 보아 삼성 쪽에 0.57로 기웁니다. 해치가 데뷔전에서 깜짝 호투하면 SSG의 장타력이 균형을 뒤집을 수 있어 단정은 피합니다."
  },
  {
    // lotte(비슬리) @ lg(임찬규) — 잠실
    game_id: "09e0f80d-41dd-4463-990a-93d3a3ad3229",
    predicted_winner_team_id: "lg",
    confidence: 0.62,
    key_factor: "LG 상위타선 출루 우위 + 잠실 홈 선두 흐름",
    one_liner:
      "홍창기·박해민·오스틴으로 이어지는 LG 상위 타선이 리그 최상위권 출루 능력을 갖춰 롯데 타선을 앞서고, 어제 롯데를 꺾고 시즌 40승에 가장 먼저 도달한 선두 LG가 잠실 홈에서 흐름을 이어갑니다.",
    detailed_analysis:
      "타선과 흐름이 모두 LG로 기웁니다. LG 라인업(평균 .277, 출루율 .376, 장타력 .402)은 홍창기·박해민·오스틴·문보경의 출루 능력이 리그 최상위권이라, 롯데 라인업(평균 .268, 출루율 .333, 장타력 .382)보다 주자를 쌓아 득점으로 연결하는 힘이 큽니다. 선발은 색깔이 다릅니다. 롯데 비슬리(ERA 4.86, WHIP 1.51, K9 10.57)는 9이닝당 탈삼진이 10개를 넘는 파워형이지만 이닝당 주자도 많아 기복이 있고, LG 임찬규(ERA 3.72, WHIP 1.55, K9 4.96)는 탈삼진은 적어도 맞춰 잡으며 실점을 억제해 온 카드입니다. 임찬규의 이닝당 주자(WHIP 1.55)가 높은 점은 불안 요소지만, LG 불펜이 어제 총동원 체제로 롯데를 5-3으로 막아낸 만큼 뒷심에서 앞섭니다. 흐름도 LG가 어제 롯데에 설욕하며 시즌 40승에 가장 먼저 도달했고 박해민이 13시즌 연속 20도루를 세우는 등 분위기가 좋습니다. 선두의 잠실 홈 전력과 출루 우위를 더 무겁게 보아 LG 쪽에 0.62로 기웁니다. 비슬리의 탈삼진이 LG 타선을 묶고 롯데 톱타선이 이틀 전처럼 폭발하면 변수가 됩니다."
  },
  {
    // doosan(곽빈) @ kia(김태형) — 광주
    game_id: "ffdffa7a-22b0-418c-adc4-e816f6235407",
    predicted_winner_team_id: "doosan",
    confidence: 0.55,
    key_factor: "곽빈 선발 우위 vs 김태형 제구·피홈런 불안",
    one_liner:
      "두산 곽빈이 9이닝당 탈삼진 10개가 넘는 구위에 평균 자책점 3점대 초반의 에이스급 카드인 반면 KIA 선발 김태형은 9이닝당 볼넷 5개에 피홈런까지 많은 제구 불안형이라, 콘택트가 강한 두산 타선이 원정에서 앞섭니다.",
    detailed_analysis:
      "선발 격차가 이 카드의 핵심입니다. 두산 곽빈(ERA 3.38, WHIP 1.38, K9 10.66, HR9 0.54)은 9이닝당 탈삼진이 10개를 넘고 피홈런을 거의 내주지 않는 에이스급 선발이라, 김도영·나성범·아데를린으로 이어지는 KIA의 장타 위주 득점 루트(장타력 .461)를 억제하기에 좋은 궁합입니다. 반면 KIA 김태형(ERA 5.17, WHIP 1.76, BB9 5.18, HR9 1.44)은 9이닝당 볼넷이 5개를 넘고 피홈런도 많은 제구 불안형이라, 삼진을 거의 당하지 않는 두산 타선(평균 .275, 출루율 .358, 삼진 비율 15.9%)의 끈질긴 콘택트에 볼넷과 안타를 내주며 자멸할 위험이 큽니다. 다만 두산 라인업의 장타력(장타력 .387, ISO .112)이 낮아 김태형의 피홈런 약점을 한 방으로 응징하기보다 주자를 쌓아 점수를 짜내는 그림이라 폭발력은 제한적입니다. 흐름은 KIA가 좋습니다. KIA는 어제 네일의 무사사구 호투와 김도영의 맹타로 두산을 2-1로 꺾고 단독 4위로 올라섰고, 두산은 같은 경기를 내줬습니다. 그래서 confidence는 0.55로 박빙. 광주 홈과 상승세는 KIA 쪽이지만, 선발 매치업의 구조적 우위를 더 무겁게 보아 두산에 살짝 기웁니다. 곽빈이 제구가 흔들리거나 KIA 클린업이 한 방을 터뜨리면 곧장 뒤집힐 수 있습니다."
  },
  {
    // nc(김준원) @ kt(고영표) — 수원
    game_id: "06427010-5838-4edc-8409-ffbfcbcfbdaf",
    predicted_winner_team_id: "kt",
    confidence: 0.62,
    key_factor: "KT 출루형 타선·홈 우위 + NC 신인 선발 미지수",
    one_liner:
      "NC 선발 김준원이 1군 표본이 6이닝도 안 되는 미지수인 반면 KT 고영표는 9이닝당 볼넷 1.5개의 노련한 제구를 갖췄고, 출루율 리그 최상위의 KT 타선이 수원 홈에서 2연승 흐름을 이어갑니다.",
    detailed_analysis:
      "선발 신뢰도와 타선 모두 KT로 기웁니다. KT 고영표(ERA 4.50, WHIP 1.25, BB9 1.46, K9 10.32)는 68이닝 표본에서 9이닝당 볼넷 1.5개의 정교한 제구와 두 자릿수 탈삼진 능력을 겸비한 노련한 카드입니다. 반면 NC 김준원(ip 5.7)은 1군 표본이 6이닝에도 못 미쳐 호투든 난조든 가늠하기 어려운 변동성 큰 선발이라, 단일 경기 신뢰도에서 크게 밀립니다. 타선도 KT가 위입니다. KT 라인업(평균 .306, 출루율 .394, 삼진 비율 16.6%)은 출루와 콘택트가 리그 최상위라 상대 투수를 끈질기게 괴롭히고, NC 라인업(평균 .281, 출루율 .355, 장타력 .406)은 준수하지만 KT의 출루 능력에는 못 미칩니다. 흐름도 KT가 좋습니다. KT는 어제 8회 9-7 역전을 허용하고도 허경민의 4안타·결승 2루타로 NC를 11-9로 다시 뒤집으며 2연승과 위닝시리즈를 확보했고, 선두 LG를 1.5경기 차로 추격 중입니다. 선발·타선·홈·상승세가 일관되게 KT 쪽이라 confidence 0.62. 다만 고영표의 피홈런(HR9 1.06)이 다소 높아, 김준원이 짧은 이닝을 버티고 NC가 한 방을 터뜨리면 접전으로 흐를 여지는 인정합니다."
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
