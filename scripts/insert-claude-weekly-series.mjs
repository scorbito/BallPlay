// 2026-06-08 주 (6/9-6/14) Claude 주간 시리즈 예측 10건 INSERT.
// 가이드: docs/ai-weekly-series-prediction-guide.md
// 페르소나 없이 자유 분석.

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

const WEEK_START = "2026-06-08";
const PUBLISHED_AT = "2026-06-08T09:00:00+09:00";
const MODEL = "claude-opus-4-8";

const series = [
  // ───── EARLY (6/9-6/11) ─────
  {
    group: "early",
    start: "2026-06-09",
    end: "2026-06-11",
    home: "lotte",
    away: "doosan",
    game_ids: [
      "cf3ad074-cf17-40f7-8c5d-4974ab453149",
      "2d6545fd-ffb7-44aa-b409-e5b658ffabe4",
      "dc15d5fc-edfd-4129-8011-e85e752344aa"
    ],
    label: "3연전",
    headline: "5할 도달 두산과 3연패에서 막 벗어난 롯데가 사직에서 만납니다.",
    pick: "doosan",
    result: "winning",
    wins: 2,
    losses: 1,
    confidence: 0.55,
    key_factor: "선발 안정감",
    one_liner: "두산이 벤자민·최민석 중심 선발 안정감에서 한 끗 앞서지만 사직 홈과 비슬리·박세웅 카드를 안고 있는 롯데와의 박빙 시리즈가 예상됩니다.",
    detailed_analysis:
      "두산은 어제 안우진을 맹폭하며 시즌 처음 승률 5할에 도달, 라인업(평균 .265, 출루율 .357, 삼진 비율 14.5%)이 KBO 최강 콘택트 그룹으로 정점에 올라 있습니다. 박찬호·정수빈·카메론·양의지 톱4 폼이 살아 있고, 벤자민(ERA 2.61, WHIP 1.35)·최민석(ERA 3.29)·잭로그 중심 선발진 안정감이 시리즈 전체에서 두산 쪽으로 무게를 옮깁니다. 롯데는 정반대 상황. 최근 3연패 수렁에 어제 한화전 2-9 대패로 분위기가 무거운 상태이고, 라인업(평균 .254, 출루율 .316) 길이가 6번 이후 OPS .650 안팎으로 끊깁니다. 다만 사직 홈 + 비슬리(K9 10.71)·박세웅 같은 검증된 선발 카드가 1경기 정도는 가져갈 가능성이 충분합니다. 황성빈·고승민·레이예스·나승엽 톱4가 짧은 표본의 영건 선발 만나면 다타선 모드가 가능한 점도 변수. 결론적으로 두산이 2승, 사직 홈 변수와 비슬리 등판일 1패 가능성을 인정해 2-1 위닝 시리즈로 봅니다."
  },
  {
    group: "early",
    start: "2026-06-09",
    end: "2026-06-11",
    home: "kt",
    away: "samsung",
    game_ids: [
      "d455847a-e366-4627-bc16-a8d9ef01d2ac",
      "3747cd83-415d-45fd-a780-aeb31f8b0535",
      "df9b612f-0212-4561-a0c7-f09259a7dddc"
    ],
    label: "3연전",
    headline: "공동 선두 다툼에서 1.5게임 차로 추격 중인 KT와 1위 삼성의 정면 승부입니다.",
    pick: "kt",
    result: "winning",
    wins: 2,
    losses: 1,
    confidence: 0.55,
    key_factor: "콘택트 타선 + 홈",
    one_liner: "KT 타선이 시즌 평균 .314·출루율 .403의 KBO 최상위 콘택트 그룹이고 수원 홈 이점까지 더해 1.5게임 차 추격 흐름이 시리즈를 가져옵니다.",
    detailed_analysis:
      "시즌 순위표상 두 팀이 가장 강한 충돌입니다. KT(34-23, 0.596) 가 1위 삼성(45-30, 0.600) 을 1.5게임 차로 추격하는 상황이라 시리즈 자체가 순위 변동의 분기점. 라인업으로는 KT(평균 .314, 출루율 .403, 삼진 비율 16.6%) 가 KBO 최상위 콘택트 그룹으로 누적 화력이 더 깊고, 최원준·김현수·김민혁·힐리어드·허경민 톱5의 안정성이 단일 경기 분산도를 줄입니다. 삼성(평균 .283, 장타력 .434) 도 김지찬·구자욱·디아즈·최형우 클린업이 폭발력에서 우위이지만 어제 KIA 에 0-7 완패로 분위기가 한 끗 다운된 상태. 선발 매치업은 양 팀 모두 사우어·고영표 vs 후라도·원태인급 카드를 풀어 호각, 1선발 매치업이면 KT 가 어떤 카드를 올리든 6이닝 이상 책임지는 안정성이 높습니다. 수원 홈 이점 + 콘택트 우위 + 추격 동기까지 KT 쪽으로 일관되게 기울어 2-1 위닝 시리즈로 봅니다. 단, 라팍이 아닌 수원 홈이라 삼성 장타력 폭발이 1경기 한정으로 나타날 가능성을 인정해 confidence 0.55."
  },
  {
    group: "early",
    start: "2026-06-09",
    end: "2026-06-11",
    home: "hanwha",
    away: "kia",
    game_ids: [
      "d6c9efc1-38c4-4aae-8e36-298d42c10b62",
      "f43c0c1a-dac6-4fc3-9fbe-c4703ec1987d",
      "33e581be-4b60-424c-b038-ddd751794b12"
    ],
    label: "3연전",
    headline: "어제 롯데에 9-2 대승한 한화와 어제 삼성을 7-0 완파한 KIA의 상위권 격돌입니다.",
    pick: "hanwha",
    result: "winning",
    wins: 2,
    losses: 1,
    confidence: 0.55,
    key_factor: "다이너마이트 타선 + 대전 홈",
    one_liner: "한화 페라자·노시환·강백호 클린업이 어제 9-2 대승으로 폼 정점에 올라 있고 대전 만원 관중 분위기까지 더해 KIA 와의 상위권 격돌에서 한 끗 우위를 만듭니다.",
    detailed_analysis:
      "양 팀 모두 어제 대승으로 분위기가 정점인 상위권 시리즈입니다. 한화는 어제 사직에서 류현진 호투 + 페라자 맹타로 롯데를 9-2 완파, 라인업(평균 .274, 출루율 .356, 장타력 .429) 의 페라자·문현빈·노시환·허인서·강백호(복귀 가정) 라인업 폼이 살아 있습니다. 류현진 7승 + 에르난데스 안정대 + 화이트 복귀로 선발진 깊이가 시즌 들어 가장 두꺼운 시점. 대전 한화생명파크 25번째 전석 매진 이슈가 보여주듯 홈 분위기가 가장 큰 무기. KIA(평균 .267, 장타력 .438, ISO .172) 도 어제 올러 7이닝 무실점에 김도영·나성범 클린업 폼으로 삼성을 7-0 완파, 네일·황동하·올러로 이어지는 외인+토종 트리오가 강력합니다. 다만 김도영·아데를린 클린업이 우완 매치업에서 한화 좌완 라인(류현진·에르난데스 좌우)의 변동성에 노출되는 점이 변수. 두 팀 모두 폼·라인업이 비슷한 수준이라 박빙 시리즈가 예상되지만 대전 홈 + 류현진 카드 매치업 우위 + 어제 대승의 자신감으로 한화 2-1 위닝, confidence 0.55."
  },
  {
    group: "early",
    start: "2026-06-09",
    end: "2026-06-11",
    home: "kiwoom",
    away: "nc",
    game_ids: [
      "c83b23f9-3a85-45ee-b35e-ff854a113c95",
      "4cd88a7e-31d9-4a49-a777-01329a19eef2",
      "00c401fe-f900-463a-9e9b-7e8e06ea7997"
    ],
    label: "3연전",
    headline: "최하위 키움과 7위로 반등 중인 NC의 하위권 시리즈가 고척에서 열립니다.",
    pick: "nc",
    result: "winning",
    wins: 2,
    losses: 1,
    confidence: 0.56,
    key_factor: "라일리 + 어제 역전승 흐름",
    one_liner: "NC 가 어제 LG 를 역전승으로 잡으며 김주원·박민우·박건우 라인업 폼이 살아났고, KBO 최하위 키움(0.369) 상대 고척 원정이지만 라일리·테일러 외인 카드 안정감으로 위닝 시리즈를 잡을 가능성이 높습니다.",
    detailed_analysis:
      "순위표상 격차가 가장 큰 시리즈입니다. NC(25-31, 0.446) 가 7위이고 키움(24-41, 0.369) 이 10위 최하위. 표면 격차는 약 8게임이지만 NC 가 어제 LG 와의 역전승으로 분위기가 살아난 점이 결정적입니다. 라인업(평균 .277, 출루율 .363, 장타력 .409) 이 시즌 누적보다 한 단계 올라온 흐름이고 김주원·박민우·박건우·권희동 톱4 폼이 정점. 외인 라일리·테일러 중심 선발진도 5이닝 이상 책임지는 안정성을 회복했습니다. 키움은 정반대. 4월부터 누적된 최하위 흐름이 단일 시리즈로 뒤집기 어려운 구조이고, 라인업(평균 .257, 장타력 .453) 의 ISO .197 장타력이 표본 짧은 영건들의 변동성에 더 가깝습니다. 안우진(어제 두산 맹폭당함)·알칸타라 카드를 묶어 1경기 정도 가져갈 가능성은 충분하지만 시리즈 전체 흐름을 가져가기엔 화력과 분위기 모두 부족. 고척 돔구장 홈 이점이 NC 의 강한 햇볕 영향력을 줄이는 변수지만 그래도 NC 2-1 위닝, confidence 0.56."
  },
  {
    group: "early",
    start: "2026-06-09",
    end: "2026-06-11",
    home: "lg",
    away: "ssg",
    game_ids: [
      "583ecf6c-f87f-4c68-87e6-29add37a77fa",
      "bec1a2b0-735b-4d43-b642-933a79830ac0",
      "b767faa4-6a37-4a6e-b698-4b73355e5c68"
    ],
    label: "3연전",
    headline: "공동 1위 LG 와 13연패 뒤 3연승으로 회복 중인 SSG 의 잠실 시리즈입니다.",
    pick: "lg",
    result: "winning",
    wins: 2,
    losses: 1,
    confidence: 0.58,
    key_factor: "톱4 출루 + 잠실 홈",
    one_liner: "LG 가 시즌 1위(0.621)에 톱4 출루율 .380 의 라인업 깊이를 가졌고 잠실 홈에서 웰스·톨허스트 중심 외인 카드까지 안정적이라 13연패 후 회복 중인 SSG 와의 시리즈를 가져옵니다.",
    detailed_analysis:
      "순위표상 격차가 두드러지는 시리즈입니다. LG(36-22, 0.621) 가 1위, SSG(37-30, 0.552) 가 5위로 5게임 차. 다만 SSG 가 13연패 끝에 3연승으로 회복 중이고 라인업(평균 .275, 출루율 .356, 삼진 비율 14.9%) 의 콘택트 강점이 살아나는 흐름이라 일방적이지는 않습니다. 최정·김재환·에레디아·박성한 라인업 폼이 점차 살아나는 단계. 그래도 LG 의 안정성이 시리즈 무게를 가져갑니다. 라인업(평균 .280, 출루율 .378, 삼진 비율 17.6%) 이 KBO 상위급 출루·콘택트 균형 그룹이고 홍창기·박해민·오스틴·문보경·오지환 톱5의 라인업 길이가 깊은 게 강점. 선발 매치업도 톨허스트(ERA 3.24)·웰스(시즌 ERA 2점대)·송승기·임찬규로 이어지는 LG 외인+토종 5인 로테이션이 SSG 의 김건우·베니지아노·타케다급 선발 풀보다 한 단계 위. 잠실 홈 + 1위 동기 부여 + 선발 깊이로 LG 2-1 위닝. SSG 가 회복 흐름이라 스윕 가능성은 낮춰 confidence 0.58."
  },
  // ───── WEEKEND (6/12-6/14) ─────
  {
    group: "weekend",
    start: "2026-06-12",
    end: "2026-06-14",
    home: "kt",
    away: "nc",
    game_ids: [
      "3ef375b1-e6b2-4c16-afd2-afe58171a705",
      "1c40f8da-c72d-4d15-ba44-21abe5eaf55b",
      "06427010-5838-4edc-8409-ffbfcbcfbdaf"
    ],
    label: "3연전",
    headline: "2위 KT 와 7위 NC 가 수원에서 만나는 상하위권 격돌입니다.",
    pick: "kt",
    result: "winning",
    wins: 2,
    losses: 1,
    confidence: 0.6,
    key_factor: "콘택트 + NC 삼진율 약점",
    one_liner: "KT 가 시즌 평균 .314 의 KBO 최강 콘택트 라인업이고 NC 의 시즌 삼진 비율 28.7% 가 KBO 최고치 약점이라 수원 홈에서 KT 가 위닝 시리즈로 가져갈 가능성이 높습니다.",
    detailed_analysis:
      "KT(34-23, 0.596) 와 NC(25-31, 0.446) 의 시즌 격차가 약 6게임으로 분명한 우열 구도입니다. 라인업 격차가 결정적. KT(평균 .314, 출루율 .403, 삼진 비율 16.6%) 가 KBO 최상위 콘택트 그룹이고 NC(평균 .250 시즌 누적, K% 28.7) 는 KBO 최고 삼진 비율이 약점이라 KT 선발진의 평이한 K9 카드(고영표·사우어·오원석) 로도 충분히 흔들 수 있습니다. NC 는 최근 라일리·테일러 중심으로 선발이 살아 있고 김주원·박민우·박건우 라인업이 회복 중이지만 표본이 짧고 KT 콘택트 그룹 상대 K% 우위가 작아지는 그림. KT 는 수원 홈 + 1위 추격 동기까지 일관되게 우세. NC 의 분위기 회복은 인정해 스윕은 아니고 2-1 위닝, confidence 0.6."
  },
  {
    group: "weekend",
    start: "2026-06-12",
    end: "2026-06-14",
    home: "lg",
    away: "lotte",
    game_ids: [
      "d04b22e1-290e-4c94-b4c4-2a244d2334be",
      "4059bbf9-a27e-4add-92ba-b13e7bfc292b",
      "09e0f80d-41dd-4463-990a-93d3a3ad3229"
    ],
    label: "3연전",
    headline: "1위 LG 와 9위 롯데가 잠실에서 만나는 상하위 격돌입니다.",
    pick: "lg",
    result: "winning",
    wins: 2,
    losses: 1,
    confidence: 0.62,
    key_factor: "선발 깊이 + 홈",
    one_liner: "LG 의 외인+토종 5선발 안정성이 롯데의 비슬리 1선발 의존도를 한 단계 압도하고 잠실 홈에서 시즌 1위 흐름이 그대로 이어진다는 판단으로 위닝 시리즈를 봅니다.",
    detailed_analysis:
      "LG(36-22, 0.621) 와 롯데(28-31-7, 0.475) 의 격차가 시즌 누적상 9게임 안팎으로 가장 큰 시리즈 중 하나입니다. 선발진 깊이가 결정적. LG 는 톨허스트·웰스·임찬규·송승기·치리노스(리오스 합류 가정) 로 5선발 모두 5이닝 이상 책임지는 안정형 로테이션이고 롯데는 비슬리(K9 10.71) 1선발 의존도가 너무 큽니다. 박세웅·로드리게스·나균안·김진욱·이민석 풀에서 박세웅 외 나머지는 ERA 5~8점대 변동성이 큰 카드라 시리즈 3경기 중 1경기는 LG 가 큰 점수 차이로 가져갈 가능성. 라인업도 LG(평균 .280, 출루율 .378) 가 롯데(평균 .254, 출루율 .316) 보다 출루·콘택트 모두 우위. 다만 황성빈·고승민·레이예스·나승엽 톱4 폼은 살아 있어 1경기 정도는 빅이닝으로 가져갈 가능성을 인정해 LG 2-1 위닝, confidence 0.62. 스윕 가능성도 검토했지만 잠실 홈 + 박빙 도시 시리즈 변동성을 인정해 위닝으로 마무리."
  },
  {
    group: "weekend",
    start: "2026-06-12",
    end: "2026-06-14",
    home: "samsung",
    away: "ssg",
    game_ids: [
      "d648060d-5d19-4590-99d1-9736852838e8",
      "c7d96f93-39e6-4562-ba8d-12979e4d0e9f",
      "9904dc32-7256-4402-bc69-afd1941cb8dd"
    ],
    label: "3연전",
    headline: "1위 삼성과 5위 SSG 가 라팍에서 만나는 상위권 시리즈입니다.",
    pick: "samsung",
    result: "winning",
    wins: 2,
    losses: 1,
    confidence: 0.58,
    key_factor: "라팍 장타력 + 후라도",
    one_liner: "삼성 라인업이 시즌 평균 .307·장타력 .472 의 KBO 최상위 화력이고 라팍 홈 + 후라도·원태인·오러클린 1~3선발 카드 안정성으로 SSG 회복 흐름을 누른다고 봅니다.",
    detailed_analysis:
      "삼성(45-30-2, 0.600) 과 SSG(37-30-3, 0.552) 의 격차가 5게임 안팎으로 분명하지만 SSG 가 13연패 후 3연승으로 회복 중이라 단순 격차로 단정할 수는 없습니다. 그래도 삼성 쪽 우위가 분명. 라인업(평균 .307, 출루율 .390, 장타력 .472) 이 KBO 최상위 화력 그룹이고 김지찬·구자욱·디아즈·최형우·박승규 톱5 의 좌·우 분포 균형이 시즌 내내 유지된 강점입니다. 라팍 홈 이점까지 더해지면 장타력 폭발이 시리즈 1~2경기에서 자연스럽게 나오는 그림. 선발진도 후라도·원태인·오러클린·양창섭·최원태 5인 로테이션이 SSG 의 김건우·베니지아노·타케다 풀보다 한 단계 위. SSG 는 최정·김재환·에레디아 클린업이 살아나는 흐름이라 1경기 정도는 충분히 가져갈 수 있어 스윕은 아니고 삼성 2-1 위닝, confidence 0.58."
  },
  {
    group: "weekend",
    start: "2026-06-12",
    end: "2026-06-14",
    home: "kiwoom",
    away: "hanwha",
    game_ids: [
      "e83810dc-429e-4fcd-b19f-3605d2c18fda",
      "02f82ff8-3d1e-46d4-9b18-221ec0961a3a",
      "b8065d15-4b6e-4b74-a29c-155969d0e90d"
    ],
    label: "3연전",
    headline: "3위 한화와 최하위 키움이 고척에서 만나는 상하위 시리즈입니다.",
    pick: "hanwha",
    result: "winning",
    wins: 2,
    losses: 1,
    confidence: 0.62,
    key_factor: "다이너마이트 타선 + 선발 깊이",
    one_liner: "한화 류현진·에르난데스·화이트 중심 외인+토종 선발 깊이와 페라자·노시환·강백호 다이너마이트 타선이 KBO 최하위 키움(0.369) 상대 위닝 시리즈로 이어진다는 판단입니다.",
    detailed_analysis:
      "한화(42-32-2, 0.568) 가 3위이고 키움(24-41-1, 0.369) 이 10위 최하위. 시즌 격차가 약 13게임으로 가장 큰 시리즈 중 하나입니다. 라인업 격차가 결정적. 한화(평균 .274, 출루율 .356, 장타력 .429) 의 페라자·문현빈·노시환·강백호·허인서 클린업이 KBO 상위급 화력이고 류현진 7승 + 에르난데스 안정대 + 화이트 복귀로 선발진 깊이가 시즌 들어 가장 두꺼운 시점. 키움은 라인업(시즌 평균 .231) 의 KBO 최하위 화력이 큰 약점이고 안우진(어제 두산 맹폭) 외 선발 풀이 평이형. 다만 알칸타라(ERA 3.18) 등판일에는 1경기 정도 가져갈 가능성이 있고 히우라 합류 후 라인업 화력이 일부 회복된 점도 변수. 고척 돔 + 안우진 또는 알칸타라 카드에서 1패를 안고 한화 2-1 위닝, confidence 0.62."
  },
  {
    group: "weekend",
    start: "2026-06-12",
    end: "2026-06-14",
    home: "kia",
    away: "doosan",
    game_ids: [
      "d2decbec-d083-444d-855e-5deaccd3a94d",
      "d615e13c-62b1-4aea-9643-78b52c5f8a2e",
      "ffdffa7a-22b0-418c-adc4-e816f6235407"
    ],
    label: "3연전",
    headline: "2위 KIA 와 5할 진입 두산이 광주에서 만나는 시리즈입니다.",
    pick: "kia",
    result: "winning",
    wins: 2,
    losses: 1,
    confidence: 0.58,
    key_factor: "올러·네일 + 광주 홈",
    one_liner: "KIA 의 올러(ERA 2.63)·네일·황동하 외인+토종 1~3선발 카드가 두산의 벤자민·최민석·잭로그 풀보다 한 단계 위이고 광주 홈에서 김도영·나성범 클린업 폼이 시리즈를 가져온다고 봅니다.",
    detailed_analysis:
      "KIA(44-31-1, 0.587) 와 두산(29-28-2, 0.509) 의 격차가 5게임 안팎인데 두산이 어제 안우진을 맹폭하며 5할에 도달한 흐름이라 시리즈 무게가 일방적이지는 않습니다. 다만 KIA 쪽 안정성이 시리즈를 가져갑니다. 선발진은 올러(ERA 2.63, WHIP 0.97) 가 KBO 1선발급으로 단독 우위, 네일·황동하·양현종·시라카와(복귀 가정) 로 5선발이 채워져 깊이가 두텁습니다. 두산도 벤자민(ERA 2.61)·최민석 안정형 카드를 갖췄지만 5선발 풀에서 잭로그·박신지 변동성이 크고 KIA 라인업의 ISO .172 장타력에 흔들릴 가능성. 라인업도 KIA(평균 .267, 장타력 .438, ISO .172) 가 박재현·김도영·나성범·아데를린 클린업의 장타력에서 두산(평균 .265, 장타력 .379) 보다 한 단계 위. 광주 홈 + 외인 1선발 카드 + 라인업 깊이로 KIA 2-1 위닝, confidence 0.58. 두산 벤자민 등판일은 KIA 가 잡기 어려운 그림이라 스윕은 배제."
  }
];

console.log(`Inserting ${series.length} weekly series + ${series.length} Claude predictions for week ${WEEK_START}...`);

let okCount = 0;
let failCount = 0;

for (const s of series) {
  // 1) UPSERT series row, return series_id
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

  // 2) UPSERT Claude prediction with that series_id
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
