// 2026-06-05 Claude one_liner UPDATE — 전문 약어 제거, 평이한 한국어로.
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

const updates = [
  {
    game_id: "2f6c3e20-2ca6-40c2-bcd1-90d8020537ff",
    key_factor: "류현진 vs 로드리게스",
    one_liner: "한화 픽. 류현진은 평균 자책점 3점대 초반의 한화 1선발이고 롯데 로드리게스는 5점대 평이한 카드라 한 단계 차이가 분명하고, 강백호·노시환 중심의 타선이 사직에서도 그대로 작동합니다."
  },
  {
    game_id: "eb669790-27f5-4f86-a900-c0ad9ca914e3",
    key_factor: "KT 톱타선 + 김건우 흔들림",
    one_liner: "KT 픽. KT는 팀 타율과 출루율 모두 리그 최상위급으로 타격감이 가장 좋은 팀이고, 상대 김건우는 최근 일주일 7자책점에 볼넷도 많아 KT 타선이 다득점 모드에 들어갈 만한 흐름입니다."
  },
  {
    game_id: "3b18bef2-3be4-47a7-9743-52e158466a69",
    key_factor: "두산 콘택트 + 키움 약점 타선",
    one_liner: "두산 픽. 두산은 리그에서 가장 삼진을 안 당하는 콘택트 강팀이라 영건 하영민의 볼넷·실투를 그대로 점수로 바꿀 수 있고, 키움 타선은 팀 타율 리그 최하위라 잠실에서 잭로그를 흔들기 어렵습니다."
  },
  {
    game_id: "fcd0ca0b-c73a-4f8a-b40d-7ff268a0a7b2",
    key_factor: "올러 KBO 1선발급 + 광주",
    one_liner: "KIA 픽. 올러는 평균 자책점 2점대에 탈삼진 능력까지 갖춘 리그 최상위 선발이고, 김도영·나성범·아데를린 클린업의 장타력이 광주 홈에서 오러클린을 흔들기 좋은 매치업입니다."
  },
  {
    game_id: "28849d56-4cd3-48ef-834b-f63accc30014",
    key_factor: "NC 삼진 많은 약점 + LG 라인업",
    one_liner: "LG 픽. NC는 리그에서 삼진을 가장 많이 당하는 팀이라 LG 김윤식 정도 카드로도 흔들 수 있는 구조이고, 홍창기·박해민·오스틴·오지환 톱타선의 출루 능력이 NC 라일리 상대로도 작동합니다."
  }
];

console.log(`Updating ${updates.length} one_liners for 2026-06-05 (claude)...`);

let okCount = 0;
let failCount = 0;
for (const u of updates) {
  const { data, error } = await sb
    .from("bp_ai_predictions")
    .update({ one_liner: u.one_liner, key_factor: u.key_factor })
    .eq("game_id", u.game_id)
    .eq("ai_provider", "claude")
    .eq("game_date", "2026-06-05")
    .select("id, predicted_winner_team_id, key_factor")
    .single();
  if (error) {
    console.log(`  ✗ ${u.game_id}: ${error.message}`);
    failCount++;
  } else {
    console.log(`  ✓ ${data.predicted_winner_team_id.padEnd(8)} | key_factor="${data.key_factor}"`);
    okCount++;
  }
}

console.log(`\n결과: 성공 ${okCount}건 / 실패 ${failCount}건`);
