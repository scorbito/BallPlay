// 두 팀 색상이 비슷할 때 어웨이 막대 색을 구분되게 보정.
//   1) 홈/어웨이 고유색이 충분히 다르면 어웨이 고유색 그대로
//   2) 비슷하면 어웨이 2번째 색(accent)이 충분히 다른 경우 그걸로
//   3) 그래도 안 되면 홈색에서 멀어지게 밝게/어둡게 보정한 색
// (기존 AiWinnerStatsTab 등 여러 곳의 동일 로직을 공용화)

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const n = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const int = parseInt(n, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function colorDist(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/** 홈 색과 구분되는 어웨이 막대 색을 반환. */
export function ensureAwayFill(homeHex: string, awayHex: string, awayAccent?: string): string {
  const home = hexToRgb(homeHex);
  const away = hexToRgb(awayHex);
  if (colorDist(home, away) >= 110) return awayHex;
  if (awayAccent) {
    const acc = hexToRgb(awayAccent);
    if (colorDist(home, acc) >= 110) return awayAccent;
  }
  const lighter: [number, number, number] = [
    home[0] + (255 - home[0]) * 0.55,
    home[1] + (255 - home[1]) * 0.55,
    home[2] + (255 - home[2]) * 0.55
  ];
  const darker: [number, number, number] = [away[0] * 0.5, away[1] * 0.5, away[2] * 0.5];
  const chosen = colorDist(home, lighter) >= colorDist(home, darker) ? lighter : darker;
  return rgbToHex(chosen[0], chosen[1], chosen[2]);
}
