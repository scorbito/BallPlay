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
const MODEL_NAME = "gpt-5.5-codex";

const rows = [
  {
    game_id: "d0f783c8-f7fb-4daf-a360-b610f9abb3ff",
    predicted_winner_team_id: "lotte",
    confidence: 0.59,
    key_factor: "불펜 소모와 반등 흐름",
    one_liner:
      "NC가 직전 대량 실점으로 흔들린 직후라, 박세웅 카드와 롯데 하위 타선의 연결감에 조금 더 무게를 뒀습니다.",
    detailed_analysis:
      "롯데는 최근 라인업에서 황성빈, 고승민, 레이예스, 나승엽 축이 계속 유지되고 있고 직전 LG전 승리 기사에서도 황성빈의 결승 주루와 전민재 3타점이 언급될 만큼 하위 연결이 살아난 흐름입니다. NC는 김주원, 박건우, 데이비슨 중심축 자체는 위협적이지만 5월 28일 한화전 7-18 패배 과정에서 불펜과 수비가 동시에 흔들렸다는 뉴스가 누적됐습니다. 선발은 구창모가 홈에서 버티는 힘이 있지만 최근 NC가 경기 후반에 무너진 잔상이 커서, 초반 균형 뒤 롯데가 후반 한 번의 빅이닝을 잡을 가능성을 봅니다. 강한 확신은 아니지만 오늘은 롯데 쪽 반등 신호가 더 선명합니다.",
  },
  {
    game_id: "5358295e-ab78-49f2-b781-26ed45e6281b",
    predicted_winner_team_id: "hanwha",
    confidence: 0.76,
    key_factor: "화력 상승과 연패 압박",
    one_liner:
      "한화는 강백호와 김태연이 만든 대역전 흐름이 강하고, SSG는 9연패 압박을 먼저 걷어내야 합니다.",
    detailed_analysis:
      "한화는 최근 라인업에서 페라자, 문현빈, 강백호, 노시환이 상위와 중심을 형성하고 있고, 5월 28일 NC전에서는 강백호와 김태연이 8타점을 합작했다는 뉴스가 여러 건 확인됐습니다. 반대로 SSG는 삼성전 1-10 패배로 신세계 인수 후 최다 9연패라는 부정적 이슈가 크게 쌓였고, 타선과 마운드가 동시에 조용하다는 보도가 이어졌습니다. 선발 매치업도 최민준이 긴 이닝으로 흐름을 끊어야 하는 부담이 큰 반면, 한화는 홈에서 화이트가 초반만 정리해주면 최근 타선 폭발력을 바로 연결할 수 있습니다. 흐름형 예측으로는 오늘 5경기 중 한화 쪽 신호가 가장 강합니다.",
  },
  {
    game_id: "4d957851-a623-4666-8f01-669b36124c1a",
    predicted_winner_team_id: "lg",
    confidence: 0.56,
    key_factor: "선발 안정감",
    one_liner:
      "KIA의 6연승 기세는 무섭지만, 웰스가 홈에서 초반 볼넷 리스크를 줄이면 LG가 근소하게 앞설 수 있습니다.",
    detailed_analysis:
      "KIA는 키움전 5-0 승리와 황동하의 6이닝 무실점 소식까지 더해지며 6연승의 상승세가 분명합니다. 다만 오늘 선발은 그 경기의 황동하가 아니라 이의리이고, 최근 KIA 관련 뉴스도 새 아시아쿼터 영입처럼 당장 오늘 선발 매치업을 직접 바꾸는 내용은 아닙니다. LG는 직전 롯데전에서 후반 추격을 허용하며 졌지만 최근 상위권 흐름을 유지하고 있고, 오늘은 홈에서 웰스가 먼저 경기를 안정시키는 구도가 더 자연스럽습니다. KIA의 기세 때문에 confidence는 낮게 잡지만, 한 경기 매치업만 보면 LG의 선발 안정감이 근소 우위라고 봅니다.",
  },
  {
    game_id: "80251d7e-0511-416d-ac8c-147b7ef17f8c",
    predicted_winner_team_id: "samsung",
    confidence: 0.71,
    key_factor: "홈런 흐름과 원태인",
    one_liner:
      "삼성은 홈런 5방 직후 선두 흐름을 이어가고, 원태인 선발까지 붙어 두산보다 완성도가 높습니다.",
    detailed_analysis:
      "삼성은 5월 28일 SSG전에서 홈런 5개와 최원태의 완벽투로 10-1 대승을 거뒀다는 보도가 이어졌고, 순위표 기준으로도 리그 선두권 흐름이 가장 안정적입니다. 최근 라인업 역시 김지찬, 구자욱, 디아즈, 르윈 디아즈 축의 장타 기대가 살아있고 하위 타선에서도 한 방이 나온 점이 중요합니다. 두산은 직전 KT전에서 곽빈 이후 불펜이 무너지며 7~9회에만 10점을 내줬다는 뉴스가 있어, 원정에서 다시 불펜 부담을 안고 들어갑니다. 잭로그가 삼진으로 버틸 여지는 있지만 원태인 선발, 홈 이점, 최근 장타 흐름을 합치면 삼성 우세가 뚜렷합니다.",
  },
  {
    game_id: "790f6cfc-35db-4ec3-87a3-283e258f40e6",
    predicted_winner_team_id: "kt",
    confidence: 0.66,
    key_factor: "후반 득점 집중력",
    one_liner:
      "KT는 두산전 후반 10득점으로 타선 반등을 확인했고, 키움은 연승 뒤 급격히 식은 흐름이 부담입니다.",
    detailed_analysis:
      "KT는 5월 28일 두산전에서 7~9회에만 10득점하며 11-3 역전승을 만들었고, 고영표의 51일 만의 승리와 힐리어드의 장타까지 긍정적 뉴스가 많았습니다. 최근 라인업도 안현민, 강백호, 힐리어드, 황재균, 장성우로 이어지는 중장거리 구성이 뚜렷해 배동현을 상대로 초반부터 압박할 수 있습니다. 키움은 직전 KIA전 0-5 패배로 타선이 막혔고, 최근 순위표에서도 연패 흐름과 하위권 부담이 같이 보입니다. 사우어가 원정에서 장타만 조심하면 KT가 중반 이후 불펜 싸움에서 다시 점수를 벌릴 가능성이 높다고 판단했습니다.",
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
  throw new Error(`Existing gpt predictions found: ${existing.map((row) => row.game_id).join(", ")}`);
}

let inserted = 0;

for (const row of rows) {
  const payload = {
    ...row,
    game_date: GAME_DATE,
    ai_provider: AI_PROVIDER,
    model_name: MODEL_NAME,
    published_at: PUBLISHED_AT,
  };

  const { data, error } = await supabase
    .from("bp_ai_predictions")
    .insert(payload)
    .select("id, game_id, predicted_winner_team_id, confidence")
    .single();

  if (error) throw error;
  inserted += 1;
  console.log(
    `${inserted}. ${data.game_id} => ${data.predicted_winner_team_id} (${data.confidence}) id=${data.id}`
  );
}

console.log(`Inserted ${inserted} gpt predictions for ${GAME_DATE}.`);
