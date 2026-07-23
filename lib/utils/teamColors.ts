// 두 팀 색상이 비슷할 때 어웨이 막대 색을 구분되게 보정.
//   1) 홈/어웨이 고유색이 충분히 다르면 어웨이 고유색 그대로
//   2) 비슷하면 어웨이 2번째 색(accent)이 충분히 다른 경우 그걸로
//   3) 그래도 안 되면 홈색에서 멀어지게 밝게/어둡게 보정한 색
// (기존 AiWinnerStatsTab 등 여러 곳의 동일 로직을 공용화)

/**
 * 열세 쪽 지표 막대 색 — 우세한 쪽만 팀 컬러로 남겨 그래프만 봐도 우열이 읽히게 한다.
 * (AI 예측 상세의 팀 전력/선발/불펜/타선 비교 공용)
 */
export const BAR_MUTED_COLOR = "#cbd5e1";

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
  // 밝게 보정은 '원정 팀 색' 기준으로 한다. 홈 색 기준으로 흰색과 섞으면
  // 홈이 검정·회색일 때 결과가 무채색이 되어 '열세 회색'과 구분이 안 된다.
  // (섞는 비율도 낮춰 채도를 살림 — 흰색을 많이 섞을수록 회색빛이 된다)
  const lighter: [number, number, number] = [
    away[0] + (255 - away[0]) * 0.4,
    away[1] + (255 - away[1]) * 0.4,
    away[2] + (255 - away[2]) * 0.4
  ];
  const darker: [number, number, number] = [away[0] * 0.5, away[1] * 0.5, away[2] * 0.5];

  // 폴백이 '열세 회색'과 비슷하면 우열 판별이 안 되므로, 회색에서 먼 쪽을 고른다.
  // (밝게 보정하면 회색빛이 되기 쉬워 어둡게 보정한 색이 대체로 안전)
  const muted = hexToRgb(BAR_MUTED_COLOR);
  const lighterOk = colorDist(home, lighter) >= 110 && colorDist(muted, lighter) >= 110;
  const darkerOk = colorDist(home, darker) >= 110 && colorDist(muted, darker) >= 110;
  let chosen: [number, number, number];
  if (darkerOk && !lighterOk) chosen = darker;
  else if (lighterOk && !darkerOk) chosen = lighter;
  else {
    // 둘 다 되거나 둘 다 안 되면 — 홈/회색 양쪽에서 가장 먼 쪽.
    const scoreL = Math.min(colorDist(home, lighter), colorDist(muted, lighter));
    const scoreD = Math.min(colorDist(home, darker), colorDist(muted, darker));
    chosen = scoreD >= scoreL ? darker : lighter;
  }
  return rgbToHex(chosen[0], chosen[1], chosen[2]);
}
