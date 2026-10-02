import "server-only";
import { check, db } from "./db";
import { activeTeamId } from "./team";
import type { SavedProjection } from "./types";

export async function listSavedProjections(tenantId?: string): Promise<SavedProjection[]> {
  const [s, team] = await Promise.all([db(), activeTeamId()]);
  let q = s.from("projections").select("*").eq("team_id", team).order("created_at", { ascending: false }).limit(200);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  return check(await q);
}

export async function insertProjections(
  rows: Omit<SavedProjection, "id" | "created_at" | "team_id">[],
): Promise<SavedProjection[]> {
  const [s, team] = await Promise.all([db(), activeTeamId()]);
  return check(await s.from("projections").insert(rows.map((r) => ({ ...r, team_id: team }))).select());
}

export async function setProjectionStatus(id: string, status: "approved" | "unreviewed") {
  const [s, team] = await Promise.all([db(), activeTeamId()]);
  check(await s.from("projections").update({ review_status: status }).eq("id", id).eq("team_id", team));
}

export async function deleteProjection(id: string) {
  const [s, team] = await Promise.all([db(), activeTeamId()]);
  check(await s.from("projections").delete().eq("id", id).eq("team_id", team));
}
