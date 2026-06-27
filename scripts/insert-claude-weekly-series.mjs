// 2026-06-22 주 (6/23-6/28) Claude 주간 시리즈 예측 10건 INSERT.
// 가이드: docs/ai-weekly-series-prediction-guide.md
// 페르소나 없이 자유 분석. 선발은 5선발 로테이션 추정(예상 선발).

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

const WEEK_START = "2026-06-22";
const PUBLISHED_AT = "2026-06-22T09:00:00+09:00";
// ⚠️ INSERT 직전 확인: 현재 세션 모델과 일치하는가?
const MODEL = "claude-opus-4-8";

const series = [
  // ───── EARLY (6/23-6/25) ─────
  {
    group: "early", start: "2026-06-23", end: "2026-06-25",
    home: "lg", away: "samsung",
    game_ids: ["982e0110-7ca3-447e-9705-afede3aaf450", "39b18172-22cc-43d6-b5c5-21e6558c955d", "63de8612-3d80-4354-8bcf-52703fc0198a"],
    label: "3연전",
    headline: "승률 1위 LG와 공동 선두 삼성이 잠실에서 만나는 선두 맞대결입니다.",
    pick: "lg", result: "winning", wins: 2, losses: 1, confidence: 0.54,
    key_factor: "잠실 홈 + 선발 안정감",
    one_liner: "선두를 다투는 두 팀의 전력이 팽팽하지만, LG가 톨허스트·임찬규의 안정적인 선발과 잠실 홈 이점을 안고 있어 한 경기를 더 가져갈 가능성이 높습니다.",
    detailed_analysis:
      "전력이 가장 팽팽한 선두 맞대결입니다. 예상 선발은 LG 톨허스트(ERA 4.03)·이정용(ERA 6.05)·임찬규(ERA 3.45), 삼성 최원태(ERA 4.39)·오러클린(ERA 3.89)·후라도(ERA 2.86)로, 에이스 후라도가 나오는 한 경기는 삼성이 가져갈 공산이 큽니다. 다만 LG는 톨허스트·임찬규 두 경기에서 안정적인 선발을 기대할 수 있고, 이정용이 흔들리는 경기를 타선으로 메워야 합니다. 타선은 삼성 라인업(평균 .288, 출루율 .380, 장타력 .427)이 LG 라인업(평균 .279, 출루율 .377, 장타력 .409)보다 미세하게 앞서지만 차이는 크지 않습니다. 결국 잠실 홈 이점과 LG의 선발 두 자리 안정감에 무게를 둬 2승 1패를 예상합니다. 후라도가 시리즈 흐름을 끊고 삼성 타선이 폭발하면 삼성이 가져갈 수도 있는 박빙입니다."
  },
  {
    group: "early", start: "2026-06-23", end: "2026-06-25",
    home: "kt", away: "ssg",
    game_ids: ["2390988b-59b7-446b-8416-f53c933c3e6f", "b49f488d-af56-4c37-a591-65afd9ce2b57", "83610134-e1ab-4385-916e-ae12030a4ca1"],
    label: "3연전",
    headline: "2위 KT와 5위 SSG가 수원에서 만나는 시리즈입니다.",
    pick: "kt", result: "winning", wins: 2, losses: 1, confidence: 0.63,
    key_factor: "KT 콘택트 타선 + SSG 선발 부진",
    one_liner: "KT 타선이 시즌 타율 3할에 출루율도 리그 최상위인 콘택트 그룹인 반면 SSG 선발진은 평균 자책점이 모두 5점대 안팎이라, KT가 수원 홈에서 위닝 시리즈를 가져갈 가능성이 높습니다.",
    detailed_analysis:
      "선발과 타선이 모두 KT로 기우는 시리즈입니다. 예상 선발은 KT 사우어(ERA 4.20)·소형준(ERA 3.48)·오원석(ERA 5.56), SSG 김건우(ERA 5.43)·타케다(ERA 7.06)·베니지아노(ERA 5.91)로, SSG 선발진은 세 명 모두 평균 자책점이 높고 특히 타케다는 7점대로 불안합니다. 타선 격차는 더 큽니다. KT 라인업(평균 .307, 출루율 .389, 장타력 .430)은 최원준·안현민·힐리어드 중심의 리그 최상위 콘택트 그룹이라 SSG의 불안한 선발을 공략하기 좋습니다. SSG 라인업(평균 .279, 출루율 .359, 장타력 .429)도 최정·에레디아·김재환의 장타력이 있어 한 경기는 가져갈 수 있지만, 소형준이 나오는 경기는 KT가 우위입니다. 수원 홈과 KT 타선의 우위에 무게를 둬 2승 1패를 예상합니다."
  },
  {
    group: "early", start: "2026-06-23", end: "2026-06-25",
    home: "kiwoom", away: "kia",
    game_ids: ["cfdb8b9d-27fe-44e5-9167-045e0a8c22da", "9f3950b3-2bf3-43ea-bf3b-3ab797d0b4c5", "65e100a2-ca45-4b04-bdce-e6f729367dcd"],
    label: "3연전",
    headline: "2위 KIA와 최하위 키움이 고척에서 만나는 상하위 시리즈입니다.",
    pick: "kia", result: "winning", wins: 2, losses: 1, confidence: 0.62,
    key_factor: "KIA 장타 타선 + 키움 빈타",
    one_liner: "KIA가 올러·네일의 안정적인 선발과 김도영·나성범 중심의 장타력을 갖춘 반면, 키움 타선은 장타력이 리그 최하위인 빈타라 KIA가 위닝 시리즈를 가져갈 전망입니다.",
    detailed_analysis:
      "전력 격차가 분명한 시리즈입니다. 예상 선발은 KIA 올러(ERA 2.58)·양현종(ERA 4.12)·네일(ERA 3.40), 키움 박준현(ERA 2.90)·안우진(ERA 3.46)·알칸타라(ERA 2.93)로, 의외로 키움 선발진도 안정적이라 안우진이 나오는 경기는 키움이 가져갈 가능성이 있습니다. 승부를 가르는 건 타선입니다. KIA 라인업(평균 .276, 출루율 .357, 장타력 .424)은 김도영·나성범·카스트로의 장타력이 강점인 반면, 키움 라인업(평균 .253, 출루율 .331, 장타력 .341)은 장타력이 리그 최하위권으로 한 방이 거의 없습니다. KIA가 올러·네일이 나오는 두 경기에서 안정적인 선발과 타선 우위를 살린다면 2승 1패가 유력합니다. 안우진이 KIA 타선을 묶고 키움이 짜내기로 한 점 승부를 가져가면 변수가 됩니다."
  },
  {
    group: "early", start: "2026-06-23", end: "2026-06-25",
    home: "hanwha", away: "doosan",
    game_ids: ["97767d6b-378d-40a2-ba08-16c5cf269ca5", "1ae1302a-435b-420c-87ac-614e291fcd95", "fe188aca-a69a-4c00-8b7b-df4f5bf656cd"],
    label: "3연전",
    headline: "3위 한화와 5위 두산이 대전에서 만나는 시리즈입니다.",
    pick: "hanwha", result: "winning", wins: 2, losses: 1, confidence: 0.56,
    key_factor: "한화 장타 타선 + 대전 홈",
    one_liner: "두산 최민석·벤자민의 선발이 안정적이지만, 강백호·노시환·페라자의 장타력을 갖춘 한화 타선이 대전 홈에서 받쳐주고 두산 1차전 선발이 불안해 한화가 근소하게 앞섭니다.",
    detailed_analysis:
      "선발과 타선이 엇갈리는 시리즈입니다. 예상 선발은 한화 에르난데스(ERA 4.21)·박준영(ERA 4.56)·왕옌청(ERA 3.74), 두산 타카다(ERA 11.42)·최민석(ERA 2.77)·벤자민(ERA 3.02)으로, 두산은 최민석·벤자민 두 경기 선발이 매우 안정적이지만 1차전 타카다가 평균 자책점 11점대로 크게 불안합니다. 한화는 박준영의 제구 난조(9이닝당 볼넷 8개)가 약점이지만 에르난데스·왕옌청이 받쳐줍니다. 타선은 한화 라인업(평균 .284, 출루율 .368, 장타력 .441)이 강백호·노시환·페라자의 장타력으로 두산 라인업(평균 .275, 출루율 .349, 장타력 .396)을 앞섭니다. 한화가 타카다가 나오는 1차전을 타선으로 가져가고 대전 홈 이점을 살린다면 2승 1패가 가능합니다. 두산 최민석·벤자민이 한화 타선을 묶으면 시리즈가 뒤집힐 수 있습니다."
  },
  {
    group: "early", start: "2026-06-23", end: "2026-06-25",
    home: "lotte", away: "nc",
    game_ids: ["192804c4-8e2f-4570-a940-2d80512ee86f", "3b8aa6f7-d0ac-48b8-adf3-9045240395b5", "f18adafa-535e-420b-a2c4-cd678206e84b"],
    label: "3연전",
    headline: "7위 NC와 8위 롯데가 사직에서 만나는 하위권 시리즈입니다.",
    pick: "nc", result: "winning", wins: 2, losses: 1, confidence: 0.55,
    key_factor: "라일리 구위 + NC 타선",
    one_liner: "NC 라일리가 9이닝당 탈삼진 12개의 압도적인 구위를 갖췄고 NC 타선도 롯데보다 출루와 장타가 앞서, 사직 원정이지만 NC가 시리즈를 가져갈 가능성이 높습니다.",
    detailed_analysis:
      "하위권 맞대결이지만 NC가 한 수 위로 보입니다. 예상 선발은 NC 라일리(ERA 3.74, K9 12.21)·테일러(ERA 4.48)·토다(ERA 4.73), 롯데 박세웅(ERA 4.84)·로드리게스(ERA 4.91)·이민석(ERA 5.34)으로, 라일리의 구위가 단연 돋보이고 NC 선발진 전체가 롯데보다 안정적입니다. 타선도 NC 라인업(평균 .285, 출루율 .370, 장타력 .422)이 김주원·박민우·이우성 중심으로 롯데 라인업(평균 .267, 출루율 .333, 장타력 .403)보다 출루와 콘택트에서 앞섭니다. 다만 롯데는 사직 홈이고 박세웅이 1차전을 버텨주면 한 경기는 가져갈 수 있습니다. NC의 선발·타선 우위에 무게를 둬 2승 1패를 예상하되, 양 팀 모두 기복이 큰 하위권이라 변동성은 인정합니다."
  },
  // ───── WEEKEND (6/26-6/28) ─────
  {
    group: "weekend", start: "2026-06-26", end: "2026-06-28",
    home: "samsung", away: "kt",
    game_ids: ["69d794fe-cd5b-4800-b4ed-13f992a346e8", "b19f6b71-333e-409d-ae7e-6b60a0c7aee1", "e7d8a692-6880-47a6-a788-9e09ec57017f"],
    label: "3연전",
    headline: "공동 선두 삼성과 2위 KT가 대구에서 만나는 상위권 시리즈입니다.",
    pick: "samsung", result: "winning", wins: 2, losses: 1, confidence: 0.56,
    key_factor: "원태인 + 대구 홈, KT 선발 불안",
    one_liner: "KT 타선이 강력하지만 1·2차전 선발 배제성과 신인 로건의 제구가 불안한 반면, 삼성은 에이스 원태인과 대구 홈을 앞세워 시리즈를 가져갈 가능성이 높습니다.",
    detailed_analysis:
      "상위권 맞대결로 박빙이 예상됩니다. 예상 선발은 삼성 장찬희(ERA 4.86)·양창섭(ERA 4.53)·원태인(ERA 3.57), KT 배제성(ERA 4.70, BB9 6.26)·로건(신인, 표본 적음)·고영표(ERA 4.38)로, KT는 1·2차전 배제성과 로건의 제구·검증이 불안하고 3차전 고영표가 가장 믿을 만합니다. 삼성은 에이스 원태인이 한 경기를 잡아줄 수 있습니다. 타선은 KT 라인업(평균 .307, 출루율 .389, 장타력 .430)이 삼성 라인업(평균 .288, 출루율 .380, 장타력 .427)보다 콘택트에서 앞서지만 차이는 크지 않습니다. 삼성이 대구 홈에서 KT의 불안한 1·2차전 선발을 공략한다면 2승 1패가 가능합니다. 고영표가 나오는 경기와 KT 타선의 폭발이 변수입니다."
  },
  {
    group: "weekend", start: "2026-06-26", end: "2026-06-28",
    home: "nc", away: "kiwoom",
    game_ids: ["081748e3-3ebd-417a-89b4-f25ae4d315e7", "e4348772-f858-46dd-8cab-12a2d18c4b49", "bf977f6a-ebf8-4843-b5fe-d29dca2fe884"],
    label: "3연전",
    headline: "7위 NC와 최하위 키움이 창원에서 만나는 시리즈입니다.",
    pick: "nc", result: "winning", wins: 2, losses: 1, confidence: 0.6,
    key_factor: "NC 타선 우위 + 창원 홈",
    one_liner: "NC 타선이 출루와 장타에서 키움을 앞서고 에이스 구창모가 한 경기를 책임지는 반면, 키움 타선은 장타력이 리그 최하위라 NC가 창원 홈에서 위닝 시리즈를 가져갈 전망입니다.",
    detailed_analysis:
      "NC가 전력에서 앞서는 시리즈입니다. 예상 선발은 NC 김준원(ERA 5.87, 표본 적음)·김태경(ERA 4.50)·구창모(ERA 3.51), 키움 로젠버그(ERA 4.80)·배동현(ERA 5.10)·하영민(ERA 4.50)으로, 구창모가 NC 선발 중 가장 믿을 만하고 1차전 김준원은 표본이 짧아 변수입니다. 승부는 타선에서 갈립니다. NC 라인업(평균 .285, 출루율 .370, 장타력 .422)이 김주원·박민우 중심으로 키움 라인업(평균 .253, 출루율 .331, 장타력 .341)을 출루·장타 모두 크게 앞섭니다. 키움은 장타력이 리그 최하위라 대량 득점이 어렵습니다. NC가 창원 홈에서 타선 우위를 살린다면 2승 1패가 유력합니다. 1차전 김준원이 무너지면 한 경기는 키움이 가져갈 수 있습니다."
  },
  {
    group: "weekend", start: "2026-06-26", end: "2026-06-28",
    home: "lotte", away: "lg",
    game_ids: ["488a8f3b-f5b9-4420-83fd-c344ad35fd97", "1db24bad-97af-4686-803b-85251981544e", "e5b81bbf-9d57-4058-8056-6471e1384b3e"],
    label: "3연전",
    headline: "1위 LG와 8위 롯데가 사직에서 만나는 상하위 시리즈입니다.",
    pick: "lg", result: "winning", wins: 2, losses: 1, confidence: 0.6,
    key_factor: "웰스 선발 우위 + LG 타선",
    one_liner: "LG 에이스 웰스가 평균 자책점 2점대 중반의 정상급 선발이고 LG 타선도 롯데보다 출루가 앞서, 사직 원정이지만 LG가 위닝 시리즈를 가져갈 가능성이 높습니다.",
    detailed_analysis:
      "전력 격차가 있는 시리즈입니다. 예상 선발은 LG 웰스(ERA 2.47)·장현식(ERA 4.24)·톨허스트(ERA 4.03), 롯데 나균안(ERA 3.86)·비슬리(ERA 4.63)·김진욱(ERA 3.33)으로, 에이스 웰스가 한 경기를 확실히 잡아줄 수 있고 롯데도 나균안·김진욱이 나쁘지 않아 한 경기는 가져갈 만합니다. 타선은 LG 라인업(평균 .279, 출루율 .377, 장타력 .409)이 홍창기·오스틴·문보경 중심으로 롯데 라인업(평균 .267, 출루율 .333, 장타력 .403)보다 출루에서 앞섭니다. LG가 시즌 1위 전력에 웰스의 우위를 살린다면 사직 원정이라도 2승 1패가 유력합니다. 롯데가 사직 홈에서 김진욱·나균안으로 두 경기를 버티면 접전이 됩니다."
  },
  {
    group: "weekend", start: "2026-06-26", end: "2026-06-28",
    home: "doosan", away: "kia",
    game_ids: ["6b85d69f-c7fb-42f2-9d24-65bcb36d189d", "e86293d8-8308-44d3-9592-ed0954400bef", "2d2bd0a9-d988-4ecc-b99f-9a4a5d6780da"],
    label: "3연전",
    headline: "2위 KIA와 5위 두산이 잠실에서 만나는 시리즈입니다.",
    pick: "doosan", result: "winning", wins: 2, losses: 1, confidence: 0.53,
    key_factor: "곽빈 구위 + 잠실 홈",
    one_liner: "KIA 타선이 장타력에서 앞서지만, 두산 에이스 곽빈이 9이닝당 탈삼진 11개의 구위로 1차전을 잡아주고 잠실 홈 이점까지 더해 두산이 근소하게 앞섭니다.",
    detailed_analysis:
      "박빙이 예상되는 시리즈입니다. 예상 선발은 두산 곽빈(ERA 3.12, K9 10.96)·잭로그(ERA 4.44)·최승용(ERA 5.46), KIA 황동하(ERA 4.14)·김태형(ERA 5.63)·시라카와(ERA 4.82)로, 두산 곽빈의 구위가 단연 돋보이고 KIA 선발진은 세 명 모두 평균 자책점이 다소 높고 피홈런이 잦은 편입니다. 타선은 KIA 라인업(평균 .276, 출루율 .357, 장타력 .424)이 김도영·나성범의 장타력으로 두산 라인업(평균 .275, 출루율 .349, 장타력 .396)보다 한 방에서 앞섭니다. 결국 곽빈이 나오는 1차전과 잠실 홈 이점이 승부를 가른다고 봅니다. 두산이 곽빈으로 1차전을 잡고 한 경기를 더 가져가면 2승 1패가 가능하지만, KIA 타선이 두산 3·4선발을 공략하면 곧장 뒤집힐 수 있는 동전 던지기에 가깝습니다."
  },
  {
    group: "weekend", start: "2026-06-26", end: "2026-06-28",
    home: "ssg", away: "hanwha",
    game_ids: ["0e10d435-da21-4ab6-bd02-c8cb3c65d68b", "f90ad383-5a19-4219-9452-332561028d4a", "31fd9a05-ccd1-46c2-8d3f-60f633f73cf9"],
    label: "3연전",
    headline: "3위 한화와 5위 SSG가 문학에서 만나는 시리즈입니다.",
    pick: "hanwha", result: "winning", wins: 2, losses: 1, confidence: 0.62,
    key_factor: "류현진·화이트 선발 우위 + 한화 장타",
    one_liner: "한화 류현진·화이트의 선발이 안정적인 반면 SSG 선발진은 평균 자책점이 모두 5점대를 넘어, 강백호·노시환의 장타력을 갖춘 한화가 문학 원정에서도 시리즈를 가져갈 전망입니다.",
    detailed_analysis:
      "한화가 선발에서 크게 앞서는 시리즈입니다. 예상 선발은 한화 화이트(ERA 3.65)·류현진(ERA 2.74)·에르난데스(ERA 4.21), SSG 해치(ERA 6.30, 표본 적음)·최민준(ERA 4.84)·김민준(ERA 7.88, 표본 적음)으로, 류현진·화이트가 두 경기를 안정적으로 잡아줄 수 있는 반면 SSG는 해치·김민준의 검증이 부족하고 최민준도 제구가 불안합니다. 타선은 한화 라인업(평균 .284, 출루율 .368, 장타력 .441)이 강백호·노시환·페라자의 장타력으로 SSG 라인업(평균 .279, 출루율 .359, 장타력 .429)을 근소하게 앞섭니다. 한화가 류현진·화이트의 선발 우위를 살린다면 문학 원정이라도 2승 1패가 유력합니다. SSG가 최정·에레디아·김재환의 장타로 한화 불펜을 흔들면 한 경기는 가져갈 수 있습니다."
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
