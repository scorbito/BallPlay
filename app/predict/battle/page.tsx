import { renderBattleList, BATTLE_REVALIDATE } from "@/lib/predict/battleList";

// 정적/ISR — 기본(최신) 배틀 리스트. 날짜 지정은 /predict/battle/date/[date].
export const revalidate = BATTLE_REVALIDATE;

export default async function AiBattleListPage() {
  return renderBattleList(null);
}
