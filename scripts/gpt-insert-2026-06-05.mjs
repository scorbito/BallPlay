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

const GAME_DATE = "2026-06-05";
const PUBLISHED_AT = "2026-06-05T09:00:00+09:00";
const AI_PROVIDER = "gpt";
const MODEL_NAME = "gpt-5.5-codex";

const rows = [
  {
    game_id: "2f6c3e20-2ca6-40c2-bcd1-90d8020537ff",
    predicted_winner_team_id: "hanwha",
    confidence: 0.66,
    key_factor: "류현진 안정감",
    one_liner:
      "롯데 타선도 최근 하위타선까지 쉽게 죽지 않지만, 오늘은 류현진이 초반 흐름을 잡아줄 가능성이 더 큽니다. 로드리게스가 장타를 허용하면 한화가 중반 이후 점수 차를 벌릴 수 있습니다.",
    detailed_analysis:
      "한화는 전날 두산전에서 아쉬운 흐름이 있었지만, 오늘 선발 카드만큼은 확실한 안정감을 기대할 수 있습니다. 류현진은 볼넷으로 스스로 무너지는 유형이 아니고, 긴 이닝을 계산할 수 있다는 점에서 롯데 타선을 상대하기 좋은 카드입니다. 롯데 로드리게스는 탈삼진 능력은 있지만 장타 허용과 주자 관리가 흔들리는 날이 있어 한화 중심타선 앞에서 위험한 승부가 될 수 있습니다. 롯데는 황성빈, 고승민, 레이예스, 나승엽이 초반 출루를 만들면 경기 흐름을 가져올 수 있습니다. 다만 한화도 노시환과 김태연 중심으로 한 방을 만들 수 있고, 류현진이 버티는 동안 먼저 리드를 잡을 가능성이 큽니다. 오늘은 접전이 되더라도 한화가 선발 안정감으로 한 발 앞선다고 보겠습니다.",
  },
  {
    game_id: "eb669790-27f5-4f86-a900-c0ad9ca914e3",
    predicted_winner_team_id: "ssg",
    confidence: 0.56,
    key_factor: "초반 마운드 변수",
    one_liner:
      "KT 타선은 오늘도 가장 위협적인 축이지만, 문용익이 초반을 버티지 못하면 SSG가 홈에서 분위기를 잡을 수 있습니다. 김건우도 불안 요소는 있어, 이 경기는 초반 3이닝 실점 관리가 승부처입니다.",
    detailed_analysis:
      "KT는 최원준, 김현수, 힐리어드, 허경민으로 이어지는 타선의 출루와 콘택트가 매우 좋습니다. 그래서 SSG 김건우가 볼넷을 많이 내주면 KT가 경기 초반부터 크게 흔들 수 있습니다. 하지만 KT 선발 문용익도 최근 이닝 소화와 주자 관리가 안정적이라고 보기 어렵습니다. SSG는 긴 연패를 끊은 뒤 최정, 에레디아, 김재환, 전의산 쪽 장타 흐름을 다시 살릴 여지가 있습니다. 양쪽 모두 마운드 불안이 있어 점수 싸움으로 번질 가능성이 큽니다. 그 상황에서는 홈에서 먼저 분위기를 잡고 심리적 부담을 덜어낸 SSG 쪽을 아주 근소하게 보겠습니다.",
  },
  {
    game_id: "3b18bef2-3be4-47a7-9743-52e158466a69",
    predicted_winner_team_id: "doosan",
    confidence: 0.62,
    key_factor: "두산 상승세",
    one_liner:
      "두산은 최근 접전 운영과 불펜 마무리에서 힘을 얻었고, 키움은 타선이 한 번 막히면 따라가는 힘이 약합니다. 최승용이 초반 볼넷만 줄이면 두산이 홈에서 흐름을 이어갈 가능성이 높습니다.",
    detailed_analysis:
      "두산은 우천 지연과 긴 승부 속에서도 한화를 잡아내며 최근 경기 운영에 자신감을 얻었습니다. 이용찬의 세이브처럼 뒷문에서 긍정적인 장면이 나온 점도 접전에서 도움이 됩니다. 최승용은 시즌 전체로 보면 기복이 있지만, 키움 타선이 최근 출루와 장타 모두 강한 편은 아니라 초반만 버티면 충분히 승산이 있습니다. 키움 하영민도 볼넷과 장타 허용이 겹치는 날에는 두산 상위타선에 주도권을 줄 수 있습니다. 키움은 히우라가 중심에서 한 방을 만들면 흐름을 바꿀 수 있지만, 전체 타선의 응집력은 아직 두산보다 약합니다. 오늘은 두산이 홈에서 선취점 이후 불펜 승부로 이어가는 그림을 더 높게 봅니다.",
  },
  {
    game_id: "fcd0ca0b-c73a-4f8a-b40d-7ff268a0a7b2",
    predicted_winner_team_id: "kia",
    confidence: 0.58,
    key_factor: "올러 제구력",
    one_liner:
      "삼성 타선은 구자욱-최형우-디아즈 중심으로 정말 까다롭지만, 광주에서는 올러의 제구와 탈삼진 능력이 먼저 눈에 들어옵니다. KIA가 초반에 오러클린의 볼넷을 끌어내면 홈에서 근소하게 앞설 수 있습니다.",
    detailed_analysis:
      "이 경기는 오늘 가장 판단이 어려운 경기 중 하나입니다. 삼성은 김성윤, 구자욱, 최형우, 디아즈, 강민호까지 이어지는 타선의 출루와 장타 밸런스가 좋습니다. 오러클린도 탈삼진 능력이 있어 KIA 타선을 쉽게 상대할 투수는 아닙니다. 다만 KIA 올러는 실점 억제, 주자 관리, 탈삼진 모두 안정적인 선발이고 홈 광주에서 긴 이닝을 기대할 수 있습니다. KIA 타선은 최근 전체 출루 흐름이 삼성보다 약하지만 김도영, 나성범, 아데를린의 장타 한 방은 여전히 살아 있습니다. 삼성 타선의 힘 때문에 크게 확신할 수는 없지만, 오늘은 올러가 6이닝 안팎을 버티고 KIA가 홈에서 1~2점 차 승부를 가져가는 쪽을 보겠습니다.",
  },
  {
    game_id: "28849d56-4cd3-48ef-834b-f63accc30014",
    predicted_winner_team_id: "lg",
    confidence: 0.6,
    key_factor: "LG 타선 응집력",
    one_liner:
      "NC 라일리는 삼진을 잡을 힘이 있지만, LG는 홍창기-오스틴-오지환으로 이어지는 공격 흐름이 쉽게 끊기지 않습니다. 김윤식이 초반을 버텨주면 LG가 중후반 타선 응집력으로 앞설 가능성이 큽니다.",
    detailed_analysis:
      "NC 라일리는 탈삼진 능력이 좋고 초반부터 타자와 정면 승부할 힘이 있습니다. 그래서 LG가 초반에 끌려가면 경기가 생각보다 답답해질 수 있습니다. 하지만 NC 타선은 최근 삼진으로 공격 흐름이 끊기는 장면이 많고, 출루 이후 한 번에 몰아치는 힘도 LG보다 떨어집니다. LG는 홍창기와 박해민이 상위에서 기회를 만들고, 오스틴과 오지환이 해결하는 구조가 안정적입니다. 김윤식은 표본이 많지는 않지만 최근 실점 억제가 괜찮고, NC 타선 상대로 큰 이닝만 피하면 충분히 버틸 수 있습니다. 창원 원정 부담은 있지만 전체 전력과 타선 응집력은 LG 쪽이 더 좋다고 보겠습니다.",
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
  const { error: deleteError } = await supabase
    .from("bp_ai_predictions")
    .delete()
    .eq("game_date", GAME_DATE)
    .eq("ai_provider", AI_PROVIDER)
    .in("game_id", gameIds);
  if (deleteError) throw deleteError;
  console.log(`Deleted ${existing.length} existing gpt predictions for ${GAME_DATE}.`);
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
