import { POINT_LABEL, POINT_REWARDS } from "@/lib/points/config";

export type StadiumPointClaimResult = {
  ok?: boolean;
  awarded?: boolean;
  amount?: number;
  balance?: number;
  baseAmount?: number;
  bonusAmount?: number;
  earnedToday?: number;
  awardedToday?: number;
  firstTierCount?: number | null;
  firstTierLimit?: number;
  nextAmount?: number;
  policyMessage?: string;
  error?: string;
};

export function formatStadiumPointToast(result: StadiumPointClaimResult): string {
  const amount = Number(result.amount ?? 0);
  const baseAmount = Number(result.baseAmount ?? POINT_REWARDS.stadiumOfficialAfterFive);
  const bonusAmount = Number(result.bonusAmount ?? Math.max(0, amount - baseAmount));

  if (bonusAmount > 0) {
    const count = Number(result.firstTierCount ?? 1);
    const limit = Number(result.firstTierLimit ?? POINT_REWARDS.stadiumOfficialFirstFiveCount);
    return `공식 경기 +${baseAmount}${POINT_LABEL} 획득!\n첫 ${limit}경기 보너스 +${bonusAmount}${POINT_LABEL} (${count}/${limit})`;
  }

  return `공식 경기 +${baseAmount}${POINT_LABEL} 획득!`;
}

export async function claimStadiumRecordPoints(recordId: string): Promise<StadiumPointClaimResult> {
  const res = await fetch("/api/points/stadium-record", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recordId })
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) as StadiumPointClaimResult : {};
  if (!res.ok || data.ok === false) {
    return { ok: false, error: data.error ?? "stadium point claim failed" };
  }
  return data;
}
