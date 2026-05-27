// 박스스코어 타자 테이블 cell의 전체 필드 확인 — playerId가 Class/링크 등에 숨어있나.
// Usage: node scripts/probe-kbo-boxscore-cells.mjs 20260527KTOB0 2026

const gameId = process.argv[2] ?? "20260527KTOB0";
const seasonId = process.argv[3] ?? "2026";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";
const BASE = "https://www.koreabaseball.com";

const res = await fetch(`${BASE}/ws/Schedule.asmx/GetBoxScore`, {
  method: "POST",
  cache: "no-store",
  headers: {
    "User-Agent": UA,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Referer: `${BASE}/Schedule/GameCenter/Main.aspx`,
    "X-Requested-With": "XMLHttpRequest",
    Origin: BASE
  },
  body: new URLSearchParams({ leId: "1", srId: "0", seasonId, gameId }).toString()
});

const data = JSON.parse(await res.text());
const batterTable = data.tables[1];

// 첫 3개 타자 행의 cell 전체 구조 (선수명 cell에 playerId 단서 있나)
console.log("=== 타자 테이블 row[0]의 모든 cell 전체 필드 ===");
const row0 = batterTable.rows[0].row;
row0.forEach((cell, i) => {
  console.log(`cell[${i}]:`, JSON.stringify(cell));
});

console.log("\n=== 선수명 cell만 (index 2) — 3개 행 ===");
batterTable.rows.slice(0, 3).forEach((r, i) => {
  console.log(`row[${i}] 선수명 cell:`, JSON.stringify(r.row[2]));
});

// data 전체 최상위 키 — 혹시 lineup 전용 필드 있나
console.log("\n=== GetBoxScore 응답 최상위 키 ===");
console.log(Object.keys(data).join(", "));
