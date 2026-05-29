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

const GAME_DATE = "2026-05-30";
const PUBLISHED_AT = "2026-05-30T09:00:00+09:00";
const AI_PROVIDER = "gpt";
const MODEL_NAME = "gpt-5-codex";

const rows = [
  {
    game_id: "5f6b53d6-a9e1-4ac7-bf1a-28a0314ba8a7",
    predicted_winner_team_id: "samsung",
    confidence: 0.69,
    key_factor: "선발 WHIP 차이",
    one_liner:
      "두산이 전날 라팍에서 반전을 만들었지만, 오늘은 오러클린의 안정감과 삼성 타선의 바닥을 더 믿습니다.",
    detailed_analysis:
      "삼성 오러클린은 최신 스냅샷 기준 ERA 3.68, WHIP 1.21, K/9 8.25로 최승용(ERA 5.13, WHIP 1.63)보다 선발 안정감이 분명합니다. 두산은 전날 삼성전 9회 반전 보도로 분위기를 바꿨지만, 최근 라인업 평균 장타율 .358로 한 번 더 대량 득점을 기대하기에는 폭발력이 제한적입니다. 삼성은 구자욱-최형우-디아즈 축과 하위타선 장타 흐름이 살아 있고, 오러클린 계약 연장 뉴스도 마운드 신뢰를 보강합니다. 전날 패배 직후라 초반 압박은 있겠지만 선발과 타선 균형은 삼성 쪽으로 봅니다.",
  },
  {
    game_id: "10691854-55a9-4f88-b6d4-e9836153ccc9",
    predicted_winner_team_id: "kia",
    confidence: 0.64,
    key_factor: "올러 안정감",
    one_liner:
      "LG가 KIA 연승을 끊었지만, 오늘 선발 매치업은 올러의 WHIP와 KIA 장타력이 다시 앞서는 그림입니다.",
    detailed_analysis:
      "KIA 올러는 ERA 2.45, WHIP 0.93, K/9 9.39에 최근 주간 6이닝 무자책 흐름까지 있어 오늘 선발 중 가장 강한 축입니다. LG는 전날 웰스 호투와 젊은 거포들의 장타 보도가 이어졌고, 송승기도 탈삼진 능력은 있지만 ERA 4.71, WHIP 1.48로 주자 허용 위험이 더 큽니다. KIA 타선은 최근 라인업 기준 장타율 .481, ISO .209로 LG(.381/.120)보다 한 방 기대값이 높습니다. 잠실 원정과 전날 완패 여파 때문에 과신은 어렵지만, 선발 우위가 충분히 커서 KIA 반등을 선택합니다.",
  },
  {
    game_id: "f173c876-c703-435f-a494-08ade87ae264",
    predicted_winner_team_id: "nc",
    confidence: 0.67,
    key_factor: "선발 제구 격차",
    one_liner:
      "롯데의 전날 연장 승리는 강한 신호지만, 이민석의 볼넷 리스크와 라일리의 제구 차이가 큽니다.",
    detailed_analysis:
      "NC 라일리는 ERA 3.27, WHIP 1.00, K/9 9.82, BB/9 1.64로 짧은 표본 안에서 제구와 탈삼진이 모두 안정적입니다. 반면 롯데 이민석은 ERA 11.42, WHIP 2.19, BB/9 8.28로 초반 볼넷과 장타 허용이 겹치면 경기가 빠르게 기울 수 있습니다. 롯데는 전날 연장 10회 5득점으로 NC를 누른 흐름과 라인업 장타율 .462가 매력적입니다. 그래도 오늘은 선발 리스크 차이가 너무 커서 NC가 초반부터 득점권 기회를 더 자주 만들 가능성이 높다고 봅니다.",
  },
  {
    game_id: "ad2766a5-4534-40f4-89b9-5343f838a9e3",
    predicted_winner_team_id: "hanwha",
    confidence: 0.8,
    key_factor: "류현진과 10연패",
    one_liner:
      "류현진의 제구 안정과 한화 중심타선 흐름이 SSG의 10연패 부담보다 훨씬 강하게 보입니다.",
    detailed_analysis:
      "한화 류현진은 ERA 3.42, WHIP 1.04, BB/9 1.37로 경기 운영 안정감이 뚜렷하고 최근 주간 6.7이닝 2자책 흐름도 좋습니다. SSG 김건우는 ERA 3.68로 버틸 힘은 있지만 BB/9 4.56, HR/9 1.23이라 대전 원정에서 장타와 볼넷이 겹칠 위험이 있습니다. 한화 타선은 최근 라인업 기준 타율 .298, 출루율 .376, 장타율 .467로 강백호-문현빈-노시환 축의 압박이 크고, 전날도 SSG를 10연패로 몰아넣었습니다. 이 경기는 분위기, 선발, 타선이 같은 방향을 가리켜 높은 확신으로 한화를 봅니다.",
  },
  {
    game_id: "a4e71d35-c30c-4bc4-81a9-664239a91f86",
    predicted_winner_team_id: "kt",
    confidence: 0.66,
    key_factor: "타선 출루 격차",
    one_liner:
      "문용익의 선발 표본은 불확실하지만, KT 타선의 출루와 접촉 능력이 키움보다 확실히 높습니다.",
    detailed_analysis:
      "KT는 최근 라인업 기준 타율 .311, 출루율 .389, 삼진율 15.8%로 오늘 경기 팀들 중 가장 안정적인 접촉 프로필을 보입니다. 키움은 장타율 .331, ISO .091, 삼진율 22.7%라 박정훈이 버티더라도 득점 지원이 얇아질 가능성이 큽니다. 박정훈은 ERA 4.08이지만 BB/9 5.96으로 KT처럼 출루 압박이 좋은 타선을 만나면 투구 수가 빠르게 늘 수 있습니다. KT 문용익은 시즌 선발 스탯 표본이 거의 없어 리스크가 있지만, 불펜 게임으로 가도 타선과 팀 흐름은 KT 쪽이 더 신뢰됩니다.",
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
