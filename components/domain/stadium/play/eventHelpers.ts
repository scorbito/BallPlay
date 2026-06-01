import type { InningLog } from "@/lib/sim/types";
import type { FlatEvent } from "./types";

export function flatten(innings: InningLog[]): FlatEvent[] {
  const out: FlatEvent[] = [];
  let home = 0;
  let away = 0;
  for (const ing of innings) {
    let halfIdx = 0;
    for (const ab of ing.top.atBats) {
      away += ab.runsScored;
      out.push({ inning: ing.inning, half: "top", index: halfIdx++, ab, scoreSnapshot: { home, away } });
    }
    if (ing.bottom) {
      halfIdx = 0;
      for (const ab of ing.bottom.atBats) {
        home += ab.runsScored;
        out.push({ inning: ing.inning, half: "bottom", index: halfIdx++, ab, scoreSnapshot: { home, away } });
      }
    }
  }
  return out;
}

export function buildLinescore(innings: InningLog[], visibleCount: number, events: FlatEvent[]) {
  const visibleEvents = events.slice(0, visibleCount);
  const seenInning = new Map<string, number>();

  for (const ev of visibleEvents) {
    const key = `${ev.inning}|${ev.half}`;
    seenInning.set(key, (seenInning.get(key) ?? 0) + ev.ab.runsScored);
  }

  const totalInnings = Math.max(9, ...innings.map((i) => i.inning));

  const lastEvent = visibleEvents[visibleEvents.length - 1];
  const currentInning = lastEvent?.inning ?? 1;
  const currentHalf = lastEvent?.half ?? "top";

  type Cell = { runs: number | null };
  const away: Cell[] = [];
  const home: Cell[] = [];

  for (let i = 1; i <= totalInnings; i++) {
    const topKey = `${i}|top`;
    const botKey = `${i}|bottom`;

    away.push({ runs: seenInning.has(topKey) ? seenInning.get(topKey)! : null });

    const inningData = innings.find((x) => x.inning === i);
    if (inningData && inningData.bottom === null) {
      home.push({ runs: null });
    } else if (seenInning.has(botKey)) {
      home.push({ runs: seenInning.get(botKey)! });
    } else {
      home.push({ runs: null });
    }
  }

  return { away, home, currentInning, currentHalf, totalInnings };
}
