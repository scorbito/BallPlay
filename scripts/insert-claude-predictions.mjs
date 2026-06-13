// 2026-06-13 Claude 예측 5건 INSERT.
// ai_provider='claude', published_at=09:00 KST.
// 월요일 갱신된 최신 스냅샷 스탯 + 선발 + 타선 시즌능력 + 뉴스 기반. 근거는 확인된 사실만.

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

const GAME_DATE = "2026-06-13";
const PUBLISHED_AT = "2026-06-13T09:00:00+09:00";
// ⚠️ Claude 본인이 INSERT 직전 확인: 현재 자기 모델이 이 값과 일치하는가?
const MODEL = "claude-opus-4-8";

const rows = [
  {
    // ssg(베니지아노) @ samsung(후라도) — 대구
    game_id: "c7d96f93-39e6-4562-ba8d-12979e4d0e9f",
    predicted_winner_team_id: "samsung",
    confidence: 0.66,
    key_factor: "후라도 에이스급 제구 vs 베니지아노 피홈런",
    one_liner:
      "후라도가 평균 자책점 2점 중반에 9이닝당 볼넷 1.5개의 에이스급 제구를 자랑하는 반면 SSG 베니지아노는 볼넷과 피홈런이 함께 많은 기복형이라, 시즌 1위 삼성이 대구 홈에서 앞서갑니다.",
    detailed_analysis:
      "선발 격차가 가장 큰 카드입니다. 삼성 후라도(ERA 2.61, WHIP 1.17, BB9 1.54, HR9 0.95)는 76이닝의 충분한 표본을 쌓은 에이스급 선발로, 9이닝당 볼넷이 1.5개에 불과한 정교한 제구가 강점입니다. 반면 SSG 베니지아노(ERA 5.13, WHIP 1.51, BB9 3.62, HR9 1.51)는 볼넷과 피홈런을 함께 내주는 기복형이라, 디아즈·구자욱 중심의 삼성 중심타선에 장타를 허용할 위험이 큽니다. 타선은 양 팀이 팽팽합니다. SSG 라인업(평균 .284, 출루율 .365, 장타력 .435)이 최정·에레디아를 앞세워 삼성 라인업(평균 .279, 출루율 .366, 장타력 .431)에 수치상 밀리지 않아, 베니지아노의 부진을 타선으로 만회할 여지는 있습니다. 변수는 흐름입니다. SSG는 어제 불펜을 총동원해 삼성을 5-3으로 꺾고 3연패를 끊은 직후라 분위기가 살아 있고, 최정의 결승포로 타선도 반등 기미를 보였습니다. 다만 시즌 1위 팀의 전력과 후라도의 압도적인 선발 우위, 대구 홈 이점을 더 무겁게 보아 삼성 쪽에 0.66으로 기웁니다."
  },
  {
    // doosan(벤자민) @ kia(네일) — 광주
    game_id: "d615e13c-62b1-4aea-9643-78b52c5f8a2e",
    predicted_winner_team_id: "kia",
    confidence: 0.53,
    key_factor: "KIA 중심타선 장타력 반등 + 양 에이스 맞대결",
    one_liner:
      "두산 벤자민과 KIA 네일 모두 평균 자책점 2~3점대의 에이스라 점수가 귀한 투수전이 예상되는데, 김도영·나성범 중심의 리그 정상급 장타 라인업을 가진 KIA가 광주 홈에서 3연패 탈출을 노립니다.",
    detailed_analysis:
      "양 선발 모두 리그 최상급이라 선발만으로는 우열을 가리기 어렵습니다. 두산 벤자민(ERA 2.84, WHIP 1.36, K9 7.63, HR9 0.18)은 피홈런을 거의 내주지 않는 호투형이고, KIA 네일(ERA 3.58, WHIP 1.12, BB9 1.79, HR9 0.36)은 이닝당 주자를 1.1개로 묶는 정교한 제구가 강점이라 백중세에 가깝습니다. 결국 타선에서 갈린다고 봅니다. KIA 라인업(평균 .268, 출루율 .340, 장타력 .461, ISO .193)은 김도영·나성범·아데를린의 장타력이 리그 정상급이라, 단번에 점수를 만드는 힘에서 두산 라인업(평균 .264, 출루율 .345, 장타력 .401)을 앞섭니다. 다만 벤자민의 피홈런 억제(HR9 0.18)가 KIA의 장타 위주 득점 루트를 틀어막는다는 점이 관전 포인트입니다. 흐름은 두산이 좋습니다. 두산은 어제 최민석의 8탈삼진 호투와 양의지의 홈런으로 KIA를 4-2로 꺾고 2연승, KIA는 타선 침묵 속 3연패에 빠졌습니다. 그래서 confidence는 0.53으로 박빙. 슬럼프에 빠진 KIA 타선의 반등 가능성과 홈 이점, 우월한 장타력에 아주 살짝 무게를 두지만, 사실상 동전 던지기에 가까운 에이스 맞대결입니다."
  },
  {
    // nc(토다) @ kt(오원석) — 수원
    game_id: "1c40f8da-c72d-4d15-ba44-21abe5eaf55b",
    predicted_winner_team_id: "kt",
    confidence: 0.57,
    key_factor: "오원석 탈삼진·제구 + KT 홈 상승세",
    one_liner:
      "KT 오원석이 9이닝당 탈삼진 8개에 볼넷 2개의 안정된 구위를 갖춰 NC 토다보다 단일 경기 결정력에서 앞서고, 어제 김현수의 끝내기로 2연승을 달린 KT가 수원 홈에서 분위기를 이어갑니다.",
    detailed_analysis:
      "선발은 KT가 한 끗 앞섭니다. KT 오원석(ERA 5.25, WHIP 1.42, K9 8.18, BB9 2.01)은 시즌 자책점이 다소 높지만 9이닝당 탈삼진 8개에 볼넷 2개로 구위와 제구의 밸런스가 좋은 카드입니다. 반면 NC 토다(ERA 4.69, WHIP 1.47, HR9 1.29)는 피홈런이 다소 많아 KT의 출루형 타선에 빅이닝을 내줄 위험이 있습니다. 타선 성격은 갈립니다. KT 라인업(평균 .283, 출루율 .363, ISO .087)은 장타력은 약해도 출루와 콘택트가 리그 최상위라 끈질기게 물고 늘어지고, NC 라인업(평균 .275, 출루율 .368, 장타력 .403)은 출루는 비슷하되 장타에서 약간 앞섭니다. 흐름은 KT가 확실히 좋습니다. KT는 어제 9회말 김현수의 끝내기 적시타로 NC를 3-2로 꺾고 2연승을 달리며 선두 LG를 1경기 차로 추격했고, NC는 같은 경기를 내주며 이번 주 분위기가 가라앉았습니다. 선발·홈·상승세가 일관되게 KT 쪽이라 confidence 0.57. NC 토다가 피홈런만 억제하면 박빙 접전으로 흐를 여지는 인정합니다."
  },
  {
    // hanwha(박준영) @ kiwoom(알칸타라) — 고척
    game_id: "02f82ff8-3d1e-46d4-9b18-221ec0961a3a",
    predicted_winner_team_id: "kiwoom",
    confidence: 0.55,
    key_factor: "알칸타라 에이스 제구 vs 박준영 극심한 볼넷",
    one_liner:
      "키움 알칸타라가 9이닝당 볼넷 1.3개의 리그 최정상급 제구를 갖춘 에이스인 반면 한화 박준영은 9이닝당 볼넷이 8개에 육박하는 극심한 제구 난조라, 어제 끝내기 승리로 분위기를 탄 키움이 고척 홈에서 이변을 노립니다.",
    detailed_analysis:
      "팀 순위는 한화가 위지만, 이 카드의 결정적 균열은 선발 매치업입니다. 키움 알칸타라(ERA 3.12, WHIP 1.15, BB9 1.27, K9 8.08)는 78이닝의 충분한 표본에서 9이닝당 볼넷 1.3개의 최정상급 제구와 준수한 탈삼진을 겸비한 에이스입니다. 반대로 한화 박준영(ERA 4.94, WHIP 1.77, BB9 7.97)은 9이닝당 볼넷이 8개에 육박하는 극심한 제구 난조 상태라, 표본이 24이닝 안팎으로 짧은 점을 감안해도 끊임없이 주자를 내줄 위험이 매우 큽니다. 타선은 한화가 앞섭니다. 한화 라인업(평균 .274, 출루율 .357, 장타력 .408)은 강백호·노시환·페라자가 살아 있어 키움 라인업(평균 .247, 출루율 .324, 장타력 .364, 삼진 비율 25.4%)보다 분명히 우위지만, 알칸타라가 그 화력을 묶을 수 있다는 점이 핵심입니다. 즉 한화 타선의 우위는 알칸타라가, 키움 타선의 약점은 박준영의 볼넷 남발이 상쇄하는 구도입니다. 흐름도 키움이 좋습니다. 키움은 어제 9회 2사에서 서건창의 끝내기 3루타로 한화를 4-3으로 뒤집은 직후이고, 한화는 마무리 이민우가 3연투 끝에 무너지며 불펜 피로가 누적됐습니다. 선발 제구 격차와 홈·상승세를 더 무겁게 보아 키움 쪽에 0.55로 기웁니다. 박준영이 짧은 표본에서 제구를 잡고 한화 중심타선이 알칸타라를 공략하면 균형은 곧장 한화로 넘어갑니다."
  },
  {
    // lotte(이민석) @ lg(김진수) — 잠실
    game_id: "4059bbf9-a27e-4add-92ba-b13e7bfc292b",
    predicted_winner_team_id: "lg",
    confidence: 0.61,
    key_factor: "선발 안정성 + LG 상위타선 출루 우위",
    one_liner:
      "롯데 이민석이 9이닝당 볼넷 5개가 넘는 제구 불안에 평균 자책점 6점대인 반면 LG 김진수는 이닝당 주자를 안정적으로 억제하는 카드라, 시즌 선두 LG가 잠실 홈에서 어제 대패를 설욕할 채비가 됐습니다.",
    detailed_analysis:
      "선발 신뢰도에서 LG가 앞섭니다. LG 김진수(ERA 4.07, WHIP 1.32, BB9 2.59)는 표본이 24이닝대로 길지는 않아도 이닝당 주자를 1.3개대로 억제하는 안정형인 반면, 롯데 이민석(ERA 6.27, WHIP 1.66, BB9 5.29)은 9이닝당 볼넷이 5개를 넘는 제구 불안형이라 홍창기·박해민·오스틴으로 이어지는 LG의 출루형 상위 타선에 볼넷을 헌납하기 쉽습니다. 타선도 LG가 우위입니다. LG 라인업(평균 .272, 출루율 .363, 장타력 .425)은 출루·장타 모두 롯데 라인업(평균 .248, 출루율 .315, 장타력 .383)을 앞서, 이민석의 제구 난조를 빅이닝으로 응징할 능력이 큽니다. 변수는 어제 흐름입니다. 롯데는 어제 잠실에서 17안타 16득점으로 LG를 16-5로 대파했고 황성빈이 5타점으로 폭발하며 타선이 절정에 올라 있어, 그 분위기가 이어지면 만만치 않습니다. 다만 어제의 폭발은 다른 선발을 상대한 결과이고, 시즌 선두(39승 24패)의 잠실 홈 전력과 선발·타선의 구조적 우위를 더 무겁게 보아 LG 쪽에 0.61로 기웁니다. 롯데 톱타선이 이틀 연속 터지고 김진수가 짧은 표본에서 흔들리면 변수가 될 수 있습니다."
  }
];

console.log(`Inserting ${rows.length} predictions as ai_provider='claude' (${MODEL}) for ${GAME_DATE}...`);

let okCount = 0;
let failCount = 0;
for (const r of rows) {
  const payload = {
    game_id: r.game_id,
    game_date: GAME_DATE,
    ai_provider: "claude",
    model_name: MODEL,
    predicted_winner_team_id: r.predicted_winner_team_id,
    confidence: r.confidence,
    key_factor: r.key_factor,
    one_liner: r.one_liner,
    detailed_analysis: r.detailed_analysis,
    published_at: PUBLISHED_AT
  };
  const { data, error } = await sb
    .from("bp_ai_predictions")
    .insert(payload)
    .select("id, game_id, predicted_winner_team_id, confidence")
    .single();
  if (error) {
    console.log(`  ✗ ${r.game_id} → ${r.predicted_winner_team_id}: ${error.message}`);
    failCount++;
  } else {
    console.log(`  ✓ ${data.predicted_winner_team_id.padEnd(8)} conf=${data.confidence} | row id=${data.id}`);
    okCount++;
  }
}

console.log(`\n결과: 성공 ${okCount}건 / 실패 ${failCount}건`);
