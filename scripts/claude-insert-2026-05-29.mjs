// 2026-05-29 Claude 예측 5건 INSERT (매치업 균형파).
// 허용된 3개 테이블만 조회 + 웹 외부 조사 기반.
// 다른 AI 예측 row 는 조회하지 않음 (독립성).

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

const GAME_DATE = "2026-05-29";
const PUBLISHED_AT = "2026-05-29T09:00:00+09:00";
const MODEL = "claude-opus-4-7";

const rows = [
  {
    // 롯데(박세웅) @ NC(구창모) — 창원
    game_id: "d0f783c8-f7fb-4daf-a360-b610f9abb3ff",
    predicted_winner_team_id: "lotte",
    confidence: 0.55,
    key_factor: "NC 불펜 붕괴 직후",
    one_liner: "어제 18실 대패로 NC 불펜·분위기 동시 붕괴, 구창모 복귀 직후라 5이닝 보장이 안 됩니다.",
    detailed_analysis:
      "정량으로만 보면 박세웅 시즌 ERA 4.71·WHIP 1.57·1승 4패는 NC 라인업(박건우·데이비슨·이우성)이 신나게 때릴 수 있는 표본이라 NC 쪽이 분명히 우세 같지만, 오늘은 그 정량을 덮을 변수가 두 개입니다. 첫째, NC는 5/28 한화전에서 7-18 대패하면서 셋업·추격조 불펜을 거의 다 소진했고 6실점 빌미가 된 결정적 실책까지 나와 수비 멘탈도 흔들립니다. 둘째, 구창모는 잦은 부상 때문에 4/30 1군 말소 → 약 10일 휴식 → 5/10 복귀 패턴으로 시즌 운영 중이라 5월 후반 등판들이 모두 짧고 5이닝 보장이 안 됩니다. 어제 소진된 NC 불펜이 또 일찍 가동되면 어제처럼 빅이닝이 터질 가능성이 큽니다. 반대로 롯데는 어제 LG를 8-5로 잡고 3연패 탈출, 황성빈 결승 3루타·전민재 3타점으로 타선이 살아났고 최준용은 9회 153km 구속 회복으로 마무리도 신선. 박세웅이 부진해도 NC 불펜 vs 롯데 불펜의 신선도 격차가 결정타가 될 거란 판단. 박빙이라 신뢰도는 낮게 잡았지만 분위기와 불펜 신선도에서 롯데입니다."
  },
  {
    // SSG(최민준) @ 한화(화이트) — 대전
    game_id: "5358295e-ab78-49f2-b781-26ed45e6281b",
    predicted_winner_team_id: "hanwha",
    confidence: 0.72,
    key_factor: "9연패 vs 18득점",
    one_liner: "SSG는 신세계 인수 후 최다 9연패, 한화는 시즌 최다 18득점 — 모멘텀 격차가 극단적입니다.",
    detailed_analysis:
      "언더독 헌터 시각에서도 오늘 SSG 픽은 불가능에 가깝습니다. SSG는 신세계 인수 이래 최다 9연패에 빠졌고 어제 삼성에 1-10으로 완파, 팀 최다 11연패도 코앞이라는 위기 헤드라인이 며칠째 도배되고 있는 상태. 반대 한화는 어제 NC전에서 5점 열세를 7회 6득점·8회 빅이닝으로 뒤집어 18-7 시즌 최다 득점, 강백호 145m 홈런 4타점·김태연 4타점 합작 8타점이라는 라인업 폭발 신호가 잔뜩 나왔습니다. 선발도 한화 우위입니다. 화이트는 6주 햄스트링 결장 후 5/16 KT전 6.1이닝 4탈삼진 1자책으로 KBO 데뷔 첫 승, 6주 만에 정상 컨디션을 증명한 직후고 그동안 한화에 없던 진짜 1선발 카드. 반대편 SSG 최민준은 ERA·제구가 흔들리는 시기라 페라자·강백호·노시환 라인과 매치업에서 빅이닝을 한 번 더 헌납할 가능성이 높습니다. 9연패 팀의 반등이 매력적인 픽이긴 하지만 매치업·모멘텀·홈/원정 모든 항목에서 한화 우세라 신뢰도를 비교적 높게 잡았습니다."
  },
  {
    // KIA(이의리) @ LG(웰스) — 잠실
    game_id: "4d957851-a623-4666-8f01-669b36124c1a",
    predicted_winner_team_id: "kia",
    confidence: 0.55,
    key_factor: "6연승 모멘텀에 베팅",
    one_liner: "이의리 부진 변수 충분히 알지만, 6연승+우승후보 합류 KIA 분위기가 매치업 격차를 덮습니다.",
    detailed_analysis:
      "남들 다 LG 픽 갈 매치업입니다. 웰스 ERA 2.06·WHIP 0.97은 KBO 최상위급이고, 이의리는 5월 부진 누적으로 이범호 감독이 '마지막 기회'급으로 언급할 만큼 사실상 로테이션 탈락 위기. 단일 경기 선발 매치업만 보면 LG가 압도적이라는 데 동의합니다. 그래도 KIA를 찍는 이유는 KIA가 단순 강팀 폼이 아니라 6연승 + 2연속 시리즈 스윕 + '우승후보 대열 합류' 헤드라인이 일제히 한 방향으로 굳어진 상태이기 때문입니다. 박재현·김도영·아데를린 라인업이 직전 6경기 다득점, 황동하 5승 무패·시라카와 영입까지 마운드 보강 분위기도 함께 받고 있고, 이런 흐름의 팀은 약한 선발이 등판해도 라인업이 캐리하는 경기가 종종 나옵니다. 잠실의 좌타 라인(홍창기·박해민·오스틴)이 이의리의 볼넷 약점을 정확히 파고들 매치업이라는 정량 신호는 인정하지만, 그 시나리오대로 가도 KIA 타선이 웰스에게 3~4점만 뽑아내면 LG 불펜이 6연승 분위기의 팀을 8회·9회에 끊어줄 수 있을지가 의문입니다. 박빙으로 보고 0.55로 신뢰도를 낮게 잡았지만, 흐름의 KIA에 베팅합니다."
  },
  {
    // 두산(잭로그) @ 삼성(원태인) — 대구
    game_id: "80251d7e-0511-416d-ac8c-147b7ef17f8c",
    predicted_winner_team_id: "samsung",
    confidence: 0.68,
    key_factor: "원태인 추가 휴식+하위타선",
    one_liner: "원태인은 5/26 우천취소로 추가 휴식까지 확보, 디아즈·전병우·이재현 하위타선이 폭발 중입니다.",
    detailed_analysis:
      "양의지가 발목 통증에서 복귀해 어제 5번 DH로 출장하고 최근 10경기 0.353 타격감이라는 두산의 작은 반등 신호는 진짜고, 잭로그도 K9 8점대 탈삼진형이라 무시 못할 카드입니다. 그런데도 삼성을 비교적 높은 0.68로 잡은 이유는 두 가지. 첫째, 원태인은 햄스트링 복귀 직후 5/26 두산전이 우천취소되면서 본인 입장에서 추가 휴식까지 확보한 상태로 등판합니다. 컨디션이 가장 좋은 시점에 두산을 만나는 셈. 둘째, 삼성 타선이 어제 SSG전 홈런 5방 10-1 대승을 칠 때 박진만 감독이 직접 '하위타선 홈런 4방'을 비결로 꼽았듯, 디아즈·박승규·전병우·이재현 5~7번 라인업이 살아난 게 결정적입니다. 구자욱·최형우 의존도가 줄면서 라인업 전체가 폭발하는 단계라, 잭로그가 5이닝까지 잘 막아도 후반에 무너질 가능성이 크고 두산은 어제 KT전에서 곽빈이 잘 던졌는데 불펜이 10실점으로 무너져 같은 패턴이 되풀이될 위험이 높습니다. 두산 양의지 카드가 매력적이지만 삼성의 폼이 압도적이라 그쪽으로."
  },
  {
    // KT(사우어) @ 키움(배동현) — 고척
    game_id: "790f6cfc-35db-4ec3-87a3-283e258f40e6",
    predicted_winner_team_id: "kt",
    confidence: 0.61,
    key_factor: "고척 약체 매치업 분위기차",
    one_liner: "어제 11-3 대승 KT vs KIA에게 시리즈 스윕당한 키움 — 약체끼리는 분위기가 결정적입니다.",
    detailed_analysis:
      "선발만 떼면 사우어·배동현 모두 ERA 4점대 중후반, WHIP 1.4 안팎으로 매치업 자체는 박빙이고 표면적으론 키움 홈 이점이 살짝 더 있습니다. 언더독 헌터 시각에서 키움 픽도 충분히 매력적이긴 합니다. 그런데도 KT 쪽으로 기우는 이유는 약체끼리 단일 경기에서 분위기 격차가 너무 큽니다. KT는 어제 두산전 11-3 대승, 고영표가 51일 만의 시즌 2승, 힐리어드 4타점·8회 빅이닝으로 라인업·선발·불펜이 모두 동시에 살아난 흐름. 반대로 키움은 KIA에게 3연전 스윕 + 어제 5-0 완파로 5연패 수렁, 안우진·알칸타라·로젠버그가 3경기 연속 KIA 타선을 못 막은 게 더 큰 신호고 라인업 SLG·ISO·K%는 모두 하위권. 최원준·김현수·힐리어드·허경민으로 이어지는 KT 콘택트 라인(팀 K% 16% 전후)이 배동현 같은 4점대 ERA 투수에게 다득점을 뽑는 시나리오가 가장 자연스러운 그림입니다. 키움 홈 변수를 인정해 신뢰도는 0.61로 살짝 낮췄지만 KT 쪽."
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
