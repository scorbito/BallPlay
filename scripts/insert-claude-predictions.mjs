// 2026-06-28 Claude 일일 예측 5건 INSERT. (claude 슬롯 전용 — 다른 provider 미변경)
// 실제 발표 선발 + 시즌 스탯 + 상대팀 전적 + 2차전 결과/뉴스 반영. 주말 시리즈 3차전.
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

const GAME_DATE = "2026-06-28";
const PUBLISHED_AT = "2026-06-28T09:00:00+09:00";
// ⚠️ INSERT 직전 확인: 현재 세션 모델과 일치하는가?
const MODEL = "claude-opus-4-8";

const rows = [
  {
    // kiwoom(와일스) @ nc(라일리) — 창원
    game_id: "bf977f6a-ebf8-4843-b5fe-d29dca2fe884",
    predicted_winner_team_id: "nc",
    confidence: 0.56,
    key_factor: "라일리 구위·키움전 강세",
    one_liner:
      "NC 라일리가 9이닝당 탈삼진 12개에 가까운 구위로 키움 상대 평균 자책점 2점대로 강했고 창원 홈까지 안고 있습니다. 다만 어제 10연패를 끊은 키움의 반등 흐름이 변수입니다.",
    detailed_analysis:
      "선발에서 NC가 앞서는 카드입니다. NC 라일리(ERA 3.42, WHIP 1.04, K9 11.78, BB9 1.54)는 압도적인 구위에 볼넷도 적은 에이스로 키움 상대 13이닝 평균 자책점 2.08로 강했습니다. 키움 와일스(ERA 4.13, 24이닝, BB9 0.75)는 볼넷이 거의 없는 제구형이지만 1군 표본이 짧은 미지수 카드입니다. 타선은 NC 라인업(평균 .264, 출루율 .358)과 키움 라인업(평균 .255, 출루율 .338)이 비슷한 수준이라 큰 격차는 없습니다. NC는 창원 홈 이점이 있지만, 키움은 어제 하영민의 호투로 10연패를 끊은 반등 흐름이 매섭습니다. 라일리의 구위와 키움전 강세, 홈에 무게를 둬 0.56의 박빙으로 봅니다. 와일스가 제구를 앞세워 호투하고 키움이 상승세를 이어가면 곧장 뒤집힐 수 있습니다."
  },
  {
    // kia(김태형) @ doosan(최승용) — 잠실
    game_id: "2d2bd0a9-d988-4ecc-b99f-9a4a5d6780da",
    predicted_winner_team_id: "doosan",
    confidence: 0.54,
    key_factor: "최승용 KIA전 강세 + 두산 홈",
    one_liner:
      "두산 최승용이 시즌 성적은 부진해도 KIA 상대 평균 자책점 2점대로 강했고, 어제 위닝 시리즈를 확정한 두산이 잠실 홈에서 앞섭니다. 다만 KIA의 장타력이 여전한 변수입니다.",
    detailed_analysis:
      "양 선발 모두 시즌 성적은 부진한 박빙 카드입니다. 두산 최승용(ERA 5.46, WHIP 1.60)과 KIA 김태형(ERA 5.49, WHIP 1.68, HR9 1.83) 모두 평균 자책점이 5점대이지만, 최승용은 KIA 상대 11.2이닝 평균 자책점 2.31로 강했던 반면 김태형은 피홈런이 잦습니다. 타선은 KIA 라인업(평균 .260, 출루율 .325, 장타력 .437, ISO .176)이 김도영·카스트로의 장타력으로 두산 라인업(평균 .264, 출루율 .337, 장타력 .391)을 장타에서 앞섭니다. 다만 두산은 어제 KIA를 잡고 위닝 시리즈를 확정한 상승세이고 잠실 홈 이점이 있습니다. 최승용의 KIA전 강세와 두산의 흐름·홈에 무게를 둬 0.54의 박빙으로 봅니다. KIA 타선이 부진한 최승용을 공략하면 곧장 뒤집힐 수 있습니다."
  },
  {
    // kt(고영표) @ samsung(양창섭) — 대구
    game_id: "e7d8a692-6880-47a6-a788-9e09ec57017f",
    predicted_winner_team_id: "kt",
    confidence: 0.56,
    key_factor: "고영표 삼성전 강세 + KT 콘택트 타선",
    one_liner:
      "KT 고영표가 삼성 상대 평균 자책점 1점대로 강했고 볼넷이 거의 없는 제구형인 데다, KT 타선이 시즌 타율 3할에 출루율 4할의 리그 최강 콘택트 그룹이라 대구 원정에서도 앞섭니다.",
    detailed_analysis:
      "선발과 타선이 KT로 기우는 카드입니다. KT 고영표(ERA 4.28, WHIP 1.29, K9 9.56, BB9 1.35)는 볼넷이 거의 없는 제구형으로 삼성 상대 6이닝 평균 자책점 1.5에 이닝당 주자 0.67로 강했습니다. 삼성 양창섭(ERA 4.53, HR9 1.27)은 피홈런이 잦은 편입니다. 타선은 KT 라인업(평균 .309, 출루율 .400, 장타력 .436)이 최원준·안현민·힐리어드 중심의 리그 최상위 콘택트 그룹으로 삼성 라인업(평균 .277, 출루율 .364, 장타력 .400)을 크게 앞섭니다. 다만 삼성은 어제 KT를 역전으로 꺾으며 대구 홈에서 기세를 올린 상승세입니다. 고영표의 삼성전 강세와 KT 콘택트 타선에 무게를 둬 0.56의 박빙으로 봅니다. 삼성이 홈에서 양창섭을 받쳐주고 타선이 살아나면 접전이 됩니다."
  },
  {
    // lg(장현식) @ lotte(비슬리) — 사직
    game_id: "e5b81bbf-9d57-4058-8056-6471e1384b3e",
    predicted_winner_team_id: "lg",
    confidence: 0.53,
    key_factor: "LG 타선 우위 + 비슬리 LG전 강세",
    one_liner:
      "LG 타선이 출루와 장타에서 롯데보다 앞서고 어제 오스틴의 역전 만루포로 연패를 끊은 흐름입니다. 다만 롯데 비슬리가 LG 상대 평균 자책점 2점대로 강했던 점이 변수라 접전이 예상됩니다.",
    detailed_analysis:
      "선발은 롯데, 타선은 LG가 앞서는 박빙 카드입니다. 롯데 비슬리(ERA 4.50, WHIP 1.50, K9 10.34)는 구위가 좋고 LG 상대 13이닝 평균 자책점 2.08로 강했던 반면, LG 장현식(ERA 3.69, 39이닝)은 선발 표본이 적고 롯데 상대로는 불펜 등판뿐이라 검증이 부족합니다. 타선은 LG 라인업(평균 .280, 출루율 .370, 장타력 .425)이 오스틴·문보경 중심으로 롯데 라인업(평균 .261, 출루율 .325, 장타력 .396)을 출루와 장타에서 분명히 앞섭니다. LG는 어제 오스틴의 시즌 23호 역전 만루포로 연패를 끊은 상승세입니다. 비슬리의 LG전 강세가 걸리지만, LG의 타선 우위와 흐름에 무게를 둬 0.53의 박빙으로 봅니다. 비슬리가 LG전 호투를 이어가고 롯데가 사직 홈에서 받쳐주면 곧장 뒤집힐 수 있습니다."
  },
  {
    // hanwha(류현진) @ ssg(최민준) — 문학
    game_id: "31fd9a05-ccd1-46c2-8d3f-60f633f73cf9",
    predicted_winner_team_id: "hanwha",
    confidence: 0.6,
    key_factor: "류현진 에이스 + 한화 장타·노시환 폼",
    one_liner:
      "한화 류현진이 평균 자책점 2점대 후반의 에이스로 최민준보다 한 수 위이고, 노시환이 5경기 연속 홈런을 치는 한화 타선이 어제 위닝 시리즈를 확정한 흐름까지 안고 앞섭니다.",
    detailed_analysis:
      "선발에서 한화가 앞서는 카드입니다. 한화 류현진(ERA 2.76, WHIP 1.07, BB9 1.21)은 볼넷이 거의 없는 리그 정상급 에이스로 SSG 상대 16.2이닝 평균 자책점 3.78의 안정된 이력이 있습니다. SSG 최민준(ERA 4.84, BB9 4.21, HR9 1.40)은 제구와 피홈런이 불안하지만 한화 상대 14.1이닝 평균 자책점 2.51로 강했던 점은 변수입니다. 타선은 한화 라인업(평균 .285, 출루율 .360, 장타력 .451, ISO .166)이 노시환(5경기 연속 홈런)·강백호·페라자의 장타력으로 SSG 라인업(평균 .275, 출루율 .351, 장타력 .437)을 앞섭니다. 한화는 어제 SSG를 8-1로 대파하며 위닝 시리즈를 확정한 상승세입니다. 류현진의 에이스 등판과 한화 장타력·흐름에 무게를 둬 0.60으로 봅니다. 최민준이 한화전 강세를 또 이어가면 문학 홈의 SSG가 접전을 만들 수 있습니다."
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
