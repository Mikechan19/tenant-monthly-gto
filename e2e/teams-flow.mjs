// Browser E2E for login + team workspaces, run against a LOCAL Supabase-like stack
// (GoTrue + PostgREST + capture-only SMTP behind a gateway that exposes GET /__mail).
// Not part of `bun run test`. Usage:
//   APP=http://localhost:3200 GATEWAY=http://127.0.0.1:54331 NODE_PATH=<dir with playwright-core> node e2e/teams-flow.mjs
// MOBILE=1 runs the same flow at 390×844 (touch) through the bottom tab bar, "More" sheet and Add Sales FAB.
// SHOTS=<dir> saves screenshots of the auth / team screens.
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
const MOBILE = process.env.MOBILE === "1";
const SHOTS = process.env.SHOTS;
const CTX = MOBILE ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {};
const tag = MOBILE ? "[mobile] " : "";
const results = [];
const netlog = [];
const ok = (name, cond, extra = "") => {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? "PASS" : "FAIL"} ${tag}${name}${extra ? " — " + extra : ""}`);
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
// Only ever interact with what the user can see (desktop and phone chrome both exist in the DOM).
const $ = (page, sel) => page.locator(sel).filter({ visible: true });
const click = (page, sel) => $(page, sel).first().click();
const count = (page, sel) => $(page, sel).count();
const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${MOBILE ? "mobile" : "desktop"}-${name}.png`, fullPage: true });
const seen = (loc) => loc.first().waitFor({ timeout: 10000 }).then(() => true, () => false);
const mailCount = async () => (await (await fetch(`${GATEWAY}/__mail`)).json()).length;

async function signUpAndConfirm(page, email, nextPath = "/") {
  const before = await mailCount();
  await page.goto(`${APP}/signup${nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  await page.fill("#email", email);
  await page.fill("#password", PW);
  await click(page, "button[type=submit]");
  await page.getByRole("status").waitFor();
  const msg = await page.getByRole("status").innerText();
  const link = await latestLink(email, before);
  await page.goto(link);
  await page.waitForLoadState("networkidle");
  return msg;
}


/** Opens the workspace menu: always visible in the desktop sidebar; on phones it lives in the "More" sheet. */
async function workspaceMenu(page) {
  if (MOBILE && !(await count(page, "[data-testid=workspace-menu]"))) {
    await $(page, "[data-testid=bottom-nav] button:has-text('More')").click();
    await $(page, "[data-testid=workspace-menu]").first().waitFor();
  }
  return $(page, "[data-testid=workspace-menu]").first();
}
async function closeMenu(page) {
  if (MOBILE && (await count(page, "[role=dialog]"))) await page.keyboard.press("Escape");
}
async function roleOf(page) {
  const m = await workspaceMenu(page);
  const r = await m.getByTestId("active-role").innerText();
  await closeMenu(page);
  return r;
}
async function gotoTeam(page) {
  // Reach /team the way a user would: sidebar link on desktop, More sheet on phones.
  await page.goto(`${APP}/`);
  const m = await workspaceMenu(page);
  await m.getByRole("link", { name: "Team settings" }).click();
  await page.waitForURL(`${APP}/team`);
  await $(page, "h1").first().waitFor();
}
async function switchTeam(page, label) {
  const m = await workspaceMenu(page);
  await m.locator("select#team-switch").selectOption({ label });
  await page.waitForTimeout(1200);
  await closeMenu(page);
}
async function signOutUI(page) {
  const m = await workspaceMenu(page);
  await m.locator("button:has-text('Sign out')").click();
  await page.waitForURL(/\/login/);
}
const addSalesSel = MOBILE ? "[data-testid=fab-add-sales]" : "button:has-text('Add Sales')";

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const newPage = async () => (await browser.newContext(CTX)).newPage();
try {
  // ── anonymous ──
  const anon = await newPage();
  await anon.goto(`${APP}/tenants`);
  ok("anon: /tenants redirects to /login?next=/tenants", new URL(anon.url()).pathname === "/login" && anon.url().includes("next=%2Ftenants"));
  await shot(anon, "login");
  const health = await anon.request.get(`${APP}/api/health`);
  ok("anon: /api/health stays public", health.status() === 200);
  const api = await anon.request.get(`${APP}/api/stripe/checkout`, { maxRedirects: 0 });
  ok("anon: other API routes return 401", api.status() === 401);
  await anon.fill("#email", "nobody@e2e.test");
  await anon.fill("#password", "wrong-password");
  await click(anon, "button[type=submit]");
  ok("anon: wrong credentials show an error", await seen(anon.getByText("Wrong email or password.")));

  // ── alice signs up (email confirmation), creates a team, adds data ──
  const alice = await newPage();
  alice.on("console", (m) => netlog.push(`${Date.now() % 1e6} console.${m.type()}: ${m.text().slice(0, 300)}`));
  alice.on("request", (r) => (r.method() === "POST" || r.headers()["rsc"]) && netlog.push(`${Date.now() % 1e6} REQ ${r.method()} ${new URL(r.url()).pathname} ${r.headers()["next-action"] ? "action" : ""}${r.headers()["next-router-prefetch"] ? "prefetch" : ""}`));
  alice.on("requestfinished", async (r) => (r.method() === "POST" || r.headers()["rsc"]) && netlog.push(`${Date.now() % 1e6} DONE ${r.method()} ${new URL(r.url()).pathname} ${(await r.response())?.status()}`));
  alice.on("requestfailed", (r) => netlog.push(`${Date.now() % 1e6} FAILED ${r.method()} ${r.url().slice(21, 120)} action=${!!r.headers()["next-action"]} ${r.failure()?.errorText}`));
  alice.on("response", (r) => r.status() >= 400 && netlog.push(`${Date.now() % 1e6} HTTP ${r.status()} ${r.request().method()} ${r.url().slice(21, 160)}`));
  alice.on("framenavigated", (f) => f === alice.mainFrame() && netlog.push(`${Date.now() % 1e6} NAV ${f.url()}`));
  const msg = await signUpAndConfirm(alice, ALICE);
  ok("alice: signup asks to confirm email", /confirmation link/i.test(msg));
  ok("alice: confirmation link signs in and lands on onboarding (no team yet)", new URL(alice.url()).pathname === "/onboarding", alice.url());
  await shot(alice, "onboarding");
  await alice.fill("#team-name", "SPSB Leasing");
  await click(alice, "button:has-text('Create workspace')");
  await alice.waitForURL(`${APP}/`);
  ok("alice: create team → dashboard empty state", await seen(alice.getByText("No tenants yet")));
  ok("alice: workspace menu shows Admin role", (await roleOf(alice)) === "Admin");
  ok("alice: Demo workspace data is NOT visible to a new team", (await alice.getByText("Coffee House").count()) === 0);
  if (MOBILE) ok("alice: bottom tab bar visible, desktop sidebar hidden", (await count(alice, "[data-testid=bottom-nav]")) === 1 && (await count(alice, "aside")) === 0);

  await alice.goto(`${APP}/tenants`);
  await click(alice, "button:has-text('Add tenant')");
  await alice.fill("#t-name", "Kopi Corner");
  await alice.fill("#t-unit", "G-01");
  await alice.fill("#t-rate", "7");
  await click(alice, "form button[type=submit]:has-text('Add tenant')");
  ok("alice (admin): tenant saved", await seen(alice.getByRole("link", { name: "Kopi Corner" }).filter({ visible: true })));

  await click(alice, addSalesSel);
  const opt = await alice.locator("select[name=tenant_id] option", { hasText: "Kopi Corner" }).first().getAttribute("value");
  await $(alice, "select[name=tenant_id]").selectOption(opt);
  await $(alice, "input[name=amount]").fill("4321");
  await click(alice, "form:has(input[name=amount]) button[type=submit]");
  await alice.getByText("Sales record added.").waitFor();
  await alice.goto(`${APP}/`);
  const today = await $(alice, "[data-testid=today-total]").first().innerText();
  ok(`alice (admin): sales saved via ${MOBILE ? "FAB" : "Add Sales"} and dashboard shows it`, /4,321/.test(today), today);

  // ── invites ──
  await gotoTeam(alice);
  ok("alice: /team reachable from the workspace menu", new URL(alice.url()).pathname === "/team");
  await alice.fill("#invite-email", BOB);
  await alice.selectOption("#invite-role", "viewer");
  await click(alice, "button:has-text('Create invite')");
  await alice.waitForFunction(() => document.querySelector("[data-testid=invite-link]")?.value.startsWith("http"));
  const bobLink = await alice.getByTestId("invite-link").first().inputValue();
  ok("alice: invite link shown to copy", /\/invite\/[0-9a-f]{48}$/.test(bobLink), bobLink);
  await alice.fill("#invite-email", CAROL);
  await alice.selectOption("#invite-role", "analyst");
  await click(alice, "button:has-text('Create invite')");
  await alice.getByText(`Invite created for ${CAROL}.`).waitFor();
  await alice.reload();
  await $(alice, "[data-testid=invite-row]").first().waitFor().catch(() => {});
  const rows = await count(alice, "[data-testid=invite-row]");
  ok("alice: two pending invites listed", rows === 2, `rows=${rows} all=${await alice.getByTestId("invite-row").count()} ${(await alice.getByText(/Pending invites/).allInnerTexts()).join("|")}`);
  await shot(alice, "team");
  const carolLink = new URL(
    await alice.getByTestId("invite-row").filter({ hasText: CAROL }).getByTestId("invite-link").inputValue(),
    APP,
  ).href;

  // ── bob (viewer) follows the link while signed out, signs up, joins ──
  const bob = await newPage();
  await bob.goto(bobLink);
  ok("bob: invite link → login with next=/invite/…", new URL(bob.url()).pathname === "/login" && bob.url().includes("invite"));
  const invitePath = new URL(bobLink).pathname;
  await signUpAndConfirm(bob, BOB, invitePath);
  ok("bob: after confirming email he lands back on the invite", new URL(bob.url()).pathname === invitePath, bob.url());
  await shot(bob, "invite");
  await click(bob, "button:has-text('Join SPSB Leasing')");
  await bob.waitForURL(`${APP}/`);
  ok("bob: joined — sees alice's sales", /4,321/.test(await $(bob, "[data-testid=today-total]").first().innerText()));
  ok("bob: role shows Viewer", (await roleOf(bob)) === "Viewer");
  ok("bob (viewer): no Add Sales button / FAB", (await count(bob, "button:has-text('Add Sales')")) === 0 && (await bob.getByTestId("fab-add-sales").count()) === 0);
  await bob.goto(`${APP}/tenants`);
  const tv = await seen(bob.getByRole("link", { name: "Kopi Corner" }).filter({ visible: true }));
  const addT = await count(bob, "button:has-text('Add tenant')");
  const del = await count(bob, "button:has-text('Delete')");
  ok("bob (viewer): tenant visible, no Add tenant / Delete", tv && addT === 0 && del === 0, `visible=${tv} add=${addT} delete=${del}`);
  await bob.goto(`${APP}/import`);
  ok("bob (viewer): import page explains read-only", (await bob.getByText("viewer", { exact: false }).filter({ visible: true }).count()) > 0);
  await gotoTeam(bob);
  ok("bob (viewer): team page has no invite form", (await count(bob, "#invite-email")) === 0 && (await count(bob, "[data-testid=member-row]")) === 2);

  await bob.goto(carolLink);
  ok("bob: someone else's invite shows mismatch warning", (await bob.getByText("was sent to").count()) > 0 && (await count(bob, "button:has-text('Join')")) === 0);

  // ── carol (analyst) signs up first, then sees the pending invite on onboarding ──
  const carol = await newPage();
  await signUpAndConfirm(carol, CAROL);
  ok("carol: new user with a pending invite sees it on onboarding", new URL(carol.url()).pathname === "/onboarding" && (await carol.getByText("SPSB Leasing").count()) > 0);
  await click(carol, "button:has-text('Join')");
  await carol.waitForURL(`${APP}/`);
  ok("carol: role shows Analyst", (await roleOf(carol)) === "Analyst");
  ok(`carol (analyst): has ${MOBILE ? "Add Sales FAB" : "Add Sales"}`, await seen($(carol, addSalesSel)));
  if (MOBILE) {
    await click(carol, addSalesSel);
    const o = await carol.locator("select[name=tenant_id] option", { hasText: "Kopi Corner" }).first().getAttribute("value");
    await $(carol, "select[name=tenant_id]").selectOption(o);
    await $(carol, "select[name=period_type]").selectOption("hourly").catch(() => {});
    await $(carol, "input[name=amount]").fill("100");
    await click(carol, "form:has(input[name=amount]) button[type=submit]");
    ok("carol (analyst): Add Sales via FAB saved", await seen(carol.getByText("Sales record added.")));
  }
  await carol.goto(`${APP}/projections`);
  await click(carol, "button:has-text('Save weekly snapshot')");
  ok("carol (analyst): saved a projection snapshot", await seen(carol.getByText("Saved projections (1)")));

  // ── alice: change bob to analyst, then he can write ──
  await gotoTeam(alice);
  const bobRow = $(alice, "[data-testid=member-row]").filter({ hasText: BOB });
  await bobRow.locator("select").selectOption("analyst");
  await alice.waitForTimeout(1000);
  await bob.goto(`${APP}/`);
  ok("bob: promoted by admin → Add Sales appears", await seen($(bob, addSalesSel)));

  // ── second team + switcher; isolation ──
  await gotoTeam(alice);
  await alice.locator("#team-name").fill("Alice Sandbox");
  await click(alice, "button:has-text('Create team')");
  await alice.waitForURL(`${APP}/`);
  ok("alice: second team is empty (data walled off)", await seen(alice.getByText("No tenants yet")));
  await switchTeam(alice, "SPSB Leasing");
  await alice.goto(`${APP}/`);
  ok(`alice: switching back via ${MOBILE ? "More sheet" : "sidebar"} shows SPSB Leasing data`, (MOBILE ? /4,421/ : /4,321/).test(await $(alice, "[data-testid=today-total]").first().innerText()));
  const bm = await workspaceMenu(bob);
  ok("bob: cannot see alice's sandbox in switcher", (await bm.locator("select#team-switch option", { hasText: "Alice Sandbox" }).count()) === 0);
  await closeMenu(bob);

  // ── sign out; magic link sign-in ──
  await signOutUI(alice);
  await alice.goto(`${APP}/`);
  ok("alice: after sign-out the app redirects to login", new URL(alice.url()).pathname === "/login");
  const before = await mailCount();
  await click(alice, "button:has-text('magic link')");
  await alice.fill("#email", ALICE);
  await click(alice, "button[type=submit]");
  await alice.getByRole("status").waitFor();
  await alice.goto(await latestLink(ALICE, before));
  await alice.waitForLoadState("networkidle");
  ok("alice: magic link signs her back in", new URL(alice.url()).pathname === "/" && (await seen($(alice, "main h1"))), alice.url());

  // ── password sign-in ──
  const c2 = await newPage();
  await c2.goto(`${APP}/login`);
  await c2.fill("#email", BOB);
  await c2.fill("#password", PW);
  await click(c2, "button[type=submit]");
  await c2.waitForURL(`${APP}/`);
  ok("bob: password sign-in works", await seen($(c2, "[data-testid=today-total]")));
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
console.log(`\n${tag}${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
