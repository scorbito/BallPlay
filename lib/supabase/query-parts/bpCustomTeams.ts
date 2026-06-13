import type { SupabaseClient } from "@supabase/supabase-js";
import type { Player } from "@/lib/types/lineup";
import { buildCustomTeamMeta, type PlayableTeamMeta, type PlayableTeamRoster } from "@/lib/types/playableTeam";

const TEAMS_TABLE = "bp_custom_teams";
const PLAYERS_TABLE = "bp_custom_team_players";

export type BpCustomTeamRow = {
  id: string;
  owner_user_id: string;
  name: string;
  initials: string;
  color: string;
  badge_style: "circle" | "shield";
  scout_pieces: number;
  is_public: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BpCustomTeamPlayerRow = {
  id: string;
  custom_team_id: string;
  player_id: string;
  acquired_source: string;
  acquired_at: string;
  metadata: Record<string, unknown>;
};

export type UpsertCustomTeamInput = {
  ownerUserId: string;
  teamId?: string | null;
  name: string;
  initials: string;
  color: string;
  badgeStyle: "circle" | "shield";
  scoutPieces?: number;
  isPublic?: boolean;
};

export function rowToCustomTeamMeta(row: BpCustomTeamRow): PlayableTeamMeta {
  return buildCustomTeamMeta({
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    initials: row.initials,
    color: row.color,
    badgeStyle: row.badge_style
  });
}

export async function getMyActiveCustomTeam(
  client: SupabaseClient,
  userId: string
): Promise<{ ok: true; row: BpCustomTeamRow | null } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TEAMS_TABLE)
    .select("*")
    .eq("owner_user_id", userId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  return { ok: true, row: (data as BpCustomTeamRow | null) ?? null };
}

export async function getCustomTeamById(
  client: SupabaseClient,
  teamId: string
): Promise<{ ok: true; row: BpCustomTeamRow | null } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(TEAMS_TABLE)
    .select("*")
    .eq("id", teamId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  return { ok: true, row: (data as BpCustomTeamRow | null) ?? null };
}

export async function upsertCustomTeam(
  client: SupabaseClient,
  input: UpsertCustomTeamInput
): Promise<{ ok: true; row: BpCustomTeamRow } | { ok: false; error: string }> {
  const payload = {
    ...(input.teamId ? { id: input.teamId } : {}),
    owner_user_id: input.ownerUserId,
    name: input.name,
    initials: input.initials,
    color: input.color,
    badge_style: input.badgeStyle,
    scout_pieces: input.scoutPieces ?? 0,
    is_public: input.isPublic ?? true,
    is_active: true
  };

  const { data, error } = await client
    .from(TEAMS_TABLE)
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, row: data as BpCustomTeamRow };
}

export async function listCustomTeamPlayerIds(
  client: SupabaseClient,
  customTeamId: string
): Promise<{ ok: true; playerIds: string[] } | { ok: false; error: string }> {
  const { data, error } = await client
    .from(PLAYERS_TABLE)
    .select("player_id")
    .eq("custom_team_id", customTeamId)
    .order("acquired_at", { ascending: true });

  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    playerIds: ((data ?? []) as Array<{ player_id: string }>).map((row) => row.player_id)
  };
}

export async function addCustomTeamPlayers(
  client: SupabaseClient,
  input: {
    customTeamId: string;
    playerIds: string[];
    acquiredSource?: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.playerIds.length === 0) return { ok: true };

  const rows = input.playerIds.map((playerId) => ({
    custom_team_id: input.customTeamId,
    player_id: playerId,
    acquired_source: input.acquiredSource ?? "recruit"
  }));

  const { error } = await client
    .from(PLAYERS_TABLE)
    .upsert(rows, { onConflict: "custom_team_id,player_id", ignoreDuplicates: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateCustomTeamScoutPieces(
  client: SupabaseClient,
  input: {
    customTeamId: string;
    scoutPieces: number;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client
    .from(TEAMS_TABLE)
    .update({ scout_pieces: input.scoutPieces })
    .eq("id", input.customTeamId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function archiveCustomTeam(
  client: SupabaseClient,
  customTeamId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client
    .from(TEAMS_TABLE)
    .update({ is_active: false, is_public: false })
    .eq("id", customTeamId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function buildCustomTeamRoster(input: {
  team: BpCustomTeamRow;
  players: Player[];
}): PlayableTeamRoster {
  return {
    team: rowToCustomTeamMeta(input.team),
    players: input.players,
    scoutPieces: Number(input.team.scout_pieces ?? 0)
  };
}
