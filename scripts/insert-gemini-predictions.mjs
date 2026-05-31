// 2026-05-31 Gemini 예측 5건 - 기존 데이터 삭제 후 신규 INSERT.
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

const GAME_DATE = "2026-05-31";
const PUBLISHED_AT = "2026-05-31T09:00:00+09:00";
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
    game_id: "e3b6b910-c2fe-4b1f-a090-febe191b2bc6",
    predicted_winner_team_id: "lg",
    confidence: 0.72,
    key_factor: "선발 안정성 우위",
    one_liner: "시즌 6승 ERA 3.44의 톨허스트가 제구가 흔들리는 양현종을 상대로 선발 우위를 보여줄 것.",
    detailed_analysis:
      "시즌 1위로 도약한 LG와 4위 KIA의 잠실 시리즈 최종전입니다. 양 팀 선발 투수의 정량적 데이터에서 확실한 차이가 발생합니다. LG 선발 톨허스트는 시즌 ERA 3.44, WHIP 1.18, 6승 3패로 매우 견고하며 출루를 효율적으로 억제하고 있습니다. 반면 KIA 양현종은 시즌 ERA 4.74, WHIP 1.40으로 출루 허용이 잦고 위기관리에서 기복을 보입니다. 어제 타선이 폭발하며 12-2 대승을 거둔 LG가 홈에서 톨허스트의 안정성을 발판 삼아 승리를 굳힐 것입니다."
  },
  {
    game_id: "732ab61d-523f-4267-88a9-ef26b3b57617",
    predicted_winner_team_id: "doosan",
    confidence: 0.68,
    key_factor: "선발 클래스 차이",
    one_liner: "ERA 2.84의 강력한 구위를 가진 최민석이 오프너 카드를 꺼낸 삼성을 상대로 우위를 점할 것.",
    detailed_analysis:
      "시즌 3위 삼성과 6위 두산의 대결입니다. 삼성은 상위권에 랭크되어 있으나 현재 2연패 중이며, 금일 선발은 불펜 자원인 양창섭이 임시 오프너성으로 등판해 이닝 소화 면에서 큰 리스크를 안고 있습니다. 반면 두산은 선발 최민석이 ERA 2.84, WHIP 1.30, K9 8.52로 빼어난 구위와 안정감을 보여주어 정식 선발 매치업의 완성도 차이가 극명합니다. 삼성의 대구 홈런 화력이 복병이지만, 검증된 투수 데이터에 무게를 두는 관점에서는 두산의 승리 확률이 더 높습니다."
  },
  {
    game_id: "0057eb37-edbb-4dc6-b7ad-bece1113d74b",
    predicted_winner_team_id: "lotte",
    confidence: 0.70,
    key_factor: "선발 제구 및 구위 우세",
    one_liner: "탈삼진 능력(K9 10.81)과 제구가 안정된 비슬리가 볼넷 불안을 안은 테일러를 압도할 것.",
    detailed_analysis:
      "공동 8위 팀 간의 하위권 대결입니다. 양 팀의 팀 성적은 동률이나 선발 매치업의 퀄리티 격차가 큽니다. 롯데 선발 비슬리는 ERA 3.71, WHIP 1.35, BB9 2.53, K9 10.81로 빼어난 제구력과 폭발적인 삼진 능력을 고루 갖추었습니다. 반면 NC 선발 테일러는 ERA 5.77, WHIP 1.53, BB9 4.94로 매 경기 볼넷 남발과 주자 누적으로 자멸하는 흐름을 보여줍니다. 선발 투수의 사사구 억제 지표와 위기관리 능력을 중시하는 보수파 관점에서는 롯데의 우세가 뚜렷합니다."
  },
  {
    game_id: "f9b6e8ca-e20e-45e9-ac60-1a1286b6ca14",
    predicted_winner_team_id: "hanwha",
    confidence: 0.78,
    key_factor: "상대 선발 붕괴 및 기세",
    one_liner: "시즌 1승 6패 ERA 8.69로 붕괴된 타케다를 상대로 5할 복귀에 성공한 한화 타선이 폭발할 것.",
    detailed_analysis:
      "최근 3연승으로 5할 승률 복귀에 성공한 5위 한화와, 충격의 10연패 수렁에 빠진 7위 SSG의 경기입니다. 한화 에르난데스(ERA 4.68)도 확실한 카드는 아니지만, 상대 선발인 SSG 타케다는 시즌 1승 6패, ERA 8.69, WHIP 1.96, BB9 5.17로 마운드가 완전히 붕괴된 최악의 정량 지표를 보이고 있습니다. 10연패를 겪는 동안 투타 밸런스가 완전히 깨진 SSG가 대전 원정에서 류현진 등판 경기 다음 날의 한화 타선을 당해내기는 어려워 보입니다. 기세가 충천한 한화의 완승이 기대됩니다."
  },
  {
    game_id: "9f918c50-d498-4a0d-a337-d985b6876fa0",
    predicted_winner_team_id: "kt",
    confidence: 0.74,
    key_factor: "선발 제구 및 순위 차이",
    one_liner: "볼넷 억제력(BB9 2.38)이 뛰어난 6승의 보쉴리가 제구 난조가 있는 박준현을 상대로 안정적인 경기를 이끌 것.",
    detailed_analysis:
      "3연승과 함께 단독 2위로 우뚝 선 KT와, 6연패에 빠진 최하위 10위 키움의 경기입니다. 키움 선발 박준현은 시즌 ERA 2.84로 낮아 보이나 WHIP 1.46, BB9 5.69로 제구 기복이 매우 심해 실질적인 마운드 위험도가 높습니다. 반면 KT 선발 보쉴리는 6승 3패, ERA 3.49, WHIP 1.41에 BB9 2.38로 이닝 소화력과 안정감에서 훨씬 완성도 높은 투구를 기대할 수 있습니다. 밤샘 특타를 진행할 만큼 침체된 키움 타선이 보쉴리를 공략하긴 어렵고, 투타 전반의 힘의 균형에서 앞선 KT가 승리할 것입니다."
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
