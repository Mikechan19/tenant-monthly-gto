import "server-only";
import { check, db } from "./db";
import type { SavedProjection } from "./types";

export async function listSavedProjections(tenantId?: string): Promise<SavedProjection[]> {
  const s = await db();
  let q = s.from("projections").select("*").order("created_at", { ascending: false }).limit(200);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  return check(await q);
}

export async function insertProjections(
  rows: Omit<SavedProjection, "id" | "created_at">[],
): Promise<SavedProjection[]> {
  const s = await db();
  return check(await s.from("projections").insert(rows).select());
}

export async function setProjectionStatus(id: string, status: "approved" | "unreviewed") {
  const s = await db();
  check(await s.from("projections").update({ review_status: status }).eq("id", id));
}

export async function deleteProjection(id: string) {
  const s = await db();
  check(await s.from("projections").delete().eq("id", id));
}
