"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { check, db, DataError } from "@/lib/data/db";
import { getWorkspace, writeDenied } from "@/lib/data/team";
import { isRole, TEAM_COOKIE, validateInvite, validateTeamName, type Role } from "@/lib/logic/team";

export type TeamState = {
  ok?: boolean;
  message?: string;
  token?: string;
  /** Set when the workspace context changed; the client does a full navigation there. */
  redirectTo?: string;
  errors?: { email?: string; role?: string; name?: string; form?: string };
  nonce?: number;
};

async function setActiveTeam(teamId: string) {
  (await cookies()).set(TEAM_COOKIE, teamId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

function msg(e: unknown): string {
  unstable_rethrow(e);
  const m = e instanceof Error ? e.message : String(e ?? "");
  if (/team_invites_open_uniq|duplicate key/i.test(m)) return "That email already has an open invite — copy or revoke it below.";
  if (/at least one admin/i.test(m)) return "A team needs at least one admin. Make someone else admin first.";
  if (/different email/i.test(m)) return "This invite was sent to a different email address.";
  if (/already been used/i.test(m)) return "This invite has already been used.";
  if (/not found/i.test(m)) return "Invite not found — it may have been revoked.";
  if (e instanceof DataError) return e.message;
  return m || "Something went wrong. Please try again.";
}

function refresh() {
  revalidatePath("/", "layout");
}

// ── workspace ───────────────────────────────────────────────────────────────

export async function createTeam(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const v = validateTeamName(fd.get("name"));
  if (!v.ok) return { ok: false, errors: { name: v.error } };
  let teamId: string;
  try {
    const s = await db();
    teamId = check(await s.rpc("create_team", { p_name: v.name })) as string;
  } catch (e) {
    return { ok: false, errors: { form: msg(e) } };
  }
  await setActiveTeam(teamId);
  refresh();
  return { ok: true, redirectTo: "/" };
}

export async function switchTeam(teamId: string): Promise<TeamState> {
  const ws = await getWorkspace();
  if (!ws) return { ok: false, errors: { form: "Please sign in again." } };
  const team = ws.teams.find((t) => t.id === teamId);
  if (!team) return { ok: false, errors: { form: "You're not a member of that team." } };
  await setActiveTeam(team.id);
  refresh();
  return { ok: true, message: `Switched to ${team.name}.` };
}

export async function renameTeam(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const no = await writeDenied("admin");
  if (no) return { ok: false, errors: { form: no } };
  const v = validateTeamName(fd.get("name"));
  if (!v.ok) return { ok: false, errors: { name: v.error } };
  try {
    const ws = (await getWorkspace())!;
    const s = await db();
    check(await s.from("teams").update({ name: v.name }).eq("id", ws.active!.id));
  } catch (e) {
    return { ok: false, errors: { form: msg(e) } };
  }
  refresh();
  return { ok: true, message: "Team renamed.", nonce: Date.now() };
}

// ── invites ─────────────────────────────────────────────────────────────────

export async function inviteMember(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const no = await writeDenied("admin");
  if (no) return { ok: false, errors: { form: no } };
  const v = validateInvite(fd.get("email"), fd.get("role"));
  if (!v.ok) return { ok: false, errors: v.errors };
  try {
    const ws = (await getWorkspace())!;
    if (v.email === ws.user.email.toLowerCase()) return { ok: false, errors: { email: "You're already in this team." } };
    const s = await db();
    const row = check(
      await s.from("team_invites").insert({ team_id: ws.active!.id, email: v.email, role: v.role }).select("token").single(),
    ) as { token: string };
    refresh();
    return { ok: true, message: `Invite created for ${v.email}.`, token: row.token, nonce: Date.now() };
  } catch (e) {
    return { ok: false, errors: { form: msg(e) } };
  }
}

export async function revokeInvite(id: string): Promise<TeamState> {
  const no = await writeDenied("admin");
  if (no) return { ok: false, errors: { form: no } };
  try {
    const ws = (await getWorkspace())!;
    const s = await db();
    check(await s.from("team_invites").delete().eq("id", id).eq("team_id", ws.active!.id));
  } catch (e) {
    return { ok: false, errors: { form: msg(e) } };
  }
  refresh();
  return { ok: true, message: "Invite revoked." };
}

export async function acceptInvite(token: string): Promise<TeamState> {
  let teamId: string;
  try {
    const s = await db();
    teamId = check(await s.rpc("accept_invite", { p_token: token })) as string;
  } catch (e) {
    return { ok: false, errors: { form: msg(e) } };
  }
  await setActiveTeam(teamId);
  refresh();
  return { ok: true, redirectTo: "/" };
}

// ── members ─────────────────────────────────────────────────────────────────

export async function changeRole(userId: string, role: Role): Promise<TeamState> {
  const no = await writeDenied("admin");
  if (no) return { ok: false, errors: { form: no } };
  if (!isRole(role)) return { ok: false, errors: { form: "Unknown role." } };
  try {
    const ws = (await getWorkspace())!;
    const s = await db();
    const rows = check(
      await s.from("team_members").update({ role }).eq("team_id", ws.active!.id).eq("user_id", userId).select("user_id"),
    ) as unknown[];
    if (!rows.length) return { ok: false, errors: { form: "Member not found." } };
  } catch (e) {
    return { ok: false, errors: { form: msg(e) } };
  }
  refresh();
  return { ok: true, message: "Role updated." };
}

export async function removeMember(userId: string): Promise<TeamState> {
  const no = await writeDenied("admin");
  if (no) return { ok: false, errors: { form: no } };
  try {
    const ws = (await getWorkspace())!;
    if (userId === ws.user.id) return { ok: false, errors: { form: "Use “Leave team” to remove yourself." } };
    const s = await db();
    check(await s.from("team_members").delete().eq("team_id", ws.active!.id).eq("user_id", userId));
  } catch (e) {
    return { ok: false, errors: { form: msg(e) } };
  }
  refresh();
  return { ok: true, message: "Member removed." };
}

export async function leaveTeam(): Promise<TeamState> {
  try {
    const ws = await getWorkspace();
    if (!ws?.active) return { ok: false, errors: { form: "No active team." } };
    const s = await db();
    check(await s.from("team_members").delete().eq("team_id", ws.active.id).eq("user_id", ws.user.id));
  } catch (e) {
    return { ok: false, errors: { form: msg(e) } };
  }
  (await cookies()).delete(TEAM_COOKIE);
  refresh();
  return { ok: true, redirectTo: "/" };
}
