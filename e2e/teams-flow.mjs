// Browser E2E for login + team workspaces, run against a LOCAL Supabase-like stack
// (GoTrue + PostgREST + capture-only SMTP behind a gateway that exposes GET /__mail).
// Not part of `bun run test`. Usage:
//   APP=http://localhost:3200 GATEWAY=http://127.0.0.1:54331 NODE_PATH=<dir with playwright-core> node e2e/teams-flow.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const APP = process.env.APP ?? "http://localhost:3200";
const GATEWAY = process.env.GATEWAY ?? "http://127.0.0.1:54331";
const run = Date.now().toString(36);
const ALICE = `alice.${run}@e2e.test`;
const BOB = `bob.${run}@e2e.test`;
const CAROL = `carol.${run}@e2e.test`;
const PW = "correct-horse-9";
const results = [];
const netlog = [];
const ok = (name, cond, extra = "") => {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
};

function decodeQP(s) {
  return s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
async function latestLink(to, sinceCount) {
  for (let i = 0; i < 40; i++) {
    const all = await (await fetch(`${GATEWAY}/__mail`)).json();
    const mine = all.slice(sinceCount).filter((m) => m.raw.toLowerCase().includes(to.toLowerCase()));
    if (mine.length) {
      const body = decodeQP(mine[mine.length - 1].raw);
      const m = body.match(/href="([^"]*\/verify\?[^"]*)"/);
      if (m) return m[1].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no email for ${to}`);
}
const seen = (loc) => loc.first().waitFor({ timeout: 10000 }).then(() => true, () => false);
const mailCount = async () => (await (await fetch(`${GATEWAY}/__mail`)).json()).length;

async function signUpAndConfirm(page, email, nextPath = "/") {
  const before = await mailCount();
  await page.goto(`${APP}/signup${nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  await page.fill("#email", email);
  await page.fill("#password", PW);
  await page.click("button[type=submit]");
  await page.getByRole("status").waitFor();
  const msg = await page.getByRole("status").innerText();
  const link = await latestLink(email, before);
  await page.goto(link);
  await page.waitForLoadState("networkidle");
  return msg;
}

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
try {
  // ── anonymous ──
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(`${APP}/tenants`);
  ok("anon: /tenants redirects to /login?next=/tenants", new URL(anon.url()).pathname === "/login" && anon.url().includes("next=%2Ftenants"));
  const health = await anon.request.get(`${APP}/api/health`);
  ok("anon: /api/health stays public", health.status() === 200);
  const api = await anon.request.get(`${APP}/api/stripe/checkout`, { maxRedirects: 0 });
  ok("anon: other API routes return 401", api.status() === 401);
  await anon.fill("#email", "nobody@e2e.test");
  await anon.fill("#password", "wrong-password");
  await anon.click("button[type=submit]");
  ok("anon: wrong credentials show an error", await seen(anon.getByText("Wrong email or password.")));

  // ── alice signs up (email confirmation), creates a team, adds data ──
  const aliceCtx = await browser.newContext();
  const alice = await aliceCtx.newPage();
  alice.on("request", (r) => r.method() === "POST" && netlog.push(`${Date.now() % 1e6} REQ ${new URL(r.url()).pathname}`));
  alice.on("requestfinished", async (r) => r.method() === "POST" && netlog.push(`${Date.now() % 1e6} DONE ${new URL(r.url()).pathname} ${(await r.response())?.status()}`));
  alice.on("requestfailed", (r) => netlog.push(`${Date.now() % 1e6} FAILED ${new URL(r.url()).pathname} ${r.failure()?.errorText}`));
  alice.on("console", (m) => m.type() === "error" && netlog.push(`console: ${m.text().slice(0, 300)}`));
  const msg = await signUpAndConfirm(alice, ALICE);
  ok("alice: signup asks to confirm email", /confirmation link/i.test(msg));
  ok("alice: confirmation link signs in and lands on onboarding (no team yet)", new URL(alice.url()).pathname === "/onboarding", alice.url());
  await alice.fill("#team-name", "SPSB Leasing");
  await alice.click("button:has-text('Create workspace')");
  await alice.waitForURL(`${APP}/`);
  ok("alice: create team → dashboard empty state", await seen(alice.getByText("No tenants yet")));
  ok("alice: sidebar shows team + Admin role", (await alice.getByTestId("active-role").first().innerText()) === "Admin");
  ok("alice: Demo workspace data is NOT visible to a new team", (await alice.getByText("Coffee House").count()) === 0);

  await alice.goto(`${APP}/tenants`);
  await alice.click("button:has-text('Add tenant')");
  await alice.fill("#t-name", "Kopi Corner");
  await alice.fill("#t-unit", "G-01");
  await alice.fill("#t-rate", "7");
  await alice.click("form button[type=submit]:has-text('Add tenant')");
  await alice.getByRole("link", { name: "Kopi Corner" }).waitFor();
  ok("alice (admin): tenant saved", true);

  await alice.click("button:has-text('Add Sales')");
  await alice.selectOption("select[name=tenant_id]", { label: "Kopi Corner · G-01" }).catch(async () => {
    const opt = await alice.locator("select[name=tenant_id] option", { hasText: "Kopi Corner" }).first().getAttribute("value");
    await alice.selectOption("select[name=tenant_id]", opt);
  });
  await alice.fill("input[name=amount]", "4321");
  await alice.click("form:has(input[name=amount]) button[type=submit]");
  await alice.getByText("Sales record added.").waitFor();
  await alice.goto(`${APP}/`);
  const today = await alice.getByTestId("today-total").innerText();
  ok("alice (admin): sales saved and dashboard shows it", /4,321/.test(today), today);

  // ── invites ──
  await alice.goto(`${APP}/team`);
  await alice.fill("#invite-email", BOB);
  await alice.selectOption("#invite-role", "viewer");
  await alice.click("button:has-text('Create invite')");
  await alice.getByTestId("invite-link").first().waitFor();
  await alice.waitForFunction(() => document.querySelector("[data-testid=invite-link]")?.value.startsWith("http"));
  const bobLink = await alice.getByTestId("invite-link").first().inputValue();
  ok("alice: invite link shown to copy", /\/invite\/[0-9a-f]{48}$/.test(bobLink), bobLink);
  await alice.fill("#invite-email", CAROL);
  await alice.selectOption("#invite-role", "analyst");
  await alice.click("button:has-text('Create invite')");
  await alice.waitForTimeout(800);
  await alice.reload();
  ok("alice: two pending invites listed", (await alice.getByTestId("invite-row").count()) === 2);
  const carolLink = new URL(
    await alice.getByTestId("invite-row").filter({ hasText: CAROL }).getByTestId("invite-link").inputValue(),
    APP,
  ).href;

  // ── bob (viewer) follows the link while signed out, signs up, joins ──
  const bobCtx = await browser.newContext();
  const bob = await bobCtx.newPage();
  await bob.goto(bobLink);
  ok("bob: invite link → login with next=/invite/…", new URL(bob.url()).pathname === "/login" && bob.url().includes("invite"));
  const invitePath = new URL(bobLink).pathname;
  await signUpAndConfirm(bob, BOB, invitePath);
  ok("bob: after confirming email he lands back on the invite", new URL(bob.url()).pathname === invitePath, bob.url());
  await bob.click("button:has-text('Join SPSB Leasing')");
  await bob.waitForURL(`${APP}/`);
  ok("bob: joined — sees alice's sales", /4,321/.test(await bob.getByTestId("today-total").innerText()));
  ok("bob: role shows Viewer", (await bob.getByTestId("active-role").first().innerText()) === "Viewer");
  ok("bob (viewer): no Add Sales button", (await bob.locator("button:has-text('Add Sales')").count()) === 0);
  await bob.goto(`${APP}/tenants`);
  const tv = await seen(bob.getByRole("link", { name: "Kopi Corner" }));
  const addT = await bob.locator("button:has-text('Add tenant')").count();
  const del = await bob.locator("button:has-text('Delete')").count();
  ok("bob (viewer): tenant visible, no Add tenant / Delete", tv && addT === 0 && del === 0, `visible=${tv} add=${addT} delete=${del} url=${bob.url()}`);
  await bob.goto(`${APP}/import`);
  ok("bob (viewer): import page explains read-only", (await bob.getByText("viewer", { exact: false }).count()) > 0);
  await bob.goto(`${APP}/team`);
  ok("bob (viewer): team page has no invite form", (await bob.locator("#invite-email").count()) === 0 && (await bob.getByTestId("member-row").count()) === 2);

  // bob opens carol's invite → email mismatch
  await bob.goto(carolLink);
  ok("bob: someone else's invite shows mismatch warning", (await bob.getByText("was sent to").count()) > 0 && (await bob.locator("button:has-text('Join')").count()) === 0);

  // ── carol (analyst) signs up first, then sees the pending invite on onboarding ──
  const carolCtx = await browser.newContext();
  const carol = await carolCtx.newPage();
  await signUpAndConfirm(carol, CAROL);
  ok("carol: new user with a pending invite sees it on onboarding", new URL(carol.url()).pathname === "/onboarding" && (await carol.getByText("SPSB Leasing").count()) > 0);
  await carol.click("button:has-text('Join')");
  await carol.waitForURL(`${APP}/`);
  ok("carol: role shows Analyst", (await carol.getByTestId("active-role").first().innerText()) === "Analyst");
  ok("carol (analyst): has Add Sales", await seen(carol.locator("button:has-text('Add Sales')")));
  await carol.goto(`${APP}/projections`);
  await carol.click("button:has-text('Save weekly snapshot')");
  await carol.getByText("Saved projections (1)").waitFor();
  ok("carol (analyst): saved a projection snapshot", true);

  // ── alice: change bob to analyst, then he can write ──
  await alice.goto(`${APP}/team`);
  const bobRow = alice.getByTestId("member-row").filter({ hasText: BOB });
  await bobRow.locator("select").selectOption("analyst");
  await alice.waitForTimeout(1000);
  await bob.goto(`${APP}/`);
  ok("bob: promoted by admin → Add Sales appears", (await bob.locator("button:has-text('Add Sales')").count()) > 0);

  // ── second team + switcher; isolation ──
  await alice.goto(`${APP}/team`);
  await alice.locator("#team-name").fill("Alice Sandbox");
  await alice.click("button:has-text('Create team')");
  await alice.waitForURL(`${APP}/`);
  ok("alice: second team is empty (data walled off)", await seen(alice.getByText("No tenants yet")));
  await alice.locator("select#team-switch").first().selectOption({ label: "SPSB Leasing" });
  await alice.waitForTimeout(1200);
  await alice.goto(`${APP}/`);
  ok("alice: switching back shows SPSB Leasing data", /4,321/.test(await alice.getByTestId("today-total").innerText()));
  await bob.goto(`${APP}/`);
  ok("bob: cannot see alice's sandbox in switcher", (await bob.locator("select#team-switch option", { hasText: "Alice Sandbox" }).count()) === 0);

  // ── sign out; magic link sign-in ──
  await alice.click("button:has-text('Sign out')");
  await alice.waitForURL(/\/login/);
  await alice.goto(`${APP}/`);
  ok("alice: after sign-out the app redirects to login", new URL(alice.url()).pathname === "/login");
  const before = await mailCount();
  await alice.click("button:has-text('magic link')");
  await alice.fill("#email", ALICE);
  await alice.click("button[type=submit]");
  await alice.getByRole("status").waitFor();
  await alice.goto(await latestLink(ALICE, before));
  await alice.waitForLoadState("networkidle");
  ok("alice: magic link signs her back in", new URL(alice.url()).pathname === "/" && (await alice.getByTestId("workspace-menu").count()) > 0, alice.url());

  // ── password sign-in ──
  const c2 = await (await browser.newContext()).newPage();
  await c2.goto(`${APP}/login`);
  await c2.fill("#email", BOB);
  await c2.fill("#password", PW);
  await c2.click("button[type=submit]");
  await c2.waitForURL(`${APP}/`);
  ok("bob: password sign-in works", (await c2.getByTestId("workspace-menu").count()) > 0);
  await c2.goto(`${APP}/login`);
  ok("signed-in user visiting /login is sent to the app", new URL(c2.url()).pathname === "/");
} catch (e) {
  ok("unexpected exception", false, String(e?.stack ?? e).slice(0, 800));
  if (process.env.E2E_DEBUG) console.log(netlog.slice(-30).join("\n"));
  for (const ctx of browser.contexts())
    for (const pg of ctx.pages())
      console.log("--- page", pg.url(), "\n", (await pg.locator("main").innerText().catch(() => "")).slice(0, 1200));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
