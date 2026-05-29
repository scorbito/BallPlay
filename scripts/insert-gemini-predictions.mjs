// 2026-05-29 Gemini 예측 5건 - 기존 데이터 삭제 후 신규 INSERT.
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

const GAME_DATE = "2026-05-29";
const PUBLISHED_AT = "2026-05-29T09:00:00+09:00";
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
    game_id: "d0f783c8-f7fb-4daf-a360-b610f9abb3ff",
    predicted_winner_team_id: "nc",
    confidence: 0.60,
    key_factor: "선발 제구 우위",
    one_liner: "선발 투수의 안정성(구창모 WHIP 1.39 vs 박세웅 1.57)과 NC의 홈 이점이 우위를 가를 것.",
    detailed_analysis:
      "NC와 롯데는 현재 공동 8위로 순위가 같지만, 선발 투수의 안정성에서 차이가 드러납니다. NC 선발 구창모는 시즌 ERA 4.47, WHIP 1.39, 9이닝당 볼넷(BB9) 2.98로 안정적인 제구력을 보유하고 있습니다. 반면 롯데 선발 박세웅은 ERA 4.71, WHIP 1.57, BB9 4.53으로 제구 불안이 크고 볼넷 허용률이 높습니다. 롯데는 직전 LG전에서 불펜 6명을 기용하는 총력전을 펼쳤기에 불펜 피로도가 쌓인 상태입니다. 창원 홈구장의 이점과 구창모의 안정적인 실점 억제력을 감안할 때 NC의 승리 가능성이 높습니다."
  },
  {
    game_id: "5358295e-ab78-49f2-b781-26ed45e6281b",
    predicted_winner_team_id: "hanwha",
    confidence: 0.68,
    key_factor: "팀 기세 차이",
    one_liner: "9연패 늪에 빠진 SSG의 침체와 대역전극으로 기세가 오른 한화의 화력 차이.",
    detailed_analysis:
      "한화는 직전 NC전에서 2-7의 열세를 극복하고 18-7 대역전승을 거두며 타선의 분위기가 최고조에 달해 있습니다. 강백호와 김태연의 타점이 폭발하며 분위기를 주도하고 있습니다. 반면 SSG는 투타 밸런스가 완전히 붕괴되며 9연패 수렁에 빠져 있습니다. SSG 선발 최민준은 ERA 3.51로 선방 중이나 볼넷 허용(BB9 4.61)이 많고, 연패로 지쳐있는 마운드가 한화의 강타선을 버티기 버거울 것입니다. 대전 홈 버프를 받는 한화가 기세상 우위를 가져갈 것으로 기대됩니다."
  },
  {
    game_id: "790f6cfc-35db-4ec3-87a3-283e258f40e6",
    predicted_winner_team_id: "kt",
    confidence: 0.72,
    key_factor: "전력 및 순위 차이",
    one_liner: "3위 KT의 투타 안정감과 5연패에 빠진 최하위 키움의 전력 격차가 드러날 것.",
    detailed_analysis:
      "3위 KT와 10위 키움의 매치업입니다. 키움은 고척 홈에서 3연전 스윕패를 당하며 5연패의 침체에 빠져 있습니다. 키움 선발 배동현은 ERA 4.54이나 WHIP 1.61로 매 이닝 많은 출루를 허용하고 있어 불안 요소가 많습니다. 이에 비해 KT 선발 사우어는 ERA 4.82이지만 WHIP 1.38로 안정적인 이닝 소화 및 주자 억제 능력을 보여줍니다. 직전 두산전에서 11득점을 올리며 연승 분위기를 탄 KT 타선의 기세가 배동현을 조기에 공략할 것이며, 전반적인 전력 차에 힘입어 KT가 우세할 것입니다."
  },
  {
    game_id: "80251d7e-0511-416d-ac8c-147b7ef17f8c",
    predicted_winner_team_id: "samsung",
    confidence: 0.78,
    key_factor: "에이스와 홈 이점",
    one_liner: "사흘 더 쉰 에이스 원태인의 안정적인 투구와 선두 삼성의 홈런 화력이 시너지를 낼 것.",
    detailed_analysis:
      "단독 선두 삼성은 직전 SSG전에서 홈런 5방을 터뜨리며 10-1 완승을 거두었고, 3연승의 안정적인 가도를 달리고 있습니다. 특히 선발 원태인은 충분한 휴식을 취하고 마운드에 올라 최고의 컨디션을 발휘할 수 있는 상태입니다(시즌 ERA 3.43, WHIP 1.19, BB9 2.06). 두산 선발 잭로그 역시 ERA 3.81로 준수하나, 두산은 직전 경기 8회에만 불펜이 10실점하는 대참사를 겪어 마운드가 흔들리고 있습니다. 타자 친화적인 대구 라팍에서 원태인의 호투와 삼성의 홈런포 시너지를 앞세워 삼성이 무난히 승리를 챙길 것입니다."
  },
  {
    game_id: "4d957851-a623-4666-8f01-669b36124c1a",
    predicted_winner_team_id: "lg",
    confidence: 0.75,
    key_factor: "선발 전력 격차",
    one_liner: "시즌 ERA 2.06의 웰스를 앞세운 LG가 제구 불안이 극심한 이의리의 KIA 타선을 침묵시킬 것.",
    detailed_analysis:
      "2위 LG와 4위 KIA의 매치업입니다. KIA가 6연승으로 상승세를 타고 있으나 오늘 선발 매치업의 기록 격차가 압도적입니다. LG 선발 웰스는 시즌 ERA 2.06, WHIP 0.97로 철벽 지표를 보여줍니다. 반면 KIA 선발 이의리는 복귀 이후 9이닝당 볼넷 7.84, WHIP 1.98, ERA 8.37로 심각한 제구 제어 문제를 드러내고 있습니다. 데이터의 확실한 신호에 기반하여 판단했을 때, 사사구 남발 가능성이 높은 이의리를 상대로 웰스가 압도적인 마운드 안정을 제공하며 홈 잠실에서 LG가 승리를 가져갈 확률이 높습니다."
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
