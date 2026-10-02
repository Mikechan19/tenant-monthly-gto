import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { check, db, DataError } from "./db";
import { canWrite, isAdmin, isRole, pickActiveTeam, TEAM_COOKIE, type Role, type TeamRef } from "@/lib/logic/team";

export type Workspace = {
  user: { id: string; email: string };
  teams: TeamRef[];
  active: TeamRef | null;
};

export type Member = { user_id: string; email: string; role: Role; created_at: string };
export type Invite = { id: string; email: string; role: Role; token: string; created_at: string };
export type PendingInvite = { token: string; team_id: string; team_name: string; role: Role; created_at: string };

/** Signed-in user + team memberships + active team, memoised per request. null = signed out. */
export const getWorkspace = cache(async (): Promise<Workspace | null> => {
  const s = await db();
  const { data, error } = await s.auth.getUser();
  if (error || !data.user) return null;
  const rows = check(
    await s.from("team_members").select("role, team:teams(id, name)").eq("user_id", data.user.id),
  ) as unknown as { role: string; team: { id: string; name: string } | null }[];
  const teams: TeamRef[] = rows
    .filter((r) => r.team && isRole(r.role))
    .map((r) => ({ id: r.team!.id, name: r.team!.name, role: r.role as Role }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const cookieTeam = (await cookies()).get(TEAM_COOKIE)?.value;
  return { user: { id: data.user.id, email: data.user.email ?? "" }, teams, active: pickActiveTeam(teams, cookieTeam) };
});

/** Active team for a page/data call. Redirects to /login (signed out) or /onboarding (no team). */
export async function requireTeam(): Promise<TeamRef> {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  if (!ws.active) redirect("/onboarding");
  return ws.active;
}

export async function activeTeamId(): Promise<string> {
  return (await requireTeam()).id;
}

/** For server actions: returns a user-facing reason the caller may not write, or null if allowed. */
export async function writeDenied(level: "write" | "admin" = "write"): Promise<string | null> {
  let ws: Workspace | null;
  try {
    ws = await getWorkspace();
  } catch (e) {
    return e instanceof DataError ? e.message : "Could not check your access.";
  }
  if (!ws) return "Your session has expired — please sign in again.";
  if (!ws.active) return "Create or join a team first.";
  if (level === "admin" && !isAdmin(ws.active.role)) return "Only team admins can do that.";
  if (!canWrite(ws.active.role)) return "Viewers have read-only access to this team.";
  return null;
}

export async function listMembers(teamId: string): Promise<Member[]> {
  const s = await db();
  return check(await s.rpc("team_member_list", { p_team: teamId })) as Member[];
}

export async function listOpenInvites(teamId: string): Promise<Invite[]> {
  const s = await db();
  return check(
    await s
      .from("team_invites")
      .select("id, email, role, token, created_at")
      .eq("team_id", teamId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ) as Invite[];
}

export async function myPendingInvites(): Promise<PendingInvite[]> {
  const s = await db();
  return check(await s.rpc("my_pending_invites")) as PendingInvite[];
}

export async function invitePreview(
  token: string,
): Promise<{ team_name: string; email: string; role: Role; accepted: boolean } | null> {
  const s = await db();
  const rows = check(await s.rpc("invite_preview", { p_token: token })) as {
    team_name: string;
    email: string;
    role: Role;
    accepted: boolean;
  }[];
  return rows[0] ?? null;
}
