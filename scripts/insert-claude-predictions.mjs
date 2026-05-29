// 2026-05-29 Claude 예측 5건 INSERT.
// ai_provider='claude', published_at=09:00 KST.
// 다른 AI 행은 조회하지 않음 (독립성 규칙).

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
    game_id: "d0f783c8-f7fb-4daf-a360-b610f9abb3ff",
    predicted_winner_team_id: "lotte",
    confidence: 0.54,
    key_factor: "직전 7-18 후폭풍",
    one_liner: "어제 18실점·실책 6점 빌미로 무너진 NC, 오늘은 불펜과 분위기 모두 빚을 졌습니다.",
    detailed_analysis:
      "직관적인 정량 매치업으로만 보면 창원 홈 이점과 박건우·데이비슨 중심 NC 라인업이 무게 추 같지만, 오늘 무게 추는 직전 경기에 있습니다. NC는 5/28 한화전에서 7-18 대패하면서 추격조 — 셋업 라인까지 다 끌어 썼고, 실책 한 방으로 6실점 빌미를 내준 수비도 흔들렸습니다. 구창모는 5월 들어 짧은 등판이 잦아 5이닝조차 불투명한 상태라 어제 소진된 불펜이 다시 일찍 가동될 가능성이 높습니다. 반면 박세웅은 시즌 ERA가 좋진 않아도 직전 한 주 6이닝대 2자책으로 안정세, 롯데는 어제 휴식일이라 최준용 포함 마무리도 신선합니다. 라일리·토다 등 외국인 선발 로테가 어긋난 NC가 구창모 카드로 박세웅과 맞붙는 매치업 자체가 살짝 불리. 박빙이지만 롯데 쪽으로 살짝 기울었다는 판단입니다."
  },
  {
    game_id: "5358295e-ab78-49f2-b781-26ed45e6281b",
    predicted_winner_team_id: "hanwha",
    confidence: 0.74,
    key_factor: "9연패 vs 18득점",
    one_liner: "SSG는 2,090일 만의 9연패, 한화는 어제 시즌 최다 18득점 — 모멘텀 격차가 극단적입니다.",
    detailed_analysis:
      "오늘 매치업의 핵심은 야구 외적 변수가 아니라 분명한 흐름 격차입니다. SSG는 신세계 인수 이래 최다 9연패 수렁, 어제 삼성전에서 1-10 완파로 타선·마운드 모두 침묵. 강민호 인터뷰가 아니라 결과지표가 그대로 9연패를 말해주고 있습니다. 한화는 정반대로 NC전 5점 열세를 7회 6득점·8회 빅이닝으로 뒤집어 18-7 시즌 최다 득점, 강백호 145m 홈런 4타점·김태연 4타점 합작 8타점이라는 시즌 베스트 폼 신호가 잔뜩 나왔습니다. 선발 화이트는 시즌 첫 등판 햄스트링 부상에서 5/16 수원 KT전 6.1이닝 1자책 데뷔 첫 승으로 복귀, 이후 등판들도 깨끗해 표본은 적지만 1선발 모드. SSG 최민준은 제구가 불안정해 페라자·강백호·노시환 라인업과의 매치업이 매우 불리합니다. 대전 5/29 날씨도 맑음 예보라 우천취소 변수 없음. 화이트 컨디션 불확실성만 빼면 모든 항목에서 한화 우세라 신뢰도를 비교적 높게 잡았습니다."
  },
  {
    game_id: "4d957851-a623-4666-8f01-669b36124c1a",
    predicted_winner_team_id: "lg",
    confidence: 0.68,
    key_factor: "선발 격차 vs 6연승",
    one_liner: "이의리 ERA 8점대 vs 웰스 ERA 2점대, 다만 KIA 6연승 모멘텀이 가장 큰 변수입니다.",
    detailed_analysis:
      "이전이라면 LG로 자신 있게 70% 이상이지만, KIA 6연승 흐름은 가볍게 볼 수 없습니다. 황동하가 5월 5경기 5승 ERA 1.48로 5월 MVP 후보, 시라카와 영입까지 더해 우승후보 대열 합류라는 헤드라인이 일제히 KIA 쪽이고 박재현·김도영·아데를린 라인업도 다득점 중. 다만 오늘 등판은 황동하가 아니라 이의리입니다. 이범호 감독이 사실상 '마지막 기회'라고 언급할 만큼 5월 부진(2이닝 못 채우고 강판한 등판 포함)이 누적된 상태. 반대편 웰스는 시즌 ERA 2점대로 KBO 최상위급 안정감이라 단일 경기 선발 매치업은 LG가 분명히 우세입니다. LG는 이미 시즌 30승 가장 빨리 도달했고 잠실 홈, 홍창기·박해민·오스틴 톱3 출루가 이의리의 볼넷 약점을 그대로 파고들 매치업. 잠실 5/29 맑음 예보로 외부 변수도 없습니다. KIA 모멘텀을 감안해 confidence는 살짝 낮췄지만 매치업 자체는 LG."
  },
  {
    game_id: "80251d7e-0511-416d-ac8c-147b7ef17f8c",
    predicted_winner_team_id: "samsung",
    confidence: 0.72,
    key_factor: "선두 3연승+홈런쇼",
    one_liner: "어제 홈런 5방으로 SSG를 10-1 완파한 선두 삼성, 원태인 추가 휴식까지 챙겼습니다.",
    detailed_analysis:
      "삼성은 5/28 SSG전 홈런 5방 10-1 대승으로 선두 3연승, 박진만 감독이 직접 '하위타선 홈런 4방'을 비결로 꼽을 만큼 라인업 전체가 폭발 중입니다. 디아즈·박승규·전병우·이재현으로 이어지는 5~7번이 살아나면서 구자욱·최형우 의존도가 줄어든 게 이번 시즌 가장 결정적 변화. 원태인은 햄스트링 복귀 직후이지만 5/26 두산전 우천취소로 추가 휴식까지 확보해 컨디션이 가장 좋은 상태로 등판합니다. 두산은 카메론 부진이 클린업을 끊어버리는 구조가 그대로, 양의지가 발목 통증에서 5/28 KT전 5번 DH로 복귀해 최근 10경기 0.353 타격감으로 반등 신호를 내긴 했지만 어제 KT에 패해 분위기는 여전히 가라앉아 있습니다. 잭로그는 직전 5/16 롯데전 6이닝 6실점으로 흔들렸고, K9 8.5대 탈삼진형이지만 삼성 라인업 K%가 18% 안팎으로 K형 투수에게 강한 콘택트 그룹이라 그것마저 상쇄됩니다. 대구 5/29 맑음 예보로 외부 변수 없음."
  },
  {
    game_id: "790f6cfc-35db-4ec3-87a3-283e258f40e6",
    predicted_winner_team_id: "kt",
    confidence: 0.64,
    key_factor: "분위기+타선 콘택트",
    one_liner: "KT는 어제 고영표가 51일 만에 시즌 2승, 키움은 KIA에게 스윕 — 흐름이 엇갈렸습니다.",
    detailed_analysis:
      "5/28 KT는 두산을 완파하며 고영표가 51일 만에 시즌 2승, 이강철 감독이 '8회 빅이닝 승기'를 언급할 만큼 흐름이 살아났습니다. 반대로 키움은 KIA에게 3연전 스윕(5-0 포함) 완패, 안우진·알칸타라·로젠버그가 3경기 연속 KIA 타선을 못 막은 게 더 뼈아픕니다. 선발만 따로 떼면 사우어·배동현 모두 ERA 4점대 중후반·WHIP 1.4 안팎으로 매치업 자체는 박빙. 갈리는 곳은 라인업 콘택트입니다. KT는 최원준·김현수·힐리어드·허경민 라인이 K% 16% 전후로 KBO 상위권 콘택트 그룹이라 4점대 ERA 투수에게 다득점을 뽑아내기 좋고, 키움은 서건창·안치홍·임병욱·최주환 라인이 SLG·ISO·K% 모두 하위권. 고척 홈 이점이 변수라 confidence는 중간 정도에 잡았지만 KT 쪽으로 무게 추가 기울었다고 봅니다."
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
