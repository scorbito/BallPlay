import type { BpCustomTeamRow } from "@/lib/supabase/query-parts/bpCustomTeams";

export type CustomTeamBadgeMeta = {
  name: string;
  initials: string;
  color: string;
  badge_style: "circle" | "shield";
};

export const CUSTOM_TEAM_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getCustomTeamDbId(teamId: string | null | undefined): string | null {
  if (!teamId) return null;
  const normalized = teamId
    .replace(/^custom-team:/, "")
    .replace(/^custom:/, "");
  return CUSTOM_TEAM_ID_RE.test(normalized) ? normalized : null;
}

export function getCustomTeamIdAliases(teamId: string): string[] {
  const dbId = getCustomTeamDbId(teamId);
  if (!dbId) return [teamId];
  return Array.from(new Set([teamId, dbId, `custom:${dbId}`, `custom-team:${dbId}`]));
}

export function customTeamRowToBadgeMeta(row: BpCustomTeamRow): CustomTeamBadgeMeta {
  return {
    name: row.name,
    initials: row.initials,
    color: row.color,
    badge_style: row.badge_style
  };
}

export function readLocalMyTeamBadgeMeta(): CustomTeamBadgeMeta | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem("ballplay:my-team-info");
    if (!raw) return null;
    const info = JSON.parse(raw) as {
      name?: string;
      initials?: string;
      color?: string;
      badgeStyle?: "circle" | "shield";
      badge_style?: "circle" | "shield";
    };
    const name = info.name?.trim();
    const initials = info.initials?.trim();
    if (!name || !initials) return null;

    return {
      name,
      initials,
      color: info.color || "#8b5cf6",
      badge_style: info.badge_style ?? info.badgeStyle ?? "circle"
    };
  } catch {
    return null;
  }
}
