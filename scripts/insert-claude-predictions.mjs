// 2026-06-12 Claude 예측 5건 INSERT.
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

const GAME_DATE = "2026-06-12";
const PUBLISHED_AT = "2026-06-12T09:00:00+09:00";
// ⚠️ Claude 본인이 INSERT 직전 확인: 현재 자기 모델이 이 값과 일치하는가?
const MODEL = "claude-opus-4-8";

const rows = [
  {
    // lotte(로드리게스) @ lg(톨허스트) — 잠실
    game_id: "d04b22e1-290e-4c94-b4c4-2a244d2334be",
    predicted_winner_team_id: "lg",
    confidence: 0.68,
    key_factor: "선발·타선 동시 우위 + LG 상위타선 출루",
    one_liner:
      "톨허스트가 이닝당 주자를 거의 내주지 않는 안정형인 반면 롯데 로드리게스는 볼넷과 피홈런이 함께 많은 기복형이라, 어제 SSG를 16안타로 싹쓸이한 LG 타선이 잠실 홈에서 한층 앞섭니다.",
    detailed_analysis:
      "이 카드는 선발과 타선이 모두 LG로 기웁니다. LG 톨허스트(ERA 3.36, WHIP 1.13, K9 7.84, BB9 2.52)는 이닝당 주자를 1.1개대로 묶는 안정형 외인이고, 롯데 로드리게스(ERA 5.56, WHIP 1.50, K9 9.21, BB9 3.49, HR9 1.59)는 탈삼진은 많지만 볼넷과 피홈런을 함께 내주는 기복형이라 출발선부터 차이가 납니다. 타선도 LG가 우위입니다. LG 라인업(평균 .268, 출루율 .360, 장타력 .420)은 홍창기·오스틴·문보경으로 이어지는 출루 능력이 롯데 라인업(평균 .251, 출루율 .311, 장타력 .388)을 콘택트·출루 모두에서 앞서, 로드리게스의 볼넷을 골라 빅이닝을 만들 힘이 큽니다. 흐름도 압도적입니다. LG는 어제 SSG를 16안타 15득점으로 완파하며 SSG 3연전을 싹쓸이했고 송찬의가 한 경기 최다 2루타 타이를 기록하는 등 타선이 절정입니다. 시즌 1위(39승 23패)의 잠실 홈 안정감까지 더해, 롯데의 5할 미만 성적과 비교해 LG 쪽에 0.68로 분명히 무게를 둡니다."
  },
  {
    // ssg(타케다) @ samsung(장찬희) — 대구
    game_id: "d648060d-5d19-4590-99d1-9736852838e8",
    predicted_winner_team_id: "samsung",
    confidence: 0.63,
    key_factor: "타케다 제구 붕괴 + 삼성 홈 선발 우위",
    one_liner:
      "SSG 타케다가 9이닝당 볼넷 5개가 넘는 극심한 제구 난조로 평균 자책점이 7점대까지 치솟은 상태라, 시즌 1위 삼성이 대구 홈에서 장찬희를 앞세워 앞서갑니다.",
    detailed_analysis:
      "선발에서 삼성이 확실히 앞섭니다. SSG 타케다(ERA 7.63, WHIP 1.94, BB9 5.22)는 9이닝당 볼넷을 5개 넘게 내주며 이닝당 주자가 2개에 육박하는 제구 붕괴 상태라, 시즌 자책점이 7점대까지 치솟았습니다. 반면 삼성 장찬희(ERA 3.70, WHIP 1.35, BB9 3.92)도 볼넷이 적지는 않으나 실점 억제력에서 한참 앞섭니다. 변수는 타선입니다. SSG 라인업(평균 .291, 출루율 .371, 장타력 .448)은 최정·에레디아 중심으로 수치만 보면 삼성 라인업(평균 .277, 출루율 .360, 장타력 .436)에 밀리지 않아, SSG가 타케다의 부진을 타선으로 만회할 여지는 있습니다. 다만 SSG는 어제 LG에 15-1로 대패하며 3연패에 빠졌고 타선 분위기가 가라앉은 반면, 삼성은 어제 오러클린의 1피안타 무실점 호투로 KT를 8-1로 잡고 3연패를 끊었습니다. 시즌 1위의 대구 홈 이점과 선발 우위를 더 무겁게 보아 삼성 쪽에 0.63으로 기웁니다. 타케다가 짧은 이닝만 버티고 SSG 불펜이 받쳐주면 타선 화력에서 뒤집힐 여지는 인정합니다."
  },
  {
    // doosan(최민석) @ kia(양현종) — 광주
    game_id: "d2decbec-d083-444d-855e-5deaccd3a94d",
    predicted_winner_team_id: "kia",
    confidence: 0.54,
    key_factor: "KIA 중심타선 장타 vs 최민석 피홈런 억제",
    one_liner:
      "두산 최민석이 평균 자책점 3점 초반의 호투형이라 만만치 않지만, 김도영·나성범·아데를린으로 이어지는 리그 최강 장타 라인업을 가진 KIA가 광주 홈에서 근소하게 앞섭니다.",
    detailed_analysis:
      "선발만 보면 두산이 앞섭니다. 두산 최민석(ERA 3.06, WHIP 1.33, K9 8.61, HR9 0.44)은 탈삼진 능력과 피홈런 억제가 모두 뛰어난 호투형인 반면, KIA 양현종(ERA 4.39, WHIP 1.44, BB9 4.22, HR9 1.52)은 볼넷과 피홈런을 함께 내주는 기복이 있습니다. 그러나 타선에서 균형이 KIA로 옮겨갑니다. KIA 라인업(평균 .265, 출루율 .338, 장타력 .501, ISO .236)은 김도영·나성범·아데를린의 장타력이 리그 최정상급이라, 양현종의 부진을 타선으로 메울 화력이 충분합니다. 두산 라인업(평균 .254, 출루율 .336, 장타력 .384)도 어제 12득점으로 폭발했고 카메론·양의지가 살아있지만, 누적 장타력은 KIA에 한참 못 미칩니다. 관전 포인트는 최민석의 피홈런 억제(HR9 0.44)가 KIA의 장타 위주 득점 루트를 얼마나 틀어막느냐입니다. 이 매치업이 팽팽해 confidence는 0.54로 박빙. 두산의 호투형 선발과 KIA의 압도적 장타, 광주 홈 이점이 맞물린 진짜 동전 던지기지만, 단판에서는 한 방을 가진 KIA 타선과 홈 이점에 아주 살짝 무게를 둡니다."
  },
  {
    // nc(테일러) @ kt(배제성) — 수원
    game_id: "3ef375b1-e6b2-4c16-afd2-afe58171a705",
    predicted_winner_team_id: "kt",
    confidence: 0.54,
    key_factor: "양 선발 모두 불안 + KT 콘택트 라인업 홈 이점",
    one_liner:
      "NC 테일러와 KT 배제성 모두 평균 자책점 5점대의 불안한 선발이라 타선 싸움으로 흐를 공산이 큰데, 출루율 리그 최상위의 콘택트 라인업을 가진 KT가 수원 홈에서 근소하게 앞섭니다.",
    detailed_analysis:
      "선발은 양쪽 모두 미덥지 않습니다. NC 테일러(ERA 5.60, WHIP 1.52, BB9 4.44)는 볼넷과 이닝당 주자가 많고, KT 배제성(ERA 5.02, WHIP 1.67, BB9 5.66)은 9이닝당 볼넷이 5개를 넘는 데다 표본이 14이닝대로 짧아 기복을 가늠하기 어렵습니다. 두 선발 모두 일찍 흔들릴 여지가 커, 승부는 타선과 불펜 싸움으로 흐를 가능성이 높습니다. 타선 성격은 갈립니다. KT 라인업(평균 .290, 출루율 .371, ISO .088)은 장타력은 약해도 출루와 콘택트가 리그 최상위라 상대 제구 불안을 끈질기게 물고 늘어지고, NC 라인업(평균 .274, 출루율 .364, 장타력 .404)은 출루는 비슷하되 장타에서 약간 앞섭니다. 흐름은 NC가 좋습니다. NC는 어제 키움을 3-2로 잡으며 3연속 위닝시리즈에 2연승까지 달리는 상승세인 반면, KT는 어제 삼성에 1-8로 완패했습니다. 다만 배제성의 볼넷을 KT의 출루형 라인업이 홈에서 더 잘 응징할 수 있다고 보아, 박빙이지만 KT 쪽에 0.54로 살짝 기웁니다. NC의 상승세를 감안하면 언제든 뒤집힐 수 있는 경기입니다."
  },
  {
    // hanwha(에르난데스) @ kiwoom(안우진) — 고척
    game_id: "e83810dc-429e-4fcd-b19f-3605d2c18fda",
    predicted_winner_team_id: "hanwha",
    confidence: 0.59,
    key_factor: "한화 타선 출루·장타 우위 vs 키움 최약체 화력",
    one_liner:
      "키움 안우진이 9이닝당 탈삼진 11개의 위력적인 구위로 변수를 만들 수 있지만, 강백호·노시환을 앞세운 한화 타선이 출루와 장타 모두 리그 최약체 키움 타선을 크게 앞서 원정에서도 우위를 가져갑니다.",
    detailed_analysis:
      "선발만 떼어놓고 보면 키움이 위협적입니다. 키움 안우진(ERA 4.00, WHIP 1.30, K9 11.33, BB9 2.67)은 9이닝당 탈삼진이 11개를 넘는 파워형이라 한 경기를 지배할 수 있는 카드지만, 표본이 27이닝으로 짧아 컨디션 편차가 변수입니다. 한화 에르난데스(ERA 4.31, WHIP 1.45, K9 6.30)는 평범한 콘택트 유도형입니다. 승부를 가르는 결정적 균열은 타선 격차입니다. 한화 라인업(평균 .274, 출루율 .358, 장타력 .410)은 강백호·노시환·페라자가 콘택트와 장타를 고루 갖춘 반면, 키움 라인업(평균 .249, 출루율 .329, 장타력 .370, 삼진 비율 25.2%)은 출루·장타가 리그 최하위권에 삼진 비율까지 가장 높습니다. 즉 안우진이 한화 타선을 일정 부분 묶더라도, 키움 타선이 에르난데스를 상대로 점수를 뽑지 못하면 승리로 연결하기 어렵습니다. 흐름도 한화는 어제 류현진의 8승 호투로 KIA를 꺾고 4위로 도약했고, 키움은 어제 NC에 2-3 역전패하며 위닝시리즈를 내줬습니다. 안우진의 구위가 변수라 confidence는 0.59. 안우진이 폭투 없이 6이닝 이상 끌고 가면 한화 타선도 묶일 수 있다는 점만 인정하되, 팀 전력과 타선 격차에 무게를 둬 한화를 택합니다."
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
