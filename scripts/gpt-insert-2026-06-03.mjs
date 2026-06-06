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

const GAME_DATE = "2026-06-03";
const PUBLISHED_AT = "2026-06-03T09:00:00+09:00";
const AI_PROVIDER = "gpt";
const MODEL_NAME = "gpt-5-codex";

const rows = [
  {
    game_id: "a506b577-2c92-45b6-96b0-a2d2b64670b9",
    predicted_winner_team_id: "kia",
    confidence: 0.59,
    key_factor: "광주 장타 반등",
    one_liner:
      "김진욱의 시즌 수치는 좋지만, 광주 홈 KIA는 김도영-나성범-아데를린 중심타선의 장타력이 롯데보다 위협적입니다. 황동하가 최근 무실점 흐름만 이어주면 KIA가 중반 이후 한 방으로 앞설 가능성이 큽니다.",
    detailed_analysis:
      "롯데 김진욱은 ERA 3.38, WHIP 1.19로 황동하(ERA 3.91, WHIP 1.30)보다 시즌 안정감이 조금 낫습니다. 그래서 선발만 놓고 보면 롯데도 충분히 승산이 있습니다. 다만 황동하는 최근 주간 6이닝 무자책 흐름이 있고, 광주 홈에서 초반 2~3실점 안으로 버티면 KIA 타선의 장타 기대값이 살아납니다. KIA 최근 라인업은 타율 .275, 출루율 .348, 장타율 .456, ISO .181로 롯데(.270/.322/.413/.143)보다 중심타선 파괴력이 큽니다. 롯데도 레이예스-나승엽 축이 있어 역배 가능성은 있지만, 출루율 차이와 홈 이점이 KIA 쪽입니다. KIA가 전날 캡틴 동점 홈런으로 흐름을 붙잡은 점도 연패 후 반등 신호로 봅니다.",
  },
  {
    game_id: "e60663ca-2f04-4d79-9639-3661ca2ecf4f",
    predicted_winner_team_id: "kt",
    confidence: 0.66,
    key_factor: "KT 출루와 고영표",
    one_liner:
      "LG가 1위 흐름을 타고 있지만, 수원에서는 KT 타선의 출루율과 고영표의 제구가 더 믿음직합니다. 이정용이 초반 주자를 많이 내보내면 KT 중심타선이 바로 점수로 연결할 수 있습니다.",
    detailed_analysis:
      "KT 고영표는 ERA 5.07이 높지만 K/9 10.47, BB/9 1.64로 볼넷을 줄이며 직접 승부할 수 있는 투수입니다. 최근 주간 6이닝 2자책도 반등 신호로 볼 수 있습니다. 반면 LG 이정용은 ERA 5.65, WHIP 1.85에 최근 주간 2.7이닝 5자책으로 주자 허용과 이닝 소화가 모두 부담입니다. 타선도 KT가 최근 라인업 타율 .298, 출루율 .380, 장타율 .414로 LG(.256/.353/.378)보다 안정적입니다. LG는 홍창기-오스틴-오지환이 한 번에 경기를 바꿀 수 있어 낮은 점수 차 승부가 될 가능성이 큽니다. 그래도 선발 제구, 홈 구장, 타선 출루 생산력을 합치면 KT가 근소하지만 확실한 우세입니다.",
  },
  {
    game_id: "c210637c-590c-4fe1-8d32-dc152d2c5f8f",
    predicted_winner_team_id: "hanwha",
    confidence: 0.73,
    key_factor: "타선 화력 차이",
    one_liner:
      "두산이 잠실 홈이라도 박신지의 실점 리스크가 너무 크고, 한화는 강백호-노시환-문현빈 중심타선의 힘이 확실합니다. 왕옌청이 초반만 버티면 한화가 타선 화력으로 경기를 끌고 갈 가능성이 높습니다.",
    detailed_analysis:
      "한화 왕옌청은 ERA 3.24로 안정적이지만 WHIP 1.41, BB/9 3.70이라 완벽한 선발 카드는 아닙니다. 그래도 두산 박신지는 ERA 10.50, WHIP 1.83, BB/9 6.00, HR/9 2.25로 현재 매치업에서 훨씬 큰 위험을 안고 들어갑니다. 타선 격차도 큽니다. 한화 최근 라인업은 타율 .302, 출루율 .381, 장타율 .480, ISO .177로 오늘 경기 중 가장 강한 축이고, 두산은 .260/.338/.377/.117로 장타 기대값이 낮습니다. 두산이 잠실에서 초반 번트와 주루로 흔드는 그림은 가능하지만, 박신지가 볼넷을 쌓으면 한화 중심타선 앞에서 버티기 어렵습니다. 한화는 다이너마이트 타선 흐름이 계속 언급될 만큼 득점 루트가 다양해 정배 선택이 타당합니다.",
  },
  {
    game_id: "d2f73a03-2a1c-4ba5-81fc-99ee547acfa9",
    predicted_winner_team_id: "samsung",
    confidence: 0.7,
    key_factor: "삼성 타선 응집력",
    one_liner:
      "김태경의 시즌 수치만 보면 NC도 버틸 수 있지만, 삼성은 최근 타선 출루율과 8회 뒤집기 흐름이 좋습니다. 대구 홈에서 최원태가 최근 무자책 흐름을 이어가면 삼성 중심타선이 차이를 만들 가능성이 큽니다.",
    detailed_analysis:
      "NC 김태경은 ERA 3.44, WHIP 1.15로 최원태(ERA 4.72, WHIP 1.53)보다 표면 수치가 좋습니다. 그래서 이 경기는 단순 선발만 보면 NC 역배를 검토해야 하는 경기입니다. 하지만 최원태는 최근 주간 7이닝 무자책으로 컨디션이 올라왔고, 삼성은 전날 8회 뒤집기쇼로 NC 불펜을 흔든 흐름이 있습니다. 타선 지표도 삼성 우위가 뚜렷합니다. 삼성 최근 라인업은 타율 .294, 출루율 .390, 장타율 .453, 삼진율 14.9%이고 NC는 .240/.315/.362에 삼진율 28.7%로 공격 안정성이 크게 떨어집니다. 김태경이 초반을 잘 막아도 후반 불펜 승부와 타선 응집력은 삼성 쪽이라고 봅니다.",
  },
  {
    game_id: "84ec98a8-d817-493c-9f74-090e840f4bf2",
    predicted_winner_team_id: "kiwoom",
    confidence: 0.58,
    key_factor: "SSG 13연패 균열",
    one_liner:
      "키움도 강한 팀은 아니지만, 히우라의 결승포와 8연패 탈출로 분위기가 바뀌었습니다. SSG는 13연패 부담이 너무 커서 백승건이 잘 버텨도 후반 운영 불안이 남아 있습니다.",
    detailed_analysis:
      "키움 로젠버그는 표본이 작지만 ERA 3.18, K/9 11.15로 헛스윙을 만들 수 있는 힘이 있습니다. SSG 백승건도 ERA 4.32, WHIP 1.56으로 완전히 밀리는 카드는 아니고, SSG 타선은 최근 라인업 장타율 .416, ISO .156으로 키움(.348/.099)보다 장타 지표가 낫습니다. 그래서 타선만 보면 SSG 반등도 충분히 검토할 수 있습니다. 다만 SSG는 전날 키움에 12-6으로 지며 13연패까지 밀렸고, 경기 후반 수비와 불펜 운영의 심리적 부담이 매우 큽니다. 키움은 히우라 결승포와 알칸타라 호투를 계기로 8연패를 끊어 분위기가 반대로 살아났습니다. 낮은 확신이지만, 지금은 SSG의 장타 지표보다 키움의 흐름 전환과 상대 붕괴 신호를 더 크게 봅니다.",
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
