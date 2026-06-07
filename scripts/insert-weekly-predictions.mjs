import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
    })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const WEEK_START_DATE = "2026-06-08";
const PUBLISHED_AT = new Date("2026-06-08T09:00:00+09:00").toISOString();
const MODEL_NAME = "gemini-3-5-flash-medium";

const seriesData = [
  // --- 주중 초반 시리즈 (early) ---
  {
    series_group: "early",
    series_start_date: "2026-06-09",
    series_end_date: "2026-06-11",
    home_team_id: "lotte",
    away_team_id: "doosan",
    label: "3연전",
    headline: "롯데의 견고한 선발진과 두산 타선 간의 접전이 예상되는 시리즈입니다.",
    game_ids: ["cf3ad074-cf17-40f7-8c5d-4974ab453149", "2d6545fd-ffb7-44aa-b409-e5b658ffabe4", "dc15d5fc-edfd-4129-8011-e85e752344aa"],
    prediction: {
      predicted_winner_team_id: "lotte",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.58,
      key_factor: "홈 및 선발 높이",
      one_liner: "사직 홈의 이점을 살릴 롯데가 안정적인 선발진의 높이를 앞세워 두산 타선을 묶어둘 확률이 높습니다.",
      detailed_analysis: "롯데는 김진욱(ERA 3.38), 나균안(3.45) 등 계산이 서는 선발 매치업을 들고 안방에서 싸웁니다. 두산의 마운드가 볼넷 허용(팀 WHIP 1.45)이 잦다는 약점을 적극 공략한다면, 레이예스(OPS 0.962)와 고승민(0.918)의 적시타 지원에 힘입어 롯데가 2승을 먼저 가져올 수 있는 매치업입니다."
    }
  },
  {
    series_group: "early",
    series_start_date: "2026-06-09",
    series_end_date: "2026-06-11",
    home_team_id: "kt",
    away_team_id: "samsung",
    label: "3연전",
    headline: "KT의 강력한 홈 화력과 삼성의 짠물 투수력이 맞붙는 상위권 격돌입니다.",
    game_ids: ["d455847a-e366-4627-bc16-a8d9ef01d2ac", "3747cd83-415d-45fd-a780-aeb31f8b0535", "df9b612f-0212-4561-a0c7-f09259a7dddc"],
    prediction: {
      predicted_winner_team_id: "kt",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.58,
      key_factor: "홈 타선 집중력",
      one_liner: "최근 타격 기세가 절정인 안현민을 앞세운 KT 타선이 홈에서 엄청난 득점력을 과시하며 승기를 잡을 것입니다.",
      detailed_analysis: "KT는 팀 평균 OPS 0.817에 달하는 화력 집중도가 무섭습니다. 삼성의 에이스급 선발들을 상대하더라도 안현민(OPS 1.161)과 최원준(0.973) 등이 이끄는 타격 페이스가 워낙 뛰어나며, 보쉴리(ERA 3.16)와 소형준(3.69) 카드가 버텨주는 경기에서 타격전 끝에 승리할 수 있습니다."
    }
  },
  {
    series_group: "early",
    series_start_date: "2026-06-09",
    series_end_date: "2026-06-11",
    home_team_id: "hanwha",
    away_team_id: "kia",
    label: "3연전",
    headline: "폭발적인 한화 타선과 균형 잡힌 KIA의 마운드가 맞대결하는 승부입니다.",
    game_ids: ["d6c9efc1-38c4-4aae-8e36-298d42c10b62", "f43c0c1a-dac6-4fc3-9fbe-c4703ec1987d", "33e581be-4b60-424c-b038-ddd751794b12"],
    prediction: {
      predicted_winner_team_id: "kia",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.63,
      key_factor: "투타 조화",
      one_liner: "선발 및 불펜의 조화가 돋보이는 KIA가 한화의 다소 불안한 뒷문을 공략해 승리를 쟁취할 전망입니다.",
      detailed_analysis: "KIA는 올러(ERA 2.63), 네일(3.84)로 이어지는 막강한 1, 2선발 카드를 지녀 선발 우위를 점합니다. 한화 타선이 폭발적이라 하더라도 KIA의 에이스들이 이닝을 통제해주고 한화의 높은 팀 평균자책점을 공략한다면 한화의 불펜진을 상대로 충분한 승수를 챙길 수 있습니다."
    }
  },
  {
    series_group: "early",
    series_start_date: "2026-06-09",
    series_end_date: "2026-06-11",
    home_team_id: "kiwoom",
    away_team_id: "nc",
    label: "3연전",
    headline: "마운드의 견고함을 앞세운 NC와 연패 탈출을 노리는 키움의 격돌입니다.",
    game_ids: ["c83b23f9-3a85-45ee-b35e-ff854a113c95", "4cd88a7e-31d9-4a49-a777-01329a19eef2", "00c401fe-f900-463a-9e9b-7e8e06ea7997"],
    prediction: {
      predicted_winner_team_id: "nc",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.68,
      key_factor: "수비력 우위",
      one_liner: "키움 마운드의 제구 불안을 NC 타선이 날카롭게 집요하게 공략하여 우위를 이끌어낼 것입니다.",
      detailed_analysis: "키움 마운드는 볼넷이 많아 위기를 자초하는 경향이 짙습니다. NC는 박민우(OPS 0.810)와 이우성(0.869)의 노련함으로 사사구를 골라내며 주도권을 쥐고, 안정된 내외야 수비를 바탕으로 지키는 야구를 통해 우세를 점할 것입니다."
    }
  },
  {
    series_group: "early",
    series_start_date: "2026-06-09",
    series_end_date: "2026-06-11",
    home_team_id: "lg",
    away_team_id: "ssg",
    label: "3연전",
    headline: "리그 1위 LG와 리그 최강의 화력을 가진 SSG의 창과 방패 싸움입니다.",
    game_ids: ["583ecf6c-f87f-4c68-87e6-29add37a77fa", "bec1a2b0-735b-4d43-b642-933a79830ac0", "b767faa4-6a37-4a6e-b698-4b73355e5c68"],
    prediction: {
      predicted_winner_team_id: "ssg",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.57,
      key_factor: "장타력 우위",
      one_liner: "최정과 고명준의 파괴력이 절정에 달한 SSG가 화력전을 유도하며 LG 마운드를 정면으로 깨뜨릴 것입니다.",
      detailed_analysis: "SSG는 리그 최고 수준의 장타율을 자랑하며, 고명준(OPS 1.047)과 최정(OPS 0.949)의 홈런 한 방은 분위기를 단숨에 가져옵니다. LG 선발진이 흔들리는 틈을 타 타선의 힘만으로 초반 리드를 벌리고 필승조 최민준(ERA 3.52) 등을 투입해 지키는 그림이 그려집니다."
    }
  },

  // --- 주말 시리즈 (weekend) ---
  {
    series_group: "weekend",
    series_start_date: "2026-06-12",
    series_end_date: "2026-06-14",
    home_team_id: "kt",
    away_team_id: "nc",
    label: "3연전",
    headline: "마운드의 정교함을 갖춘 NC와 홈 구장 득점력이 가공할 만한 KT의 맞대결입니다.",
    game_ids: ["3ef375b1-e6b2-4c16-afd2-afe58171a705", "1c40f8da-c72d-4d15-ba44-21abe5eaf55b", "06427010-5838-4edc-8409-ffbfcbcfbdaf"],
    prediction: {
      predicted_winner_team_id: "nc",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.59,
      key_factor: "선발 안정감",
      one_liner: "라일리와 구창모를 앞세운 NC의 정교한 선발진이 KT의 화력을 효율적으로 억제해내며 원정에서 우세를 점할 전망입니다.",
      detailed_analysis: "NC는 9이닝당 탈삼진 10.67을 기록 중인 라일리와 선발 구창모가 확실한 이닝 소화를 보여줍니다. KT 선발 사우어가 종종 사사구로 무너지고 불펜진의 평균자책점이 높다는 점을 감안하면, NC 타선이 박건우(OPS 0.912)를 중심으로 찬스를 잘 살려 2승 1패로 원정 위닝을 챙길 수 있습니다."
    }
  },
  {
    series_group: "weekend",
    series_start_date: "2026-06-12",
    series_end_date: "2026-06-14",
    home_team_id: "lg",
    away_team_id: "lotte",
    label: "3연전",
    headline: "짠물 수비의 롯데와 안정적인 선두 수성을 노리는 LG의 수비 대결입니다.",
    game_ids: ["d04b22e1-290e-4c94-b4c4-2a244d2334be", "4059bbf9-a27e-4add-92ba-b13e7bfc292b", "09e0f80d-41dd-4463-990a-93d3a3ad3229"],
    prediction: {
      predicted_winner_team_id: "lg",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.70,
      key_factor: "홈 경기력",
      one_liner: "홈에서 공수 조직력이 한층 더 살아나는 LG가 롯데의 하위 타선을 상대로 확실한 투수전 우위를 가져갈 전망입니다.",
      detailed_analysis: "LG는 선발 웰스(ERA 1.79)를 필두로 선발진 전체가 실점을 최소화하는 피칭에 능합니다. 롯데는 레이예스(OPS 0.962) 외에는 마운드를 공략할 뚜렷한 카드가 없으며, 경기 후반 불펜 싸움으로 이어질 때 LG 필승조의 견고함이 롯데의 끈질긴 추격을 뿌리치고 승리를 지킬 것입니다."
    }
  },
  {
    series_group: "weekend",
    series_start_date: "2026-06-12",
    series_end_date: "2026-06-14",
    home_team_id: "samsung",
    away_team_id: "ssg",
    label: "3연전",
    headline: "거포들의 낙원인 대구에서 SSG의 화력과 삼성의 1선발 마운드가 충돌합니다.",
    game_ids: ["d648060d-5d19-4590-99d1-9736852838e8", "c7d96f93-39e6-4562-ba8d-12979e4d0e9f", "9904dc32-7256-4402-bc69-afd1941cb8dd"],
    prediction: {
      predicted_winner_team_id: "ssg",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.58,
      key_factor: "화력 극대화",
      one_liner: "대구 라팍의 좁은 펜스 상성을 살려 최정과 고명준의 홈런포가 대거 가동되며 SSG가 대량 득점으로 승리를 챙길 전망입니다.",
      detailed_analysis: "SSG는 고명준(OPS 1.047)과 최정(OPS 0.949)을 위시하여 장타력 면에서 리그 최고의 화력을 보유하고 있습니다. 투수 친화적이지 않은 대구 구장 특성상, SSG의 강력한 거포진이 삼성 투수진을 난타하며 경기 주도권을 뺏고 점수 차를 크게 벌릴 수 있습니다."
    }
  },
  {
    series_group: "weekend",
    series_start_date: "2026-06-12",
    series_end_date: "2026-06-14",
    home_team_id: "kiwoom",
    away_team_id: "hanwha",
    label: "3연전",
    headline: "폭발적인 한화 타선이 고척돔에서 키움의 불안한 마운드를 정면 돌파하려 합니다.",
    game_ids: ["e83810dc-429e-4fcd-b19f-3605d2c18fda", "02f82ff8-3d1e-46d4-9b18-221ec0961a3a", "b8065d15-4b6e-4b74-a29c-155969d0e90d"],
    prediction: {
      predicted_winner_team_id: "hanwha",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.75,
      key_factor: "투타 조화",
      one_liner: "류현진과 왕옌청의 좌완 원투펀치 안정감과 함께 한화 타선이 대량 득점을 지원해 승리를 이끌 전망입니다.",
      detailed_analysis: "한화는 선발진에서 류현진(ERA 3.28)과 왕옌청(3.24)이 매우 높은 안정감을 보입니다. 키움 타선은 팀 평균 OPS가 0.726으로 득점 생산성이 부족하여 한화의 에이스들을 공략하기 힘듭니다. 한화가 투수진의 안정감과 타선의 파괴력을 앞세워 2승 이상을 쉽게 쟁취할 것입니다."
    }
  },
  {
    series_group: "weekend",
    series_start_date: "2026-06-12",
    series_end_date: "2026-06-14",
    home_team_id: "kia",
    away_team_id: "doosan",
    label: "3연전",
    headline: "투타 밸런스가 비슷한 중상위권 두 팀의 자존심 대결이 KIA 홈에서 펼쳐집니다.",
    game_ids: ["d2decbec-d083-444d-855e-5deaccd3a94d", "d615e13c-62b1-4aea-9643-78b52c5f8a2e", "ffdffa7a-22b0-418c-adc4-e816f6235407"],
    prediction: {
      predicted_winner_team_id: "doosan",
      predicted_result: "winning",
      predicted_wins: 2,
      predicted_losses: 1,
      confidence: 0.59,
      key_factor: "선발진 위력",
      one_liner: "곽빈과 벤자민의 탄탄한 선발 로테이션을 앞세운 두산이 KIA 타선을 억제하고 원정에서 귀중한 위닝을 챙길 전망입니다.",
      detailed_analysis: "두산은 곽빈(ERA 3.26)과 벤자민(2.61)이라는 리그 정상급 선발진을 보유하고 있습니다. 이들의 등판 경기에서 KIA 타선의 흐름을 성공적으로 묶어두고, 최근 폼이 좋은 박준순과 카메론의 타격 지원을 유도한다면 2승 1패로 KIA 원정을 지배할 수 있습니다."
    }
  }
];

console.log(`Inserting ${seriesData.length} weekly series and 10 predictions for gemini for week of ${WEEK_START_DATE}...`);

let okCount = 0;
let failCount = 0;

for (const s of seriesData) {
  // 1) 시리즈 기본 정보 Insert/Upsert
  const seriesPayload = {
    week_start_date: WEEK_START_DATE,
    series_group: s.series_group,
    series_start_date: s.series_start_date,
    series_end_date: s.series_end_date,
    home_team_id: s.home_team_id,
    away_team_id: s.away_team_id,
    label: s.label,
    headline: s.headline,
    game_ids: s.game_ids,
    published_at: PUBLISHED_AT
  };

  const { data: upsertedSeries, error: sErr } = await sb
    .from("bp_ai_weekly_series")
    .upsert(seriesPayload, {
      onConflict: "week_start_date,series_group,home_team_id,away_team_id"
    })
    .select("id")
    .single();

  if (sErr) {
    console.error(`✗ Failed to upsert series ${s.away_team_id} @ ${s.home_team_id}:`, sErr.message);
    failCount++;
    continue;
  }

  const seriesId = upsertedSeries.id;
  console.log(`✓ Series ${s.away_team_id.padEnd(8)} @ ${s.home_team_id.padEnd(8)} upserted. ID=${seriesId}`);

  // 2) Gemini AI 예측 정보 Insert/Upsert
  const p = s.prediction;
  const predPayload = {
    series_id: seriesId,
    week_start_date: WEEK_START_DATE,
    ai_provider: "gemini",
    model_name: MODEL_NAME,
    predicted_winner_team_id: p.predicted_winner_team_id,
    predicted_result: p.predicted_result,
    predicted_wins: p.predicted_wins,
    predicted_losses: p.predicted_losses,
    confidence: p.confidence,
    key_factor: p.key_factor,
    one_liner: p.one_liner,
    detailed_analysis: p.detailed_analysis
  };

  const { error: pErr } = await sb
    .from("bp_ai_weekly_series_predictions")
    .upsert(predPayload, {
      onConflict: "series_id,ai_provider"
    });

  if (pErr) {
    console.error(`  ✗ Failed to upsert prediction for gemini:`, pErr.message);
    failCount++;
  } else {
    console.log(`  ✓ Prediction for gemini (Winner: ${p.predicted_winner_team_id}) upserted.`);
    okCount++;
  }
}

console.log(`\n최종 결과: 성공 ${okCount + seriesData.length}건 / 실패 ${failCount}건`);
