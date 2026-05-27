// KBO 박스스코어 데이터 소스 프로브.
//   1. GetKboGameList로 특정 날짜 경기 + gameId 형식 확인
//   2. 그 gameId로 박스스코어 후보 엔드포인트들 시도 → 타자/라인업 데이터 어디서 오는지 탐색
//
// Usage: node scripts/probe-kbo-boxscore.mjs 2026-05-27

const dateArg = process.argv[2] ?? "2026-05-27";
const yyyymmdd = dateArg.replaceAll("-", "");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";
const BASE = "https://www.koreabaseball.com";

function divider(title) {
  console.log("\n" + "=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

// ── 1. 게임 목록 + gameId 확인 ──────────────────────────────
divider(`1. GetKboGameList (${dateArg})`);
let firstGameId = null;
try {
  const res = await fetch(`${BASE}/ws/Main.asmx/GetKboGameList`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Referer: `${BASE}/Schedule/Schedule.aspx`,
      "X-Requested-With": "XMLHttpRequest",
      Origin: BASE
    },
    body: new URLSearchParams({ leId: "1", srId: "0", date: yyyymmdd }).toString()
  });
  console.log("status:", res.status);
  const text = await res.text();
  const data = JSON.parse(text);
  const games = data?.game ?? [];
  console.log("game count:", games.length);
  if (games[0]) {
    // 게임 객체 전체 키 확인 — gameId 필드명 파악
    console.log("game[0] keys:", Object.keys(games[0]).join(", "));
    console.log("game[0] sample:", JSON.stringify(games[0], null, 2).slice(0, 1200));
    // 흔한 gameId 필드 후보
    firstGameId =
      games[0].G_ID ?? games[0].GAME_ID ?? games[0].gameId ?? games[0].GMKEY ?? null;
    console.log("추정 gameId:", firstGameId);
  }
} catch (err) {
  console.log("ERROR:", err.message);
}

if (!firstGameId) {
  console.log("\ngameId를 못 찾음 — 위 game[0] 객체에서 ID로 보이는 필드를 확인하세요.");
  process.exit(0);
}

// ── 2. 박스스코어 후보 엔드포인트 시도 ──────────────────────
const seasonId = dateArg.slice(0, 4);

const candidates = [
  {
    name: "Schedule.asmx/GetBoxScoreScoreboard",
    url: `${BASE}/ws/Schedule.asmx/GetBoxScoreScoreboard`,
    body: { leId: "1", srId: "0", seasonId, gameId: firstGameId }
  },
  {
    name: "Schedule.asmx/GetBoxScore",
    url: `${BASE}/ws/Schedule.asmx/GetBoxScore`,
    body: { leId: "1", srId: "0", seasonId, gameId: firstGameId }
  },
  {
    name: "GameCenter Main.asmx/GetKboGameRecord",
    url: `${BASE}/ws/Main.asmx/GetKboGameRecord`,
    body: { leId: "1", srId: "0", seasonId, gameId: firstGameId }
  },
  // 게임센터 HTML 페이지 — AJAX 아니라 SSR이면 여기 데이터 있음
  {
    name: "GameCenter HTML (BoxScore.aspx)",
    url: `${BASE}/Schedule/GameCenter/Main.aspx?leagueId=1&seriesId=0&gameId=${firstGameId}&gameDate=${yyyymmdd}&section=REVIEW`,
    isHtml: true
  }
];

for (const c of candidates) {
  divider(`2. ${c.name}`);
  try {
    const opts = c.isHtml
      ? { cache: "no-store", headers: { "User-Agent": UA } }
      : {
          method: "POST",
          cache: "no-store",
          headers: {
            "User-Agent": UA,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            Referer: `${BASE}/Schedule/GameCenter/Main.aspx`,
            "X-Requested-With": "XMLHttpRequest",
            Origin: BASE
          },
          body: new URLSearchParams(c.body).toString()
        };
    const res = await fetch(c.url, opts);
    console.log("status:", res.status);
    const text = await res.text();
    console.log("length:", text.length);
    // 타자/라인업 흔적 탐색
    const hints = ["타순", "선수명", "batter", "Batter", "HITTER", "타자", "lineup", "타율", "선발"];
    const found = hints.filter((h) => text.includes(h));
    console.log("키워드 발견:", found.length ? found.join(", ") : "(없음)");
    console.log("본문 앞 400자:", text.slice(0, 400).replace(/\s+/g, " "));
  } catch (err) {
    console.log("ERROR:", err.message);
  }
}

console.log("\n\n프로브 완료. 키워드(타순/선수명/타율 등)가 발견된 엔드포인트가 라인업 소스 후보입니다.");
