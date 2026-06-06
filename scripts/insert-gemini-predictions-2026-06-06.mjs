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

const GAME_DATE = "2026-06-06";
const PUBLISHED_AT = "2026-06-06T09:00:00+09:00";
const MODEL = "gemini-3-5-flash-high";

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

// --- 2) 신규 예측 데이터 데이터셋 ---
const rows = [
  {
    game_id: "a5e0f78f-dc79-4c49-9557-088dfafe6f10",
    predicted_winner_team_id: "ssg",
    confidence: 0.62,
    key_factor: "타선 폭발력 격차",
    one_liner: "팀 타율 3할 3푼에 OPS 0.917로 불붙은 SSG 타선이 문학 홈런 친화 구장에서 진가를 발휘할 것입니다. 마운드가 다소 불안하더라도 불방망이를 앞세운 SSG가 화력전 끝에 승리를 따낼 전망입니다.",
    detailed_analysis:
      "SSG 선발 타케다(ERA 8.10, WHIP 1.92)와 KT 대체 선발 배제성(ERA 7.71, WHIP 1.82) 모두 마운드에서 극심한 불안을 노출하고 있습니다. 결국 승패는 타선의 집중력에서 갈릴 것이며, 정량 데이터상 SSG가 압도적 우위를 점합니다. SSG는 팀 평균 OPS 0.917, 타율 0.330을 기록 중이며 고명준(OPS 1.047)과 최정(OPS 0.949) 등 중심 타선의 장타력 체급이 매우 높습니다. 반면 KT는 팀 평균 OPS 0.817로 준수하나 마운드가 일찍 붕괴할 위험이 큽니다. 최근 3연승의 가파른 상승세를 타는 SSG 타선이 문학 안방에서 KT 마운드를 두들기며 난타전을 승리로 이끌 것으로 예측합니다."
  },
  {
    game_id: "d33582a9-a456-48d1-92aa-8638b8da9bd3",
    predicted_winner_team_id: "doosan",
    confidence: 0.68,
    key_factor: "선발 이닝 소화력",
    one_liner: "제구력과 탈삼진 능력이 검증된 두산 최민석의 안정적인 선발 야구가 팀 승리를 이끌 것입니다. 투구 수 제한이 예상되는 키움 안우진의 강판 이후 두산이 경기 중반 주도권을 잡을 전망입니다.",
    detailed_analysis:
      "키움 선발 안우진은 ERA 2.25, WHIP 1.04, K9 11.63으로 리그 최정상급 구위를 뽐내지만 투구 수 제한(stamina 62구)으로 긴 이닝 소화가 어렵습니다. 반면 두산 선발 최민석은 ERA 3.29, K9 8.56으로 안정감이 뛰어나며 100구 가까이 이닝을 책임질 수 있습니다. 타선 지표에서는 키움(팀 평균 OPS 0.726, 타율 0.250)과 두산(팀 평균 OPS 0.709, 타율 0.257)이 팽팽하나, 키움은 최근 5경기 1승 4패로 극심한 침체기입니다. 안우진이 물러난 뒤 가동될 키움의 부실한 불펜진을 상대로 최근 2연승 상승세인 두산 타선이 잠실 홈경기 이점을 살려 무난히 역전할 확률이 큽니다."
  },
  {
    game_id: "4cd3e8a3-a58c-4ff9-9db4-da6992faf0b5",
    predicted_winner_team_id: "hanwha",
    confidence: 0.76,
    key_factor: "선발 및 타선 체급차",
    one_liner: "에이스 에르난데스의 선발 무게감과 팀 평균 OPS 0.882에 달하는 한화 핵타선의 위력이 돋보입니다. 투타 밸런스 붕괴로 힘겨운 롯데를 사직 원정에서 완파하고 한화가 완승을 거둘 것입니다.",
    detailed_analysis:
      "선발 매치업과 타선의 무게 모두 5위 한화가 9위 롯데를 압도합니다. 한화 선발 에르난데스는 ERA 4.47, WHIP 1.49로 준수한 이닝 소화력을 보이지만, 롯데 선발 이민석은 ERA 8.78, WHIP 1.73에 투구 수 제한(40구)까지 있어 불펜에 과부하를 줄 경기입니다. 한화 타선은 팀 평균 OPS 0.882, 타율 0.336으로 강백호(1.006)와 페라자(0.948)가 이끄는 파괴력이 엄청납니다. 반면 롯데는 레이예스(OPS 0.962)의 고군분투에도 팀 평균 OPS 0.688에 머물러 있어 공격 조립이 어렵습니다. 한화가 경기 초반부터 롯데 마운드를 흔들며 여유롭게 주도권을 쥘 경기입니다."
  },
  {
    game_id: "b00f2dfe-b643-46fe-ac62-ce30c4f8b075",
    predicted_winner_team_id: "kia",
    confidence: 0.70,
    key_factor: "선발 이닝 소화 우위",
    one_liner: "노련한 에이스 양현종의 마운드 장악력과 2연승으로 상승 궤도에 오른 KIA 타선이 조화를 이룰 것입니다. 오프너 카드를 꺼낸 삼성을 상대로 경기 중반 화력 집중력을 앞세워 KIA가 승리할 전망입니다.",
    detailed_analysis:
      "4위 KIA와 3위 삼성의 맞대결로, 선발 투수의 이닝 소화력 차이가 승부를 가를 것입니다. KIA는 베테랑 양현종(ERA 4.84, WHIP 1.45)이 선발로 등판해 최소 5~6이닝을 조율하는 반면, 삼성 선발 장찬희는 ERA 4.24에 투구 수 47구 제한을 가진 임시 오프너 카드입니다. 삼성은 팀 평균 OPS 0.776, 타율 0.273으로 장타 체급이 뛰어나지만 최근 3연패 침체에 빠져 있습니다. 반면 KIA 타선은 팀 평균 OPS 0.760, 타율 0.269로 한준수(OPS 0.947), 김도영(0.909)의 타격 컨디션이 최고조이며 팀 분위기도 2연승으로 좋습니다. 양현종이 초반 실점을 제어하는 사이 KIA가 불펜 싸움으로 넘어간 삼성 마운드를 공략해 승리를 가져갈 것입니다."
  },
  {
    game_id: "50f2f2fa-6d05-4183-b1a6-85d6105bd3c7",
    predicted_winner_team_id: "lg",
    confidence: 0.78,
    key_factor: "에이스 선발 매치업",
    one_liner: "7승 3패, ERA 3.24로 마운드를 지배하는 에이스 톨허스트의 역투와 리그 1위 LG 타선의 파괴력이 돋보입니다. 선발 매치업 우위를 바탕으로 LG가 창원 원정길에서 완승을 가져갈 전망입니다.",
    detailed_analysis:
      "리그 선두 LG가 에이스 톨허스트(7승 3패, ERA 3.24, WHIP 1.15)를 앞세워 확실한 1승을 노립니다. 톨허스트는 사사구 제어력(BB9 2.78)과 탈삼진 능력 모두 최정상급으로, NC 선발 테일러(ERA 5.44, WHIP 1.47)에 비해 압도적으로 안정적입니다. 타선에서도 LG는 팀 평균 OPS 0.735, 타율 0.260을 바탕으로 오스틴(OPS 1.020)의 해결사 본능이 번뜩이며 최근 2연승 상승세입니다. 이에 비해 NC는 팀 평균 OPS 0.703, 타율 0.245에 머물러 있어 공격 정체율이 높습니다. 에이스 카드를 낸 1위 LG가 경기 내내 마운드의 힘을 바탕으로 주도권을 쥐며 무난히 연승을 이어갈 것으로 예상됩니다."
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
