// 2026-05-30 Gemini 예측 5건 - 기존 데이터 삭제 후 신규 INSERT.
// ai_provider='gemini', published_at=09:00 KST.
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
const MODEL = "gemini-3-5-flash-medium";

// --- 1) 기존 예측 데이터 삭제 ---
console.log(`Deleting existing predictions for ${GAME_DATE} and ai_provider='gemini'...`);
const { error: delError, count } = await sb
  .from("bp_ai_predictions")
  .delete()
  .eq("game_date", GAME_DATE)
  .eq("ai_provider", "gemini");

if (delError) {
  console.error("✗ Failed to delete existing predictions:", delError.message);
  process.exit(1);
}
console.log("✓ Existing predictions deleted successfully.");

// --- 2) 신규 예측 데이터 삽입 ---
const rows = [
  {
    game_id: "5f6b53d6-a9e1-4ac7-bf1a-28a0314ba8a7",
    predicted_winner_team_id: "samsung",
    confidence: 0.75,
    key_factor: "선발 안정감 우위",
    one_liner: "시즌 ERA 3.68의 안정적인 오러클린이 출루 허용(WHIP 1.63)이 많은 최승용을 상대로 선발 우위를 점할 것.",
    detailed_analysis:
      "시즌 1위 삼성과 6위 두산의 대결입니다. 두산이 직전 경기에서 9회 극적 만루 홈런으로 이겼으나, 선발 매치업의 정량 지표 격차는 삼성이 확연히 우세합니다. 삼성 선발 오러클린은 시즌 ERA 3.68, WHIP 1.21로 훌륭하며, 두산 선발 최승용은 ERA 5.13, WHIP 1.63으로 출루 허용이 많습니다. 데이터 보수파 관점에서는 단기적인 하루의 기세보다 투수 전력의 누적 안정성에 훨씬 높은 신뢰를 보냅니다. 오러클린의 제구력과 1위 삼성의 화력을 믿고 삼성의 우세를 예상합니다."
  },
  {
    game_id: "10691854-55a9-4f88-b6d4-e9836153ccc9",
    predicted_winner_team_id: "kia",
    confidence: 0.72,
    key_factor: "에이스 카드 우세",
    one_liner: "시즌 6승 ERA 2.45의 에이스 올러가 선발 마운드의 안정감을 주도하며 KIA의 승리를 이끌 것.",
    detailed_analysis:
      "2위 LG와 4위 KIA의 상위권 대결입니다. 직전 경기는 LG가 대승을 거두었으나 오늘 선발 매치업은 KIA가 압도적으로 우세합니다. KIA 선발 올러는 ERA 2.45, WHIP 0.93, 6승 3패를 기록 중인 리그 최정상급 에이스 카드입니다. 반면 LG 송승기는 ERA 4.71, WHIP 1.48로 비교적 출루 허용이 많고 피홈런 억제력도 불안합니다. 에이스 올러의 견고한 실점 억제력을 바탕으로 KIA가 확실한 투수전의 우위를 가져갈 것으로 기대됩니다."
  },
  {
    game_id: "f173c876-c703-435f-a494-08ade87ae264",
    predicted_winner_team_id: "nc",
    confidence: 0.76,
    key_factor: "극명한 선발 격차",
    one_liner: "WHIP 1.00의 철벽 라일리와 제구 불안이 심각한 이민석의 선발 무게추가 NC로 완전히 기운다.",
    detailed_analysis:
      "8위 롯데와 9위 NC의 대결입니다. 롯데가 최근 연승을 달리고 있으나 오늘 선발 매치업은 극단적으로 한쪽에 치우칩니다. NC 선발 라일리는 ERA 3.27, WHIP 1.00, BB9 1.64로 완벽에 가까운 제구력과 안정성을 보여줍니다. 반면 대체 선발로 나서는 롯데 이민석은 주로 불펜으로 뛰며 ERA 11.42, WHIP 2.19, BB9 8.28로 제구 기복이 매우 심합니다. 투수의 출루 억제 능력을 신뢰하는 데이터 보수파는 흔들림 없는 라일리 카드를 보유한 NC의 낙승을 예상합니다."
  },
  {
    game_id: "ad2766a5-4534-40f4-89b9-5343f838a9e3",
    predicted_winner_team_id: "hanwha",
    confidence: 0.74,
    key_factor: "에이스의 제구력",
    one_liner: "BB9 1.37의 정교한 류현진과 10연패 늪에 빠져 타선 집중력이 흔들리는 SSG의 명확한 차이.",
    detailed_analysis:
      "2연승으로 5할 승률에 복귀하며 5위를 달리고 있는 한화와, 10연패의 역사적인 연패 수렁에 빠진 SSG(7위)의 경기입니다. 한화는 에이스 류현진을 등판시킵니다. 류현진은 시즌 ERA 3.42, WHIP 1.04, 그리고 볼넷 제어가 BB9 1.37로 완벽에 가까워 볼넷으로 자멸하지 않는 확실한 지표를 갖췄습니다. SSG 선발 김건우는 ERA 3.68로 준수하지만 BB9 4.56으로 제구 기복이 있습니다. 극명한 최근 기세와 투수 제구의 정밀성 차이를 근거로 한화의 우세를 신뢰합니다."
  },
  {
    game_id: "a4e71d35-c30c-4bc4-81a9-664239a91f86",
    predicted_winner_team_id: "kt",
    confidence: 0.62,
    key_factor: "전력 및 순위 우위",
    one_liner: "선발이 모두 불완전한 상태에서 3위 KT의 탄탄한 전력과 불펜 깊이가 최하위 키움을 압도할 것.",
    detailed_analysis:
      "3위 KT와 10위 키움의 대결입니다. 양 팀 모두 불펜 오프너 혹은 임시 선발(박정훈 vs 문용익)을 활용하여 마운드 운영의 변수가 매우 큽니다. 선발 투수의 긴 이닝 소화를 기대하기 힘들기 때문에 결국 불펜 총력전 및 타선 화력 싸움으로 전환될 것입니다. 이 경우 시즌 전체 승률 지표가 우수하고 전력이 더 두터운 3위 KT가 6연패 수렁에 빠진 키움보다 마운드 뒷문과 집중력 면에서 앞서게 됩니다. 변수가 있는 임시 매치업이므로 신뢰도는 보수적인 0.62로 설정합니다."
  }
];

console.log(`Inserting ${rows.length} new predictions for ${GAME_DATE}...`);

let okCount = 0;
let failCount = 0;
for (const r of rows) {
  const payload = {
    game_id: r.game_id,
    game_date: GAME_DATE,
    ai_provider: "gemini",
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
