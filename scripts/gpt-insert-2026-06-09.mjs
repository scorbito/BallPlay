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

const GAME_DATE = "2026-06-09";
const PUBLISHED_AT = "2026-06-09T09:00:00+09:00";
const AI_PROVIDER = "gpt";
const MODEL_NAME = "gpt-5-codex";

const rows = [
  {
    game_id: "583ecf6c-f87f-4c68-87e6-29add37a77fa",
    predicted_winner_team_id: "lg",
    confidence: 0.62,
    key_factor: "잠실 홈 응집력",
    one_liner:
      "SSG 김민준의 초반 흐름은 변수지만, 잠실 홈에서는 LG가 상위타선 출루와 임찬규의 최근 안정감을 앞세울 수 있습니다. SSG가 장타 한 방으로 흔들 수 있어도 전체 경기 운영은 LG 쪽이 더 안정적입니다.",
    detailed_analysis:
      "LG는 홍창기와 박해민이 앞에서 출루하고 오스틴, 문보경, 오지환이 해결하는 구조가 여전히 안정적입니다. 임찬규는 최근 등판에서 실점을 잘 억제했고, 잠실에서는 큰 장타를 줄이며 경기 흐름을 관리할 수 있습니다. SSG 김민준은 표본이 많지는 않지만 초반 구위가 살아 있으면 LG 타선을 당황시킬 수 있습니다. 다만 SSG 타선은 최근 라인업 기준 출루와 장타가 모두 LG보다 조금 낮고, 잠실에서는 한 번의 장타만으로 경기를 풀기 어렵습니다. SSG가 최정, 에레디아, 김재환 쪽에서 초반 득점을 만들면 접전이 되겠지만, LG가 중반 이후 더 많은 득점 기회를 만들 가능성이 큽니다.",
  },
  {
    game_id: "cf3ad074-cf17-40f7-8c5d-4974ab453149",
    predicted_winner_team_id: "doosan",
    confidence: 0.64,
    key_factor: "곽빈 탈삼진",
    one_liner:
      "롯데는 사직 홈에서 반격할 수 있지만, 곽빈의 탈삼진 능력과 두산 타선의 최근 연결이 더 좋아 보입니다. 나균안이 버티더라도 롯데 하위타선과 후반 운영이 부담입니다.",
    detailed_analysis:
      "곽빈은 탈삼진으로 위기를 끊을 수 있는 힘이 있고, 장타 억제도 안정적입니다. 롯데 나균안도 시즌 전체로 보면 충분히 버틸 수 있는 선발이지만, 두산 상위타선이 출루를 만들면 투구 수가 빠르게 늘 수 있습니다. 두산은 정수빈, 카메론, 오명진, 양의지로 이어지는 최근 타선 연결이 좋아졌고, 삼진도 적은 편이라 경기 중반 압박을 꾸준히 만들 수 있습니다. 롯데는 레이예스와 나승엽이 중심에서 장타를 만들 수 있지만, 최근 벤치 변화와 후반 운영 불안이 계속 부담입니다. 사직 홈 이점 때문에 일방적인 경기는 아니지만, 오늘은 두산이 선발과 타선 연결 모두 근소하게 앞섭니다.",
  },
  {
    game_id: "d455847a-e366-4627-bc16-a8d9ef01d2ac",
    predicted_winner_team_id: "kt",
    confidence: 0.61,
    key_factor: "KT 타선 출루",
    one_liner:
      "삼성은 최원태가 초반을 버티면 충분히 승산이 있지만, 수원에서는 KT 타선의 출루와 고영표의 경기 운영이 더 믿음직합니다. 최원태가 볼넷으로 흔들리면 KT가 중반에 흐름을 잡을 가능성이 큽니다.",
    detailed_analysis:
      "고영표는 실점 흐름이 완전히 낮다고 보기는 어렵지만, 볼넷을 크게 줄이며 타자와 승부할 수 있는 투수입니다. 최원태는 탈삼진 능력이 있지만 주자가 쌓이는 날에는 수원에서 KT 타선의 압박을 오래 버티기 어렵습니다. KT는 최원준, 김현수, 김민혁, 힐리어드, 허경민으로 이어지는 타선이 출루와 연결에서 매우 좋습니다. 삼성은 구자욱과 디아즈가 장타로 한 번에 흐름을 바꿀 수 있어 절대 쉽게 볼 수 없습니다. 다만 삼성 최근 라인업은 예전보다 장타 폭이 조금 줄어든 모습이고, KT가 홈에서 꾸준히 주자를 만들 가능성이 더 높습니다. 접전이지만 KT 쪽을 선택합니다.",
  },
  {
    game_id: "d6c9efc1-38c4-4aae-8e36-298d42c10b62",
    predicted_winner_team_id: "hanwha",
    confidence: 0.6,
    key_factor: "왕옌청 안정감",
    one_liner:
      "KIA는 김도영과 나성범의 장타로 언제든 경기를 바꿀 수 있지만, 대전 홈에서는 왕옌청의 안정감과 한화 중심타선 흐름이 더 좋아 보입니다. 황동하가 피홈런 부담을 줄이지 못하면 한화가 중반 이후 앞설 수 있습니다.",
    detailed_analysis:
      "왕옌청은 큰 이닝을 쉽게 허용하지 않고, 최근에도 실점을 비교적 잘 억제했습니다. KIA 황동하는 좋은 날에는 과감하게 승부할 수 있지만, 장타 허용 부담이 있어 한화 중심타선을 상대로 조심해야 합니다. KIA 타선은 김도영, 나성범, 아데를린이 만들어내는 장타력이 분명히 강점입니다. 다만 한화는 최근 강백호의 월간 MVP 흐름과 함께 페라자, 문현빈, 노시환 쪽 공격 기대감이 좋습니다. 대전 홈에서는 한화가 초반부터 출루를 만들고, 중반 이후 득점권에서 더 안정적으로 해결할 가능성이 있습니다. KIA가 한 방으로 흔들 수 있어 낮게 보지만, 오늘은 한화 쪽입니다.",
  },
  {
    game_id: "c83b23f9-3a85-45ee-b35e-ff854a113c95",
    predicted_winner_team_id: "nc",
    confidence: 0.56,
    key_factor: "NC 타선 상승",
    one_liner:
      "키움은 로젠버그가 삼진으로 흐름을 끊을 수 있지만, 최근 NC 타선은 출루와 장타가 동시에 살아났습니다. 고척 원정이라 접전이 예상되지만, 박건우-데이비슨 중심의 해결력을 더 보겠습니다.",
    detailed_analysis:
      "로젠버그는 탈삼진 능력이 좋아 NC 타선의 초반 흐름을 끊을 수 있는 선발입니다. 김태경은 최근 실점이 늘었고 장타 허용 부담도 있어 키움 중심타선을 조심해야 합니다. 그럼에도 NC는 최근 타선 흐름이 크게 좋아졌습니다. 김주원, 권희동, 이우성, 박건우, 데이비슨으로 이어지는 라인업은 출루와 장타를 동시에 만들 수 있고, 팀 분위기도 중위권 추격 쪽으로 살아났습니다. 키움은 히우라와 최주환이 장타를 만들면 경기를 뒤집을 수 있지만, 전체 타선 연결은 NC보다 불안정합니다. 선발만 보면 키움도 충분히 승산이 있지만, 오늘은 NC 타선의 최근 흐름을 더 높게 봅니다.",
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
