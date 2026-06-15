// 2026-06-16 Claude 일일 예측 5건 INSERT. (claude 슬롯 전용 — 다른 provider 미변경)
// ai_provider='claude', published_at=09:00 KST.

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

const GAME_DATE = "2026-06-16";
const PUBLISHED_AT = "2026-06-16T09:00:00+09:00";
// ⚠️ INSERT 직전 확인: 현재 세션 모델과 일치하는가?
const MODEL = "claude-opus-4-8";

const rows = [
  {
    // kt(고영표) @ doosan(최승용) — 잠실
    game_id: "b930db5d-850d-4e93-91aa-fd1a6583c855",
    predicted_winner_team_id: "kt",
    confidence: 0.60,
    key_factor: "고영표 제구·구위 우위 + KT 콘택트 타선",
    one_liner:
      "직전 등판이 우천취소돼 푹 쉰 KT 고영표가 9이닝당 볼넷 1.5개의 정교한 제구와 두 자릿수 탈삼진 능력으로 마운드를 지배할 전망입니다. 평균 자책점 5점에 가까운 두산 최승용을 상대로, 출루율 리그 최상위의 KT 타선이 잠실 원정에서도 점수를 앞서갈 가능성이 큽니다.",
    detailed_analysis:
      "선발에서 KT가 분명히 앞섭니다. KT 고영표(ERA 4.50, WHIP 1.25, BB9 1.46, K9 10.32)는 시즌 자책점이 다소 높지만 9이닝당 볼넷 1.5개의 정교한 제구에 두 자릿수 탈삼진을 겸비한 노련한 카드이고, 직전 NC전 우천취소로 충분히 쉬고 나오는 점도 긍정적입니다. 반면 두산 최승용(ERA 4.97, WHIP 1.57, BB9 3.57)은 이닝당 주자가 많고 볼넷이 잦아 KT 출루형 타선에 빅이닝을 내줄 위험이 있습니다. 타선도 KT가 위입니다. KT 라인업(평균 .296, 출루율 .371)은 최원준·김현수·허경민의 콘택트와 출루가 리그 최상위라 두산 라인업(평균 .261, 출루율 .336, 장타력 .397)보다 득점 생산에서 앞섭니다. 변수는 고영표의 피홈런(HR9 1.06)이지만, 두산 타선의 장타력이 낮아 한 방으로 뒤집힐 위험은 제한적입니다. 잠실 홈과 최승용 카드를 가진 두산이 버틸 여지는 있으나, 선발·타선 우위로 KT 쪽에 0.60으로 기웁니다."
  },
  {
    // kiwoom(하영민) @ samsung(원태인) — 대구
    game_id: "0c80cd54-f155-4ab7-897e-8a816dca1577",
    predicted_winner_team_id: "samsung",
    confidence: 0.62,
    key_factor: "원태인 제구 안정 + 삼성 홈 연승 흐름",
    one_liner:
      "원태인이 9이닝당 볼넷 2개대의 안정된 제구로 평균 자책점이 4점을 넘는 키움 하영민보다 단일 경기 신뢰도가 높습니다. 이틀 연속 역전승으로 분위기가 오른 시즌 1위 삼성이 대구 홈에서 연승을 이어갈 가능성이 큽니다.",
    detailed_analysis:
      "선발과 흐름이 모두 삼성으로 기웁니다. 삼성 원태인(ERA 3.95, WHIP 1.35, BB9 2.37, HR9 0.47)은 볼넷과 피홈런을 모두 적게 내주는 제구형이라 단일 경기 기복이 작고, 키움 하영민(ERA 4.20, WHIP 1.52, BB9 3.83, HR9 1.1)은 볼넷과 피홈런이 함께 많아 불안합니다. 타선은 성격이 갈립니다. 키움 라인업(평균 .279, 출루율 .369)은 출루는 준수하지만 장타력(.372)이 리그 최하위권이라 큰 점수를 내기 어렵고, 삼성 라인업(평균 .273, 출루율 .365, 장타력 .411)은 디아즈가 역전 만루포로 부활하는 등 중심타선이 살아나는 흐름입니다. 삼성은 이틀 연속 대역전승으로 17일 만에 연승을 만들며 분위기가 올라 있고, 대구 홈에서 시즌 1위의 안정감을 더합니다. 안우진이 아닌 하영민 등판이라 키움의 카드가 약한 점도 삼성에 유리해 0.62로 봅니다. 키움 타선이 원태인의 제구를 끈질기게 공략하면 접전 여지는 있습니다."
  },
  {
    // lotte(김진욱) @ ssg(김민준) — 문학
    game_id: "1da205e5-a115-47c2-95d5-fa74cdbfb676",
    predicted_winner_team_id: "lotte",
    confidence: 0.55,
    key_factor: "김진욱 검증 vs 김민준 제구 붕괴 + 롯데 콘택트",
    one_liner:
      "롯데 김진욱이 평균 자책점 3점 초반에 70이닝을 쌓은 검증된 선발인 반면, SSG 김민준은 표본이 4이닝도 안 되고 9이닝당 볼넷이 7개를 넘는 제구 불안의 임시 선발입니다. 최근 최하위로 처진 롯데지만 선발 매치업의 격차가 커 문학 원정에서 1승을 노려볼 만합니다.",
    detailed_analysis:
      "선발 신뢰도 격차가 결정적인 카드입니다. 롯데 김진욱(ERA 3.20, WHIP 1.17, K9 6.91)은 70이닝을 소화하며 이닝당 주자를 1.2개 아래로 묶는 검증된 카드인 반면, SSG 김민준(ERA 12.27, 3.2이닝, BB9 7.3)은 1군 표본이 4이닝에도 못 미치고 9이닝당 볼넷이 7개를 넘어 제구가 붕괴된 임시 선발입니다. 김민준 등판 경기는 SSG가 일찍 불펜으로 전환할 가능성이 높아, 롯데 타선(평균 .272, 출루율 .329)이 초반 볼넷으로 주자를 쌓으면 리드를 잡기 좋은 구도입니다. 다만 변수가 많습니다. 롯데는 최근 다시 최하위로 추락하며 타선 분위기가 가라앉았고, SSG 라인업(평균 .249, 장타력 .404)은 최정·에레디아의 장타력이 살아 있어 김진욱을 상대로 한 방을 터뜨릴 수 있습니다. SSG 홈 이점과 불펜 운영까지 고려하면 박빙이지만, 선발 매치업의 뚜렷한 우위에 무게를 둬 롯데 쪽에 0.55로 살짝 기웁니다."
  },
  {
    // lg(웰스) @ kia(시라카와) — 광주
    game_id: "7875b6bd-d4e2-4342-aed3-a95d9e37dff8",
    predicted_winner_team_id: "lg",
    confidence: 0.62,
    key_factor: "웰스 에이스 구위 + KIA 타선 침체",
    one_liner:
      "LG 웰스가 평균 자책점 2점대 중반에 이닝당 주자 1.08의 리그 정상급 선발인 반면, KIA 시라카와는 표본이 9이닝 안팎이고 9이닝당 볼넷이 6개를 넘는 제구 불안형입니다. 최근 방망이가 침묵한 KIA를 상대로 출루율 리그 최상위의 LG 타선이 광주 원정에서도 앞서갈 전망입니다.",
    detailed_analysis:
      "선발 격차가 큰 카드입니다. LG 웰스(ERA 2.63, WHIP 1.08, BB9 2.63, HR9 0.33)는 이닝당 주자를 1개 수준으로 억제하고 피홈런을 거의 내주지 않는 에이스급 카드입니다. 반면 KIA 시라카와(ERA 3.12, 8.7이닝, BB9 6.21)는 표본이 9이닝 안팎으로 짧고 9이닝당 볼넷이 6개를 넘어, 홍창기·박해민·오스틴으로 이어지는 LG의 출루형 상위 타선(출루율 .374)에 볼넷을 헌납하기 쉽습니다. 타선 흐름도 LG가 낫습니다. KIA(평균 .255, 출루율 .321)는 최근 '방망이 침묵'이라는 평가가 나올 만큼 타격이 식었고, LG(평균 .280, 출루율 .374)는 출루와 콘택트가 안정적입니다. 다만 KIA는 김도영·나성범의 장타력(장타력 .407)이 한 번 터지면 분위기를 단숨에 바꿀 수 있고 광주 홈 이점도 있습니다. 그럼에도 선발·타선·흐름이 일관되게 LG 쪽이라 0.62로 기웁니다."
  },
  {
    // hanwha(화이트) @ nc(구창모) — 창원
    game_id: "578eef7b-0598-4681-851a-50754a85aac4",
    predicted_winner_team_id: "hanwha",
    confidence: 0.56,
    key_factor: "화이트 이닝당 주자 억제 + 한화 중심타선 장타",
    one_liner:
      "한화 화이트가 이닝당 주자를 1명 아래로 묶는 정교한 제구로 NC 구창모보다 한 끗 앞서고, 강백호·노시환의 장타력을 갖춘 한화 타선이 식었던 방망이를 깨우면 우위를 가져갈 수 있습니다. 다만 두 선발 모두 안정적이라 창원 홈의 NC와 접전이 예상됩니다.",
    detailed_analysis:
      "양 선발 모두 안정적이라 박빙이 예상되는 카드입니다. 한화 화이트(ERA 2.67, WHIP 0.98, BB9 1.34)는 이닝당 주자를 1명 아래로 묶는 최상급 제구가 강점이고, NC 구창모(ERA 3.69, WHIP 1.24, BB9 2.77)도 68이닝을 소화한 안정형이라 선발만으로는 한화가 근소하게 앞서는 정도입니다. 타선은 색이 다릅니다. 한화 라인업(평균 .286, 출루율 .348, 장타력 .449, ISO .163)은 강백호·노시환·페라자의 장타력이 NC 라인업(평균 .281, 출루율 .367, 장타력 .417)보다 한 방 폭발력에서 앞서지만, 삼진 비율(24.3%)이 높아 화이트 같은 호투를 만나면 묶일 위험도 있습니다. 흐름은 변수입니다. 한화는 최근 꼴찌 키움에 스윕패를 당하며 6위로 추락했고 '식어버린 방망이'라는 평가가 나올 만큼 타격이 가라앉았으며, NC는 2연패 뒤 안방 6연전으로 반등을 노립니다. 선발 우위와 중심타선의 장타력에 무게를 두되, 한화 타선 침체와 창원 홈 변수를 인정해 0.56으로 한화에 살짝 기웁니다."
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
