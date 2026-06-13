"use server";

import { revalidatePath } from "next/cache";
import { getUserTier } from "@/lib/auth/userTier";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adjustPointBalance, setPointBalance } from "@/lib/server/points";

export type AdminBpAdjustResult =
  | { ok: true; balance: number; adjusted: number }
  | { ok: false; error: string };

async function requireAdminUser(): Promise<string> {
  const serverClient = createSupabaseServerClient();
  const [{ data: authData }, tierResult] = await Promise.all([
    serverClient.auth.getUser(),
    getUserTier(serverClient)
  ]);

  if (!authData.user) throw new Error("로그인이 필요합니다.");
  if (tierResult.tier !== "admin") throw new Error("운영자 권한이 필요합니다.");
  return authData.user.id;
}

export async function adjustMyBpForAdminAction(amount: number): Promise<AdminBpAdjustResult> {
  try {
    const userId = await requireAdminUser();
    const result = await adjustPointBalance({
      userId,
      amount,
      reason: "admin_test_adjust",
      metadata: { source: "admin_events" }
    });

    revalidatePath("/admin/events");
    revalidatePath("/my");
    return { ok: true, balance: result.balance, adjusted: result.adjusted };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "BP 조정에 실패했습니다." };
  }
}

export async function resetMyBpForAdminAction(): Promise<AdminBpAdjustResult> {
  try {
    const userId = await requireAdminUser();
    const result = await setPointBalance({
      userId,
      balance: 0,
      reason: "admin_test_reset",
      metadata: { source: "admin_events" }
    });

    revalidatePath("/admin/events");
    revalidatePath("/my");
    return { ok: true, balance: result.balance, adjusted: result.adjusted };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "BP 초기화에 실패했습니다." };
  }
}
