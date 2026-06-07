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

const WEEK_START_DATE = "2026-06-08";
const PUBLISHED_AT = "2026-06-08T09:00:00+09:00";
const AI_PROVIDER = "gpt";
const MODEL_NAME = "gpt-5-codex";

const series = [
  {
    series_group: "early",
    series_start_date: "2026-06-09",
    series_end_date: "2026-06-11",
    home_team_id: "lotte",
    away_team_id: "doosan",
    game_ids: [
      "cf3ad074-cf17-40f7-8c5d-4974ab453149",
      "2d6545fd-ffb7-44aa-b409-e5b658ffabe4",
      "dc15d5fc-edfd-4129-8011-e85e752344aa",
    ],
    label: "3연전",
    headline: "사직에서 만나는 롯데와 두산의 주중 3연전입니다.",
    prediction: {
      predicted_winner_team_id: "doosan",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.6,
      key_factor: "두산 접전 운영",
      one_liner:
        "롯데는 사직 홈에서 반격할 힘이 있지만, 최근 후반 운영이 흔들린 장면이 많았습니다. 두산은 접전 운영과 불펜 마무리가 살아나며 시리즈를 2승 1패로 가져갈 가능성이 큽니다.",
      detailed_analysis:
        "롯데는 황성빈, 고승민, 레이예스, 나승엽으로 이어지는 상위 타선이 초반 분위기를 만들 수 있는 팀입니다. 다만 최근 사직에서 리드를 지키지 못한 흐름이 있었고, 불펜으로 넘어간 뒤 한 번에 무너지는 장면이 부담입니다. 두산은 시즌 초반보다 타선 연결이 좋아졌고, 정수빈과 손아섭이 앞에서 기회를 만들면 양의지와 중심타선이 해결할 수 있습니다. 선발 로테이션 전체의 무게감이 압도적이지는 않아 매 경기 접전 가능성이 큽니다. 그래도 두산은 최근 비슷한 경기에서 버티는 힘이 생겼고, 사직 원정에서도 중후반 한두 번의 찬스를 살릴 가능성이 높습니다.",
    },
  },
  {
    series_group: "early",
    series_start_date: "2026-06-09",
    series_end_date: "2026-06-11",
    home_team_id: "kt",
    away_team_id: "samsung",
    game_ids: [
      "d455847a-e366-4627-bc16-a8d9ef01d2ac",
      "3747cd83-415d-45fd-a780-aeb31f8b0535",
      "df9b612f-0212-4561-a0c7-f09259a7dddc",
    ],
    label: "3연전",
    headline: "수원에서 열리는 KT와 삼성의 상위권 맞대결입니다.",
    prediction: {
      predicted_winner_team_id: "kt",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.56,
      key_factor: "KT 홈 타선",
      one_liner:
        "삼성 타선의 폭은 여전히 무섭지만, 수원 홈에서는 KT의 출루와 연결 능력이 시리즈 내내 힘을 낼 수 있습니다. 선발 부담이 있는 KT라도 타선이 버텨주면 2승 1패가 가능합니다.",
      detailed_analysis:
        "삼성은 김지찬, 구자욱, 디아즈, 최형우, 강민호로 이어지는 타선의 폭이 넓고 장타와 출루가 모두 가능한 팀입니다. KT는 선발층 운용에 부담이 있는 편이지만, 최원준, 김현수, 김민혁, 힐리어드, 허경민으로 이어지는 타선의 출루 능력이 매우 안정적입니다. 수원 홈에서는 KT가 초반부터 주자를 쌓아 상대 선발의 투구 수를 늘리는 그림을 만들 수 있습니다. 삼성은 한 경기 정도 타선 폭발로 확실히 가져갈 힘이 있습니다. 다만 3연전 전체로 보면 KT가 홈에서 중후반 접전 한 경기를 더 가져갈 가능성을 보겠습니다.",
    },
  },
  {
    series_group: "early",
    series_start_date: "2026-06-09",
    series_end_date: "2026-06-11",
    home_team_id: "hanwha",
    away_team_id: "kia",
    game_ids: [
      "d6c9efc1-38c4-4aae-8e36-298d42c10b62",
      "f43c0c1a-dac6-4fc3-9fbe-c4703ec1987d",
      "33e581be-4b60-424c-b038-ddd751794b12",
    ],
    label: "3연전",
    headline: "대전에서 KIA와 한화가 주중 빅매치를 치릅니다.",
    prediction: {
      predicted_winner_team_id: "hanwha",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.57,
      key_factor: "대전 타선 흐름",
      one_liner:
        "KIA는 김도영과 나성범의 장타로 언제든 경기를 바꿀 수 있지만, 한화는 대전 홈에서 중심타선 연결이 더 안정적입니다. 큰 점수 차보다는 한화가 접전 두 경기를 가져가는 흐름을 봅니다.",
      detailed_analysis:
        "KIA는 최근 김도영의 장타 흐름이 살아났고, 나성범과 아데를린까지 이어지는 중심 구간이 강합니다. 한화는 페라자, 문현빈, 노시환, 김태연 쪽에서 출루와 장타를 모두 만들 수 있어 대전 홈에서 공격 기대치가 높습니다. 두 팀 모두 선발 카드가 완전히 압도적이라고 보기는 어려워 경기 중반 이후 불펜과 득점권 집중력이 중요합니다. KIA는 한 경기에서 크게 터질 수 있는 힘이 있지만, 한화는 최근 롯데전에서 보여준 끈질긴 득점 흐름이 좋았습니다. 대전 홈 분위기까지 합치면 한화가 2승 1패로 시리즈를 가져갈 가능성이 조금 더 높습니다.",
    },
  },
  {
    series_group: "early",
    series_start_date: "2026-06-09",
    series_end_date: "2026-06-11",
    home_team_id: "kiwoom",
    away_team_id: "nc",
    game_ids: [
      "c83b23f9-3a85-45ee-b35e-ff854a113c95",
      "4cd88a7e-31d9-4a49-a777-01329a19eef2",
      "00c401fe-f900-463a-9e9b-7e8e06ea7997",
    ],
    label: "3연전",
    headline: "고척에서 키움과 NC가 흐름 싸움을 벌입니다.",
    prediction: {
      predicted_winner_team_id: "nc",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.58,
      key_factor: "NC 상승 흐름",
      one_liner:
        "키움은 고척 홈과 히우라 중심타선이 변수지만, NC는 LG를 잡아내며 경기 후반 집중력을 끌어올렸습니다. 박건우와 데이비슨 쪽 해결력이 이어진다면 NC가 2승 1패를 만들 수 있습니다.",
      detailed_analysis:
        "키움은 고척 홈에서 안치홍, 히우라, 이형종 중심으로 장타를 만들 수 있는 팀입니다. 하지만 시즌 전체 흐름은 아직 기복이 크고, 하위타선으로 내려갈수록 공격 연결이 끊기는 위험이 있습니다. NC는 최근 LG를 상대로 후반 승부를 잡아내며 자신감을 얻었습니다. 김주원과 박민우가 앞에서 출루하고, 박건우와 데이비슨이 해결하는 구도가 나오면 고척에서도 충분히 득점력을 만들 수 있습니다. 선발 매치업이 확정되지 않은 상황에서도 NC는 최근 타선 집중력과 불펜 운영에서 반등 신호가 있습니다. 키움이 한 경기는 장타로 잡을 수 있지만, 시리즈 전체는 NC 쪽으로 보겠습니다.",
    },
  },
  {
    series_group: "early",
    series_start_date: "2026-06-09",
    series_end_date: "2026-06-11",
    home_team_id: "lg",
    away_team_id: "ssg",
    game_ids: [
      "583ecf6c-f87f-4c68-87e6-29add37a77fa",
      "bec1a2b0-735b-4d43-b642-933a79830ac0",
      "b767faa4-6a37-4a6e-b698-4b73355e5c68",
    ],
    label: "3연전",
    headline: "잠실에서 LG와 SSG의 주중 3연전이 열립니다.",
    prediction: {
      predicted_winner_team_id: "lg",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.6,
      key_factor: "LG 홈 응집력",
      one_liner:
        "SSG는 연패 탈출 후 타선 분위기가 살아났지만, LG는 잠실 홈에서 상위타선 출루와 중심타선 해결력이 안정적입니다. LG가 선발 한 경기만 확실히 잡아도 시리즈 우위를 가져갈 수 있습니다.",
      detailed_analysis:
        "SSG는 긴 연패 이후 분위기를 바꾸며 최정, 김재환, 에레디아 쪽 장타 흐름이 살아난 모습입니다. 그러나 잠실 원정에서는 큰 장타 한 방보다 꾸준한 출루와 수비 집중력이 더 중요합니다. LG는 NC 원정에서 흔들린 뒤 홈으로 돌아오는 시리즈라 반등 동기가 큽니다. 홍창기와 박해민이 출루하고 오스틴, 문보경, 오지환이 해결하는 구조는 여전히 안정적입니다. SSG가 한 경기 정도 초반 장타로 잡을 수 있지만, 3연전 전체로는 LG가 홈에서 접전 두 경기를 가져갈 가능성이 높습니다.",
    },
  },
  {
    series_group: "weekend",
    series_start_date: "2026-06-12",
    series_end_date: "2026-06-14",
    home_team_id: "kt",
    away_team_id: "nc",
    game_ids: [
      "3ef375b1-e6b2-4c16-afd2-afe58171a705",
      "1c40f8da-c72d-4d15-ba44-21abe5eaf55b",
      "06427010-5838-4edc-8409-ffbfcbcfbdaf",
    ],
    label: "3연전",
    headline: "수원에서 KT와 NC가 주말 3연전을 치릅니다.",
    prediction: {
      predicted_winner_team_id: "kt",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.57,
      key_factor: "KT 홈 출루",
      one_liner:
        "NC의 상승 흐름은 분명하지만, 수원 홈 KT는 타선 출루와 연결 능력이 꾸준합니다. 주말로 갈수록 접전이 늘 수 있어도 KT가 2승 1패로 앞설 가능성을 봅니다.",
      detailed_analysis:
        "NC는 최근 선두권 팀을 상대로도 후반 집중력을 보여주며 분위기를 끌어올렸습니다. 박건우와 데이비슨이 살아나면 수원에서도 충분히 한 경기를 가져갈 수 있습니다. KT는 선발층 운용에 부담이 있어 완승을 예상하기는 어렵습니다. 하지만 타선의 출루와 연결 능력은 리그 상위권이고, 홈에서 최원준, 김현수, 힐리어드, 허경민이 꾸준히 득점 기회를 만들 수 있습니다. NC가 첫 경기나 중간 경기를 잡아도 시리즈 전체 운영에서는 KT 쪽의 안정성이 조금 더 낫습니다. 2승 1패 KT 우세를 예상합니다.",
    },
  },
  {
    series_group: "weekend",
    series_start_date: "2026-06-12",
    series_end_date: "2026-06-14",
    home_team_id: "lg",
    away_team_id: "lotte",
    game_ids: [
      "d04b22e1-290e-4c94-b4c4-2a244d2334be",
      "4059bbf9-a27e-4add-92ba-b13e7bfc292b",
      "09e0f80d-41dd-4463-990a-93d3a3ad3229",
    ],
    label: "3연전",
    headline: "잠실에서 LG와 롯데가 주말 시리즈를 만납니다.",
    prediction: {
      predicted_winner_team_id: "lg",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.66,
      key_factor: "LG 홈 전력",
      one_liner:
        "롯데는 중심타선 한 방이 있지만, 최근 후반 운영 부담이 큰 팀입니다. LG는 잠실 홈에서 출루와 수비 안정이 좋아 주말 시리즈 우위를 잡을 가능성이 큽니다.",
      detailed_analysis:
        "롯데는 레이예스와 나승엽을 앞세워 한 경기 분위기를 바꿀 수 있는 타선입니다. 하지만 최근 리드를 지키지 못하는 장면이 많았고, 불펜으로 넘어간 뒤 흔들리는 흐름이 이어졌습니다. LG는 홈에서 경기 운영이 안정적이고, 타선이 폭발하지 않아도 출루와 주루로 점수를 만드는 능력이 좋습니다. 홍창기, 박해민, 오스틴, 문보경, 오지환으로 이어지는 구간은 롯데 마운드에 계속 부담을 줄 수 있습니다. 롯데가 한 경기를 선발 호투나 장타로 잡을 수는 있지만, 3연전 전체로는 LG가 2승 1패 이상을 가져갈 가능성이 높습니다.",
    },
  },
  {
    series_group: "weekend",
    series_start_date: "2026-06-12",
    series_end_date: "2026-06-14",
    home_team_id: "samsung",
    away_team_id: "ssg",
    game_ids: [
      "d648060d-5d19-4590-99d1-9736852838e8",
      "c7d96f93-39e6-4562-ba8d-12979e4d0e9f",
      "9904dc32-7256-4402-bc69-afd1941cb8dd",
    ],
    label: "3연전",
    headline: "대구에서 삼성과 SSG가 주말 3연전을 치릅니다.",
    prediction: {
      predicted_winner_team_id: "samsung",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.63,
      key_factor: "삼성 홈 장타",
      one_liner:
        "SSG도 타선 반등이 보이지만, 대구에서는 삼성 중심타선의 장타와 홈 경기 운영이 더 강하게 작용합니다. 삼성은 한 경기 난타전을 내주더라도 시리즈 전체 우위를 잡을 가능성이 큽니다.",
      detailed_analysis:
        "SSG는 최정, 김재환, 에레디아 중심으로 장타를 만들 수 있어 삼성 마운드를 흔들 수 있습니다. 다만 대구 원정에서 삼성 타선을 시리즈 내내 눌러야 하는 부담이 큽니다. 삼성은 김지찬, 구자욱, 디아즈, 최형우, 강민호까지 공격 선택지가 다양하고, 홈에서는 장타가 흐름을 바꿀 가능성이 큽니다. SSG가 한 경기는 장타전으로 가져갈 수 있지만, 경기 후반 수비와 불펜 집중력까지 보면 삼성 쪽이 더 안정적입니다. 주말 3연전은 삼성 2승 1패를 예상합니다.",
    },
  },
  {
    series_group: "weekend",
    series_start_date: "2026-06-12",
    series_end_date: "2026-06-14",
    home_team_id: "kiwoom",
    away_team_id: "hanwha",
    game_ids: [
      "e83810dc-429e-4fcd-b19f-3605d2c18fda",
      "02f82ff8-3d1e-46d4-9b18-221ec0961a3a",
      "b8065d15-4b6e-4b74-a29c-155969d0e90d",
    ],
    label: "3연전",
    headline: "고척에서 키움과 한화의 주말 시리즈가 열립니다.",
    prediction: {
      predicted_winner_team_id: "hanwha",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.62,
      key_factor: "한화 중심타선",
      one_liner:
        "키움은 고척 홈과 히우라 장타가 변수지만, 한화는 중심타선 연결과 경기 후반 득점력이 더 안정적입니다. 한화가 한 경기를 내줘도 시리즈는 2승 1패로 가져갈 가능성이 높습니다.",
      detailed_analysis:
        "키움은 고척에서 장타 한 방으로 흐름을 바꿀 수 있는 팀이고, 히우라가 중심에 들어오며 타선의 무게감도 달라졌습니다. 다만 시리즈 전체로 보면 한화가 더 꾸준히 득점 기회를 만들 수 있습니다. 페라자, 문현빈, 노시환, 김태연으로 이어지는 중심 구간은 출루와 장타가 모두 가능하고, 경기 후반에도 쉽게 식지 않습니다. 키움이 선발 한 경기에서 확실히 앞서면 시리즈 균형이 흔들릴 수 있습니다. 그래도 3연전 전체에서는 한화가 득점 루트와 경기 운영에서 조금 더 안정적입니다.",
    },
  },
  {
    series_group: "weekend",
    series_start_date: "2026-06-12",
    series_end_date: "2026-06-14",
    home_team_id: "kia",
    away_team_id: "doosan",
    game_ids: [
      "d2decbec-d083-444d-855e-5deaccd3a94d",
      "d615e13c-62b1-4aea-9643-78b52c5f8a2e",
      "ffdffa7a-22b0-418c-adc4-e816f6235407",
    ],
    label: "3연전",
    headline: "광주에서 KIA와 두산의 주말 3연전이 펼쳐집니다.",
    prediction: {
      predicted_winner_team_id: "kia",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.61,
      key_factor: "광주 중심타선",
      one_liner:
        "두산은 최근 접전 운영이 좋아졌지만, 광주에서는 KIA 중심타선의 장타력이 더 크게 보입니다. 김도영과 나성범이 시리즈 내내 한 번씩 터지면 KIA가 2승 1패를 만들 수 있습니다.",
      detailed_analysis:
        "두산은 최근 승률 5할을 넘어설 만큼 경기 운영이 단단해졌고, 하위타선도 예전보다 쉽게 끊기지 않습니다. 그러나 광주 원정에서 KIA 중심타선을 시리즈 내내 막아내는 것은 쉽지 않습니다. KIA는 김도영, 나성범, 아데를린, 한준수가 만드는 장타 기대감이 크고, 홈에서는 한 번의 빅이닝으로 경기 흐름을 바꿀 수 있습니다. 두산도 양의지와 카메론이 중심에서 버티면 충분히 한 경기를 가져갈 수 있습니다. 그래도 3연전 전체로는 KIA가 홈에서 공격력을 더 꾸준히 보여줄 가능성이 높습니다.",
    },
  },
];

let seriesCount = 0;
let predictionCount = 0;

for (const item of series) {
  const { prediction, ...seriesPayload } = item;
  const { data: seriesRow, error: seriesError } = await supabase
    .from("bp_ai_weekly_series")
    .upsert(
      {
        ...seriesPayload,
        week_start_date: WEEK_START_DATE,
        published_at: PUBLISHED_AT,
      },
      { onConflict: "week_start_date,series_group,home_team_id,away_team_id" }
    )
    .select("id")
    .single();
  if (seriesError) throw seriesError;
  seriesCount += 1;

  const { error: predictionError } = await supabase
    .from("bp_ai_weekly_series_predictions")
    .upsert(
      {
        series_id: seriesRow.id,
        week_start_date: WEEK_START_DATE,
        ai_provider: AI_PROVIDER,
        model_name: MODEL_NAME,
        published_at: PUBLISHED_AT,
        ...prediction,
      },
      { onConflict: "series_id,ai_provider" }
    );
  if (predictionError) throw predictionError;
  predictionCount += 1;

  console.log(
    `${item.series_group} ${item.away_team_id}@${item.home_team_id} => ${prediction.predicted_winner_team_id} ${prediction.predicted_wins}-${prediction.predicted_losses}`
  );
}

console.log(`Upserted ${seriesCount} weekly series and ${predictionCount} gpt predictions.`);
