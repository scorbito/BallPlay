import {
  PITCHER_CLOSER_INDEX,
  PITCHER_REQUIRED_BULLPEN_INDEX,
  PITCHER_SLOTS_COUNT,
  PITCHER_STARTER_INDEX,
  type SavedPitcherLineup
} from "@/lib/types/lineup";
import { getTeamStats } from "./statsLoader";

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
