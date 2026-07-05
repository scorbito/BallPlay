// 2026-07-06 주 (7/7-7/9) Claude 주간 시리즈 예측 5건 INSERT. (주중 시리즈만 — 주말 없음)
// 가이드: docs/ai-weekly-series-prediction-guide.md
// 페르소나 없이 자유 분석. 선발은 5선발 로테이션 추정. 선발+타선+불펜+홈+흐름 종합.

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

const WEEK_START = "2026-07-06";
const PUBLISHED_AT = "2026-07-06T09:00:00+09:00";
// ⚠️ INSERT 직전 확인: 현재 세션 모델과 일치하는가?
const MODEL = "claude-opus-4-8";

const series = [
  {
    group: "early", start: "2026-07-07", end: "2026-07-09",
    home: "hanwha", away: "nc",
    game_ids: ["89ba0aea-e559-425c-af28-c9dee2e3c7d2", "448234b3-a227-4235-90fb-410090ab1fe2", "c4fc8c65-d3cc-4624-a6a6-77aa217b61ff"],
    label: "3연전",
    headline: "3위 한화와 7위 NC가 대전에서 만나는 주중 시리즈입니다.",
    pick: "hanwha", result: "winning", wins: 2, losses: 1, confidence: 0.57,
    key_factor: "한화 장타력 + 대전 홈",
    one_liner: "한화가 강백호·노시환의 시즌 장타력 리그 1위 타선과 화이트·왕옌청의 안정적인 선발, 대전 홈을 앞세워 앞섭니다. 다만 NC 라일리·구창모의 강한 선발이 한 경기를 가져갈 변수입니다.",
    detailed_analysis:
      "선발과 타선, 홈이 한화로 기우는 시리즈입니다. 예상 선발은 한화 왕옌청(ERA 3.59)·화이트(ERA 2.84)·에르난데스(ERA 4.97), NC 김태경(ERA 5.03)·구창모(ERA 3.44)·라일리(ERA 3.53)로, 화이트가 평균 자책점 2점대의 에이스이고 1차전 김태경이 NC 선발 중 가장 불안합니다. 다만 NC는 라일리·구창모가 평균 자책점 3점대의 강한 카드라 한 경기는 가져갈 만합니다. 타선은 한화 라인업(평균 .281, 출루율 .354, 장타력 .485, ISO .204)이 강백호·노시환·페라자의 장타력으로 시즌 리그 1위이고, NC 라인업(평균 .279, 출루율 .366, 장타력 .430)보다 한 방에서 앞섭니다. 한화는 대전 홈 이점도 있습니다. 한화의 장타력·선발·홈에 무게를 둬 2승 1패를 예상합니다. 라일리가 나오는 경기를 NC가 잡으면 시리즈가 팽팽해집니다."
  },
  {
    group: "early", start: "2026-07-07", end: "2026-07-09",
    home: "doosan", away: "ssg",
    game_ids: ["e166cd4a-4c0c-4635-99ed-419b63ec5493", "289aa036-b518-4034-8c0f-8dd393c5293b", "da2ab6b6-fc67-46af-ae27-bd02e8f5dad8"],
    label: "3연전",
    headline: "5위 두산과 5위 SSG가 잠실에서 만나는 시리즈입니다.",
    pick: "doosan", result: "winning", wins: 2, losses: 1, confidence: 0.63,
    key_factor: "두산 선발 압도 + SSG 선발 붕괴",
    one_liner: "두산이 곽빈을 앞세운 안정적인 선발진을 갖춘 반면 SSG 선발진은 평균 자책점이 모두 6점대를 넘어, 최근 연패에 빠진 SSG를 상대로 두산이 잠실 홈에서 위닝 시리즈를 가져갈 전망입니다.",
    detailed_analysis:
      "선발 격차가 이번 주 시리즈 중 가장 큰 카드입니다. 예상 선발은 두산 곽빈(ERA 2.70)·잭로그(ERA 4.12)·최승용(ERA 5.52), SSG 베니지아노(ERA 6.10)·해치(ERA 7.08)·타케다(ERA 7.43)로, SSG 선발진은 세 명 모두 평균 자책점이 6점대를 넘어 붕괴 수준인 반면 두산은 곽빈이 2점대 에이스이고 잭로그도 안정적입니다. 타선은 두산 라인업(평균 .272, 출루율 .340, 장타력 .399)과 SSG 라인업(평균 .272, 출루율 .351, 장타력 .410)이 비슷하지만, 두산이 부진한 SSG 선발을 상대로 화력을 낼 여지가 큽니다. SSG는 최근 연패로 분위기가 가라앉았고, 두산은 잠실 홈 이점이 있습니다. 두산의 선발 우위와 홈에 무게를 둬 2승 1패를 예상합니다. SSG 거포들이 두산 마운드를 흔드는 경기가 있으면 한 경기는 가져갈 수 있습니다."
  },
  {
    group: "early", start: "2026-07-07", end: "2026-07-09",
    home: "kt", away: "kiwoom",
    game_ids: ["05e7b9ab-a5c5-479a-af23-f1568f6d3017", "5239e1f9-8fc5-409e-aaf6-cdbd8225bb7e", "ba983493-f702-48d7-963c-f504fd4b7fd4"],
    label: "3연전",
    headline: "3위 KT와 최하위 키움이 수원에서 만나는 상하위 시리즈입니다.",
    pick: "kt", result: "winning", wins: 2, losses: 1, confidence: 0.57,
    key_factor: "KT 전력·홈 우위 + 고영표",
    one_liner: "KT가 고영표를 앞세운 선발과 3위의 전력, 수원 홈을 앞세워 최하위 키움을 상대로 앞섭니다. 다만 1차전 오원석이 평균 자책점 6점대로 불안한 점이 변수입니다.",
    detailed_analysis:
      "전력에서 KT가 앞서는 시리즈입니다. 예상 선발은 KT 오원석(ERA 6.11)·로건(ERA 3.00, 표본 적음)·고영표(ERA 4.43), 키움 배동현(ERA 5.37)·하영민(ERA 4.16)·박준현(ERA 3.67, BB9 6.43)으로, KT는 1차전 오원석이 불안하지만 고영표가 볼넷이 거의 없는 안정적인 카드입니다. 키움은 박준현의 제구 난조(9이닝당 볼넷 6개 이상)가 약점입니다. 타선은 KT 라인업(평균 .274, 출루율 .364, 장타력 .376)이 최근 장타력이 떨어졌지만, 키움 라인업(평균 .253, 출루율 .336, 장타력 .369)의 리그 최하위 빈타보다는 낫습니다. KT는 3위(0.557)의 전력과 수원 홈 이점이 있습니다. KT의 전력·홈 우위에 무게를 둬 2승 1패를 예상합니다. 오원석이 무너지는 1차전을 키움이 잡으면 시리즈가 팽팽해질 수 있습니다."
  },
  {
    group: "early", start: "2026-07-07", end: "2026-07-09",
    home: "lotte", away: "kia",
    game_ids: ["8a6a35ea-57c5-4519-8db2-e7e685660b4c", "0f2cf34e-e22c-4973-bb18-9933456c3b63", "08361a1d-7780-4336-ab7f-634453374a26"],
    label: "3연전",
    headline: "2위 KIA와 8위 롯데가 사직에서 만나는 시리즈입니다.",
    pick: "kia", result: "winning", wins: 2, losses: 1, confidence: 0.54,
    key_factor: "KIA 장타 타선 + 네일",
    one_liner: "KIA가 김도영 중심의 시즌 장타력 최상위 타선과 에이스 네일을 앞세워 앞섭니다. 다만 롯데가 김진욱·비슬리의 강한 선발과 사직 홈, 최근 상승세로 만만치 않은 접전이 예상됩니다.",
    detailed_analysis:
      "타선은 KIA, 선발과 홈은 롯데가 앞서는 박빙 시리즈입니다. 예상 선발은 롯데 나균안(ERA 3.95)·김진욱(ERA 2.84)·비슬리(ERA 4.48), KIA 네일(ERA 3.44)·황동하(ERA 4.37)·시라카와(ERA 4.88)로, 김진욱이 평균 자책점 2점대의 에이스이고 KIA는 네일이 가장 믿을 만합니다. 타선은 KIA 라인업(평균 .289, 출루율 .365, 장타력 .455, ISO .166)이 김도영·나성범·카스트로의 장타력으로 롯데 라인업(평균 .288, 출루율 .342, 장타력 .432)보다 한 방이 강합니다. 다만 롯데는 사직 홈 이점과 최근 KT를 이틀 연속 완파한 상승세, 짠물 불펜이 있습니다. KIA의 타선과 네일, 2위(0.587)의 전력에 살짝 무게를 둬 2승 1패를 예상하되, 롯데의 홈과 김진욱·비슬리의 선발, 상승세를 고려하면 접전이 됩니다. 롯데가 홈에서 흐름을 이어가면 시리즈를 가져갈 수 있습니다."
  },
  {
    group: "early", start: "2026-07-07", end: "2026-07-09",
    home: "samsung", away: "lg",
    game_ids: ["5fcf5f0f-2884-432f-83f2-c782329769e5", "9d1b90d3-812d-4bcb-9709-f726883b2fa8", "5382a447-66e7-4c77-b222-7a83ca24e1e8"],
    label: "3연전",
    headline: "공동 선두 삼성과 LG가 대구에서 만나는 1위 맞대결입니다.",
    pick: "lg", result: "winning", wins: 2, losses: 1, confidence: 0.53,
    key_factor: "LG 선발 깊이·장타 vs 삼성 홈",
    one_liner: "LG가 웰스·임찬규의 안정적인 선발 깊이와 장타 타선을 앞세워 근소하게 앞섭니다. 다만 삼성이 에이스 원태인과 대구 홈, 높은 출루율 타선을 앞세워 팽팽한 1위 맞대결이 예상됩니다.",
    detailed_analysis:
      "1위를 다투는 두 팀의 팽팽한 맞대결입니다. 예상 선발은 삼성 김백산(표본 적음)·원태인(ERA 3.45)·최원태(ERA 4.70), LG 임찬규(ERA 3.79)·웰스(ERA 2.77)·장현식(ERA 3.86)으로, LG는 임찬규·웰스가 안정적인 반면 삼성은 1차전 김백산이 검증 부족이고 원태인이 에이스입니다. 타선은 LG 라인업(평균 .277, 출루율 .368, 장타력 .438)이 오스틴 중심의 장타력으로, 삼성 라인업(평균 .282, 출루율 .380, 장타력 .416)보다 장타에서 앞서지만 삼성은 출루에서 앞섭니다. 삼성은 대구 홈 이점과 2연승 흐름이 있습니다. LG의 선발 깊이와 장타력, 1차전 임찬규의 안정감에 살짝 무게를 둬 2승 1패를 예상하되, 삼성의 홈과 원태인, 출루형 타선을 고려하면 동전 던지기에 가까운 접전입니다. 삼성이 대구 홈에서 원태인 등판 경기를 잡고 흐름을 타면 시리즈를 가져갈 수 있습니다."
  }
];

console.log(`Inserting ${series.length} weekly series + ${series.length} Claude predictions for week ${WEEK_START}...`);

let okCount = 0;
let failCount = 0;

for (const s of series) {
  const { data: seriesRow, error: sErr } = await sb
    .from("bp_ai_weekly_series")
    .upsert(
      {
        week_start_date: WEEK_START,
        series_group: s.group,
        series_start_date: s.start,
        series_end_date: s.end,
        home_team_id: s.home,
        away_team_id: s.away,
        game_ids: s.game_ids,
        label: s.label,
        headline: s.headline,
        published_at: PUBLISHED_AT
      },
      { onConflict: "week_start_date,series_group,home_team_id,away_team_id" }
    )
    .select("id")
    .single();

  if (sErr) {
    console.log(`  ✗ series ${s.away} @ ${s.home}: ${sErr.message}`);
    failCount++;
    continue;
  }

  const { error: pErr } = await sb
    .from("bp_ai_weekly_series_predictions")
    .upsert(
      {
        series_id: seriesRow.id,
        week_start_date: WEEK_START,
        ai_provider: "claude",
        model_name: MODEL,
        predicted_winner_team_id: s.pick,
        predicted_result: s.result,
        predicted_wins: s.wins,
        predicted_losses: s.losses,
        confidence: s.confidence,
        key_factor: s.key_factor,
        one_liner: s.one_liner,
        detailed_analysis: s.detailed_analysis
      },
      { onConflict: "series_id,ai_provider" }
    );

  if (pErr) {
    console.log(`  ✗ pred ${s.away} @ ${s.home}: ${pErr.message}`);
    failCount++;
    continue;
  }

  console.log(`  ✓ [${s.group}] ${s.away} @ ${s.home} → ${s.pick} ${s.result} ${s.wins}-${s.losses} (${s.confidence})`);
  okCount++;
}

console.log(`\n결과: 성공 ${okCount}건 / 실패 ${failCount}건`);
