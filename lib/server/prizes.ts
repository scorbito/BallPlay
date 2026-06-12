import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type PointPrizeStatus = "draft" | "active" | "closed" | "drawn" | "cancelled";

export type PointPrize = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  entryCost: number;
  winnerCount: number;
  prizeItems: Array<{
    id: string;
    rankLabel: string | null;
    title: string;
    description: string | null;
    imageUrl: string | null;
    winnerCount: number;
    sortOrder: number;
  }>;
  startsAt: string;
  endsAt: string;
  drawAt: string;
  status: PointPrizeStatus;
  totalEntries: number;
  myEntries: number;
  winners: Array<{
    id: string;
    userId: string;
    prizeItemId: string | null;
    prizeItemTitle: string | null;
    rankLabel: string | null;
    winnerRank: number;
    itemWinnerRank: number | null;
    drawnAt: string;
    isMe: boolean;
  }>;
};

type PrizeRow = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  entry_cost: number | null;
  winner_count: number | null;
  starts_at: string;
  ends_at: string;
  draw_at: string;
  status: PointPrizeStatus;
};

type WinnerRow = {
  id: string;
  prize_id: string;
  prize_item_id: string | null;
  user_id: string;
  winner_rank: number;
  item_winner_rank: number | null;
  drawn_at: string;
};

type PrizeItemRow = {
  id: string;
  prize_id: string;
  rank_label: string | null;
  title: string;
  description: string | null;
  image_url: string | null;
  winner_count: number | null;
  sort_order: number | null;
};

export async function listPointPrizes(userId?: string | null): Promise<PointPrize[]> {
  const admin = createSupabaseAdminClient();
  const { data: prizes, error: prizeError } = await admin
    .from("point_prizes")
    .select("id, title, description, image_url, entry_cost, winner_count, starts_at, ends_at, draw_at, status")
    .in("status", ["active", "closed", "drawn"])
    .order("draw_at", { ascending: true });
  if (prizeError) throw new Error(prizeError.message);

  const rows = (prizes ?? []) as PrizeRow[];
  const prizeIds = rows.map((row) => row.id);
  if (prizeIds.length === 0) return [];

  const [entryCountResult, myEntryResult, winnerResult, prizeItemsResult] = await Promise.all([
    admin
      .from("point_prize_entries")
      .select("prize_id", { count: "exact" })
      .in("prize_id", prizeIds),
    userId
      ? admin
          .from("point_prize_entries")
          .select("prize_id", { count: "exact" })
          .eq("user_id", userId)
          .in("prize_id", prizeIds)
      : Promise.resolve({ data: [], error: null }),
    admin
      .from("point_prize_winners")
      .select("id, prize_id, prize_item_id, user_id, winner_rank, item_winner_rank, drawn_at")
      .in("prize_id", prizeIds)
      .order("winner_rank", { ascending: true }),
    admin
      .from("point_prize_items")
      .select("id, prize_id, rank_label, title, description, image_url, winner_count, sort_order")
      .in("prize_id", prizeIds)
      .order("sort_order", { ascending: true })
  ]);

  if (entryCountResult.error) throw new Error(entryCountResult.error.message);
  if (myEntryResult.error) throw new Error(myEntryResult.error.message);
  if (winnerResult.error) throw new Error(winnerResult.error.message);
  if (prizeItemsResult.error) throw new Error(prizeItemsResult.error.message);

  const totalEntriesByPrize = new Map<string, number>();
  for (const entry of (entryCountResult.data ?? []) as Array<{ prize_id: string }>) {
    totalEntriesByPrize.set(entry.prize_id, (totalEntriesByPrize.get(entry.prize_id) ?? 0) + 1);
  }

  const myEntriesByPrize = new Map<string, number>();
  for (const entry of (myEntryResult.data ?? []) as Array<{ prize_id: string }>) {
    myEntriesByPrize.set(entry.prize_id, (myEntriesByPrize.get(entry.prize_id) ?? 0) + 1);
  }

  const winnersByPrize = new Map<string, WinnerRow[]>();
  for (const winner of (winnerResult.data ?? []) as WinnerRow[]) {
    const current = winnersByPrize.get(winner.prize_id) ?? [];
    current.push(winner);
    winnersByPrize.set(winner.prize_id, current);
  }

  const itemsByPrize = new Map<string, PrizeItemRow[]>();
  const itemById = new Map<string, PrizeItemRow>();
  for (const item of (prizeItemsResult.data ?? []) as PrizeItemRow[]) {
    const current = itemsByPrize.get(item.prize_id) ?? [];
    current.push(item);
    itemsByPrize.set(item.prize_id, current);
    itemById.set(item.id, item);
  }

  return rows.map((row) => {
    const rawItems = itemsByPrize.get(row.id) ?? [];
    const prizeItems = rawItems.length > 0
      ? rawItems.map((item) => ({
          id: item.id,
          rankLabel: item.rank_label,
          title: item.title,
          description: item.description,
          imageUrl: item.image_url,
          winnerCount: Number(item.winner_count ?? 1),
          sortOrder: Number(item.sort_order ?? 1)
        }))
      : [{
          id: `${row.id}:default`,
          rankLabel: null,
          title: row.title,
          description: row.description,
          imageUrl: row.image_url,
          winnerCount: Number(row.winner_count ?? 1),
          sortOrder: 1
        }];
    const winnerCount = prizeItems.reduce((sum, item) => sum + item.winnerCount, 0);
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      imageUrl: row.image_url ?? prizeItems.find((item) => item.imageUrl)?.imageUrl ?? null,
      entryCost: Number(row.entry_cost ?? 200),
      winnerCount,
      prizeItems,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      drawAt: row.draw_at,
      status: row.status,
      totalEntries: totalEntriesByPrize.get(row.id) ?? 0,
      myEntries: myEntriesByPrize.get(row.id) ?? 0,
      winners: (winnersByPrize.get(row.id) ?? []).map((winner) => {
        const prizeItem = winner.prize_item_id ? itemById.get(winner.prize_item_id) : null;
        return {
          id: winner.id,
          userId: winner.user_id,
          prizeItemId: winner.prize_item_id,
          prizeItemTitle: prizeItem?.title ?? null,
          rankLabel: prizeItem?.rank_label ?? null,
          winnerRank: winner.winner_rank,
          itemWinnerRank: winner.item_winner_rank,
          drawnAt: winner.drawn_at,
          isMe: Boolean(userId && winner.user_id === userId)
        };
      })
    };
  });
}

export async function enterPointPrize(input: {
  userId: string;
  prizeId: string;
  quantity?: number;
}): Promise<{
  ok: boolean;
  balance: number;
  spent: number;
  quantity: number;
  entryCount: number;
}> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("enter_point_prize", {
    p_prize_id: input.prizeId,
    p_user_id: input.userId,
    p_quantity: input.quantity ?? 1
  });
  if (error) throw new Error(error.message);

  const result = data as {
    ok?: boolean;
    balance?: number;
    spent?: number;
    quantity?: number;
    entry_count?: number;
  } | null;

  return {
    ok: Boolean(result?.ok),
    balance: Number(result?.balance ?? 0),
    spent: Number(result?.spent ?? 0),
    quantity: Number(result?.quantity ?? input.quantity ?? 1),
    entryCount: Number(result?.entry_count ?? 0)
  };
}

export async function drawPointPrize(prizeId: string): Promise<{
  ok: boolean;
  alreadyDrawn: boolean;
  entryCount: number;
  winnerCount: number;
}> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("draw_point_prize_winners", {
    p_prize_id: prizeId
  });
  if (error) throw new Error(error.message);

  const result = data as {
    ok?: boolean;
    already_drawn?: boolean;
    entry_count?: number;
    winner_count?: number;
  } | null;

  return {
    ok: Boolean(result?.ok),
    alreadyDrawn: Boolean(result?.already_drawn),
    entryCount: Number(result?.entry_count ?? 0),
    winnerCount: Number(result?.winner_count ?? 0)
  };
}

export async function listDuePrizeIds(): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("point_prizes")
    .select("id")
    .in("status", ["active", "closed"])
    .lte("draw_at", new Date().toISOString());
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { id: string }) => row.id);
}
