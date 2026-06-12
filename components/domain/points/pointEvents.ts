export const POINT_BALANCE_UPDATED_EVENT = "ballplay:point-balance-updated";

export function emitPointBalanceUpdated(balance?: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(POINT_BALANCE_UPDATED_EVENT, { detail: { balance } }));
}
