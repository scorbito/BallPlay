import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [
        line.slice(0, index).trim(),
        line.slice(index + 1).trim().replace(/^['"]|['"]$/g, ""),
      ];
    })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const GAME_DATE = "2026-05-31";
const PUBLISHED_AT = "2026-05-31T09:00:00+09:00";
const AI_PROVIDER = "gpt";
const MODEL_NAME = "gpt-5-codex";

const rows = [
  {
    game_id: "e3b6b910-c2fe-4b1f-a090-febe191b2bc6",
    predicted_winner_team_id: "lg",
    confidence: 0.62,
    key_factor: "홈 선발 안정감",
    one_liner:
      "KIA 장타력은 부담이지만, 잠실 홈에서 톨허스트가 양현종보다 실점 억제 기대값이 높습니다.",
    detailed_analysis:
      "LG 톨허스트는 ERA 3.44, WHIP 1.18에 최근 주간 6.3이닝 1자책으로 안정감이 살아 있습니다. KIA 양현종은 경험과 큰 경기 운영이 변수지만 ERA 4.74, WHIP 1.40, HR/9 1.65라 LG의 출루-장타 연결을 허용할 위험이 있습니다. KIA 타선은 최근 라인업 장타율 .458, ISO .199로 역전 한 방이 충분해 무시할 수 없습니다. 그래도 LG가 전날 KIA의 긴 연승 흐름을 끊었고, 홈과 선발 매치업을 합치면 오늘도 LG 쪽 승률이 조금 더 높다고 봅니다.",
  },
  {
    game_id: "732ab61d-523f-4267-88a9-ef26b3b57617",
    predicted_winner_team_id: "samsung",
    confidence: 0.66,
    key_factor: "타선 출루 격차",
    one_liner:
      "두산 최민석의 ERA는 매력적이지만, 삼성은 양창섭의 제구와 타선 출루 품질이 함께 앞섭니다.",
    detailed_analysis:
      "삼성 최근 라인업은 타율 .292, 출루율 .388, 장타율 .436으로 두산(.254/.340/.358)보다 득점 기대값이 높습니다. 양창섭은 ERA 3.64, WHIP 1.08, BB/9 2.12에 최근 주간 9이닝 무자책이라 현재 컨디션 신호가 좋습니다. 두산 최민석은 ERA 2.84와 K/9 8.52로 역배를 만들 수 있는 투수지만, BB/9 4.44와 최근 주간 5이닝 5자책은 불안 요소입니다. 대구에서 삼성 타선이 볼넷을 골라내며 투구 수를 늘리면 중반 이후 삼성 쪽으로 흐름이 넘어갈 가능성이 큽니다.",
  },
  {
    game_id: "0057eb37-edbb-4dc6-b7ad-bece1113d74b",
    predicted_winner_team_id: "lotte",
    confidence: 0.61,
    key_factor: "비슬리 탈삼진",
    one_liner:
      "NC가 전날 흐름을 가져갔지만, 오늘은 비슬리의 탈삼진과 롯데 장타력이 반등 쪽 근거를 만듭니다.",
    detailed_analysis:
      "롯데 비슬리는 ERA 3.71, WHIP 1.35, K/9 10.81에 최근 주간 6이닝 1자책으로 타자와 직접 승부할 힘이 있습니다. NC 테일러는 ERA 5.77, WHIP 1.53, BB/9 4.94라 롯데 상위 타선에 주자를 쌓아줄 위험이 큽니다. 전날 NC가 만원 관중 앞에서 롯데를 잡은 흐름은 분명하지만, 롯데 최근 라인업 장타율 .479와 ISO .186은 오늘 선발 매치업에서 다시 살아날 수 있는 신호입니다. 이 경기는 정배보다 반등 신호를 더 보는 선택이지만, 근거는 선발과 타선 수치 양쪽에 있습니다.",
  },
  {
    game_id: "f9b6e8ca-e20e-45e9-ac60-1a1286b6ca14",
    predicted_winner_team_id: "hanwha",
    confidence: 0.79,
    key_factor: "SSG 11연패",
    one_liner:
      "SSG가 언젠가 끊을 연패지만, 타케다의 제구 리스크와 한화 타선 흐름을 오늘 넘기 어렵습니다.",
    detailed_analysis:
      "한화는 최근 라인업 타율 .285, 출루율 .368, 장타율 .424로 강백호-노시환-문현빈 축의 압박이 계속 유지되고 있습니다. SSG 타케다는 ERA 8.69, WHIP 1.96, BB/9 5.17이라 대전 원정에서 초반부터 대량 실점 위험이 큽니다. 한화 에르난데스도 ERA 4.68, WHIP 1.51로 완벽한 카드는 아니어서 SSG 장타 반등 가능성은 남아 있습니다. 다만 SSG가 구단 최다 타이 11연패까지 밀렸고, 최근 한화생명 볼파크 매진 흐름까지 더하면 분위기와 매치업 모두 한화 쪽이 강합니다.",
  },
  {
    game_id: "9f918c50-d498-4a0d-a337-d985b6876fa0",
    predicted_winner_team_id: "kt",
    confidence: 0.68,
    key_factor: "KT 3연승 흐름",
    one_liner:
      "키움 박준현의 ERA는 좋지만, 볼넷 리스크와 KT 타선의 균형을 함께 보면 KT가 더 안정적입니다.",
    detailed_analysis:
      "KT 보쉴리는 ERA 3.49, HR/9 0.48, 최근 주간 7이닝 무자책으로 장타 억제와 최근 컨디션이 모두 좋습니다. 키움 박준현은 ERA 2.84로 만만치 않지만 WHIP 1.46, BB/9 5.69가 높아 KT처럼 출루와 콘택트가 고른 타선에게 흔들릴 수 있습니다. KT는 전날 키움을 8-7로 꺾고 3연승과 단독 2위 흐름을 탔고, 최근 라인업도 타율 .284, 출루율 .358로 키움보다 안정적입니다. 키움 새 외국인 타자 히우라의 멀티히트는 변수지만 전체 전력 균형은 KT가 앞섭니다.",
  },
];

const gameIds = rows.map((row) => row.game_id);
const { data: existing, error: existingError } = await supabase
  .from("bp_ai_predictions")
  .select("game_id")
  .eq("game_date", GAME_DATE)
  .eq("ai_provider", AI_PROVIDER)
  .in("game_id", gameIds);

if (existingError) throw existingError;
if (existing.length > 0) {
  throw new Error(
    `Existing gpt predictions found: ${existing.map((row) => row.game_id).join(", ")}`
  );
}

const payloads = rows.map((row) => ({
  ...row,
  game_date: GAME_DATE,
  ai_provider: AI_PROVIDER,
  model_name: MODEL_NAME,
  published_at: PUBLISHED_AT,
}));

const { data, error } = await supabase
  .from("bp_ai_predictions")
  .insert(payloads)
  .select("id, game_id, predicted_winner_team_id, confidence")
  .order("game_id");

if (error) throw error;

for (const row of data) {
  console.log(`${row.game_id} => ${row.predicted_winner_team_id} (${row.confidence})`);
}
console.log(`Inserted ${data.length} gpt predictions for ${GAME_DATE}.`);
