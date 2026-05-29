// 2026-05-30 Claude 예측 5건 INSERT.
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

const GAME_DATE = "2026-05-30";
const PUBLISHED_AT = "2026-05-30T09:00:00+09:00";
const MODEL = "claude-opus-4-7";

const rows = [
  {
    game_id: "5f6b53d6-a9e1-4ac7-bf1a-28a0314ba8a7",
    predicted_winner_team_id: "doosan",
    confidence: 0.53,
    key_factor: "9회 대역전 여진",
    one_liner: "어제 강승호 9회 역전 만루포로 라팍을 침묵시킨 두산, 모멘텀이 살짝 무게 추를 옮깁니다.",
    detailed_analysis:
      "선발 매치업만 떼면 오러클린이 분명히 우세입니다. 5연속 QS 흐름에 구단이 7월까지 계약 연장을 발표할 만큼 1선발급 안정세, 반대편 최승용은 직전 등판도 길게 가지 못한 영건이라 이닝 소화부터 차이가 납니다. 그런데 오늘 무게 추는 어제 9회에 옮겨졌습니다. 두산은 강승호 만루포 + 정수빈 쐐기로 9회에만 6점을 뽑아 라팍 역전, 김원형 감독이 직접 '포기하지 않았다'고 강조할 만큼 라커룸 분위기가 한 단계 끌어올려진 상황입니다. 삼성은 정반대로 클로저 운영이 흔들리며 5연속 QS 호투를 날렸고, 어제 충격에서 단 하루 만에 회복되긴 어렵습니다. 그래도 오러클린 등판 + 대구 홈이라는 매치업 자체의 안정감이 워낙 두꺼워서 판단을 강하게 가져가긴 부담스럽습니다. 박빙으로 보는 게 솔직한 결론이고, 분위기 한 끗 차이로 원정 두산에 미세하게 베팅."
  },
  {
    game_id: "10691854-55a9-4f88-b6d4-e9836153ccc9",
    predicted_winner_team_id: "lg",
    confidence: 0.66,
    key_factor: "타선 12득점 + 잠실 홈",
    one_liner: "어제 LG가 KIA 7연승을 끊으며 12득점 폭발, 송승기-올러 매치업도 LG 쪽으로 살짝 기울었습니다.",
    detailed_analysis:
      "선발 매치업은 송승기와 올러 둘 다 ERA 4점대 안팎으로 표면적으로는 호각이지만, KIA 라인업과 LG 라인업의 좌·우 분포에서 LG가 한 발 앞섭니다. 홍창기·박해민·오스틴·오지환 톱4가 어제 12-? 대승에서 장단 12안타를 합작하며 폼을 끌어올렸고, 염경엽 감독이 '오늘 계기로 타선 살아나길'이라 직접 언급한 만큼 다타선 모드 진입 신호가 큽니다. KIA는 7연승 끝에 어제 이의리 2이닝 6실점으로 분위기가 한 번 꺾였고, 오늘 등판하는 올러도 직전 등판들에서 5이닝 안팎으로 짧아지는 경향이 보입니다. 박재현·김도영·아데를린의 클린업 자체는 여전히 위협적이라 일방적인 경기는 아니겠지만, 잠실 홈 + 어제 살아난 타선 + KIA 직전 충격패 조합이라면 LG 쪽으로 65% 안팎 정도가 합리적 무게입니다."
  },
  {
    game_id: "f173c876-c703-435f-a494-08ade87ae264",
    predicted_winner_team_id: "nc",
    confidence: 0.6,
    key_factor: "라일리 vs 이민석",
    one_liner: "어제 구창모 노히트가 9회에 깨졌지만, 오늘은 외인 1선발 라일리 카드로 다시 균형을 잡습니다.",
    detailed_analysis:
      "핵심은 선발 매치업입니다. 라일리는 NC 외인 1선발급으로 시즌 ERA·이닝 모두 안정대, 반대편 롯데는 이민석이라는 영건을 올렸습니다. 라일리 vs 이민석은 표면 숫자보다 이닝 소화에서 격차가 클 가능성이 높고, 이는 결국 양 팀 불펜이 어떻게 쓰이느냐로 이어집니다. 롯데는 어제 연장 10회 5득점 승리로 분위기는 좋지만 그 대가로 김원중·최준용 라인이 많이 가동된 상태입니다. NC는 어제 박건우 동점포에도 패배하며 2연패에 빠졌고 분위기 자체는 살짝 가라앉아 있지만, 김주원-박민우-박건우-데이비슨 라인이 여전히 타격감을 유지하고 있어 라일리 5~6이닝 호투만 받쳐주면 자력으로 충분히 풀 수 있는 구도입니다. 분위기 변수를 인정해 60% 정도로 잡지만 매치업 자체는 NC 우세."
  },
  {
    game_id: "ad2766a5-4534-40f4-89b9-5343f838a9e3",
    predicted_winner_team_id: "hanwha",
    confidence: 0.78,
    key_factor: "류현진 vs 10연패",
    one_liner: "한화는 강백호·허인서 홈런쇼로 5할 복귀, SSG는 창단 첫 10연패 — 격차가 가장 큰 매치업입니다.",
    detailed_analysis:
      "오늘 다섯 경기 중 매치업이 가장 일방적입니다. SSG는 어제 한화전에서도 1점차 패배로 창단 첫 10연패, 박성한·에레디아·김재환 라인이 살아 있긴 해도 팀 전체 득점이 끊긴 지 길어 라커룸도 무거운 상태입니다. 반대편 한화는 강백호 100억 투런 + 허인서 50억 9회 2사 결승포로 어제 승리, 김경문 감독이 '집중력 깔끔'이라 직접 평할 만큼 타선·불펜·홈런 의존 모두 균형이 잡혔습니다. 선발은 류현진 vs 김건우. 류현진은 시즌 들어 가장 꾸준한 1선발 카드이고, 김건우는 직전 등판도 5이닝을 못 채워 5월 SSG 선발들 중 가장 흔들리는 쪽입니다. 페라자·강백호·노시환 클린업과 김건우 매치업 자체가 매우 불리. 대전 홈 이점까지 더하면 신뢰도 0.78 정도가 자연스럽고, 이 정도 신뢰도가 안 박히면 오히려 캐릭터가 흔들립니다."
  },
  {
    game_id: "a4e71d35-c30c-4bc4-81a9-664239a91f86",
    predicted_winner_team_id: "kt",
    confidence: 0.6,
    key_factor: "분위기 vs 박정훈",
    one_liner: "KT는 어제 최원준 만루포로 키움 6연패에 못 박았고, 오늘은 양 팀 모두 영건 선발 매치업입니다.",
    detailed_analysis:
      "오늘은 양 팀 모두 영건이 선발입니다. 문용익(KT)·박정훈(키움) 둘 다 표본이 적어 단일 경기 ERA만으로 판단이 어려운 구간이라, 자연스럽게 라인업 콘택트와 직전 흐름이 무게가 커집니다. KT는 어제 사우어 QS + 최원준 그랜드슬램으로 키움 7-1 완파, 이강철 감독이 '주말 1위 도전'까지 언급할 만큼 흐름이 살아 있습니다. 최원준-김현수-힐리어드-허경민으로 이어지는 라인이 영건 선발 상대 콘택트 우위가 더 크게 발휘되기 좋은 라인업입니다. 키움은 정반대로 6연패, 어제 사우어에게 안타 4개에 그치며 라커룸 분위기까지 다운된 상태로 고척돔 야간 특타까지 진행했다는 보도가 나왔습니다. 다만 키움이 고척 홈이고 영건 선발끼리는 변동성이 크다는 점에서 0.6 정도가 합리적, KT가 안전한 매치업 우위지만 단정은 살짝 보류."
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
