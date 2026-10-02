import { describe, expect, it } from "vitest";
import {
  canWrite,
  inviteUrl,
  isAdmin,
  isBarePath,
  isGuestOnlyPath,
  isPublicPath,
  isRole,
  pickActiveTeam,
  safeNext,
  validateCredentials,
  validateInvite,
  validateTeamName,
  type TeamRef,
} from "../lib/logic/team";

const teams: TeamRef[] = [
  { id: "b", name: "SPSB Leasing", role: "analyst" },
  { id: "a", name: "Demo workspace", role: "viewer" },
];

describe("roles", () => {
  it("admin and analyst can write; viewer and nobody cannot", () => {
    expect(canWrite("admin")).toBe(true);
    expect(canWrite("analyst")).toBe(true);
    expect(canWrite("viewer")).toBe(false);
    expect(canWrite(null)).toBe(false);
    expect(canWrite(undefined)).toBe(false);
  });
  it("only admin manages the team", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("analyst")).toBe(false);
    expect(isAdmin("viewer")).toBe(false);
  });
  it("isRole rejects unknown values", () => {
    expect(isRole("analyst")).toBe(true);
    expect(isRole("owner")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});

describe("pickActiveTeam", () => {
  it("uses the cookie team when the user is still a member", () => {
    expect(pickActiveTeam(teams, "b")?.id).toBe("b");
  });
  it("falls back to the first team alphabetically when the cookie is stale or missing", () => {
    expect(pickActiveTeam(teams, "gone")?.name).toBe("Demo workspace");
    expect(pickActiveTeam(teams, undefined)?.name).toBe("Demo workspace");
  });
  it("returns null when the user has no team (→ onboarding)", () => {
    expect(pickActiveTeam([], "b")).toBeNull();
  });
});

describe("validation", () => {
  it("invite: lowercases + trims email, requires a role", () => {
    expect(validateInvite("  Aisyah@SelangorProperties.com.my ", "viewer")).toEqual({
      ok: true,
      email: "aisyah@selangorproperties.com.my",
      role: "viewer",
    });
    const bad = validateInvite("not-an-email", "owner");
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.email).toBeTruthy();
      expect(bad.errors.role).toBeTruthy();
    }
    expect(validateInvite("", "admin").ok).toBe(false);
  });
  it("team name: trimmed, collapsed, 1–80 chars", () => {
    expect(validateTeamName("  SPSB   Leasing ")).toEqual({ ok: true, name: "SPSB Leasing" });
    expect(validateTeamName("   ").ok).toBe(false);
    expect(validateTeamName("x".repeat(81)).ok).toBe(false);
  });
  it("credentials: signup needs 8+ char password", () => {
    expect(validateCredentials("a@b.co", "short", { signup: true }).ok).toBe(false);
    expect(validateCredentials("a@b.co", "short").ok).toBe(true);
    expect(validateCredentials("A@B.co", "longenough", { signup: true })).toEqual({ ok: true, email: "a@b.co", password: "longenough" });
    expect(validateCredentials("nope", "x").ok).toBe(false);
  });
});

describe("routing", () => {
  it("safeNext only allows same-origin relative paths", () => {
    expect(safeNext("/tenants/abc?day=2026-10-01")).toBe("/tenants/abc?day=2026-10-01");
    expect(safeNext("/invite/abc123")).toBe("/invite/abc123");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("/login")).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(null, "/team")).toBe("/team");
  });
  it("public paths stay reachable without a session", () => {
    for (const p of ["/login", "/signup", "/auth/callback", "/api/health", "/api/stripe/webhooks"]) expect(isPublicPath(p)).toBe(true);
    for (const p of ["/", "/tenants", "/daily-report", "/projections", "/import", "/team", "/onboarding", "/invite/x", "/api/stripe/checkout", "/login-x"])
      expect(isPublicPath(p)).toBe(false);
  });
  it("guest-only and bare paths", () => {
    expect(isGuestOnlyPath("/login")).toBe(true);
    expect(isGuestOnlyPath("/auth/callback")).toBe(false);
    expect(isBarePath("/onboarding")).toBe(true);
    expect(isBarePath("/invite/abc")).toBe(true);
    expect(isBarePath("/tenants")).toBe(false);
  });
  it("inviteUrl joins origin and token", () => {
    expect(inviteUrl("https://tenant-monthly-gto.vercel.app/", "abc")).toBe("https://tenant-monthly-gto.vercel.app/invite/abc");
  });
});
