// 2026-06-07 Claude 예측 5건 INSERT.
// ai_provider='claude', published_at=09:00 KST.
// 다른 AI 행은 조회하지 않음 (독립성 규칙).
// 어제 단판 변동성 못 잡은 반성 → 박빙 카드 confidence 더 보수적.

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

const GAME_DATE = "2026-06-07";
const PUBLISHED_AT = "2026-06-07T09:00:00+09:00";
// ⚠️ Claude 본인이 INSERT 직전 확인:
//    현재 자기 모델이 이 값과 일치하는가? 다르면 여기 값을 갱신한 뒤 실행.
const MODEL = "claude-opus-4-8";

const rows = [
  {
    game_id: "3f1b9543-3868-4eef-a015-8f67dfd21aba",
    predicted_winner_team_id: "doosan",
    confidence: 0.62,
    key_factor: "벤자민 + 두산 콘택트",
    one_liner:
      "두산 픽. 벤자민이 평균 자책점 2.61로 알칸타라(3.18)보다 한 끗 위인 데다 두산 라인업이 KBO 최저 삼진 비율로 콘택트 강점이 있어, 어제 안우진을 맹폭하며 5할에 올라선 흐름이 잠실 홈에서 이어집니다.",
    detailed_analysis:
      "선발 매치업 자체가 호각에 가깝지만 두산 벤자민(ERA 2.61, WHIP 1.35, HR9 0.22)이 한 끗 위. 키움 알칸타라(ERA 3.18, WHIP 1.17, K9 8.45)도 1선발급 카드이지만 직전 등판들이 6이닝 안팎으로 끊기는 흐름이라 단일 경기 결정력에서 벤자민의 안정감이 살짝 앞섭니다. 결정적인 건 라인업. 두산은 시즌 라인업(평균 .265, 출루율 .357, 삼진 비율 14.5%)이 KBO 최강 콘택트 그룹, 어제 안우진을 맹폭하며 박찬호·정수빈·카메론·양의지 톱4 폼이 정점에 올라 있습니다. 키움은 라인업(평균 .257, 출루율 .347, 장타력 .453)이 의외로 ISO .197 의 장타력을 보여주는 게 변수이지만 표본이 짧고 임병욱·최주환·여동욱 영건 비중이 커서 단판 변동성이 큼. 두산은 시즌 처음으로 승률 5할 진입했다는 헤드라인이 라커룸 자신감으로 이어지고 잠실 홈 + 벤자민 등판이면 매치업 우위가 더 또렷해진다는 판단으로 0.62."
  },
  {
    game_id: "b4129b25-447f-42a9-83a8-1208bef07193",
    predicted_winner_team_id: "kia",
    confidence: 0.55,
    key_factor: "네일 안정 + 광주 홈",
    one_liner:
      "KIA 픽. 양창섭(평균 자책점 3.53)과 네일(3.84) 모두 안정형이라 표면 매치업은 호각이지만, 네일이 더 긴 표본에 이닝당 주자 1.11의 안정성으로 한 끗 위이고 광주 홈 + 김도영·나성범 클린업 폼이 박빙을 살짝 가릅니다.",
    detailed_analysis:
      "선발 매치업이 가장 호각인 카드입니다. 삼성 양창섭(ERA 3.53, WHIP 1.04, BB9 2.02)이 직전 일주일 6이닝 2자책으로 안정 흐름, KIA 네일(ERA 3.84, WHIP 1.11, BB9 1.42)도 시즌 누적 표본이 더 깊으면서 제구 안정. 정량으로는 둘 다 5~6이닝 무난히 책임지는 그림이라 단일 경기 결정력은 라인업과 분위기에서 갈립니다. 라인업도 호각. 삼성(평균 .283, 출루율 .367, 장타력 .434)과 KIA(평균 .267, 장타력 .438, ISO .172)가 비슷한 화력대인데, KIA 클린업의 박재현·김도영·나성범·아데를린이 광주 홈에서 좌·우 분포 균형으로 양창섭 우완 매치업이 어렵지 않습니다. 분위기는 어제 KIA 가 삼성에 패하며 한 끗 다운된 상태라 변수, 그래도 광주 홈 + 네일 카드 + 시즌 누적 흐름에서 KIA 쪽으로 미세하게 기울었다고 봐 0.55 박빙."
  },
  {
    game_id: "64026760-6335-42a9-8c86-fa35712cf50b",
    predicted_winner_team_id: "nc",
    confidence: 0.54,
    key_factor: "어제 역전승 흐름 + 창원 홈",
    one_liner:
      "NC 픽. 송승기(평균 자책점 4.18)와 토다(4.34) 선발 매치업이 거의 호각인 카드라 어제 LG 역전승으로 분위기 잡은 NC가 창원 홈에서 김주원·박민우·박건우 라인업 폼을 이어가는 그림이 자연스럽습니다.",
    detailed_analysis:
      "선발 매치업이 표면 호각. LG 송승기(ERA 4.18, WHIP 1.39, K9 7.61)가 정량으로 살짝 위이지만 변동성이 큰 카드, NC 토다(ERA 4.34, WHIP 1.47, BB9 3.35)도 외인 카드 중에선 평이형이라 단일 경기 5이닝대 호각 매치업 그림이 그려집니다. 결정 변수는 어제 흐름. NC 는 어제 LG 와의 직접 매치에서 오장한 역전 적시타로 재재역전 드라마를 만들었고 김주원·박민우·박건우·권희동 라인이 다타선 모드로 살아났습니다. 라인업(평균 .277, 출루율 .363, 장타력 .409)이 시즌 누적보다 한 단계 올라온 흐름. LG 는 정반대로 박해민·오스틴·문보경 클린업이 살아 있긴 해도 어제 9회 동점에서 역전당하며 라커룸 한 끗 다운, 라인업(평균 .280, 출루율 .378, 장타력 .380) 의 SLG 가 낮아 단일 경기 빅이닝 가능성이 떨어집니다. 창원 NC 홈 + 직전 역전승 자신감으로 한 끗 NC, confidence 0.54 박빙."
  },
  {
    game_id: "1ae3b4a3-82b9-4416-9957-648e13efc96c",
    predicted_winner_team_id: "lotte",
    confidence: 0.58,
    key_factor: "비슬리 + 황준서 제구 불안",
    one_liner:
      "롯데 픽. 비슬리가 평균 자책점 4.50에 탈삼진 능력 9이닝당 10.7로 한 단계 위인 카드이고, 한화 영건 황준서가 볼넷이 9이닝당 7.5개로 제구 불안이 누적된 상태라 선발 격차가 사직 홈 이점과 맞물려 롯데 쪽으로 기울었습니다.",
    detailed_analysis:
      "선발 매치업이 가장 명확하게 한쪽으로 기운 카드입니다. 롯데 비슬리(ERA 4.50, WHIP 1.43, K9 10.71, BB9 2.64)가 시즌 누적 안정대에 탈삼진 능력까지 갖춘 외인 1선발급, 직전 일주일 4.7이닝 7자책으로 폼이 한 번 흔들렸지만 표본·이닝 소화에서 황준서보다 한 단계 위입니다. 반대편 황준서(ERA 6.28, WHIP 1.88, BB9 7.55)는 시즌 ip 14.3 의 짧은 표본 + 볼넷 누적이 매우 심각한 영건 카드, 한화가 5선발급으로 굴리는 이유 그대로 5이닝 채우기 어려운 그림. 라인업 격차는 한화 쪽이 우위(평균 .274, 출루율 .356, 장타력 .429)이고 페라자·문현빈·노시환 클린업 폼도 살아 있지만, 황준서가 5이닝 이전 강판하면 한화 불펜이 일찍 노출되는 흐름이라 단판에서는 선발 격차가 라인업 격차를 누릅니다. 롯데(평균 .254, 출루율 .316) 라인업 길이는 짧지만 황성빈·고승민·레이예스·나승엽 톱4가 황준서 볼넷에서 자연스럽게 출루 인플레이션을 만들 수 있는 구도. 사직 홈 + 비슬리 카드에서 0.58 롯데."
  },
  {
    game_id: "f15b7a93-8401-498a-8748-4358856f966e",
    predicted_winner_team_id: "kt",
    confidence: 0.6,
    key_factor: "KT 타선 + 오원석 제구",
    one_liner:
      "KT 픽. KT 타선이 시즌 평균 .314에 출루율 .403의 KBO 최강 콘택트 그룹이고 오원석(평균 자책점 4.56)도 베니지아노(5.63)보다 제구·이닝 소화에서 한 단계 위라 문학 SSG 홈에서도 매치업 우위가 명확합니다.",
    detailed_analysis:
      "선발 매치업은 KT 쪽 우위. 오원석(ERA 4.56, WHIP 1.37, BB9 1.86)이 시즌 누적 안정형으로 제구 강점이 두드러지는 좌완, 베니지아노(ERA 5.63, WHIP 1.68, BB9 3.89)는 직전 등판들이 5이닝 안팎으로 끊기는 SSG 외인 카드라 이닝 소화에서 분명한 격차가 있습니다. 라인업 격차도 KT 쪽이 더 큼. KT(평균 .314, 출루율 .403, 삼진 비율 16.6%)는 KBO 최상위 콘택트 그룹이라 베니지아노 우완 상대 다득점 모드 진입이 자연스럽습니다. 최원준·김현수·김민혁·힐리어드·허경민 톱5가 시즌 OPS .700+ 균형으로 짜여 단일 경기 분산도가 적은 점이 강점. SSG 는 13연패 끝에 3연승으로 분위기는 회복했지만 어제 4연승 도전에 실패했다면(또는 흐름이 끊겼다면) 라커룸 압박이 다시 올라간 상태일 수 있고, 라인업(평균 .275, 출루율 .356, 장타력 .381) 의 장타력이 떨어지는 게 한 번에 빅이닝을 만들기 어려운 구조. 문학 홈 변수만 인정해 0.6, 매치업은 KT 쪽으로 명확."
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
