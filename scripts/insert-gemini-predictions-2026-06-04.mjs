// 2026-06-04 Gemini 예측 5건 - 기존 데이터 삭제 후 신규 INSERT.
// ai_provider='gemini', published_at=09:00 KST.

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

const GAME_DATE = "2026-06-04";
const PUBLISHED_AT = "2026-06-04T09:00:00+09:00";
const MODEL = "gemini-3-5-flash-medium";

// --- 1) 기존 예측 데이터 삭제 ---
console.log(`Deleting existing predictions for ${GAME_DATE} and ai_provider='gemini'...`);
const { error: delError } = await sb
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
    game_id: "60f781af-6cde-4a99-bcc5-f26909d5fd19",
    predicted_winner_team_id: "lotte",
    confidence: 0.60,
    key_factor: "선발 투수 안정감 차이",
    one_liner: "최근 6이닝 무실점으로 호투한 롯데 박세웅의 안정감이 대체 외인 시라카와를 내세운 KIA 마운드를 상대로 판정승을 거둘 것입니다.",
    detailed_analysis:
      "KIA 선발 시라카와는 시즌 스탯 스냅샷이 부재한 대체 외인 카드로 아직 검증이 더 필요한 상태입니다. 반면 롯데 선발 박세웅은 최근 주간 6이닝 무실점으로 확실한 반등세를 보여주며 마운드의 무게감을 더하고 있습니다. 비록 KIA의 팀 평균 OPS(0.806)와 장타력(SLG 0.454)이 롯데(SLG 0.389)를 상회하나, 박세웅의 안정된 경기 운영과 최근 호조를 보이고 있는 롯데의 집중력을 감안할 때 마운드의 우위를 바탕으로 롯데가 승리를 챙길 가능성이 높습니다."
  },
  {
    game_id: "8cb78a90-c348-442e-9100-55ee2bc55804",
    predicted_winner_team_id: "hanwha",
    confidence: 0.73,
    key_factor: "압도적인 타선 화력과 선발 안정감",
    one_liner: "ERA 3.05로 짠물 투구를 펼치는 한화 화이트의 선발 안정감과 팀 타율 0.302의 한화 다이너마이트 화력이 시너지를 낼 것입니다.",
    detailed_analysis:
      "한화 선발 화이트는 시즌 ERA 3.05, WHIP 1.02의 특급 지표를 보여주고 있으며, 9이닝당 볼넷도 1.74개로 안정적인 제구력을 과시하고 있습니다. 반면 두산 선발 잭로그는 최근 등판에서 5이닝 5실점으로 부진하며 제구와 구위 모두에서 불안한 모습을 노출했습니다. 여기에 한화는 강백호, 페라자, 노시환 등이 버티는 팀 평균 OPS 0.861(SLG 0.480)의 리그 최정상급 화력을 뽐내고 있어, 선발 매치업과 타선의 힘 모두에서 한화가 두산을 압도하며 무난한 승리를 가져갈 것으로 보입니다."
  },
  {
    game_id: "14744dea-bdac-4dbf-a160-ccfe6b5834a2",
    predicted_winner_team_id: "ssg",
    confidence: 0.63,
    key_factor: "연패 탈출 후의 경기력 반등과 홈 이점",
    one_liner: "13연패를 탈출하며 사기가 충천한 SSG가 홈 이점을 살려 최민준의 선발진 안정과 해결사 중심의 짜임새 있는 화력으로 키움을 제압할 것입니다.",
    detailed_analysis:
      "SSG는 바로 전날 극적인 끝내기 승리로 길었던 13연패를 탈출해 팀 분위기가 크게 회복되었습니다. 선발 최민준은 ERA 3.52로 키움 선발 배동현(ERA 4.15)에 비해 실점 억제력 측면에서 근소하게 앞서며, 연패 탈출로 불펜진의 과부하도 해소된 상황입니다. 키움 타선의 슬러깅(0.456) 포텐셜이 위협적이지만, SSG 역시 최정, 에레디아 등 베테랑 중심 타선의 집중력이 살아나고 있어 홈 문학에서의 짜임새 있는 경기 운영을 바탕으로 2연승을 챙길 전망입니다."
  },
  {
    game_id: "c4ada2ba-52e7-43be-9fc8-e6f90dd91380",
    predicted_winner_team_id: "lg",
    confidence: 0.70,
    key_factor: "에이스 웰스의 압도적인 구위와 안정감",
    one_liner: "시즌 ERA 1.79, WHIP 0.90에 달하는 LG의 특급 에이스 웰스가 KT의 강타선을 잠재우며 선두 자리를 굳건히 지킬 것입니다.",
    detailed_analysis:
      "리그 1, 2위를 다투는 빅매치입니다. KT 타선이 최근 라인업 기준 팀 평균 타율 0.303, 출루율 0.385로 엄청난 생산력을 과시하고 있으나, LG의 선발 웰스는 ERA 1.79, WHIP 0.90, HR9 0.20이라는 괴물 같은 누적 지표를 기록 중인 압도적 에이스입니다. 최근 경기에서도 6이닝 무실점을 기록하는 등 기세가 꺾이지 않았습니다. KT 선발 사우어 역시 최근 호투했으나 시즌 ERA 4.43으로 웰스에 비해 실점 리스크가 크며, 웰스가 마운드를 굳건히 지켜주는 사이 LG 타선이 사우어의 빈틈을 공략해 승기를 잡을 것입니다."
  },
  {
    game_id: "d9286fba-7a05-47fd-b3eb-2bb98262af22",
    predicted_winner_team_id: "samsung",
    confidence: 0.72,
    key_factor: "홈 구장 이점과 타선 생산성 및 삼진 억제 능력 차이",
    one_liner: "구자욱 and 최형우가 이끄는 삼성의 막강한 타선이 대구 라팍에서 구창모의 피홈런 리스크를 공략하며 승리를 이끌 것입니다.",
    detailed_analysis:
      "삼성은 팀 평균 OPS 0.833(SLG 0.453), 타율 0.283으로 리그 최상위권 화력을 보여주며 공동 1위를 달리고 있습니다. NC 선발 구창모가 최근 8이닝 1자책으로 호투했으나 홈런 친화적인 대구 구장에서 피홈런율(HR9 1.12) 리스크가 부각될 수 있습니다. 특히 NC 타선은 최근 삼진율(K%)이 29.3%에 달해 삼성 원태인(ERA 3.57)의 영리한 피칭과 탈삼진 능력에 고전할 확률이 높습니다. 삼성이 홈에서의 막강한 장타 지원과 원태인의 안정감을 무기로 우세를 점할 것입니다."
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
