// 2026-08-01 Claude 일일 예측 5건 INSERT. (claude 슬롯 전용 — 다른 provider 미변경)
// 주말 시리즈 2차전. 선발+불펜+타선+분위기+흐름 종합. v2 원칙 유지.
// ai_provider='claude', published_at=09:00 KST.

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

const GAME_DATE = "2026-08-01";
const PUBLISHED_AT = "2026-08-01T09:00:00+09:00";
// ⚠️ INSERT 직전 확인: 현재 세션 모델과 일치하는가? (Fable 5)
const MODEL = "claude-fable-5";

const rows = [
  {
    // samsung(보스) @ lotte(비슬리) — 사직
    game_id: "c84f56fc-f54a-4db6-889b-d315da7569b8",
    predicted_winner_team_id: "samsung",
    confidence: 0.54,
    key_factor: "삼성 역전승 분위기·최강 불펜 + 비슬리 변수",
    one_liner:
      "삼성이 어제 사직 난타전을 9-7로 잡아낸 분위기에 리그 최강 불펜, 조용히 준수했던 보스의 두 번째 등판까지 더해 근소하게 앞섭니다. 다만 롯데 비슬리가 9이닝당 탈삼진 10개가 넘는 홈 선발이라 접전이 예상됩니다.",
    detailed_analysis:
      "분위기와 불펜은 삼성, 선발은 롯데가 앞서는 접전 카드입니다. 선발은 롯데 비슬리(ERA 4.02, K9 10.37, HR9 0.56)가 탈삼진 능력이 뛰어난 검증된 카드이고, 삼성 보스는 데뷔전에서 타선 침묵으로 패전을 안았지만 내용은 5이닝 2실점 무볼넷(WHIP 1.00)으로 준수해 두 번째 등판을 낮게 볼 이유가 없습니다. 팀 상태는 삼성이 낫습니다. 어제 사직 난타전을 9-7로 잡아내며 KIA전 충격에서 벗어났고, 구원진 집계(평균 자책점 3.69)가 리그 최강이라 접전 후반에 강합니다. 타선도 구자욱·최형우·디아즈의 콘택트 그룹이 최근 2경기 연속 다득점입니다. 롯데는 홈 이점과 레이예스 중심의 화력이 있지만 불펜(4.74)이 삼성보다 약해 후반 승부가 부담입니다. 삼성의 분위기·불펜에 근소하게 무게를 둬 0.54로 봅니다. 비슬리가 삼진으로 삼성 콘택트를 지우면 롯데가 홈에서 되갚을 수 있습니다."
  },
  {
    // ssg(타케다) @ kiwoom(김윤하) — 고척
    game_id: "06d3407e-eb00-4fa1-9177-3b4cea1c02be",
    predicted_winner_team_id: "kiwoom",
    confidence: 0.57,
    key_factor: "키움 폭발 화력·홈 + 타케다 키움전 부진",
    one_liner:
      "키움 타선이 어제 12점 폭발을 포함해 리그에서 가장 뜨겁고, SSG 타케다는 시즌 7점대에 키움 상대로도 무너졌던 이력이 있어 고척 홈의 키움이 앞섭니다. 다만 키움 선발 김윤하의 극단적인 피홈런 문제가 변수입니다.",
    detailed_analysis:
      "타선 화력이 승부를 가를 카드입니다. 키움 타선은 어제 SSG전 12득점을 포함해 최근 화력이 리그 최고 수준(데이비슨·안치홍·박찬혁)이고, 상대 선발 타케다(ERA 7.10, WHIP 1.82)는 시즌 내내 난조인 데다 키움 상대 2경기 9.2이닝 평균 자책점 7.45로 무너졌던 이력까지 있습니다. 반면 키움 김윤하(17이닝, ERA 6.35, HR9 3.18)는 9이닝당 피홈런이 3개를 넘는 극단적인 장타 허용 문제가 있어, 최정·마드리스·김재환의 SSG 장타 타선에 위험한 유형입니다. 결국 양쪽 선발이 모두 무너질 수 있는 난타전 구도인데, 불펜(키움 5.29 vs SSG 6.81)과 홈, 타선 기세에서 키움이 앞섭니다. 키움의 화력·홈·불펜에 무게를 둬 0.57로 봅니다. 김윤하가 초반에 홈런 몇 방으로 무너지면 SSG가 난타전을 가져갈 수 있습니다."
  },
  {
    // kia(황동하) @ nc(라일리) — 창원
    game_id: "c7dc2b6a-a31c-4ae6-a195-c2f46439f669",
    predicted_winner_team_id: "nc",
    confidence: 0.58,
    key_factor: "라일리 압도 구위 + 황동하 NC전 붕괴",
    one_liner:
      "NC 라일리가 평균 자책점 3점대 초반에 9이닝당 탈삼진 12개에 육박하는 이날 최고 선발인 반면, KIA 황동하는 NC 상대 볼넷 폭발로 무너졌던 이력이 있습니다. 어제 10점 대승으로 분위기를 되찾은 NC가 홈에서 앞섭니다.",
    detailed_analysis:
      "선발 격차가 이날 가장 큰 카드입니다. NC 라일리(ERA 3.09, WHIP 1.11, K9 11.89, BB9 2.14)는 9이닝당 탈삼진이 12개에 육박하는 리그 최상위 구위형이고, KIA 황동하(ERA 4.38, HR9 1.54)는 피홈런이 잦은 데다 NC 상대 4.1이닝 평균 자책점 8.31에 9이닝당 볼넷 6개 이상으로 무너졌던 이력이 있습니다. 분위기도 바뀌었습니다. NC는 어제 양현종을 상대로 10-4 대승을 거두며 블레인·박건우의 타선이 깨어났고, KIA는 삼성전 폭발 이후 이틀 연속 원정 패배로 기세가 식었습니다. 다만 NC의 최근 10경기 실점(리그 최다 수준)과 불안한 불펜(9이닝당 볼넷 5.83)은 라일리가 일찍 내려가면 위험 요소입니다. 라일리의 구위와 NC의 반등 분위기에 무게를 둬 0.58로 봅니다. 김도영·나성범이 라일리의 피홈런(HR9 1.31)을 응징하면 KIA가 가져갈 수 있습니다."
  },
  {
    // lg(카라스코) @ doosan(곽빈) — 잠실
    game_id: "8892cc35-79a0-46ea-81d0-b8cf7dccd8ec",
    predicted_winner_team_id: "doosan",
    confidence: 0.6,
    key_factor: "곽빈 LG전 탈삼진 압도 + LG 불펜 붕괴",
    one_liner:
      "두산 곽빈이 평균 자책점 2점대 중반에 LG 상대 9이닝당 탈삼진 15개 수준으로 압도했던 에이스라, 잠실 홈의 두산이 앞섭니다. LG는 새 외국인 카라스코의 데뷔전 호투가 유일한 반전 카드입니다.",
    detailed_analysis:
      "선발과 팀 상태 모두 두산으로 기우는 카드입니다. 두산 곽빈(ERA 2.64, WHIP 1.16, K9 10.57)은 9이닝당 탈삼진 10개가 넘는 에이스로 LG 상대 5.1이닝 1실점·9이닝당 탈삼진 15개 수준의 압도 이력이 있습니다. LG는 새 외국인 카라스코의 KBO 데뷔전인데, 최근 새 외국인들이 데뷔전부터 즉시전력을 보인 전례가 많아 얕볼 수 없지만 검증되지 않은 카드입니다. 팀 상태 격차가 큽니다. LG는 최근 10경기 3승 7패에 구원진 평균 자책점 9점대의 마운드 붕괴가 이어지고 있고, 어제도 두산에 2-4로 패해 이번 시리즈 열세입니다. 두산은 잭로그·곽빈으로 이어지는 선발과 안정된 불펜(4.31), 세베리노 중심의 타선 응집력으로 최근 10경기 상승세를 유지 중입니다. 곽빈의 압도와 LG 마운드 붕괴에 무게를 둬 0.60으로 봅니다. 카라스코가 데뷔전을 지배하고 오스틴이 곽빈의 실투를 잡아내면 LG가 반전을 만들 수 있습니다."
  },
  {
    // hanwha(짐머맨) @ kt(배제성) — 수원
    game_id: "f9d277bc-5b96-4400-b347-d52c65a79479",
    predicted_winner_team_id: "hanwha",
    confidence: 0.55,
    key_factor: "배제성 볼넷 결함 + 한화 화력, KT 흐름 변수",
    one_liner:
      "KT 배제성이 9이닝당 볼넷 6개를 넘는 제구 결함 카드인 반면, 한화는 데뷔전 무실점의 짐머맨과 최근 10경기 72득점의 화력을 갖춰 원정에서도 근소하게 앞섭니다. 다만 최근 8승 1패 1무의 KT 흐름과 수원 홈이 변수입니다.",
    detailed_analysis:
      "선발 결함과 팀 흐름이 맞서는 카드입니다. KT 배제성(29.1이닝, ERA 4.30, BB9 6.14)은 9이닝당 볼넷이 6개를 넘는 대표본 제구 결함이 있어, 노시환·페라자·채은성 중심으로 최근 10경기 72득점(리그 최다 수준)을 올린 한화 타선에 빌미를 주기 쉽습니다. 한화 짐머맨은 데뷔전 4이닝 무실점으로 짧지만 깔끔했고, 두 번째 등판에서 이닝 확장이 기대됩니다. 반면 팀 흐름은 KT입니다. 최근 10경기 8승 1패 1무(득실 +31)에 어제도 류현진을 상대로 5-3 승리를 거둬 수원 홈에서 기세가 최고조입니다. 다만 배제성이 초반에 볼넷으로 무너지면 KT 타선이 따라가는 전개가 되고, 한화 불펜(6.07)이 불안해도 리드를 잡으면 류현진급 필승조 가동이 가능합니다. 배제성의 결함과 한화 화력에 근소하게 무게를 둬 0.55로 봅니다. 짐머맨이 일찍 흔들리고 KT 출루 타선이 물고 늘어지면 KT의 흐름이 이어질 수 있습니다."
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
