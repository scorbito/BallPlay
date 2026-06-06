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

const GAME_DATE = "2026-06-04";
const PUBLISHED_AT = "2026-06-04T09:00:00+09:00";
const AI_PROVIDER = "gpt";
const MODEL_NAME = "gpt-5-codex";

const rows = [
  {
    game_id: "60f781af-6cde-4a99-bcc5-f26909d5fd19",
    predicted_winner_team_id: "kia",
    confidence: 0.56,
    key_factor: "광주 홈 타선",
    one_liner:
      "시라카와는 오늘 초반 경기 적응이 관건이지만, 광주 홈 KIA는 김도영-나성범-아데를린 중심타선의 장타력이 롯데보다 위협적입니다. 박세웅이 최근 좋은 흐름을 이어가면 롯데도 충분히 흔들 수 있어 접전으로 봅니다.",
    detailed_analysis:
      "KIA 시라카와는 오늘 초반 제구와 경기 적응이 가장 큰 관건입니다. 롯데 박세웅은 시즌 전체로는 기복이 있었지만 최근 등판에서 실점을 잘 억제하며 좋은 흐름을 만들었습니다. 다만 볼넷이 늘어나는 날에는 광주 원정에서 KIA 중심타선 앞에 주자를 쌓아줄 위험이 있습니다. KIA는 김도영, 나성범, 아데를린, 김선빈으로 이어지는 중심 구간의 장타와 출루가 롯데보다 더 묵직합니다. 롯데도 레이예스와 나승엽이 시라카와를 초반부터 흔들면 충분히 주도권을 잡을 수 있습니다. 그래도 홈 구장, 타선 힘, 전날 끝내기 승리 흐름을 합치면 KIA가 근소하게 앞선다고 봅니다.",
  },
  {
    game_id: "8cb78a90-c348-442e-9100-55ee2bc55804",
    predicted_winner_team_id: "hanwha",
    confidence: 0.68,
    key_factor: "화이트와 타선",
    one_liner:
      "두산이 전날 연장 흐름을 잡았지만, 오늘은 화이트의 WHIP와 한화 타선의 출루-장타 조합이 더 안정적입니다. 잭로그가 길게 버티지 못하면 한화 중심타선이 중반 이후 차이를 만들 가능성이 큽니다.",
    detailed_analysis:
      "한화 화이트는 주자 허용을 잘 억제하고 볼넷으로 스스로 흔들리는 장면이 적은 선발입니다. 두산 잭로그도 제구력은 좋지만 최근 실점 흐름이 좋지 않아 초반부터 긴 이닝을 안정적으로 끌고 갈지가 관건입니다. 타선 차이는 한화 쪽이 더 뚜렷합니다. 한화는 강백호, 노시환, 문현빈, 페라자로 이어지는 중심 구간의 출루와 장타가 모두 좋고, 두산은 득점권에서 한 방을 만들어줄 장타력이 상대적으로 약합니다. 전날 한화가 연장 11회 흐름을 놓친 점은 부담이지만, 경기 내내 득점 기회를 만든 타선의 힘은 여전히 살아 있습니다. 잠실이라는 변수에도 선발 안정감과 타선의 질을 합치면 한화가 다시 앞설 가능성이 높습니다.",
  },
  {
    game_id: "14744dea-bdac-4dbf-a160-ccfe6b5834a2",
    predicted_winner_team_id: "ssg",
    confidence: 0.6,
    key_factor: "연패 탈출 반등",
    one_liner:
      "SSG는 13연패를 끊으면서 가장 큰 심리 부담을 덜었고, 최민준이 배동현보다 기본 안정감이 낫습니다. 키움 타선도 히우라 효과로 살아났지만, 오늘은 문학 홈 SSG의 반등 쪽을 보겠습니다.",
    detailed_analysis:
      "SSG 최민준은 키움 배동현보다 경기 초반을 안정적으로 끌고 갈 가능성이 큰 선발입니다. 배동현도 최근 등판 내용은 괜찮았지만, 주자가 쌓이는 상황에서 문학 원정의 부담을 계속 이겨낼 수 있을지가 관건입니다. 타선은 의외로 팽팽합니다. 키움은 히우라 합류 이후 장타 분위기가 살아났고, SSG도 최정, 에레디아, 김재환, 전의산으로 이어지는 구간의 힘은 충분합니다. 전날 SSG가 끝내기로 긴 연패를 끊은 건 단순한 1승 이상으로 팀 분위기를 바꿀 수 있는 장면이었습니다. 키움의 연승 가능성도 있지만, 선발 안정감과 홈에서의 반등 흐름을 더 크게 봐 SSG를 선택합니다.",
  },
  {
    game_id: "c4ada2ba-52e7-43be-9fc8-e6f90dd91380",
    predicted_winner_team_id: "lg",
    confidence: 0.58,
    key_factor: "웰스 실점 억제",
    one_liner:
      "KT 타선 지표와 홈 흐름은 좋지만, 웰스의 ERA 1점대와 WHIP 0.90은 오늘 가장 강한 선발 신호입니다. LG 타선이 많은 점수를 못 내도 웰스가 초반을 잠그면 접전 승부를 가져갈 수 있습니다.",
    detailed_analysis:
      "LG 웰스는 최근 등판마다 실점을 강하게 억제하며 오늘 경기에서 가장 믿을 만한 선발 중 한 명입니다. KT 사우어도 직전 흐름은 좋지만, 볼넷으로 주자를 내보내는 장면이 나오면 LG 상위타선에 압박을 받을 수 있습니다. 타선만 놓고 보면 KT가 더 좋습니다. KT는 최원준, 김현수, 힐리어드, 김민혁으로 이어지는 구간에서 꾸준히 주자를 만들 수 있고, 전날에도 LG 추격을 따돌렸습니다. 그래서 이 경기는 LG가 쉽게 가져갈 경기로 보기는 어렵습니다. 다만 웰스가 KT 타선을 3점 안팎으로 묶어준다면, LG가 오스틴과 오지환 쪽 한 방으로 접전 승부를 가져갈 가능성이 있습니다.",
  },
  {
    game_id: "d9286fba-7a05-47fd-b3eb-2bb98262af22",
    predicted_winner_team_id: "samsung",
    confidence: 0.64,
    key_factor: "타선 안정성",
    one_liner:
      "NC가 드디어 삼성전 연패를 끊었지만, 오늘도 타선 지표는 삼성이 훨씬 안정적입니다. 구창모가 버티더라도 원태인과 삼성 중심타선의 홈 경기 균형을 더 높게 봅니다.",
    detailed_analysis:
      "NC 구창모는 최근 등판 내용이 좋아 삼성 타선을 충분히 묶을 수 있는 선발입니다. 삼성 원태인도 큰 차이로 앞선다고 보기는 어렵지만, 홈런 억제와 경기 운영에서는 더 안정적인 모습을 기대할 수 있습니다. 핵심 차이는 타선입니다. 삼성은 구자욱, 최형우, 디아즈, 강민호로 이어지는 구간에서 출루와 장타가 모두 가능하고, 하위타선에서도 득점 연결이 이어질 수 있습니다. NC는 전날 삼성전 연패를 끊어 부담을 덜었지만, 공격이 삼진으로 끊기는 장면이 많아 원태인 상대로 흐름이 길게 이어지지 않을 위험이 큽니다. 삼성도 전날 패배 직후라 과신은 어렵습니다. 그래도 대구 홈과 타선 안정성까지 보면 다시 삼성 쪽 승률이 높다고 판단합니다.",
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
