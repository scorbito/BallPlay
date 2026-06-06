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

const GAME_DATE = "2026-06-02";
const PUBLISHED_AT = "2026-06-02T09:00:00+09:00";
const AI_PROVIDER = "gpt";
const MODEL_NAME = "gpt-5-codex";

const rows = [
  {
    game_id: "27f27f30-46c0-443f-a378-d9436b18beb4",
    predicted_winner_team_id: "kt",
    confidence: 0.64,
    key_factor: "홈 선발 우위",
    one_liner:
      "LG의 1위 흐름은 강하지만, 수원 홈에서 한차현의 WHIP와 KT 타선 출루력이 더 안정적으로 보입니다.",
    detailed_analysis:
      "KT 한차현은 ERA 3.19, WHIP 1.17, BB/9 1.72로 임찬규(ERA 4.31, WHIP 1.58)보다 주자 관리가 좋습니다. LG는 리그 상위권 흐름과 홍창기-오스틴-오지환 축이 있어 원정에서도 쉽게 밀리지 않습니다. 다만 KT 최근 라인업은 타율 .298, 출루율 .380으로 LG(.259/.360)보다 초반 득점 기회 생산이 더 안정적입니다. LG를 꺾는 선택이 다소 부담스럽지만, 오늘 한 경기만 보면 선발 제구와 홈 이점이 KT 쪽으로 살짝 더 기웁니다.",
  },
  {
    game_id: "3db425e2-453a-4e85-beeb-725feb4c80fb",
    predicted_winner_team_id: "kiwoom",
    confidence: 0.57,
    key_factor: "연패 속 선발 격차",
    one_liner:
      "키움도 연패 팀이지만, 알칸타라의 안정감이 SSG 12연패와 베니지아노 불안을 넘는 핵심 변수입니다.",
    detailed_analysis:
      "SSG와 키움 모두 흐름이 나쁘지만, 선발 매치업은 키움 알칸타라가 ERA 3.18, WHIP 1.17, BB/9 1.25로 훨씬 선명합니다. SSG 베니지아노는 ERA 5.63, WHIP 1.68, HR/9 1.36이라 낮은 득점력의 키움에게도 초반 기회를 줄 수 있습니다. 키움 타선은 장타율 .338, 삼진율 23.0%로 분명 약하지만, SSG도 최근 12연패와 베테랑 2군행 보도까지 겹쳐 경기 후반 안정감이 떨어져 있습니다. 억지 역배가 아니라 양쪽 침체 중 선발 차이가 가장 크게 보이는 쪽을 택한 낮은 확신의 선택입니다.",
  },
  {
    game_id: "96c25c83-629d-45c6-83f9-50c3e7775bb5",
    predicted_winner_team_id: "kia",
    confidence: 0.61,
    key_factor: "네일 제구력",
    one_liner:
      "KIA가 3연패로 흔들리지만, 광주 홈과 네일의 WHIP가 롯데 반등세를 근소하게 누릅니다.",
    detailed_analysis:
      "KIA 네일은 ERA 3.84보다 WHIP 1.11, BB/9 1.42, HR/9 0.43이 더 좋은 투수라 대량 실점 리스크가 낮습니다. 롯데 나균안도 ERA 3.45로 충분히 버틸 수 있고, 롯데 타선은 최근 라인업 타율 .278, 장타율 .402로 무난합니다. 다만 KIA는 6연승 뒤 3연패라는 하락 신호가 있지만 김도영-아데를린-나성범 축의 장타 기대값이 여전히 높고 홈 광주에서 반등 포인트가 있습니다. 연패 흐름 때문에 confidence는 낮게 두지만, 선발 안정과 장타 한 방의 조합은 KIA 쪽이 조금 낫습니다.",
  },
  {
    game_id: "ed12e3f2-02bc-42d4-838f-0cec52adfe26",
    predicted_winner_team_id: "doosan",
    confidence: 0.55,
    key_factor: "벤자민 선발 카드",
    one_liner:
      "한화 타선은 무섭지만, 박준영의 볼넷 리스크와 벤자민의 실점 억제를 보면 두산 역배가 성립합니다.",
    detailed_analysis:
      "한화는 최근 라인업 타율 .302, 출루율 .381, 장타율 .480으로 오늘 가장 강한 타선 중 하나입니다. 그래서 정배 감각은 한화 쪽으로 쉽게 흐르지만, 박준영은 ERA 4.42보다 WHIP 1.75와 BB/9 8.85가 너무 큰 불안입니다. 두산 벤자민은 ERA 2.61, HR/9 0.22로 장타 억제력이 강해 한화 타선을 한 번 눌러볼 카드가 됩니다. 두산 타선의 장타율 .347은 낮아 확신은 작지만, 선발 격차가 큰 날에는 약한 타선도 초반 볼넷과 불펜 승부로 경기를 가져올 수 있다고 봅니다.",
  },
  {
    game_id: "0f497078-28f9-4ee8-8691-1f84c4fb4e6c",
    predicted_winner_team_id: "samsung",
    confidence: 0.76,
    key_factor: "후라도 안정감",
    one_liner:
      "후라도의 시즌 안정감과 삼성 타선의 출루 품질이 NC 토다 매치업보다 확실히 앞섭니다.",
    detailed_analysis:
      "삼성 후라도는 ERA 2.17, WHIP 1.10, BB/9 1.40으로 오늘 선발 중 가장 믿을 만한 축입니다. NC 토다는 ERA 4.34, WHIP 1.47, BB/9 3.35로 대구 원정에서 삼성 상위 타선을 계속 막기에는 부담이 있습니다. 삼성 최근 라인업은 출루율 .382, 삼진율 15.7%로 쉽게 죽지 않는 구성이며, 김지찬-구자욱-최형우-디아즈 연결이 꾸준히 압박을 만들 수 있습니다. NC도 박민우와 데이비슨이 버티고 있지만 선발, 홈, 타선 안정성 세 축이 모두 삼성 쪽입니다.",
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
