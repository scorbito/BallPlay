// GetBoxScore JSON의 tables 구조 분석 — 어느 table이 타자 기록인지, 셀 배치 확인.
// Usage: node scripts/probe-kbo-boxscore-tables.mjs 20260527KTOB0 2026

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
const tables = data?.tables ?? [];
console.log("table 개수:", tables.length);

tables.forEach((t, i) => {
  const rows = t.rows ?? [];
  // 헤더 행 텍스트 (있으면)
  const headerTexts = (t.headers ?? []).map((h) => (h.row ?? []).map((c) => c.Text).join("|"));
  // 첫 데이터 행 텍스트
  const firstRow = rows[0]?.row?.map((c) => c.Text) ?? [];
  const secondRow = rows[1]?.row?.map((c) => c.Text) ?? [];
  console.log(`\n--- table[${i}] rows=${rows.length} ---`);
  if (headerTexts.length) console.log("  headers:", JSON.stringify(headerTexts));
  console.log("  row[0]:", JSON.stringify(firstRow));
  console.log("  row[1]:", JSON.stringify(secondRow));
});

// 타자 기록으로 추정되는 table 자세히 (타순+포지션+선수명 패턴 찾기)
console.log("\n\n=== 타자 테이블 추정 (선수명/타순 패턴) ===");
tables.forEach((t, i) => {
  const rows = t.rows ?? [];
  // 한 행에 숫자(타순)+한글약어(포지션)+이름 패턴이 있나 확인
  const sample = rows.slice(0, 12).map((r) => (r.row ?? []).map((c) => c.Text));
  const looksLikeBatters = sample.some(
    (cells) => cells.length >= 3 && /^[1-9]$/.test(cells[0]?.trim?.() ?? "")
  );
  if (looksLikeBatters) {
    console.log(`\n>>> table[${i}] 타자 후보 — 앞 12행:`);
    sample.forEach((cells, ri) => console.log(`   [${ri}]`, JSON.stringify(cells.slice(0, 5))));
  }
});
