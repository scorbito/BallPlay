// 2026-06-19 Claude 일일 예측 5건 INSERT. (claude 슬롯 전용 — 다른 provider 미변경)
// 시즌 스탯 베이스 + 상대팀 전적(bp_pitcher_vs_team_stats) 보조 반영.
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

const GAME_DATE = "2026-06-19";
const PUBLISHED_AT = "2026-06-19T09:00:00+09:00";
// ⚠️ INSERT 직전 확인: 현재 세션 모델과 일치하는가?
const MODEL = "claude-opus-4-8";

const rows = [
  {
    // samsung(후라도) @ hanwha(박준영) — 대전
    game_id: "d12fab8c-d523-44d1-89ec-b45b312bb56f",
    predicted_winner_team_id: "samsung",
    confidence: 0.62,
    key_factor: "후라도 제구·상대 한화전 강세 vs 박준영 극심한 볼넷",
    one_liner:
      "삼성 후라도가 평균 자책점 2점대에 한화 상대 통산 평균 자책점 2점대의 강세까지 갖춘 반면, 한화 박준영은 9이닝당 볼넷이 7개를 넘는 극심한 제구 불안형입니다. 출루형 삼성 타선이 박준영의 볼넷을 응징하며 대전 원정에서도 앞설 전망입니다.",
    detailed_analysis:
      "선발 격차가 큰 카드입니다. 삼성 후라도(ERA 2.96, WHIP 1.23, BB9 1.65)는 82이닝을 소화한 에이스로 제구가 정교하고, 상대팀 전적에서도 한화전 2선발 13이닝 평균 자책점 2.77, 이닝당 주자 1.00으로 강세를 보여 왔습니다. 반면 한화 박준영(ERA 4.74, WHIP 1.70, BB9 7.65)은 9이닝당 볼넷이 7개를 넘는 제구 붕괴 상태라, 삼성 라인업(평균 .264, 출루율 .366)이 사사구를 쌓아 빅이닝을 만들기 좋은 구도입니다. 한화 라인업(평균 .282, 출루율 .355, 장타력 .400)도 강백호·노시환 중심으로 후라도를 공략할 힘은 있지만, 후라도의 한화전 억제력이 이를 묶을 가능성이 큽니다. 한화는 외인 투수의 부진과 연패 흐름으로 분위기가 가라앉아 있어 대전 홈 이점도 상쇄됩니다. 선발 우위와 상대 전적, 제구 격차를 종합해 삼성 쪽에 0.62로 기웁니다."
  },
  {
    // kia(네일) @ kt(오원석) — 수원
    game_id: "c5b65bea-d7a0-4a44-b381-899062fb7c1a",
    predicted_winner_team_id: "kt",
    confidence: 0.54,
    key_factor: "KT 출루 타선·홈 + 네일의 KT 상대 부진 이력",
    one_liner:
      "KIA 네일이 시즌 평균 자책점 3점대의 에이스지만 KT 상대로는 통산 평균 자책점이 7점대로 유독 고전해 왔고, KT 타선이 출루율 리그 상위에 수원 홈 이점까지 갖췄습니다. 시즌 성적은 네일이 앞서도 이 매치업에선 KT가 근소하게 우세하다고 봅니다.",
    detailed_analysis:
      "시즌 스탯만 보면 KIA 네일(ERA 3.43, WHIP 1.09, BB9 1.66)이 KT 오원석(ERA 5.12, WHIP 1.44)보다 확실히 앞섭니다. 다만 상대팀 전적이 흥미로운 신호를 줍니다. 네일은 KT 상대 2선발 10이닝에서 평균 자책점 7.20, 이닝당 주자 1.70으로 유독 고전했고, 오원석도 KIA 상대 평균 자책점 5.73으로 평범해 이 매치업 한정으로는 격차가 좁혀집니다. 표본이 2경기씩으로 작아 단정할 수는 없지만, KT 타선이 네일을 상대로 까다로운 상대였다는 점은 참고할 만합니다. 타선은 KT(평균 .280, 출루율 .380)가 안현민 복귀 후 출루 능력이 리그 상위라 KIA(평균 .256, 출루율 .324)보다 앞서고, 수원 홈 이점도 KT 쪽입니다. 네일이 시즌 폼대로 던지면 KIA가 가져갈 수 있는 박빙이지만, 홈·타선·상대 전적을 더해 KT 쪽에 0.54로 살짝 기웁니다."
  },
  {
    // doosan(벤자민) @ lg(이정용) — 잠실
    game_id: "eeb4f8d7-79e7-46e3-b251-2d5879039154",
    predicted_winner_team_id: "doosan",
    confidence: 0.54,
    key_factor: "벤자민 선발 우위 vs LG 불펜데이(이정용)",
    one_liner:
      "두산 벤자민이 평균 자책점 2점대에 피홈런이 거의 없는 안정형인 반면, LG는 정규 선발이 아닌 이정용을 올리는 불펜데이로 맞서 선발 안정성에서 크게 밀립니다. 두산이 잠실 원정에서 선발 우위를 살려볼 만한 경기입니다.",
    detailed_analysis:
      "선발 매치업이 이 경기의 핵심입니다. 두산 벤자민(ERA 2.86, WHIP 1.34, HR9 0.16)은 피홈런을 거의 내주지 않는 안정형 에이스로, LG 상대 전적에서도 1선발 7이닝 평균 자책점 3.86으로 무난했습니다. 반면 LG는 정규 선발이 빠져 이정용(ERA 6.42, WHIP 1.93)을 올리는 불펜데이로 맞서, 초반부터 두산 타선에 점수를 내줄 위험이 큽니다. 타선은 LG가 낫습니다. LG 라인업(평균 .274, 출루율 .373)은 홍창기·오스틴 중심의 출루가 리그 상위라 벤자민을 상대로도 주자를 쌓을 수 있고, 두산 라인업(평균 .267, 출루율 .354)은 양의지 중심으로 이정용을 공략하기 좋습니다. LG가 시즌 1위의 저력과 잠실 홈, 불펜 총력전으로 메울 여지는 있지만, 선발 안정성의 뚜렷한 격차에 무게를 둬 두산 쪽에 0.54로 기웁니다."
  },
  {
    // ssg(베니지아노) @ nc(토다) — 창원
    game_id: "f5537183-bfad-48c4-a044-bc996ce0577f",
    predicted_winner_team_id: "ssg",
    confidence: 0.53,
    key_factor: "양 선발 불안 → SSG 장타력 우위",
    one_liner:
      "베니지아노와 토다 모두 평균 자책점 5점대의 불안한 선발이라 타선 싸움으로 흐를 공산이 큰데, 장타력이 리그 상위인 SSG가 한 방으로 앞서갈 가능성이 큽니다. 다만 NC 홈이라 접전이 예상됩니다.",
    detailed_analysis:
      "양 선발이 모두 불안해 타선 싸움으로 흐를 카드입니다. SSG 베니지아노(ERA 5.26, WHIP 1.51, HR9 1.38)와 NC 토다(ERA 5.04, WHIP 1.55, HR9 1.19) 모두 이닝당 주자가 많고 피홈런이 잦습니다. 상대팀 전적은 표본이 거의 없어(베니지아노는 NC전 기록 없음, 토다는 SSG전 4이닝뿐) 참고 가치가 낮습니다. 그래서 타선에서 갈린다고 봅니다. SSG 라인업(평균 .268, 출루율 .341, 장타력 .470, ISO .202)은 최정·김재환·에레디아·고명준의 장타력이 리그 최상위권이라 토다의 피홈런을 한 방으로 응징하기 좋고, NC 라인업(평균 .254, 출루율 .351, 장타력 .389)은 출루는 비슷해도 장타에서 밀립니다. 양 선발 모두 일찍 흔들릴 수 있어 불펜 싸움 변수가 크고 창원 홈은 NC 쪽이라 박빙이지만, SSG의 장타력 우위에 살짝 무게를 둬 0.53으로 기웁니다."
  },
  {
    // lotte(이민석) @ kiwoom(알칸타라) — 고척
    game_id: "fe08d41b-25e7-4dcc-beec-262e5b2b3849",
    predicted_winner_team_id: "kiwoom",
    confidence: 0.55,
    key_factor: "알칸타라 선발 우위 vs 이민석 제구 불안 + 롯데 타선 침체",
    one_liner:
      "키움 알칸타라가 평균 자책점 2점대의 에이스인 반면 롯데 이민석은 평균 자책점이 6점대인 제구 불안형이고, 롯데 타선은 출루율이 3할 아래로 처진 리그 최악 상태입니다. 고척 홈의 키움이 선발 우위를 살려 앞설 전망입니다.",
    detailed_analysis:
      "선발 신뢰도에서 키움이 앞섭니다. 키움 알칸타라(ERA 2.96, WHIP 1.13, BB9 1.27)는 9이닝당 볼넷 1.3개의 정교한 제구를 갖춘 에이스이고, 롯데 이민석(ERA 6.57, WHIP 1.66, BB9 4.74)은 볼넷이 잦은 제구 불안형이라 격차가 큽니다. 다만 상대팀 전적은 경계 신호를 줍니다. 알칸타라는 롯데 상대 2선발 12이닝에서 평균 자책점 6.00, 이닝당 주자 1.83으로 의외로 고전한 이력이 있어, 롯데 타선이 알칸타라에 강했던 흔적이 있습니다. 그러나 그 기록은 4월의 것이고, 현재 롯데 라인업(평균 .241, 출루율 .298, 장타력 .373)은 출루율이 3할 아래로 떨어진 리그 최악의 침체 상태라 재현 가능성은 낮습니다. 키움 라인업(평균 .242, 출루율 .335, 장타력 .346)도 빈약하지만, 이민석의 제구 난조를 공략할 여지는 더 큽니다. 고척 홈과 선발 격차에 무게를 두되, 알칸타라의 롯데전 이력을 반영해 confidence는 0.55로 다소 보수적으로 잡습니다."
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
