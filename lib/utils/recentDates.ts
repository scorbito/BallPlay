// 최근 N일(KST) 날짜 파라미터 — [date] 세그먼트의 generateStaticParams 용.
//
// Next.js 는 동적 세그먼트([date])에 generateStaticParams 가 있어야 라우트를 ISR(●)로
// 잡는다. 없으면 revalidate 를 붙여도 ƒ(동적)로 매 요청 서버 렌더(no-store). 최근 날짜를
// 프리렌더해두면 봇이 가장 많이 긁는 날짜별 URL 이 전부 CDN 캐시로 서빙된다.
// (빌드 타임 실행이라 Date.now 사용 가능 — 목록 밖 날짜는 on-demand ISR 로 캐시.)
export function recentDateParams(days: number): { date: string }[] {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const out: { date: string }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(nowKST);
    d.setUTCDate(nowKST.getUTCDate() - i);
    out.push({ date: d.toISOString().split("T")[0] });
  }
  return out;
}
