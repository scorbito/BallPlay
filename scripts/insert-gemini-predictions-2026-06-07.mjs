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

const GAME_DATE = "2026-06-07";
const PUBLISHED_AT = "2026-06-07T09:00:00+09:00";
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
    game_id: "3f1b9543-3868-4eef-a015-8f67dfd21aba",
    predicted_winner_team_id: "doosan",
    confidence: 0.65,
    key_factor: "선발 피홈런 억제력",
    one_liner: "피홈런 억제가 뛰어난 벤자민을 앞세운 두산 마운드가 키움 타선을 안정적으로 제어할 것입니다. 피홈런 리스크를 안고 있는 알칸타라를 상대로 두산이 신승을 거둘 전망입니다.",
    detailed_analysis:
      "두산 벤자민(ERA 2.61, WHIP 1.35)과 키움 알칸타라(ERA 3.18, WHIP 1.17)의 팽팽한 에이스 선발 매치업입니다. 하지만 9이닝당 피홈런(HR9) 지표에서 벤자민(0.22개)이 알칸타라(1.38개)에 비해 월등히 앞섭니다. 타선에서는 키움(팀 평균 OPS 0.726, 타율 0.250)과 두산(팀 평균 OPS 0.709, 타율 0.257)의 체급이 비슷하나 키움은 최근 5경기 4패로 극도의 하락세를 보입니다. 잠실구장의 넓은 특성을 고려하더라도 실투와 피홈런 억제 능력이 검증된 벤자민이 판정승을 거두며 두산의 승리를 지켜낼 것으로 예측합니다."
  },
  {
    game_id: "b4129b25-447f-42a9-83a8-1208bef07193",
    predicted_winner_team_id: "kia",
    confidence: 0.72,
    key_factor: "선발 이닝 소화 우위",
    one_liner: "100구 이상 이닝을 책임질 수 있는 확실한 선발 네일을 가동하는 KIA의 안정감이 돋보입니다. 투구 수 제한이 있는 양창섭의 조기 강판 이후 삼성이 불펜 과부하로 흔들릴 것입니다.",
    detailed_analysis:
      "4위 KIA와 3위 삼성의 치열한 순위 싸움에서 투수진의 이닝 소화력이 핵심이 될 경기입니다. KIA 선발 네일은 2승 4패로 운이 따르지 않았으나, WHIP 1.11, BB9 1.42로 정량적 구위가 압도적이며 100구 이상 투구가 가능한 정통 선발입니다. 반면 삼성 선발 양창섭은 ERA 3.53으로 호투 중이지만 투구 수 제한(71구)을 지닌 불펜 오프너 성격이 강합니다. 두 팀 타선(KIA OPS 0.760, 삼성 0.776)이 팽팽한 상황에서 선발 네일이 이닝을 길게 끌어주고, KIA의 주전 타선이 삼성의 이른 불펜 운용을 파고들어 안방에서 귀중한 승리를 가져갈 전망입니다."
  },
  {
    game_id: "64026760-6335-42a9-8c86-fa35712cf50b",
    predicted_winner_team_id: "lg",
    confidence: 0.68,
    key_factor: "타선 응집력 우위",
    one_liner: "에이스 오스틴이 이끄는 LG의 강력한 타선이 득점 응집력에서 NC 마운드를 압도할 것입니다. 선발 대결이 팽팽한 가운데 공수 밸런스 우위를 바탕으로 1위 LG가 무난히 승리할 전망입니다.",
    detailed_analysis:
      "NC 토다(ERA 4.34, WHIP 1.47)와 LG 송승기(ERA 4.18, WHIP 1.39)는 정량 지표상 5이닝 내외를 소화하는 비슷한 급의 선발 자원입니다. 그러나 타선의 체급 차이가 뚜렷합니다. LG는 팀 평균 OPS 0.735, 타율 0.260을 기록 중이며 오스틴(OPS 1.020)과 문정빈(OPS 0.932) 등 중심 타선의 집중력이 매우 뛰어납니다. 반면 NC는 팀 평균 OPS 0.703, 타율 0.245로 심한 타격 정체를 겪고 있습니다. 1위 LG가 팽팽한 경기 흐름 속에서도 기회가 왔을 때 득점으로 연결하는 뛰어난 응집력을 앞세워 창원 원정길에서 신승을 거둘 것입니다."
  },
  {
    game_id: "1ae3b4a3-82b9-4416-9957-648e13efc96c",
    predicted_winner_team_id: "lotte",
    confidence: 0.60,
    key_factor: "선발 제구 격차",
    one_liner: "삼진 능력과 안정된 제구를 갖춘 비슬리의 호투를 앞세워 롯데가 안방에서 승리를 챙길 것입니다. 제구 난조로 투구 수 조절이 힘든 한화 선발 황준서를 롯데 타선이 침착하게 무너뜨릴 전망입니다.",
    detailed_analysis:
      "선발 투수의 안정성 차이로 홈팀 롯데의 반등을 노려볼 만한 매치업입니다. 롯데 선발 비슬리는 ERA 4.50이지만 탈삼진 능력(K9 10.71)과 제구력(BB9 2.64)이 우수하며 95구 이상 책임질 수 있습니다. 반면 한화 선발 황준서는 ERA 6.28, WHIP 1.88, BB9 7.55로 극도의 제구 불균형을 겪고 있어 이른 강판(stamina 37구) 리스크가 큽니다. 한화 타선(팀 평균 OPS 0.882, 타율 0.336)이 롯데 타선(OPS 0.688)을 압도하지만, 황준서의 사사구 남발을 롯데가 집중력 있게 공략하고 비슬리가 힘으로 한화 타선을 막아낸다면 마운드 격차로 롯데가 홈에서 우위를 잡을 것입니다."
  },
  {
    game_id: "f15b7a93-8401-498a-8748-4358856f966e",
    predicted_winner_team_id: "kt",
    confidence: 0.64,
    key_factor: "선발 제구 우위",
    one_liner: "퀄리티스타트가 가능한 제구력을 보유한 KT 오원석이 안정적인 선발 투구를 보일 것입니다. 사사구 허용과 WHIP가 높은 SSG 베니지아노를 KT 타선이 집중 공략할 전망입니다.",
    detailed_analysis:
      "2위 KT와 8위 SSG의 대결로 선발 마운드의 사사구 제어 능력이 핵심 지표입니다. KT 선발 오원석은 ERA 4.56, WHIP 1.37에 BB9 1.86으로 극도로 안정적인 제구력을 장착해 90구 이상 긴 이닝 소화가 굳건합니다. 반면 SSG 선발 베니지아노는 ERA 5.63, WHIP 1.68, BB9 3.89로 잦은 출루 허용과 난조를 보이고 있습니다. 비록 SSG 타선(팀 평균 OPS 0.917, 타율 0.330)의 기세가 무섭지만, KT 타선(팀 평균 OPS 0.817) 역시 안현민(OPS 1.161)과 최원준(OPS 0.973)을 앞세워 맞불을 놓을 파괴력이 있습니다. 제구력이 견고한 오원석이 주자를 통제하며 이닝을 끌어주는 사이 KT가 무난히 우위를 점할 것으로 예측합니다."
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
