// 2026-07-27 주 (7/28-8/2) Claude 주간 시리즈 예측 10건 UPSERT. (주중 5 + 주말 5)
// 가이드: docs/ai-weekly-series-prediction-guide.md
// 페르소나 없이 자유 분석. 선발 로테이션은 최근 등판일 + 4~5일 휴식 역산(우천순연 보정) 추정.
// v2 원칙: 최근 10경기 폼 우선(키움 +14 상승 / LG -30 붕괴 / KT 8승1패), 대표본 결함만 신뢰.
// 시리즈 row/headline 은 GPT 소관 → 기존 series_id 조회 후 claude 예측만 upsert.

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

const WEEK_START = "2026-07-27";
// ⚠️ INSERT 직전 확인: 현재 세션 모델과 일치하는가? (Fable 5)
const MODEL = "claude-fable-5";

const series = [
  // ===== EARLY (7/28-7/30) =====
  {
    group: "early", home: "hanwha", away: "lotte",
    pick: "hanwha", result: "winning", wins: 2, losses: 1, confidence: 0.56,
    key_factor: "한화 선발 우위 + 홈",
    one_liner:
      "한화가 화이트를 앞세운 안정된 선발진과 대전 홈, 어제 대승으로 살아난 타선을 앞세워 앞섭니다. 롯데도 로드리게스·박세웅의 선발로 맞서지만 전체 흐름은 한화 2승 1패로 봅니다.",
    detailed_analysis:
      "선발과 홈에서 한화가 앞서는 시리즈입니다. 예상 선발은 한화 화이트(ERA 3.09)·왕옌청(ERA 3.69)·박준영(ERA 5.23), 롯데 박세웅(ERA 4.58)·로드리게스(ERA 4.29)·나균안(ERA 4.07)으로, 1·2차전 매치업에서 한화가 앞서고 3차전 박준영의 피홈런(HR9 2.18)이 약점입니다. 왕옌청은 이탈설 보도가 있었으나 최근 등판을 소화해 로테이션 유지로 봤고, 변동 시 엔도가 대체할 수 있습니다. 최근 폼은 한화가 어제 짐머맨의 데뷔전 승리(14-4)로 반등했고, 롯데(최근 3승 7패)도 어제 15득점으로 타격감을 회복해 타선끼리는 만만치 않습니다. 한화는 노시환·페라자·문현빈의 장타와 대전 홈 이점이 있습니다. 한화의 선발 우위와 홈에 무게를 둬 2승 1패를 예상합니다. 롯데 타선의 반등 화력이 이어지면 시리즈가 팽팽해질 수 있습니다. (로테이션은 공식 예고 전 추정으로 변동 가능성이 있습니다.)"
  },
  {
    group: "early", home: "nc", away: "kt",
    pick: "kt", result: "winning", wins: 2, losses: 1, confidence: 0.59,
    key_factor: "KT 최강 폼 + NC 최다 실점",
    one_liner:
      "KT가 최근 10경기 8승 1패 1무의 리그 최강 흐름과 출루율 1위 타선을 앞세워 원정에서도 앞섭니다. NC는 구창모·토다가 버티는 홈 3연전이지만 최근 실점이 리그 최다 수준이라 KT 2승 1패로 봅니다.",
    detailed_analysis:
      "흐름 격차가 뚜렷한 시리즈입니다. KT는 최근 10경기 8승 1패 1무(득실 +14)로 어제 롯데전 대패에도 리그 최강의 흐름이고, 출루율 리그 1위의 타선과 안정된 불펜을 갖췄습니다. NC는 최근 3승 6패 1무에 10경기 실점 66점으로 리그에서 가장 많이 내주고 있습니다. 예상 선발은 KT 고영표(ERA 4.43, 볼넷 리그 최소 수준)·로건(ERA 3.33)·소형준(ERA 3.09), NC 테일러(ERA 4.13)·구창모(ERA 3.61)·토다(ERA 5.03)로, 1·3차전은 KT가 앞서고 2차전 구창모 등판 경기가 NC의 승부처입니다. KT의 폼·타선 우위에 무게를 둬 2승 1패를 예상합니다. 구창모가 흐름을 끊고 창원 홈에서 NC 타선이 살아나면 접전이 될 수 있습니다. (로테이션은 추정으로 변동 가능성이 있습니다.)"
  },
  {
    group: "early", home: "ssg", away: "doosan",
    pick: "doosan", result: "winning", wins: 2, losses: 1, confidence: 0.58,
    key_factor: "두산 선발 3장 최강 + SSG 하위 선발",
    one_liner:
      "두산이 벤자민·최민석·잭로그로 이어지는 이번 주 최강급 선발 3장을 문학에 투입합니다. SSG 타선이 마드리스 가세 후 뜨겁지만 김민준·해치의 선발 열세가 커서 두산 2승 1패로 봅니다.",
    detailed_analysis:
      "선발 깊이 격차가 이번 주 시리즈 중 가장 큰 카드입니다. 예상 선발은 두산 벤자민(ERA 2.71)·최민석(ERA 2.19)·잭로그(ERA 4.06)로 세 명 모두 안정적이고, 특히 벤자민·최민석은 리그 최상위권입니다. SSG는 아빌라(데뷔 후 호투)·김민준(ERA 4.18, BB9 5.25)·해치(ERA 7.62)로 아빌라를 빼면 열세가 뚜렷합니다. 타선은 SSG가 마드리스 가세 후 최근 화력(직전 6경기 평균 6점대)이 살아났고 문학 홈 이점이 있지만, 두산도 최근 10경기 6승 3패 1무(+14)에 어제 곽빈의 7-0 완승으로 흐름이 좋습니다. 두산의 선발 3장 우위에 무게를 둬 2승 1패를 예상합니다. 아빌라 등판 경기를 SSG가 잡고 상승세 타선이 두산 선발을 흔들면 시리즈가 팽팽해질 수 있습니다. (로테이션은 추정으로 변동 가능성이 있습니다.)"
  },
  {
    group: "early", home: "lg", away: "kiwoom",
    pick: "kiwoom", result: "winning", wins: 2, losses: 1, confidence: 0.55,
    key_factor: "키움 3연승 상승세 + LG 1승 9패 붕괴",
    one_liner:
      "키움이 알칸타라·안우진의 선발과 3연승의 상승세를 앞세우는 반면, LG는 최근 10경기 1승 9패에 득실차 -30으로 무너진 상태입니다. 최하위의 원정이지만 흐름은 키움 2승 1패로 봅니다.",
    detailed_analysis:
      "순위표와 최근 흐름이 정반대인 시리즈입니다. LG는 시즌 상위권이지만 최근 10경기 1승 9패(득실 -30)로 리그에서 가장 깊은 침체이고, 키움은 최하위지만 3연승(KIA 2연파 포함)에 최근 10경기 6승 3패 1무(+14)로 가장 뜨거운 팀 중 하나입니다. 예상 선발은 키움 알칸타라(ERA 3.47, 볼넷 리그 최소)·하영민(ERA 4.35)·안우진(ERA 3.48, 탈삼진 리그 최상위), LG 톨허스트(ERA 4.21)·웰스(ERA 3.30)·임찬규(ERA 4.08)로, 1·3차전은 키움이 근소 우위이고 2차전 웰스가 LG의 승부처입니다. 데이비슨 중심의 키움 타선이 최근 경기당 6점 이상을 내는 반면 LG 타선은 침묵과 폭발을 오가며 불안정합니다. 키움의 흐름·선발 우위에 무게를 둬 2승 1패를 예상합니다. LG가 잠실에서 웰스 등판 경기를 잡고 반등의 계기를 만들면 뒤집힐 수 있습니다. (로테이션은 추정으로 변동 가능성이 있습니다.)"
  },
  {
    group: "early", home: "samsung", away: "kia",
    pick: "samsung", result: "winning", wins: 2, losses: 1, confidence: 0.55,
    key_factor: "삼성 폼·홈 + 시라카와 결함",
    one_liner:
      "선두 삼성과 2위 KIA의 맞대결로, 삼성이 최근 7승 3패의 폼과 대구 홈, 페덱의 가세를 앞세워 근소하게 앞섭니다. KIA는 1차전 올러가 확실한 카드지만 2차전 시라카와의 제구 불안이 약점이라 삼성 2승 1패로 봅니다.",
    detailed_analysis:
      "1위 다툼이 걸린 팽팽한 시리즈입니다. 예상 선발은 KIA 올러(ERA 2.52)·시라카와(ERA 5.17, BB9 5.75)·네일(ERA 3.69), 삼성 양창섭(ERA 4.07)·페덱(데뷔전 압도)·원태인(ERA 4.01)입니다. 1차전은 올러가 확실한 KIA 우위, 2차전은 시라카와의 대표본 제구 붕괴(9이닝당 볼넷 5.75)와 페덱의 가세로 삼성 우위, 3차전 네일-원태인은 팽팽합니다. 최근 폼은 삼성이 7승 3패(+15)로 좋고, KIA는 키움에 연패하며 5승 5패(+1)로 주춤합니다. 타선은 삼성이 김지찬·구자욱 중심의 리그 최고 콘택트 그룹으로 삼진이 가장 적어, 볼넷이 많은 시라카와를 공략하기 좋은 유형입니다. 삼성의 폼·홈·타선에 무게를 둬 2승 1패를 예상합니다. 올러가 1차전을 잡고 네일이 3차전을 가져가면 KIA가 위닝을 만들 수 있는 접전입니다. (로테이션은 추정으로 변동 가능성이 있습니다.)"
  },
  // ===== WEEKEND (7/31-8/2) =====
  {
    group: "weekend", home: "nc", away: "kia",
    pick: "kia", result: "winning", wins: 2, losses: 1, confidence: 0.53,
    key_factor: "올러 마무리 카드 + NC 실점 급증",
    one_liner:
      "KIA가 양현종·황동하에 마지막 경기 올러까지 이어지는 로테이션과 2위의 전력으로 근소하게 앞섭니다. NC는 라일리·구창모가 버티는 홈 3연전이지만 최근 실점이 리그 최다라 KIA 2승 1패의 접전으로 봅니다.",
    detailed_analysis:
      "선발은 NC, 전력과 흐름 관리는 KIA가 앞서는 접전 시리즈입니다. 예상 선발은 NC 라일리(ERA 3.23, 탈삼진 리그 최상위)·테일러(ERA 4.13)·구창모(ERA 3.61), KIA 양현종(ERA 3.78)·황동하(ERA 4.19)·올러(ERA 2.52)로, 1차전 라일리와 3차전 구창모가 NC의 강점이고 KIA는 마지막 경기 올러가 확실한 마무리 카드입니다. 다만 NC는 최근 10경기 실점 66점으로 리그에서 가장 많이 내주고 있어 선발이 내려간 뒤가 불안하고, KIA 타선은 김도영·나성범·카스트로의 장타로 NC 불펜을 공략할 힘이 있습니다. KIA의 전력과 올러 카드에 근소하게 무게를 둬 2승 1패를 예상합니다. 라일리·구창모가 창원 홈에서 두 경기를 지워버리면 NC가 시리즈를 가져갈 수 있습니다. (로테이션은 추정으로 변동 가능성이 있습니다.)"
  },
  {
    group: "weekend", home: "kiwoom", away: "ssg",
    pick: "kiwoom", result: "winning", wins: 2, losses: 1, confidence: 0.55,
    key_factor: "키움 상승세·홈 + SSG 주말 선발 열세",
    one_liner:
      "키움이 3연승의 상승세와 고척 홈, 마지막 경기 알칸타라 카드를 앞세워 앞섭니다. SSG는 김건우·타케다의 주말 선발이 모두 평균 자책점 6~7점대라 흐름을 뒤집기 어려워 키움 2승 1패로 봅니다.",
    detailed_analysis:
      "하위권 맞대결이지만 흐름이 갈리는 시리즈입니다. 예상 선발은 SSG 김건우(ERA 6.70, BB9 5.10)·타케다(ERA 7.22)·아빌라(데뷔 후 호투), 키움 박준현(ERA 4.18, BB9 7.31)·김윤하(ERA 6.75)·알칸타라(ERA 3.47)로, 양 팀 모두 앞 두 경기 선발이 불안하고 마지막 경기에 에이스급이 나옵니다. 차이는 타선과 흐름입니다. 키움은 3연승(KIA 2연파 포함)에 최근 10경기 65득점으로 데이비슨 중심의 화력이 뜨겁고 고척 홈 이점이 있습니다. SSG는 마드리스 가세 후 살아났지만 최근 무승부 포함 주춤하고, 원정에서 김건우·타케다의 볼넷을 키움 타선이 응징할 가능성이 큽니다. 키움의 상승세·홈에 무게를 둬 2승 1패를 예상합니다. 아빌라 등판 경기와 타케다의 반등 여부에 따라 SSG가 뒤집을 수 있습니다. (로테이션은 추정으로 변동 가능성이 있습니다.)"
  },
  {
    group: "weekend", home: "doosan", away: "lg",
    pick: "doosan", result: "winning", wins: 2, losses: 1, confidence: 0.62,
    key_factor: "곽빈·벤자민 vs LG 붕괴",
    one_liner:
      "두산이 곽빈·벤자민의 에이스 카드를 잠실 홈에서 내는 반면, LG는 최근 10경기 1승 9패의 침체에 송승기·박시원의 불안한 선발로 맞서야 합니다. 이번 주 가장 계산이 서는 두산 2승 1패로 봅니다.",
    detailed_analysis:
      "선발과 흐름이 모두 두산으로 기우는, 이번 주 격차가 가장 뚜렷한 시리즈입니다. 예상 선발은 두산 곽빈(ERA 2.80, 어제 완승)·최승용 등 5선발·벤자민(ERA 2.71), LG 송승기(ERA 4.83)·박시원(ERA 4.00, 임시 선발급)·톨허스트(ERA 4.21)로, 1·3차전 매치업에서 두산이 크게 앞섭니다. 흐름도 두산이 최근 6승 3패 1무(+14)에 어제 삼성을 7-0으로 완파한 상승세인 반면, LG는 1승 9패(득실 -30)로 리그에서 가장 깊은 침체입니다. 타선도 세베리노·양의지의 두산이 오스틴에 의존하는 LG보다 안정적입니다. 두산의 선발·홈·흐름 우위에 무게를 둬 2승 1패를 예상하며, 스윕 가능성도 열려 있습니다. LG가 2차전 5선발 경기를 잡고 톨허스트가 3차전을 지키면 최소화할 수 있습니다. (로테이션은 추정으로 변동 가능성이 있습니다.)"
  },
  {
    group: "weekend", home: "kt", away: "hanwha",
    pick: "hanwha", result: "winning", wins: 2, losses: 1, confidence: 0.53,
    key_factor: "류현진·짐머맨·화이트 원정 3장 + KT 홈 폼",
    one_liner:
      "한화가 류현진·짐머맨·화이트로 이어지는 이번 주 최강의 원정 선발 3장을 수원에 투입합니다. KT의 리그 최강 폼과 홈 이점이 맞서지만, 선발 높이에서 앞선 한화 2승 1패의 접전으로 봅니다.",
    detailed_analysis:
      "선발 높이와 팀 흐름이 정면으로 맞서는 상위권 시리즈입니다. 예상 선발은 한화 류현진(ERA 2.90, BB9 1.16)·짐머맨(데뷔전 6이닝급 호투로 14-4 완승)·화이트(ERA 3.09)로 세 장 모두 검증된 에이스급이고, KT 사우어(ERA 4.30)·고영표(ERA 4.43, 볼넷 리그 최소)·오원석(ERA 6.11)은 상대적으로 낮습니다. 반면 KT는 최근 10경기 8승 1패 1무의 리그 최강 폼에 출루율 1위 타선, 수원 홈 이점이 있습니다. 한화 타선도 노시환·페라자·문현빈이 어제 14득점으로 폭발해 화력이 뒤지지 않습니다. 세 경기 모두 한화 선발이 우위인 점에 근소하게 무게를 둬 2승 1패를 예상합니다. KT 타선이 특유의 출루로 한화 선발의 투구 수를 끌어올리고 불펜 싸움으로 끌고 가면 홈에서 뒤집을 수 있는 동전 던지기에 가까운 시리즈입니다. (로테이션은 추정으로 변동 가능성이 있습니다.)"
  },
  {
    group: "weekend", home: "lotte", away: "samsung",
    pick: "samsung", result: "winning", wins: 2, losses: 1, confidence: 0.54,
    key_factor: "삼성 폼·타선 + 보스 데뷔 부진 변수",
    one_liner:
      "삼성이 최근 7승 3패의 폼과 리그 최고 콘택트 타선, 페덱 카드를 앞세워 앞섭니다. 다만 1차전 보스가 데뷔전에서 부진했고 롯데도 김진욱·비슬리의 홈 선발이 만만치 않아 삼성 2승 1패의 접전으로 봅니다.",
    detailed_analysis:
      "전력은 삼성, 홈 선발은 롯데가 맞서는 시리즈입니다. 예상 선발은 삼성 보스(데뷔전 패전으로 검증 실패)·최원태 또는 양창섭·페덱(가세 후 압도), 롯데 김진욱(ERA 3.07)·비슬리(ERA 4.28)·박세웅(ERA 4.58)입니다. 1차전은 김진욱이 앞서고, 3차전 페덱이 삼성의 확실한 카드입니다. 새 외국인들이 데뷔전부터 압도하던 이달 흐름에서 보스만 예외(7실점 완패)였던 점은 삼성의 리스크입니다. 최근 폼은 삼성 7승 3패(+15), 롯데 3승 7패(-3)로 갈리지만, 롯데는 어제 KT를 15-1로 대파하며 타격감이 살아났고 사직 홈 이점이 있습니다. 타선은 삼성이 김지찬·구자욱·최형우의 콘택트로 앞섭니다. 삼성의 폼·타선에 무게를 두되 보스와 롯데 타격 반등을 고려해 2승 1패의 접전으로 봅니다. 김진욱이 1차전을 잡고 롯데 화력이 이어지면 홈 위닝이 가능합니다. (로테이션은 추정으로 변동 가능성이 있습니다.)"
  }
];

console.log(`Upserting ${series.length} Claude weekly-series predictions for week ${WEEK_START} (${MODEL})...`);
console.log(`※ 시리즈 row/headline 및 타 provider 예측은 건드리지 않음 (기존 series_id 조회만).\n`);

let okCount = 0;
let failCount = 0;

for (const s of series) {
  const { data: seriesRow, error: sErr } = await sb
    .from("bp_ai_weekly_series")
    .select("id")
    .eq("week_start_date", WEEK_START)
    .eq("series_group", s.group)
    .eq("home_team_id", s.home)
    .eq("away_team_id", s.away)
    .single();

  if (sErr || !seriesRow) {
    console.log(`  ✗ series 조회 실패 [${s.group}] ${s.away}@${s.home}: ${sErr?.message ?? "없음"}`);
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
    console.log(`  ✗ pred [${s.group}] ${s.away}@${s.home}: ${pErr.message}`);
    failCount++;
    continue;
  }

  console.log(`  ✓ [${s.group}] ${s.away} @ ${s.home} → ${s.pick} ${s.result} ${s.wins}-${s.losses} (${s.confidence})`);
  okCount++;
}

console.log(`\n결과: 성공 ${okCount}건 / 실패 ${failCount}건`);
