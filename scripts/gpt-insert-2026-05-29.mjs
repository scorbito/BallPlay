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

const GAME_DATE = "2026-05-29";
const PUBLISHED_AT = "2026-05-29T09:00:00+09:00";
const AI_PROVIDER = "gpt";
const MODEL_NAME = "gpt-5-codex";

const rows = [
  {
    game_id: "d0f783c8-f7fb-4daf-a360-b610f9abb3ff",
    predicted_winner_team_id: "lotte",
    confidence: 0.58,
    key_factor: "후반 득점 흐름",
    one_liner:
      "박세웅의 최근 이닝 소화와 롯데 중심타선의 장타 신호를 NC 불펜 불안보다 조금 더 높게 봤습니다.",
    detailed_analysis:
      "롯데는 최근 라인업 기준 타선 장타율이 .462, ISO가 .172로 NC(.380/.138)보다 뚜렷하게 앞섭니다. 박세웅은 시즌 ERA 4.71로 압도적이지는 않지만 최근 주간 6.4이닝 2자책 흐름이라 구창모의 주간 2.6이닝 6자책보다 안정 신호가 낫습니다. NC는 김주원-박건우-데이비슨 축이 위협적이지만 전날 한화전 18실점 보도처럼 불펜과 수비 쪽 흔들림이 이어졌습니다. 창원 홈 이점 때문에 크게 벌리기는 어렵지만, 중후반 한 번의 빅이닝 가능성은 롯데 쪽이 더 자연스럽습니다.",
  },
  {
    game_id: "5358295e-ab78-49f2-b781-26ed45e6281b",
    predicted_winner_team_id: "hanwha",
    confidence: 0.78,
    key_factor: "타선 폭발력",
    one_liner:
      "한화는 강백호-문현빈-노시환 축의 최근 화력이 강하고, SSG는 9연패 흐름을 먼저 끊어야 하는 부담이 큽니다.",
    detailed_analysis:
      "한화는 최근 라인업 9인 평균이 타율 .298, 출루율 .376, 장타율 .467로 오늘 10개 팀 중 가장 좋은 축에 가깝습니다. 전날 NC전에서도 강백호와 김태연 중심의 대량 득점 보도가 이어졌고, 대전 홈에서 화이트가 ERA 2.63, WHIP 1.10으로 초반 안정감을 주는 매치업입니다. SSG 최민준도 ERA 3.51로 쉽게 무너질 투수는 아니지만 BB/9 4.61과 팀 9연패 뉴스가 겹치며 경기 후반 운영 리스크가 큽니다. 언더독 반등 가능성은 열어두되 현재 흐름과 선발-타선 조합은 한화 쪽 확률이 꽤 높습니다.",
  },
  {
    game_id: "790f6cfc-35db-4ec3-87a3-283e258f40e6",
    predicted_winner_team_id: "kt",
    confidence: 0.72,
    key_factor: "타선 접촉률",
    one_liner:
      "KT는 최근 라인업의 출루와 삼진 억제가 좋고, 키움은 배동현이 버텨도 득점 지원이 얇아 보입니다.",
    detailed_analysis:
      "KT 최근 라인업은 타율 .311, 출루율 .389, 삼진율 15.8%로 오늘 매치업 중 가장 깔끔한 접촉 프로필을 보입니다. 사우어의 ERA 4.82는 부담이지만 이닝 누적과 탈삼진 능력은 배동현과 비슷하고, 키움 타선은 최근 라인업 기준 장타율 .331, ISO .091로 득점 루트가 좁습니다. 전날 KT가 두산전 7~9회에만 10득점했다는 흐름도 후반 집중력 신호로 볼 수 있습니다. 고척 원정 변수를 감안해 과신하지는 않지만, 타선의 바닥과 후반 득점 기대값은 KT가 더 낫습니다.",
  },
  {
    game_id: "80251d7e-0511-416d-ac8c-147b7ef17f8c",
    predicted_winner_team_id: "samsung",
    confidence: 0.74,
    key_factor: "선발 안정감",
    one_liner:
      "잭로그도 나쁘지 않지만 원태인의 WHIP와 삼성의 장타 흐름, 대구 홈 이점이 함께 붙습니다.",
    detailed_analysis:
      "원태인은 최신 스냅샷 기준 ERA 3.43, WHIP 1.19, HR/9 0.23으로 장타 억제력이 확실합니다. 두산 잭로그도 ERA 3.81, K/9 8.54라 맞불은 가능하지만, 두산은 최근 보도에서 불펜 붕괴와 수비 실책 문제가 반복적으로 언급됐고 최근 라인업 장타율도 .358에 그칩니다. 삼성은 전날 SSG전 홈런 5방과 선두 수성 보도가 나온 직후라 하위타선까지 장타가 살아난 상태입니다. 선발에서 큰 차이는 아니어도 홈 구장, 장타 흐름, 불펜 안정감을 합치면 삼성 우세가 선명합니다.",
  },
  {
    game_id: "4d957851-a623-4666-8f01-669b36124c1a",
    predicted_winner_team_id: "lg",
    confidence: 0.57,
    key_factor: "웰스 제구력",
    one_liner:
      "KIA의 6연승과 장타력은 강하지만, 오늘 선발 매치업만 놓고 보면 웰스의 안정감이 근소하게 앞섭니다.",
    detailed_analysis:
      "KIA는 최근 라인업 기준 장타율 .481, ISO .209로 LG보다 펀치력이 좋고 6연승 보도까지 있어 흐름만 보면 강하게 끌립니다. 다만 이의리는 ERA 8.37, WHIP 1.98, BB/9 7.84로 볼넷 리스크가 너무 커서 잠실 원정 초반부터 주자를 쌓을 가능성이 큽니다. LG 웰스는 ERA 2.06, WHIP 0.97로 오늘 선발 중 가장 안정적인 축이고, 홍창기-박해민-오스틴으로 이어지는 라인업은 대량 득점보다 꾸준한 출루 압박에 강점이 있습니다. KIA의 상승세 때문에 낮은 확신으로 잡지만, 오늘 한 경기의 균형은 LG 선발 안정감 쪽으로 살짝 기웁니다.",
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
