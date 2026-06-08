// 2026-06-09 Gemini 예측 5건 - 기존 데이터 삭제 후 신규 INSERT.
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

const GAME_DATE = "2026-06-09";
const PUBLISHED_AT = "2026-06-09T09:00:00+09:00";
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
    game_id: "cf3ad074-cf17-40f7-8c5d-4974ab453149",
    predicted_winner_team_id: "doosan",
    confidence: 0.64,
    key_factor: "곽빈의 탈삼진 능력과 피홈런 억제력",
    one_liner: "9이닝당 탈삼진 11.12개를 기록 중인 곽빈의 막강한 구위가 롯데의 하위 타선을 상대로 위력을 발휘할 것입니다. 나균안도 안정적이지만 피홈런 제어와 타선의 득점 지원력에서 앞선 두산이 승리할 전망입니다.",
    detailed_analysis:
      "두산 선발 곽빈은 이번 시즌 ERA 3.26, 9이닝당 탈삼진 11.12개로 리그 정상급 구위를 보이고 있으며, 피홈런율(HR9 0.44)도 매우 낮아 대량 실점의 리스크가 적습니다. 반면 롯데 선발 나균안은 ERA 3.53으로 안정적이지만 9이닝당 피홈런(HR9 1.13)이 다소 높아 한 방을 조심해야 합니다. 롯데 타선은 팀 평균 OPS 0.684로 득점권 해결 능력이 침체되어 있는 반면, 두산은 조수행(OPS 0.810)과 박준순(0.881) 등 상위 타선의 기동력과 짜임새가 더 뛰어납니다. 곽빈이 롯데의 강타자 레이예스를 봉쇄하는 사이, 두산 타선이 나균안의 실투를 공략해 리드를 잡을 것으로 예측됩니다."
  },
  {
    game_id: "d455847a-e366-4627-bc16-a8d9ef01d2ac",
    predicted_winner_team_id: "kt",
    confidence: 0.62,
    key_factor: "고영표의 송곳 제구력과 최원태의 볼넷 허용 리스크",
    one_liner: "9이닝당 볼넷 1.60개로 정밀 제구를 보여주는 고영표가 사사구 허용이 많은 삼성 최원태와의 마운드 대결에서 우위를 점할 것입니다. 홈 타선의 확실한 득점 지원을 받는 KT가 이번 경기를 가져갈 것으로 보입니다.",
    detailed_analysis:
      "KT 선발 고영표는 9이닝당 탈삼진 10.45개와 압도적인 제구력(BB9 1.60)을 겸비하여 실질적인 피칭 안정감이 매우 뛰어납니다. 반면 삼성 선발 최원태는 WHIP 1.53, BB9 3.74로 주자를 많이 허용하는 고질적인 문제를 안고 있어, 경기 초반부터 KT의 강타선(팀 평균 OPS 0.813)에게 찬스를 줄 위험이 큽니다. KT는 안현민(OPS 1.161), 최원준(0.988) 등 출루율과 장타력을 겸비한 타자들이 즐비해 최원태의 사사구 남발을 대량 득점으로 연결시킬 능력이 충분합니다. 고영표가 노련하게 삼성 타선을 범타 처리하는 사이 KT가 득점을 쌓아 승리할 것으로 예상됩니다."
  },
  {
    game_id: "d6c9efc1-38c4-4aae-8e36-298d42c10b62",
    predicted_winner_team_id: "hanwha",
    confidence: 0.70,
    key_factor: "황동하의 피홈런 취약성과 한화 홈런포의 시너지",
    one_liner: "9이닝당 피홈런 1.84개로 홈런 허용이 잦은 황동하가 대전구장에서 한화의 핵타선을 극복하기는 쉽지 않아 보입니다. 안정적인 선발 왕옌청을 내세운 한화가 화력전 끝에 승리를 가져올 전망입니다.",
    detailed_analysis:
      "한화 선발 왕옌청은 이번 시즌 5승 2패 ERA 3.13, 피홈런 억제력(HR9 0.57)을 바탕으로 뛰어난 실점 제어 능력을 보여주고 있습니다. 반면 KIA 선발 황동하는 ERA 4.41에 9이닝당 피홈런이 1.84개로 장타 허용율이 매우 높은 상태에서, 타자 친화적인 대전 구장에서 경기를 치러야 하는 심각한 약점을 안고 있습니다. 페라자(OPS 0.987)와 강백호(0.986)가 이끄는 한화 타선은 팀 타율 0.321로 타격감이 정점이며, 실투를 담장 밖으로 넘겨버릴 힘을 충분히 갖추고 있습니다. 왕옌청이 KIA 타선(팀 평균 OPS 0.795)을 상대로 주자를 적절히 억제하는 동안 한화 타선이 홈런포로 승기를 굳힐 것으로 예상됩니다."
  },
  {
    game_id: "c83b23f9-3a85-45ee-b35e-ff854a113c95",
    predicted_winner_team_id: "kiwoom",
    confidence: 0.60,
    key_factor: "로젠버그의 탈삼진 능력과 NC 선발의 장타 허용 불안",
    one_liner: "10개가 넘는 9이닝당 탈삼진을 바탕으로 구위를 입증한 로젠버그가 NC의 강타선을 효과적으로 잠재울 것입니다. 피홈런이 많은 NC 김태경을 상대로 고척 홈의 이점을 살려 키움이 승리를 거둘 전망입니다.",
    detailed_analysis:
      "키움 선발 로젠버그는 표본이 적으나 ERA 3.18, 9이닝당 탈삼진 10.06개로 압도적인 구위와 안정적인 장타 제어(HR9 0.53) 능력을 검증받았습니다. 반면 NC 선발 김태경은 9이닝당 피홈런 1.69개로 마운드 불안 요소를 노출하고 있어 장타력 면에서 불안감이 큽니다. 비록 NC 타선(팀 평균 OPS 0.735)이 키움보다 짜임새는 우수하지만, 로젠버그의 묵직한 구위를 넘어서기는 쉽지 않을 것입니다. 키움 타선이 김태경의 실투와 볼넷을 놓치지 않고 득점으로 연결하여 로젠버그에게 승리 투수 요건을 선물할 것입니다."
  },
  {
    game_id: "583ecf6c-f87f-4c68-87e6-29add37a77fa",
    predicted_winner_team_id: "lg",
    confidence: 0.72,
    key_factor: "임찬규의 잠실 피칭 노하우와 SSG의 임시 선발 변수",
    one_liner: "넓은 잠실구장 상성을 적극 활용하는 베테랑 임찬규의 위기관리 능력이 SSG의 장타력을 제어할 핵심 무기입니다. 불펜 소모가 예상되는 SSG의 오프너 마운드를 공략하여 LG가 안방에서 승리할 전망입니다.",
    detailed_analysis:
      "LG 선발 임찬규는 ERA 3.88로 실점 통제 능력이 검증되었으며, 넓은 잠실을 홈으로 써 피장타 억제와 외야수비의 도움을 받기 좋은 투수입니다. 반면 SSG는 선발 등판 경험이 적은 구원 자원 김민준을 올려 불펜 전면전을 치러야 하는 상태입니다. SSG의 타선(팀 평균 OPS 0.912)은 파괴력이 대단하지만 홈구장에 비해 장타가 억제되는 잠실 구장의 특성을 극복해야 하는 부담이 있습니다. 오스틴(OPS 1.042)과 문성주(0.831)를 필두로 정교한 공격을 풀어가는 LG 타선이 SSG의 불안한 마운드를 쉼 없이 흔들며 낙승을 이끌 것입니다."
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
