// 선수명 워들 데이터 스냅샷 생성.
//
//   node scripts/build-wordle-answers.mjs
//
// 생성물 2개:
//   data/wordle/guessable.json — 추측 허용 풀(3음절 전원). 이름·팀·포지션그룹·등번호만.
//   data/wordle/answers.json   — 정답 풀(3음절 + 규정 출장 이상)을 고정 시드로 셔플한 id 목록.
//
// 왜 스냅샷인가:
//   로스터는 스크래퍼로 갱신된다. 정답 풀을 런타임에 매번 계산하면 로스터가 바뀔 때
//   배열 순서가 흔들려 "진행 중인 그날의 정답이 바뀌는" 사고가 난다.
//   그래서 순서를 파일에 고정하고, 갱신 시에는 기존 순서를 유지한 채 뒤에만 append 한다.
//
// 정답 id 는 base64 로 감싼다. 개발자 도구를 열면 결국 보이지만(캐주얼 데일리 퍼즐의
// 일반적 트레이드오프), 번들을 눈으로 훑다가 우연히 스포일러를 당하는 건 막는다.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROSTER_DIR = join(ROOT, "data", "rosters");
const OUT_DIR = join(ROOT, "data", "wordle");

/** 정답이 되기 위한 최소 시즌 출장 수. 1군 주력만 정답으로 삼아 "누군지 모르는 선수" 불만을 막는다. */
const MIN_SEASON_GAMES = 30;
/** 격자가 3칸 고정이라 3음절만 다룬다(로스터 940명 중 898명 = 95.5%). */
const NAME_SYLLABLES = 3;

const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;

function isCompleteHangul(ch) {
  const code = ch.codePointAt(0);
  return code >= HANGUL_FIRST && code <= HANGUL_LAST;
}

function isThreeSyllableHangul(name) {
  const chars = Array.from(name);
  return chars.length === NAME_SYLLABLES && chars.every(isCompleteHangul);
}

/**
 * KBO 원본은 투수/포수/내야수/외야수 4분류만 제공하고, 스크래퍼가 내야수를 3B,
 * 외야수를 CF 로 기본 매핑한다(data/rosters/*.json 의 _note 참조).
 * 따라서 3B·SS 같은 세부 포지션은 신뢰할 수 없고 4개 그룹까지만 쓴다.
 */
function toPositionGroup(primaryPosition) {
  if (primaryPosition === "P") return "투수";
  if (primaryPosition === "C") return "포수";
  if (["1B", "2B", "3B", "SS"].includes(primaryPosition)) return "내야수";
  return "외야수";
}

/** mulberry32 — 고정 시드 PRNG. 재실행해도 같은 순서가 나와야 하므로 Math.random 을 쓰지 않는다. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHUFFLE_SEED = 20260801;

function shuffleFixed(items) {
  const rand = mulberry32(SHUFFLE_SEED);
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function encodeId(id) {
  return Buffer.from(id, "utf8").toString("base64");
}

// ── 로스터 로드 ──
const players = [];
for (const file of readdirSync(ROSTER_DIR)) {
  if (!file.endsWith(".json")) continue;
  // 국가대표 로스터는 팀 로스터 참조 목록이라 선수 원본이 없다.
  if (file.startsWith("national")) continue;
  const roster = JSON.parse(readFileSync(join(ROSTER_DIR, file), "utf8"));
  for (const player of roster.players ?? []) {
    if (!isThreeSyllableHangul(player.name)) continue;
    players.push({
      id: player.id,
      name: player.name,
      teamId: roster.teamId,
      posGroup: toPositionGroup(player.primaryPosition),
      jersey: typeof player.jerseyNumber === "number" ? player.jerseyNumber : 0,
      seasonGames: typeof player.seasonGames === "number" ? player.seasonGames : 0
    });
  }
}
players.sort((a, b) => a.id.localeCompare(b.id));

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ── guessable.json — 추측 허용 풀 ──
// seasonGames 는 화면에서 안 쓰므로 제외(번들 용량 + 정답 추론 힌트 방지).
const guessable = players.map(({ id, name, teamId, posGroup, jersey }) => ({
  id,
  name,
  teamId,
  posGroup,
  jersey
}));
writeFileSync(
  join(OUT_DIR, "guessable.json"),
  `${JSON.stringify({ players: guessable }, null, 0)}\n`,
  "utf8"
);

// ── answers.json — 정답 풀 ──
const answerPool = players.filter((p) => p.seasonGames >= MIN_SEASON_GAMES);
const answersPath = join(OUT_DIR, "answers.json");

let orderedIds;
if (existsSync(answersPath)) {
  // 기존 순서 유지 + 신규만 뒤에 append. 과거 정답 이력이 보존된다.
  const prev = JSON.parse(readFileSync(answersPath, "utf8"));
  const prevIds = (prev.answers ?? []).map((e) => Buffer.from(e, "base64").toString("utf8"));
  const poolIds = new Set(answerPool.map((p) => p.id));
  const kept = prevIds.filter((id) => poolIds.has(id));
  const dropped = prevIds.filter((id) => !poolIds.has(id));
  const fresh = shuffleFixed(answerPool.map((p) => p.id)).filter((id) => !prevIds.includes(id));
  orderedIds = [...kept, ...fresh];
  console.log(`기존 ${prevIds.length}개 중 유지 ${kept.length} / 제외 ${dropped.length} / 신규 ${fresh.length}`);
} else {
  orderedIds = shuffleFixed(answerPool.map((p) => p.id));
}

writeFileSync(
  answersPath,
  `${JSON.stringify(
    {
      _note:
        "선수명 워들 정답 순서 스냅샷. 순서를 바꾸면 과거 정답 이력이 어긋난다 — 갱신 시 뒤에만 append.",
      minSeasonGames: MIN_SEASON_GAMES,
      answers: orderedIds.map(encodeId)
    },
    null,
    0
  )}\n`,
  "utf8"
);

const byTeam = {};
for (const p of answerPool) byTeam[p.teamId] = (byTeam[p.teamId] ?? 0) + 1;
console.log(`추측 풀 ${guessable.length}명 / 정답 풀 ${orderedIds.length}명`);
console.log(`정답 풀 팀별: ${Object.entries(byTeam).map(([t, n]) => `${t} ${n}`).join(", ")}`);
