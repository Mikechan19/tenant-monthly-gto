// Browser E2E for the Monthly GTO screen against a LOCAL stack (GoTrue + PostgREST + capture SMTP gateway).
// Data: private/excel_gto_2026.json + private/2026_gto_actuals.sql when they exist (real Excel figures, local
// only), else the committed synthetic fixture __tests__/fixtures/synthetic_gto_2026.json with a seed built
// from it here. Every on-screen GTO figure is compared with the fixture; no tenant names or figures are
// hard-coded in this file.
// Usage: APP=… GATEWAY=… PSQL="psql -d <db>" SHOTS=<dir> [SYNTHETIC=1] NODE_PATH=<playwright-core dir> node e2e/gto-flow.mjs
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const APP = process.env.APP ?? "http://localhost:3210";
const GATEWAY = process.env.GATEWAY ?? "http://127.0.0.1:54341";
const PSQL = process.env.PSQL; // used to reset/seed the Demo workspace and add the test user to it
const SHOTS = process.env.SHOTS;
const DEMO = "00000000-0000-4000-8000-00000000d0e0";
const root = new URL("..", import.meta.url).pathname;
const privFixture = join(root, "private/excel_gto_2026.json");
const privSeed = join(root, "private/2026_gto_actuals.sql");
const PRIVATE = !process.env.SYNTHETIC && existsSync(privFixture) && existsSync(privSeed);
const fixture = JSON.parse(readFileSync(PRIVATE ? privFixture : join(root, "__tests__/fixtures/synthetic_gto_2026.json"), "utf8"));
const YEAR = fixture.year;
const tiered = fixture.tenants.filter((t) => !t.outlets); // tenants with per-band sheets (+ SST)
const outletT = fixture.tenants.find((t) => t.outlets); // tenant with several outlets + base rent
const [T1, T2] = tiered;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EMAIL = `gto.${Date.now().toString(36)}@e2e.test`;
const PW = "correct-horse-9";
const results = [];
const recon = [];
const ok = (name, cond, extra = "") => {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
};
const $ = (page, sel) => page.locator(sel).filter({ visible: true });
const seen = (loc) => loc.first().waitFor({ timeout: 10000 }).then(() => true, () => false);

// ── exact money (same rules as lib/logic/gto.ts, independent implementation) ──
const SCALE = 10n ** 14n;
const decUnits = (s) => {
  const neg = String(s).startsWith("-");
  const [w, f = ""] = String(s).replace("-", "").split(".");
  const u = BigInt(w) * SCALE + BigInt((f + "0".repeat(14)).slice(0, 14));
  return neg ? -u : u;
};
const fmtUnits = (u) => {
  const sen = (u + 10n ** 12n / 2n) / 10n ** 12n;
  return (Number(sen) / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmt = (s) => fmtUnits(decUnits(s));
function calcUnits(gross, tiers, sstPct = 0) {
  const g = BigInt(Math.round(gross * 100));
  let lo = 0n;
  let gto = 0n;
  for (const t of tiers) {
    const hi = t.up_to === null ? null : BigInt(Math.round(t.up_to * 100));
    const cap = hi === null || hi > g ? g : hi;
    if (cap > lo) gto += (cap - lo) * BigInt(Math.round(t.rate * 1e6)) * 10n ** 6n;
    if (hi !== null) lo = hi;
  }
  return { gto, after: (gto * (10n ** 6n + BigInt(Math.round(sstPct * 1e4)))) / 10n ** 6n };
}
const fmtDate = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const lastMonth = (t) => Math.max(...Object.keys(t.months).map(Number));

// ── seed (synthetic mode builds it from the fixture; private mode runs the generated private seed) ──
function syntheticSeed() {
  const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
  const out = ["do $s$ declare v_t uuid; begin"];
  for (const t of fixture.tenants) {
    const tiers = JSON.stringify(t.tiers);
    out.push(
      `  select id into v_t from public.tenants where team_id = '${DEMO}' and name = ${q(t.name)} limit 1;`,
      `  if v_t is null then insert into public.tenants (team_id, name) values ('${DEMO}', ${q(t.name)}) returning id into v_t; end if;`,
      `  update public.tenants set property = ${q(t.property)}, gto_tiers = '${tiers}'::jsonb, gto_sst_pct = ${t.sst_pct},` +
        ` base_rent_monthly = ${t.base_rent_monthly ?? "null"}, lease_start = ${q(t.lease_start)}, lease_end = ${q(t.lease_end)} where id = v_t;`,
      // synthetic tenants are test-only: make the fixture authoritative so a changed fixture re-seeds cleanly
      `  delete from public.sales_records where tenant_id = v_t and period_type = 'monthly' and source = 'import';`,
    );
    for (const [m, x] of Object.entries(t.months)) {
      const at = `${YEAR}-${String(m).padStart(2, "0")}-01 12:00:00+08`;
      for (const [o, a] of x.outlets ? Object.entries(x.outlets) : [[null, x.gross]])
        out.push(
          `  insert into public.sales_records (team_id, tenant_id, period_type, amount, recorded_at, source, outlet) select '${DEMO}', v_t, 'monthly', ${a}, '${at}', 'import', ${q(o)}::text` +
            ` where not exists (select 1 from public.sales_records s where s.tenant_id = v_t and s.period_type = 'monthly' and s.recorded_at = '${at}' and s.outlet is not distinct from ${q(o)}::text);`,
        );
    }
  }
  out.push("end $s$;");
  const f = join(tmpdir(), `gto-synthetic-seed-${process.pid}.sql`);
  writeFileSync(f, out.join("\n"));
  return f;
}

async function confirmLink(to, since) {
  for (let i = 0; i < 40; i++) {
    const all = await (await fetch(`${GATEWAY}/__mail`)).json();
    const m = all.slice(since).find((x) => x.raw.toLowerCase().includes(to));
    if (m) {
      const body = m.raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      return body.match(/href="([^"]*\/verify\?[^"]*)"/)[1].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("no confirmation email");
}
const row = (page, tenant, line) => page.locator(`[data-testid=gto-row-${line}][data-tenant="${tenant}"]`);
const cell = async (page, tenant, line, i) => (await row(page, tenant, line).locator("td").nth(i).innerText()).trim();
const rowTotal = async (page, tenant, line) => (await row(page, tenant, line).locator("td").last().innerText()).trim();

console.log(`data: ${PRIVATE ? "private Excel fixture (local only)" : "synthetic fixture"}`);
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
try {
  if (!PSQL) throw new Error("set PSQL to seed the Demo workspace and add the test user to it");
  // reset what earlier runs changed (this test's manual outlet sale, edited bands), then (re)seed
  execSync(`${PSQL} -qAtc "delete from public.sales_records where source = 'manual' and team_id = '${DEMO}' and tenant_id in (select id from public.tenants where team_id = '${DEMO}' and name = '${outletT.name.replace(/'/g, "''")}')"`);
  execSync(`${PSQL} -q -v ON_ERROR_STOP=1 -f "${PRIVATE ? privSeed : syntheticSeed()}"`, { stdio: "ignore" });

  const desk = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const since = (await (await fetch(`${GATEWAY}/__mail`)).json()).length;
  await desk.goto(`${APP}/signup`);
  await desk.fill("#email", EMAIL);
  await desk.fill("#password", PW);
  await $(desk, "button[type=submit]").click();
  await desk.getByRole("status").waitFor();
  await desk.goto(await confirmLink(EMAIL, since));
  await desk.waitForURL(/onboarding/);
  execSync(`${PSQL} -qAtc "select public.add_team_member_by_email('${DEMO}', '${EMAIL}', 'admin')"`);
  await desk.goto(`${APP}/gto?year=${YEAR}`);
  ok("desktop: /gto loads for a Demo workspace member", await seen($(desk, "[data-testid=gto-grid]")));
  ok("desktop: sidebar has Monthly GTO", (await $(desk, "aside a[href='/gto']").count()) === 1);

  // ── every tenant-month vs the fixture ──
  let mismatches = 0;
  for (const t of fixture.tenants) {
    const sst = Number(t.sst_pct) > 0;
    for (let i = 0; i < 12; i++) {
      const x = t.months[String(i + 1)];
      const gto = await cell(desk, t.name, "gto", i);
      const second = sst ? await cell(desk, t.name, "sst", i) : await cell(desk, t.name, "gross", i);
      const want = x ? fmt(x.gto_exact) : "—";
      const want2 = !x ? "—" : sst ? fmt(x.after_sst_exact) : Number(x.gross).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const match = gto === want && second === want2;
      if (!match) mismatches++;
      recon.push({ tenant: t.name, month: MONTHS[i], fxGto: x ? x.gto_cents : "(no sales)", appGto: gto, fx2: x ? (sst ? x.after_sst_cents : x.gross) : "(no sales)", app2: second, match });
    }
  }
  const n = fixture.tenants.length * 12;
  ok(`desktop: all ${n} tenant-months match the fixture ('—' where no sales)`, mismatches === 0, `${mismatches} mismatches`);
  ok("desktop: no negative figures anywhere", (await desk.locator("[data-testid=gto-grid] td").allInnerTexts()).every((s) => !s.trim().startsWith("-")));
  const exactTotal = (t, k) => fmtUnits(Object.values(t.months).reduce((s, x) => s + decUnits(x[k]), 0n));
  ok("desktop: annual totals = exact sums of the months, rounded once",
    fixture.tenants.every(() => true) &&
      (await rowTotal(desk, T1.name, "gto")) === exactTotal(T1, "gto_exact") &&
      (await rowTotal(desk, T2.name, "gto")) === exactTotal(T2, "gto_exact") &&
      (await rowTotal(desk, T2.name, "sst")) === exactTotal(T2, "after_sst_exact") &&
      (await rowTotal(desk, outletT.name, "gto")) === exactTotal(outletT, "gto_exact"),
    `${await rowTotal(desk, T1.name, "gto")} / ${await rowTotal(desk, T2.name, "gto")}`);
  const base = Number(outletT.base_rent_monthly);
  const m1 = outletT.months["1"];
  ok("desktop: base rent + GTO = total rent (outlet tenant, Jan)",
    (await cell(desk, outletT.name, "total", 0)) === fmtUnits(BigInt(Math.round(base * 100)) * 10n ** 12n + decUnits(m1.gto_exact)));
  ok("desktop: portfolio row present", (await desk.getByTestId("portfolio-gto").count()) === 1);
  if (SHOTS) await desk.screenshot({ path: `${SHOTS}/gto-1440.png`, fullPage: true });

  // ── band breakdown (second tiered tenant, its last month with sales) ──
  const lm = lastMonth(T2);
  const xm = T2.months[String(lm)];
  await row(desk, T2.name, "gto").locator(`[data-testid=gto-cell-${YEAR}-${String(lm).padStart(2, "0")}]`).click();
  const bd = $(desk, "[data-testid=gto-breakdown]");
  await bd.waitFor();
  const bands = await bd.locator("[data-testid=band-row]").allInnerTexts();
  ok(`breakdown: ${xm.bands.length} bands with the fixture's labels and amounts`,
    bands.length === xm.bands.length && xm.bands.every((b, i) => bands[i].includes(b.label) && bands[i].includes(fmt(b.excel_exact))),
    bands.join(" | ").replace(/\s+/g, " "));
  ok("breakdown: GTO and after-SST totals",
    (await bd.getByTestId("breakdown-gto").innerText()) === fmt(xm.gto_exact) && (await bd.getByTestId("breakdown-after-sst").innerText()) === fmt(xm.after_sst_exact));
  if (SHOTS) await desk.screenshot({ path: `${SHOTS}/gto-1440-breakdown.png` });
  await desk.keyboard.press("Escape");
  await row(desk, outletT.name, "gto").locator(`[data-testid=gto-cell-${YEAR}-01]`).click();
  const jb = $(desk, "[data-testid=gto-breakdown]");
  await jb.waitFor();
  const jt = await jb.innerText();
  const money2 = (v) => Number(v).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  ok("breakdown: outlet tenant lists every outlet with its sales",
    Object.entries(m1.outlets).every(([o, a]) => jt.includes(o) && jt.includes(money2(a))));
  await desk.keyboard.press("Escape");

  // ── tenant page: terms card + mini table ──
  await desk.getByRole("link", { name: outletT.name }).filter({ visible: true }).first().click();
  await desk.waitForURL(/\/tenants\//);
  const terms = await $(desk, "[data-testid=lease-terms]").innerText();
  ok("tenant page: Lease & GTO terms card (base rent, lease term)",
    terms.includes(money2(base)) && terms.includes(fmtDate(outletT.lease_start)) && terms.includes(fmtDate(outletT.lease_end)), terms.replace(/\s+/g, " "));
  ok("tenant page: monthly GTO mini-table", (await $(desk, "[data-testid=tenant-gto-table] tbody tr").count()) === 12);
  if (SHOTS) await desk.screenshot({ path: `${SHOTS}/tenant-outlets-1440.png`, fullPage: true });

  // ── add an outlet sale in the first month without sales → recomputes over the threshold ──
  const nm = lastMonth(outletT) + 1;
  const threshold = outletT.tiers[0].up_to;
  const amount = threshold + 71560;
  const want = calcUnits(amount, outletT.tiers, outletT.sst_pct);
  await $(desk, "button:has-text('Add Sales')").first().click();
  await $(desk, "select[name=period_type]").selectOption("monthly");
  await $(desk, "input[name=date]").fill(`${YEAR}-${String(nm).padStart(2, "0")}-01`);
  await desk.waitForFunction((k) => document.querySelectorAll("#outlet-options option").length >= k, outletT.outlets.length);
  const opts = await desk.locator("#outlet-options option").evaluateAll((os) => os.map((o) => o.value));
  ok("add sales: outlet datalist offers the tenant's outlets", outletT.outlets.every((o) => opts.includes(o)), `${opts.length} options`);
  await $(desk, "input[name=outlet]").fill(outletT.outlets[0]);
  await $(desk, "input[name=amount]").fill(String(amount));
  await $(desk, "form:has(input[name=amount]) button[type=submit]").click();
  await desk.getByText("Sales record added.").waitFor();
  await desk.goto(`${APP}/gto?year=${YEAR}`);
  ok("add sales: month recomputes (threshold + 71,560 → GTO on the excess; total rent = base + GTO)",
    (await cell(desk, outletT.name, "gto", nm - 1)) === fmtUnits(want.gto) &&
      (await cell(desk, outletT.name, "total", nm - 1)) === fmtUnits(BigInt(Math.round(base * 100)) * 10n ** 12n + want.after),
    `${await cell(desk, outletT.name, "gto", nm - 1)} / ${await cell(desk, outletT.name, "total", nm - 1)}`);

  // ── edit a band in the tenant form → /gto recomputes; then restore ──
  const topIdx = T2.tiers.length; // 1-based label index of the open-ended band
  const topPct = Number((T2.tiers[topIdx - 1].rate * 100).toFixed(6));
  async function setTop(pct) {
    await desk.goto(`${APP}/gto?year=${YEAR}`);
    await desk.getByRole("link", { name: T2.name }).filter({ visible: true }).first().click();
    await desk.waitForURL(/\/tenants\//);
    await $(desk, "button:has-text('Edit')").first().click();
    const ed = $(desk, "[data-testid=tier-editor]");
    await ed.waitFor();
    await ed.getByLabel(`Band ${topIdx} rate (%)`).fill(String(pct));
    await $(desk, "button:has-text('Save tenant')").click();
    await desk.getByText("Tenant updated.").waitFor();
  }
  await setTop(topPct + 0.5);
  const edited = calcUnits(xm.gross, T2.tiers.map((t, i) => (i === topIdx - 1 ? { ...t, rate: (topPct + 0.5) / 100 } : t)), T2.sst_pct);
  await desk.goto(`${APP}/gto?year=${YEAR}`);
  ok(`edit band: top rate ${topPct}% → ${topPct + 0.5}% recomputes ${MONTHS[lm - 1]}`,
    (await cell(desk, T2.name, "gto", lm - 1)) === fmtUnits(edited.gto) && (await cell(desk, T2.name, "sst", lm - 1)) === fmtUnits(edited.after),
    `${await cell(desk, T2.name, "gto", lm - 1)} / ${await cell(desk, T2.name, "sst", lm - 1)}`);
  await setTop(topPct);
  await desk.goto(`${APP}/gto?year=${YEAR}`);
  ok("edit band: restored → back to the fixture figure", (await cell(desk, T2.name, "gto", lm - 1)) === fmt(xm.gto_exact));
  await desk.getByRole("link", { name: T2.name }).filter({ visible: true }).first().click();
  await desk.waitForURL(/\/tenants\//);
  await $(desk, "button:has-text('Edit')").first().click();
  await $(desk, "[data-testid=tier-editor]").getByLabel("Band 2 upper limit (RM)").fill("1");
  await $(desk, "button:has-text('Save tenant')").click();
  ok("edit band: decreasing limits rejected with an inline error", await seen($(desk, "[data-testid=tier-editor] [role=alert]")));
  await desk.keyboard.press("Escape");

  // ── phone: cards + breakdown ──
  const mob = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
  await mob.goto(`${APP}/login`);
  await mob.fill("#email", EMAIL);
  await mob.fill("#password", PW);
  await $(mob, "button[type=submit]").click();
  await mob.waitForURL(`${APP}/`);
  await $(mob, "[data-testid=bottom-nav] a[href='/gto']").click();
  await mob.waitForURL(/\/gto/);
  ok("mobile: GTO tab in the bottom bar", true);
  const cards = $(mob, "[data-testid=gto-card]");
  await cards.first().waitFor();
  const names = await cards.locator("a[href^='/tenants/']").allInnerTexts();
  ok("mobile: one card per tenant incl. every fixture tenant", fixture.tenants.every((t) => names.includes(t.name)) && new Set(names).size === names.length, `${names.length} cards`);
  const c1 = cards.filter({ hasText: T1.name });
  const firstNoSales = MONTHS.findIndex((_, i) => !T1.months[String(i + 1)]);
  ok("mobile: first tenant's Jan figure (after SST) and '— no sales' months",
    (await c1.getByTestId(`gto-cell-${YEAR}-01`).innerText()) === fmt(T1.months["1"].after_sst_exact) && (firstNoSales < 0 || /— no sales/.test(await c1.innerText())));
  ok("mobile: no horizontal overflow at 390px", await mob.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  if (SHOTS) await mob.screenshot({ path: `${SHOTS}/gto-390.png`, fullPage: true });
  await c1.getByTestId(`gto-cell-${YEAR}-01`).click();
  const mb = $(mob, "[data-testid=gto-breakdown]");
  await mb.waitFor();
  ok("mobile: breakdown sheet opens with the bands",
    (await mb.locator("[data-testid=band-row]").count()) === T1.tiers.length && (await mb.getByTestId("breakdown-after-sst").innerText()) === fmt(T1.months["1"].after_sst_exact));
  if (SHOTS) await mob.screenshot({ path: `${SHOTS}/gto-390-breakdown.png` });
} catch (e) {
  ok("unexpected exception", false, String(e?.stack ?? e).slice(0, 900));
} finally {
  await browser.close();
}
if (recon.length) {
  console.log("\nReconciliation (fixture vs app):");
  console.log("tenant | month | fixture GTO | app GTO | fixture after SST (or gross) | app | ok");
  for (const r of recon) console.log(`${r.tenant} | ${r.month} | ${r.fxGto} | ${r.appGto} | ${r.fx2} | ${r.app2} | ${r.match ? "✓" : "✗"}`);
}
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
