import {
  PITCHER_CLOSER_INDEX,
  PITCHER_REQUIRED_BULLPEN_INDEX,
  PITCHER_SLOTS_COUNT,
  PITCHER_STARTER_INDEX,
  type SavedPitcherLineup
} from "@/lib/types/lineup";
import { getTeamStats } from "./statsLoader";

/** 사용자가 직접 선택한 자리는 보존하고 빈 슬롯만 자동으로 채운다.
 *  - 선발(slot 0): stamina 높은 순 (autoFillPitcherLineup과 동일)
 *  - 마무리(slot 1): saves 많은 순 → tiebreak stamina
 *  - 불펜(slot 2~8): ERA 낮은 순 → tiebreak WHIP
 *  - 이미 어딘가에 배치된 선수는 다시 안 씀(중복 방지).
 *  공개 시 / 시뮬 진입 시 호출되어 빈 자리를 완성한다. */
export function fillMissingPitcherSlots(
  teamId: string,
  current: (string | null)[]
): SavedPitcherLineup | null {
  const stats = getTeamStats(teamId);
  if (stats.pitchers.length < 1) return null;

  const slots = Array.from({ length: PITCHER_SLOTS_COUNT }, (_, i) => current[i] ?? null);
  const used = new Set<string>();
  slots.forEach((id) => id && used.add(id));

  // 선발 자리가 비어있으면 stamina 기준으로 채움 (autoFillPitcherLineup과 동일 기준)
  if (!slots[PITCHER_STARTER_INDEX]) {
    const starterPick = [...stats.pitchers]
      .filter((p) => !used.has(p.playerId))
      .sort((a, b) => b.staminaPitches - a.staminaPitches)[0];
    if (starterPick) {
      slots[PITCHER_STARTER_INDEX] = starterPick.playerId;
      used.add(starterPick.playerId);
    }
  }

  // 마무리 자리가 비어있으면 saves 기준으로 1명 채움
  if (!slots[PITCHER_CLOSER_INDEX]) {
    const closerPick = [...stats.pitchers]
      .filter((p) => !used.has(p.playerId))
      .sort((a, b) => {
        if (b.saves !== a.saves) return b.saves - a.saves;
        return b.staminaPitches - a.staminaPitches;
      })[0];
    if (closerPick) {
      slots[PITCHER_CLOSER_INDEX] = closerPick.playerId;
      used.add(closerPick.playerId);
    }
  }

  // 불펜 자리는 ERA 낮은 순으로 채움 (낮을수록 좋음)
  const bullpenPool = [...stats.pitchers]
    .filter((p) => !used.has(p.playerId))
    .sort((a, b) => {
      const ea = a.era || 99;
      const eb = b.era || 99;
      if (ea !== eb) return ea - eb;
      return (a.whip || 99) - (b.whip || 99);
    });
  let bullpenIdx = 0;
  for (let slot = PITCHER_REQUIRED_BULLPEN_INDEX; slot < PITCHER_SLOTS_COUNT; slot += 1) {
    if (slots[slot]) continue;
    const pitcher = bullpenPool[bullpenIdx];
    if (!pitcher) break;
    slots[slot] = pitcher.playerId;
    used.add(pitcher.playerId);
    bullpenIdx += 1;
  }

  return {
    teamId,
    slots,
    updatedAt: new Date().toISOString()
  };
}

export function autoFillPitcherLineup(teamId: string): SavedPitcherLineup | null {
  const stats = getTeamStats(teamId);
  if (stats.pitchers.length < 1) return null;

  const slots: (string | null)[] = Array.from({ length: PITCHER_SLOTS_COUNT }, () => null);
  const byStamina = [...stats.pitchers].sort((a, b) => b.staminaPitches - a.staminaPitches);
  const starter = byStamina[0];
  slots[PITCHER_STARTER_INDEX] = starter.playerId;

  const withoutStarter = byStamina.filter((p) => p.playerId !== starter.playerId);
  const closer = [...withoutStarter].sort((a, b) => {
    if (b.saves !== a.saves) return b.saves - a.saves;
    return b.staminaPitches - a.staminaPitches;
  })[0];
  if (closer) slots[PITCHER_CLOSER_INDEX] = closer.playerId;

  const bullpenPool = withoutStarter.filter((p) => p.playerId !== closer?.playerId);
  for (let slot = PITCHER_REQUIRED_BULLPEN_INDEX; slot < PITCHER_SLOTS_COUNT; slot += 1) {
    const pitcher = bullpenPool[slot - PITCHER_REQUIRED_BULLPEN_INDEX];
    if (!pitcher) break;
    slots[slot] = pitcher.playerId;
  }

  return {
    teamId,
    slots,
    updatedAt: new Date().toISOString()
  };
}
