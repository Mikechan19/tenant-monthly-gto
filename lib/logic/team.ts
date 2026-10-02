// Pure helpers for team workspaces, roles and auth routing (no I/O — unit-tested in __tests__/team.test.ts).

export type Role = "admin" | "analyst" | "viewer";
export const ROLES: Role[] = ["admin", "analyst", "viewer"];
export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", analyst: "Analyst", viewer: "Viewer" };
export const ROLE_HELP: Record<Role, string> = {
  admin: "Everything, plus invite and manage members",
  analyst: "Add, edit and import sales, tenants and projections",
  viewer: "Read-only",
};

export type TeamRef = { id: string; name: string; role: Role };

/** Cookie holding the active team id. */
export const TEAM_COOKIE = "gto_team";

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as string[]).includes(v);
}

export function canWrite(role: Role | null | undefined): boolean {
  return role === "admin" || role === "analyst";
}

export function isAdmin(role: Role | null | undefined): boolean {
  return role === "admin";
}

/** The cookie's team if the user still belongs to it, else the first team (alphabetical), else null. */
export function pickActiveTeam(teams: TeamRef[], cookieTeamId: string | null | undefined): TeamRef | null {
  if (!teams.length) return null;
  return teams.find((t) => t.id === cookieTeamId) ?? [...teams].sort((a, b) => a.name.localeCompare(b.name))[0];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

export function validateInvite(
  emailRaw: unknown,
  roleRaw: unknown,
): { ok: true; email: string; role: Role } | { ok: false; errors: { email?: string; role?: string } } {
  const email = normalizeEmail(emailRaw);
  const errors: { email?: string; role?: string } = {};
  if (!email) errors.email = "Enter an email address.";
  else if (!EMAIL_RE.test(email) || email.length > 254) errors.email = "That doesn’t look like an email address.";
  if (!isRole(roleRaw)) errors.role = "Choose a role.";
  if (errors.email || errors.role) return { ok: false, errors };
  return { ok: true, email, role: roleRaw as Role };
}

export function validateTeamName(v: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = String(v ?? "").trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Give the team a name." };
  if (name.length > 80) return { ok: false, error: "Keep the name under 80 characters." };
  return { ok: true, name };
}

export function validateCredentials(
  emailRaw: unknown,
  passwordRaw: unknown,
  { signup = false } = {},
): { ok: true; email: string; password: string } | { ok: false; errors: { email?: string; password?: string } } {
  const email = normalizeEmail(emailRaw);
  const password = String(passwordRaw ?? "");
  const errors: { email?: string; password?: string } = {};
  if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Enter your password.";
  else if (signup && password.length < 8) errors.password = "Use at least 8 characters.";
  if (errors.email || errors.password) return { ok: false, errors };
  return { ok: true, email, password };
}

/** Only same-origin relative paths are allowed as post-login destinations (no open redirects). */
export function safeNext(next: unknown, fallback = "/"): string {
  const s = typeof next === "string" ? next : "";
  if (!s.startsWith("/") || s.startsWith("//") || s.startsWith("/\\") || /[\r\n]/.test(s)) return fallback;
  if (s.startsWith("/login") || s.startsWith("/signup") || s.startsWith("/auth/")) return fallback;
  return s;
}

/** Routes reachable without a session. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/auth/") ||
    pathname === "/api/health" ||
    pathname.startsWith("/api/stripe/webhooks")
  );
}

/** Routes for signed-out users only — a signed-in visitor is sent to the app. */
export function isGuestOnlyPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup";
}

/** Pages rendered without the app sidebar (auth, onboarding, invite acceptance). */
export function isBarePath(pathname: string): boolean {
  return (
    isGuestOnlyPath(pathname) ||
    pathname.startsWith("/auth/") ||
    pathname === "/onboarding" ||
    pathname.startsWith("/invite/")
  );
}

export function inviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/invite/${token}`;
}
