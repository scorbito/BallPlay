// 2026-05-31 Claude 예측 5건 INSERT.
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

const GAME_DATE = "2026-05-31";
const PUBLISHED_AT = "2026-05-31T09:00:00+09:00";
const MODEL = "claude-opus-4-7";

const rows = [
  {
    game_id: "e3b6b910-c2fe-4b1f-a090-febe191b2bc6",
    predicted_winner_team_id: "lg",
    confidence: 0.62,
    key_factor: "1위 탈환 + 잠실 홈",
    one_liner: "어제 35일 만에 1위를 탈환한 LG, 잠실에서 양현종을 맞아 2연승에 도전합니다.",
    detailed_analysis:
      "양현종 vs 톨허스트 자체는 호각으로 봐야 합니다. 양현종은 KIA의 베테랑 좌완으로 잠실에서도 경력이 두텁고, 톨허스트는 LG 외인 선발 중에서는 변동성이 살짝 큰 카드입니다. 단일 매치업으로만 보면 KIA가 살짝 우세하다는 평가도 가능합니다. 그런데 오늘 경기에서 그 호각의 매치업 위에 분위기와 라인업 결이 그대로 얹힙니다. LG는 어제 오지환·오스틴 홈런포로 3-1 승리하며 35일 만에 1위 탈환, 염경엽 감독 인터뷰 톤도 '이 흐름을 이어가자'로 정리됐고 문보물 복귀라는 추가 보강 헤드라인까지 같이 나왔습니다. KIA는 정반대로 6연승 직후 2연패, 이의리는 2군행이 확정되었고 시라카와 합류는 다음 주라 이번 시리즈는 기존 마운드로 버텨야 합니다. 잠실 홈 이점 + 홍창기·박해민·오스틴·오지환 톱4의 좌완 양현종에 대한 콘택트 실적까지 더하면 LG 쪽으로 60% 초반대가 합리적. 양현종 카드의 무게를 인정해 confidence는 보수적으로 잡았습니다."
  },
  {
    game_id: "732ab61d-523f-4267-88a9-ef26b3b57617",
    predicted_winner_team_id: "doosan",
    confidence: 0.6,
    key_factor: "2일 연속 만루포 모멘텀",
    one_liner: "어제 정수빈 9회 만루포로 이틀 연속 역전극을 만든 두산, 라팍에서 분위기를 그대로 가져옵니다.",
    detailed_analysis:
      "선발 매치업은 최민석과 양창섭, 둘 다 영건이라 단일 경기 변동성이 큽니다. 시즌 누적 ERA·이닝 모두 호각에 가깝지만 양창섭이 5월 들어 5이닝 이전 강판이 잦았다는 점, 그에 비해 최민석이 직전 등판에서 비교적 안정적으로 5이닝을 채운 점에서 살짝 두산 쪽이 우위입니다. 그런데 오늘 무게 추를 결정하는 건 어제 9회입니다. 두산은 강승호(5/29)·정수빈(5/30) 이틀 연속 역전 만루포라는 역대 두 번째 진기록으로 시리즈를 끌고 왔고, 김원형 감독이 '포기하지 않는 야구'를 두 번 연속 언급한 만큼 라커룸이 가장 단단한 상태입니다. 삼성은 헤드라인에 '차라리 0-10 대패가 나았다'가 등장할 만큼 정신적 내상이 누적, 박진만 감독도 인터뷰에서 마무리 운영 재점검을 시사했습니다. 다만 대구 홈 + 디아즈·구자욱·최형우 클린업의 폭발력 자체는 여전해서 확신도는 0.6 정도가 정직."
  },
  {
    game_id: "0057eb37-edbb-4dc6-b7ad-bece1113d74b",
    predicted_winner_team_id: "nc",
    confidence: 0.55,
    key_factor: "외인 vs 외인 박빙",
    one_liner: "비슬리-테일러 외인 선발 매치업에 어제 NC 만원관중 역전승 분위기를 살짝 얹습니다.",
    detailed_analysis:
      "비슬리와 테일러 모두 외인 선발 카드라 단일 경기 변수가 큰 매치업입니다. 비슬리는 시즌 ERA가 4점대 초반·QS 빈도가 높은 안정형, 테일러는 등판 표본이 짧아 변동성이 더 크다는 점에서 정량만 보면 롯데가 살짝 유리할 수도 있습니다. 다만 그 차이를 어제 흐름이 상당히 메웠습니다. NC는 어제 라일리 호투 + 데이비슨 결승타 + 김형준 쐐기포로 2연패를 탈출하면서 엔팍 개장 7년 만의 30번째 만원관중까지 등에 업었고, 박민우·박건우·데이비슨 클린업이 동시에 폼을 회복했습니다. 롯데는 정반대로 6-2 패배 + 직전 김원중·최준용 가동까지 겹쳐 불펜 신선도가 떨어진 상태. 비슬리 5이닝이 빠르게 마무리되면 그 빈자리가 바로 약점으로 노출됩니다. 매치업 자체는 호각, 분위기·홈·라인업 폼에서 NC 쪽으로 살짝 — 박빙 인정해 0.55 정도가 정직한 무게입니다."
  },
  {
    game_id: "f9b6e8ca-e20e-45e9-ac60-1a1286b6ca14",
    predicted_winner_team_id: "hanwha",
    confidence: 0.74,
    key_factor: "11연패 vs 3연승",
    one_liner: "한화는 어제 류현진 201승으로 3연승, SSG는 구단 최다 타이 11연패 — 격차가 가장 명확합니다.",
    detailed_analysis:
      "오늘 다섯 경기 중 매치업이 가장 일방적인 카드입니다. SSG는 어제 3홈런 13안타에도 13-10으로 패배할 만큼 마운드가 통째로 무너진 상태, 구단 역대 최다 타이 11연패라는 헤드라인이 그대로 분위기를 말해줍니다. 한화는 정반대로 류현진 201승 + 강백호 5타점 + 노시환 쐐기포로 3연승, 5할+ 복귀에 대전 25번째 전석 매진까지 더해져 라커룸·관중 모두 폭발 직전. 선발은 타케다 vs 에르난데스. 타케다는 SSG가 임시방편으로 굴리는 카드라 5이닝조차 불투명한 반면, 에르난데스는 시즌 안착 단계의 외인이고 페라자·강백호·노시환 클린업과의 매치업도 우위. 이 정도 격차에서 신뢰도를 낮게 잡으면 오히려 매치업 균형 감각이 깨집니다. 단, 외인 매치업 변동성과 SSG 라인업의 잠재 폭발력을 일부 인정해 0.74로 마무리."
  },
  {
    game_id: "9f918c50-d498-4a0d-a337-d985b6876fa0",
    predicted_winner_team_id: "kt",
    confidence: 0.68,
    key_factor: "단독 2위 vs 7연패",
    one_liner: "KT는 3연승으로 단독 2위 도약, 키움은 7연패 — 보쉴리-박준현 매치업도 KT가 명확히 우위입니다.",
    detailed_analysis:
      "선발 매치업부터 KT 쪽이 분명히 우세합니다. 보쉴리는 KT가 5선발급으로 굴리는 외인이지만 시즌 들어 6이닝 안팎을 꾸준히 채워주는 안정세, 반대편 박준현은 키움 영건으로 표본이 짧고 직전 등판에서 5이닝 이전 강판한 경기가 있어 이닝 소화 자체에서 차이가 예상됩니다. 라인업 콘택트에서도 격차가 있습니다. KT는 최원준이 어제 3안타로 폼을 끌어올렸고 김현수·힐리어드·허경민 라인이 K% 16% 안팎으로 영건 선발에게 다득점을 뽑기 좋은 콘택트 그룹. 키움은 새 용병 히우라 멀티히트라는 작은 반등 신호가 있긴 하지만 7연패 분위기가 라커룸 전체를 누르는 상황입니다. KT는 단독 2위 도약 직후라 '1위 LG 0.5G 차'라는 동기 부여까지 명확. 고척 홈 이점만 변수로 인정해 0.68로 정리."
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
