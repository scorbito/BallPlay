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

const GAME_DATE = "2026-06-07";
const PUBLISHED_AT = "2026-06-07T09:00:00+09:00";
const AI_PROVIDER = "gpt";
const MODEL_NAME = "gpt-5-codex";

const rows = [
  {
    game_id: "3f1b9543-3868-4eef-a015-8f67dfd21aba",
    predicted_winner_team_id: "doosan",
    confidence: 0.61,
    key_factor: "잠실 상승세",
    one_liner:
      "두산은 전날 안우진을 공략하며 타선 자신감을 크게 끌어올렸고, 오늘은 벤자민이 초반 흐름을 잡아줄 수 있습니다. 키움도 알칸타라가 버티면 접전으로 갈 수 있지만, 잠실 홈의 두산 흐름을 더 높게 보겠습니다.",
    detailed_analysis:
      "두산은 최근 잠실에서 경기 운영이 단단해졌고, 전날 강한 선발을 상대로도 타선이 살아났다는 점이 큽니다. 벤자민은 큰 장타를 잘 억제하는 편이라 키움 중심타선이 한 번에 흐름을 바꾸기 쉽지 않을 수 있습니다. 키움 알칸타라는 제구와 탈삼진이 좋아 두산 타선을 묶을 힘이 있습니다. 다만 키움은 득점권에서 연결이 끊기면 한 번에 따라붙는 힘이 흔들릴 수 있습니다. 두산은 정수빈, 카메론, 손아섭, 양의지로 이어지는 구간에서 꾸준히 출루를 만들고, 후반 불펜 승부로 넘어가는 운영도 좋아졌습니다. 오늘은 초반 1~2점 싸움에서 두산이 더 안정적으로 버틸 가능성이 큽니다.",
  },
  {
    game_id: "b4129b25-447f-42a9-83a8-1208bef07193",
    predicted_winner_team_id: "samsung",
    confidence: 0.56,
    key_factor: "삼성 타선 균형",
    one_liner:
      "KIA는 광주 홈과 네일의 안정감이 있지만, 삼성은 구자욱-디아즈 중심타선의 출루와 장타 균형이 좋습니다. 접전 가능성이 큰 경기라 낮게 보지만, 삼성 타선의 폭을 조금 더 믿겠습니다.",
    detailed_analysis:
      "KIA 네일은 주자 관리를 잘하고 큰 이닝을 쉽게 내주지 않는 투수라 삼성도 초반부터 크게 몰아치기는 어렵습니다. 광주 홈이라는 점도 KIA에는 분명한 힘입니다. 하지만 삼성 양창섭도 최근 경기 운영이 안정적이고, 볼넷으로 무너지는 장면이 많지 않습니다. 타선에서는 삼성의 폭이 조금 더 넓습니다. 김지찬과 김성윤이 앞에서 흔들고, 구자욱, 디아즈, 강민호, 류지혁으로 이어지는 구간이 꾸준히 압박을 줄 수 있습니다. KIA도 김도영과 나성범의 장타가 살아나면 바로 흐름이 바뀌지만, 오늘은 삼성의 공격 선택지가 조금 더 다양하다고 판단합니다.",
  },
  {
    game_id: "64026760-6335-42a9-8c86-fa35712cf50b",
    predicted_winner_team_id: "nc",
    confidence: 0.53,
    key_factor: "창원 흐름",
    one_liner:
      "LG가 전체 전력은 여전히 좋지만, NC는 전날 LG를 잡으며 창원 홈 분위기를 확실히 살렸습니다. 토다가 초반을 버티고 박건우-데이비슨 쪽에서 해결하면 NC가 한 번 더 흐름을 이어갈 수 있습니다.",
    detailed_analysis:
      "LG는 홍창기, 박해민, 오스틴, 문보경, 오지환으로 이어지는 타선 구성이 여전히 좋습니다. 송승기도 직전 흐름이 좋아 NC 타선을 상대로 초반을 버틸 수 있습니다. 다만 NC는 전날 LG전에서 후반 집중력과 장타 흐름을 보여줬고, 창원 홈 분위기가 살아났습니다. 토다는 기복은 있지만 초반에 볼넷만 줄이면 LG 타선을 상대로 5이닝 안팎을 버틸 수 있는 카드입니다. NC는 김주원, 박민우가 출루하고 박건우와 데이비슨이 해결하는 흐름이 나오면 충분히 승산이 있습니다. LG가 더 안정적인 팀인 건 맞지만, 오늘은 NC의 홈 흐름을 아주 근소하게 보겠습니다.",
  },
  {
    game_id: "1ae3b4a3-82b9-4416-9957-648e13efc96c",
    predicted_winner_team_id: "hanwha",
    confidence: 0.57,
    key_factor: "한화 연결력",
    one_liner:
      "롯데는 비슬리가 삼진으로 흐름을 끊을 수 있지만, 최근 뒷문 불안과 3연패 분위기가 부담입니다. 한화는 황준서의 초반 제구가 변수지만, 페라자-문현빈-노시환 중심타선의 연결력을 더 믿겠습니다.",
    detailed_analysis:
      "롯데 비슬리는 탈삼진 능력이 좋아 한화 타선의 초반 흐름을 끊을 수 있습니다. 하지만 최근 실점 흐름이 좋지 않았고, 롯데는 경기 후반 불펜에서 흔들리는 장면이 반복됐습니다. 한화 황준서는 볼넷이 많아 사직 원정에서 초반부터 주자를 쌓을 위험이 있습니다. 그래서 이 경기는 쉽게 한쪽으로 기울 경기로 보기는 어렵습니다. 다만 한화는 페라자, 문현빈, 노시환, 김태연으로 이어지는 중심 구간이 꾸준히 점수를 만들 수 있습니다. 롯데가 선취점을 내도 후반 운영 불안이 남아 있어, 한화가 중반 이후 뒤집거나 달아나는 쪽을 조금 더 높게 봅니다.",
  },
  {
    game_id: "f15b7a93-8401-498a-8748-4358856f966e",
    predicted_winner_team_id: "kt",
    confidence: 0.65,
    key_factor: "KT 타선 출루",
    one_liner:
      "KT는 최근 타선 출루와 연결이 가장 안정적인 축이고, 오원석도 베니지아노보다 경기 운영이 깔끔합니다. SSG가 홈에서 버티더라도 KT가 중반 이후 꾸준히 압박할 가능성이 큽니다.",
    detailed_analysis:
      "KT는 최원준, 김현수, 김민혁, 힐리어드, 허경민으로 이어지는 타선이 출루와 콘택트 모두 안정적입니다. 최근 라인업의 흐름만 보면 오늘 5경기 중 가장 꾸준히 기회를 만들 수 있는 팀입니다. 오원석은 압도적인 투수는 아니지만 볼넷으로 크게 흔들리는 유형은 아니어서 SSG 타선을 상대로 경기 운영을 기대할 수 있습니다. SSG 베니지아노는 장타와 주자 허용이 겹치는 날이 있어 KT 상위타선과 만나면 투구 수가 빠르게 늘 수 있습니다. SSG도 홈에서 최정, 김재환, 에레디아가 한 방을 만들 수 있지만, 전체 연결력은 KT가 더 좋아 보입니다. 오늘은 KT가 초반부터 꾸준히 주자를 쌓고 후반에 차이를 만드는 그림을 보겠습니다.",
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
