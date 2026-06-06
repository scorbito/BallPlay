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

const GAME_DATE = "2026-06-06";
const PUBLISHED_AT = "2026-06-06T09:00:00+09:00";
const AI_PROVIDER = "gpt";
const MODEL_NAME = "gpt-5-codex";

const rows = [
  {
    game_id: "a5e0f78f-dc79-4c49-9557-088dfafe6f10",
    predicted_winner_team_id: "ssg",
    confidence: 0.58,
    key_factor: "문학 홈 반등",
    one_liner:
      "SSG는 긴 연패를 끊은 뒤 3연승 흐름까지 만들었고, 문학 홈에서 타선 분위기가 확실히 살아났습니다. KT 타선도 강하지만 배제성이 초반 주자 관리를 못 하면 SSG 중심타선에 먼저 끌려갈 가능성이 큽니다.",
    detailed_analysis:
      "SSG는 연패를 끊은 뒤 경기 후반 집중력과 타선의 자신감이 함께 살아난 모습입니다. 최정, 김재환, 에레디아, 전의산으로 이어지는 중심 구간은 장타와 출루를 동시에 기대할 수 있습니다. KT는 최원준, 김현수, 힐리어드, 허경민이 버티는 타선이라 쉽게 밀리지 않습니다. 다만 배제성이 초반부터 볼넷과 장타를 함께 허용하면 문학 원정에서 분위기를 다시 가져오기 어렵습니다. 타케다도 완전히 믿을 카드는 아니어서 난타전 가능성은 있습니다. 그래도 최근 팀 흐름과 홈에서의 공격 응집력을 합치면 SSG가 근소하게 앞선다고 봅니다.",
  },
  {
    game_id: "d33582a9-a456-48d1-92aa-8638b8da9bd3",
    predicted_winner_team_id: "kiwoom",
    confidence: 0.6,
    key_factor: "안우진 선발 우위",
    one_liner:
      "두산은 최근 접전 운영이 좋아졌지만, 오늘은 안우진이 초반 흐름을 잡아줄 가능성이 큽니다. 키움 타선도 히우라 합류 이후 중심에서 장타 신호가 살아나 두산을 충분히 압박할 수 있습니다.",
    detailed_analysis:
      "키움은 순위만 보면 부담이 있지만, 오늘 선발 카드가 경기의 균형을 바꿀 수 있습니다. 안우진은 빠른 공과 탈삼진 능력으로 두산 타선의 초반 흐름을 끊을 수 있는 투수입니다. 두산은 홈에서 정수빈, 손아섭, 양의지 중심으로 끈질기게 출루를 만들 수 있지만, 장타 한 방의 폭발력은 키움보다 강하게 보이지 않습니다. 키움은 히우라가 중심에 들어오면서 타선의 무게감이 분명히 달라졌고, 안치홍과 이형종까지 연결되면 득점 루트가 생깁니다. 최민석이 볼넷으로 주자를 쌓으면 안우진이 버티는 경기에서 추격 부담이 커질 수 있습니다. 오늘은 키움이 선발 우위로 먼저 흐름을 잡는 쪽을 보겠습니다.",
  },
  {
    game_id: "4cd3e8a3-a58c-4ff9-9db4-da6992faf0b5",
    predicted_winner_team_id: "hanwha",
    confidence: 0.64,
    key_factor: "한화 타선 흐름",
    one_liner:
      "한화는 전날 류현진 호투와 타선 폭발로 사직에서 크게 이기며 분위기를 끌어올렸습니다. 롯데도 홈에서 반격할 힘은 있지만, 이민석이 초반에 흔들리면 한화 중심타선이 빠르게 경기를 잡을 수 있습니다.",
    detailed_analysis:
      "한화는 전날 사직에서 투타가 함께 살아나며 분위기를 크게 바꿨습니다. 에르난데스가 완벽한 선발은 아니지만 롯데 타선을 상대로 초반 큰 이닝만 피하면 타선 지원을 기대할 수 있습니다. 롯데 이민석은 좋은 공을 갖고 있어도 볼넷과 초반 실점 위험이 남아 있습니다. 한화는 페라자, 문현빈, 노시환, 김태연 쪽에서 출루와 장타를 동시에 만들 수 있어 주자가 쌓였을 때 위협이 큽니다. 롯데도 황성빈, 고승민, 레이예스, 나승엽이 초반부터 흔들면 홈에서 흐름을 잡을 수 있습니다. 그래도 현재 타선의 연결성과 전날 경기 분위기까지 보면 한화가 조금 더 앞섭니다.",
  },
  {
    game_id: "b00f2dfe-b643-46fe-ac62-ce30c4f8b075",
    predicted_winner_team_id: "samsung",
    confidence: 0.56,
    key_factor: "삼성 중심타선",
    one_liner:
      "KIA는 광주 홈과 양현종의 경험이 있지만, 삼성 타선은 출루와 장타 균형이 가장 좋은 축입니다. 접전 가능성이 크지만 구자욱-디아즈-최형우 중심타선의 응집력을 더 높게 보겠습니다.",
    detailed_analysis:
      "KIA는 광주 홈에서 김도영, 나성범, 아데를린이 한 번에 분위기를 바꿀 수 있는 팀입니다. 양현종의 경험도 큰 무기라 삼성 타선이 초반부터 쉽게 몰아치기는 어려울 수 있습니다. 다만 양현종은 최근 장타 허용 부담이 있고, 삼성 타선은 그 빈틈을 놓치지 않을 만큼 중심 구간이 강합니다. 삼성은 김지찬과 박승규가 앞에서 기회를 만들고, 구자욱, 디아즈, 최형우가 해결하는 흐름이 좋습니다. 장찬희가 광주 원정에서 얼마나 버티느냐가 변수지만, 삼성은 불펜 승부로 넘어가도 타선의 폭이 넓습니다. 아주 큰 차이는 아니지만 타선의 균형과 응집력에서 삼성을 선택합니다.",
  },
  {
    game_id: "50f2f2fa-6d05-4183-b1a6-85d6105bd3c7",
    predicted_winner_team_id: "lg",
    confidence: 0.68,
    key_factor: "LG 공수 균형",
    one_liner:
      "NC 라일리는 삼진을 잡을 힘이 있지만, LG는 톨허스트의 안정감과 상위타선 연결이 모두 좋습니다. 창원 원정 변수는 있어도 LG가 중후반 타선 응집력으로 앞설 가능성이 큽니다.",
    detailed_analysis:
      "LG는 오늘 경기에서 선발과 타선의 균형이 가장 깔끔한 팀 중 하나입니다. 톨허스트는 최근 흐름이 안정적이고, 볼넷으로 크게 흔들리는 장면이 적어 NC 타선을 상대하기 좋은 카드입니다. NC 라일리도 삼진을 잡는 힘이 있어 초반에는 팽팽한 투수전이 될 수 있습니다. 하지만 NC 타선은 공격이 삼진으로 끊기는 장면이 많고, 출루 이후 해결력이 LG보다 안정적이지 않습니다. LG는 홍창기, 박해민이 기회를 만들고 오스틴, 문보경, 오지환이 해결하는 구조가 잘 잡혀 있습니다. 창원 원정 부담은 있지만 전체 전력과 경기 후반 집중력까지 보면 LG가 가장 설득력 있는 선택입니다.",
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
