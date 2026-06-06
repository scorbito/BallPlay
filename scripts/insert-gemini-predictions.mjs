// 2026-06-05 Gemini 예측 5건 - 기존 데이터 삭제 후 신규 INSERT.
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

const GAME_DATE = "2026-06-05";
const PUBLISHED_AT = "2026-06-05T09:00:00+09:00";
const MODEL = "gemini-3-5-flash-high";

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
    game_id: "2f6c3e20-2ca6-40c2-bcd1-90d8020537ff",
    predicted_winner_team_id: "hanwha",
    confidence: 0.82,
    key_factor: "선발 투수의 체급 차이와 한화 타선의 장타력",
    one_liner: "리그 최상급 제구력을 갖춘 류현진과 불안한 피칭의 로드리게스 선발 맞대결에서 마운드 무게감이 크게 기울어집니다. 여기에 리그 최강의 화력을 자랑하는 한화 타선이 로드리게스의 피홈런 약점을 파고들어 대승을 거둘 것입니다.",
    detailed_analysis:
      "한화 선발 류현진은 이번 시즌 9이닝당 볼넷(BB9) 1.40, WHIP 1.06으로 완벽한 송곳 제구를 보여주고 있으며, 롯데의 약한 타선(팀 평균 OPS 0.688)이 그를 공략하기란 매우 어렵습니다. 반면 롯데 선발 로드리게스는 ERA 5.12, WHIP 1.49에 9이닝당 피홈런(HR9)이 1.59로 장타 허용이 매우 빈번합니다. 강백호(OPS 1.006)와 페라자(0.948)가 버티는 한화의 초강력 타선(팀 평균 OPS 0.882)이 로드리게스의 실투를 놓치지 않고 장타로 연결할 확률이 지극히 높습니다. 선발 투수의 안정감과 타선의 파괴력 모두 한화의 압도적인 우세를 가리킵니다."
  },
  {
    game_id: "eb669790-27f5-4f86-a900-c0ad9ca914e3",
    predicted_winner_team_id: "ssg",
    confidence: 0.72,
    key_factor: "KT의 오프너/불펜 데이 공략",
    one_liner: "선발 카드에서 임시 오프너를 내세운 KT가 최정, 고명준이 버티는 SSG의 홈 화력을 감당하긴 어렵습니다. SSG 선발 김건우의 제구 불안 요소를 감안하더라도 타선의 득점 지원을 등에 업은 SSG가 무난히 승리를 챙길 것입니다.",
    detailed_analysis:
      "KT는 선발로 구원이 주 역할인 문용익을 오프너로 기용하여 사실상의 불펜 데이를 치러야 하는 악재를 안고 있습니다. 피홈런이 많이 나오는 문학구장에서 리그 최상급 화력의 SSG 타선(팀 평균 OPS 0.917)을 상대로 불펜을 소모하는 것은 큰 부담입니다. SSG 선발 김건우 역시 9이닝당 볼넷 4.86으로 제구가 다소 불안하여 KT의 강력한 타선(팀 평균 OPS 0.817)에 실점할 가능성이 있습니다. 그러나 문용익의 제구 불안을 공략해 낼 SSG의 득점권 해결 능력이 월등하기에 경기 후반 화력전 끝에 SSG가 승리를 가져올 것으로 예측됩니다."
  },
  {
    game_id: "3b18bef2-3be4-47a7-9743-52e158466a69",
    predicted_winner_team_id: "doosan",
    confidence: 0.58,
    key_factor: "선발 투수의 제구력과 주자 억제 능력",
    one_liner: "양 팀 선발 투수가 모두 불안하지만, 피홈런이 많은 하영민보다 넓은 잠실을 홈으로 쓰는 최승용이 실점 억제 측면에서 미세하게 유리합니다. 홈 응집력이 조금 더 우세한 두산이 치열한 접전 끝에 신승을 거둘 것으로 예상됩니다.",
    detailed_analysis:
      "두산 최승용(ERA 5.61, WHIP 1.68)과 키움 하영민(ERA 4.89, WHIP 1.53) 모두 주자 허용이 많아 경기 초반 위기가 잦을 매치업입니다. 다만 하영민은 9이닝당 볼넷 4.88과 더불어 피홈런 허용율(HR9 1.40)이 높아 실점 리스크가 더 큰 반면, 최승용은 넓은 잠실구장의 도움을 받아 피장타를 억제할 여지가 큽니다. 타선의 생산성 역시 두산(팀 평균 OPS 0.709)이 키움(0.726)보다 화력의 기복이 덜하며, 경기 후반 불펜 운영의 안정감에서 홈팀 두산이 미세한 우위를 보일 것으로 판단됩니다."
  },
  {
    game_id: "fcd0ca0b-c73a-4f8a-b40d-7ff268a0a7b2",
    predicted_winner_team_id: "kia",
    confidence: 0.76,
    key_factor: "올러의 압도적인 구위와 주자 허용 억제력",
    one_liner: "리그 정상급 성적을 내고 있는 KIA의 에이스 올러(WHIP 0.97)가 삼성의 거포 타선을 상대로 우위를 점할 것입니다. 볼넷 허용이 잦은 삼성 오러클린을 상대로 KIA의 기동력과 짜임새 있는 타선이 다득점을 지원할 전망입니다.",
    detailed_analysis:
      "KIA 선발 올러는 ERA 2.63, WHIP 0.97로 극상의 구위를 보이고 있어 홈구장에서 삼성을 상대로 경기 흐름을 장악할 가능성이 매우 큽니다. 반면 삼성 선발 오러클린은 탈삼진 능력은 준수하지만 BB9 3.84로 제구가 종종 흔들리며 주자를 쌓아두는 경향이 있습니다. 팀 타율 0.269의 KIA 타선은 집요한 출루와 찬스 해결력을 갖추고 있어 오러클린의 제구 흔들림을 적극 공략할 것입니다. 삼성이 자랑하는 장타력(구자욱 OPS 1.038)이 올러의 구위에 막히는 사이, 효율적으로 주자를 불러들일 KIA의 승리가 예상됩니다."
  },
  {
    game_id: "28849d56-4cd3-48ef-834b-f63accc30014",
    predicted_winner_team_id: "nc",
    confidence: 0.70,
    key_factor: "라일리의 압도적 탈삼진 능력과 LG의 임시 선발 변수",
    one_liner: "9이닝당 탈삼진 10.67개와 송곳 제구력(BB9 1.67)을 겸비한 NC 라일리가 LG의 타선을 압도할 것입니다. 불펜 소모가 예상되는 LG의 선발 마운드 사정상 경기 초반부터 NC가 리드를 잡을 가능성이 높습니다.",
    detailed_analysis:
      "NC 선발 라일리는 ERA 3.33, WHIP 1.11로 뛰어난 주자 억제력을 가졌으며, 강력한 탈삼진 능력을 통해 LG의 중심 타선을 무력화시킬 수 있습니다. 반면 LG는 구원 투수인 김윤식을 선발 마운드에 올려 불펜 데이에 가까운 마운드 운영을 펼쳐야 하는 상황입니다. 라일리가 높은 피홈런(HR9 1.67) 성향을 가지고 있어 오스틴(OPS 1.020)의 장타를 경계해야 하지만, 제구(BB9 1.67)가 뛰어나 솔로 홈런 수준으로 피해를 최소화할 수 있습니다. LG 불펜을 상대로 찬스를 살릴 NC 타선의 뒷심이 합쳐져 NC가 승기를 잡을 것입니다."
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
