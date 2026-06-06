// 2026-06-05 두산-키움 Claude 예측 수정.
// 두산 선발이 잭로그가 아니라 최승용(좌완)으로 변경되어 one_liner / 본문 / confidence 재산정.

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

const GAME_ID = "3b18bef2-3be4-47a7-9743-52e158466a69";

const updated = {
  predicted_winner_team_id: "doosan",
  confidence: 0.6,
  key_factor: "두산 콘택트 + 키움 최하위 타선",
  one_liner:
    "두산 픽. 두산은 KBO 최저 삼진 비율 라인업으로 키움 영건 하영민의 볼넷 많은 제구를 그대로 파고들 콘택트 우위가 있고, 키움 타선은 시즌 평균 0.231·출루율 0.307의 KBO 최하위 화력이라 좌완 최승용을 흔들기 어렵습니다.",
  detailed_analysis:
    "선발만 보면 두산 최승용(좌완·ERA 5.61·WHIP 1.68·K9 5.44)과 키움 하영민(우완·ERA 4.89·WHIP 1.53·K9 7.91) 모두 평이형이고 표면 매치업은 오히려 하영민이 살짝 위입니다. 그래서 결정은 라인업에서 갈립니다. 두산 타선은 정수빈·박찬호·손아섭·카메론·김민석·양의지로 시즌 K% 15.5의 KBO 최강 콘택트 그룹, 하영민의 BB9 4.88 제구 변동을 그대로 출루 인플레이션으로 전환하기 좋은 구조입니다. 키움 타선은 정반대. 시즌 평균 .231·OBP .307·SLG .320으로 KBO 최하위급, 히우라 합류 후 활력은 붙었지만 표본이 짧고 라인업 길이 자체가 6번 이후 OPS .650 안팎으로 끊깁니다. 좌완 최승용 입장에선 키움 라인업의 좌타 비중(서건창·추재현·김건희·권혁빈) 4명이 좌좌 매치업 약점에 노출되는 구도라 5이닝 호투 그림이 충분히 그려집니다. 두산은 어제 한화전 박치국 슈퍼캐치·이용찬 세이브로 위닝시리즈를 결정하며 분위기·불펜 신뢰가 단단하고 카메론·강승호·정수빈 클린업이 폼 회복 흐름. 잠실 홈 + 라인업 격차에서 두산 쪽으로 0.6, 최승용 ERA 5점대가 5이닝 이전 강판으로 이어질 가능성을 인정해 0.64에서 살짝 보수적으로 조정했습니다."
};

console.log(`Updating Claude prediction for game ${GAME_ID}...`);
const { data, error } = await sb
  .from("bp_ai_predictions")
  .update(updated)
  .eq("game_id", GAME_ID)
  .eq("ai_provider", "claude")
  .select("id, predicted_winner_team_id, confidence")
  .single();

if (error) {
  console.log(`✗ update failed: ${error.message}`);
  process.exit(1);
}

console.log(`✓ ${data.predicted_winner_team_id} conf=${data.confidence} | row id=${data.id}`);
