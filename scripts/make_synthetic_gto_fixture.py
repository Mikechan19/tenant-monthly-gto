#!/usr/bin/env python3
"""Write __tests__/fixtures/synthetic_gto_2026.json — MADE-UP tenants, bands and sales in the same shape
as the private Excel fixture (see scripts/gto_from_excel.py), with expected figures computed independently
here with exact Decimal arithmetic (ROUND_HALF_UP to the sen). Committed; contains no real data.

Covers: 2- and 3-band marginal tiers, SST, a month below the threshold (GTO 0), months with no sales,
two outlets that only cross the threshold combined, base rent + GTO, and a half-sen value
(Demo Tenant B, gross 700,001 → GTO 18,750.045) that naive float rounding gets wrong (18,750.04).
"""
import json
from decimal import ROUND_HALF_UP, Decimal as D
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "__tests__/fixtures/synthetic_gto_2026.json"
SEN = D("0.01")


def label(lo, hi):
    lo_s = "0" if lo == 0 else f"{int(lo) + 1:,}"
    return f"{lo_s} - Above" if hi is None else f"{lo_s} - {int(hi):,}"


def calc(gross, tiers, sst_pct):
    gross, lo, total, bands = D(str(gross)), D(0), D(0), []
    for i, t in enumerate(tiers):
        hi = None if t["up_to"] is None else D(str(t["up_to"]))
        cap = gross if hi is None else min(hi, gross)
        sales = max(cap - lo, D(0))
        amt = sales * D(str(t["rate"]))
        total += amt
        bands.append({"label": label(lo, hi), "rate": t["rate"], "sales": float(sales) if sales % 1 else int(sales),
                      "excel_exact": format(amt.normalize(), "f"), "excel_cents": str(amt.quantize(SEN, ROUND_HALF_UP))})
        if hi is not None:
            lo = hi
    after = total * (1 + D(str(sst_pct)) / 100)
    return bands, total, after


def tenant(name, prop, tiers, sst, months, **extra):
    t = {"code": name.split()[-1], "name": name, "property": prop, "tiers": tiers, "sst_pct": sst, "months": {}, **extra}
    for m, v in months.items():
        outlets = v if isinstance(v, dict) else None
        gross = sum(D(str(x)) for x in outlets.values()) if outlets else D(str(v))
        bands, gto, after = calc(gross, tiers, sst)
        g = float(gross) if gross % 1 else int(gross)
        row = {"gross": g, "gto_exact": format(gto.normalize(), "f"), "gto_cents": str(gto.quantize(SEN, ROUND_HALF_UP))}
        if outlets:
            row["outlets"] = outlets
        else:
            row.update({"bands": bands, "after_sst_exact": format(after.normalize(), "f"),
                        "after_sst_cents": str(after.quantize(SEN, ROUND_HALF_UP)), "sheet": f"M{m:02d}({t['code']})"})
        t["months"][m] = row
    return t


tenants = [
    tenant("Demo Tenant A", "Demo Mall North", [{"up_to": 400000, "rate": 0.0}, {"up_to": None, "rate": 0.03}], 8.0,
           {1: 912345, 2: 874120, 3: 385000, 4: 1000500, 5: 400000, 6: 955501, 7: 899999.99, 8: 1210437}),
    tenant("Demo Tenant B", "Demo Mall South",
           [{"up_to": 150000, "rate": 0.0}, {"up_to": 350000, "rate": 0.015}, {"up_to": None, "rate": 0.045}], 8.0,
           {1: 512345, 2: 260000, 3: 150000, 4: 350000, 5: 643219, 6: 488888, 7: 599001, 8: 700001}),
    tenant("Demo Tenant C", None, [{"up_to": 300000, "rate": 0.0}, {"up_to": None, "rate": 0.05}], 0,
           {1: {"Outlet North": 120450.5, "Outlet South": 60210.25}, 2: {"Outlet North": 131000, "Outlet South": 55999.9},
            3: {"Outlet North": 98765.4, "Outlet South": 40000}, 4: {"Outlet North": 160000, "Outlet South": 152345.67},
            5: {"Outlet North": 140000.01, "Outlet South": 70000}, 6: {"Outlet North": 150000, "Outlet South": 150000},
            7: {"Outlet North": 101010.1, "Outlet South": 20202.02}},
           outlets=["Outlet North", "Outlet South"], base_rent_monthly=12500, base_rent_psf=5,
           lease_start="2025-07-01", lease_end="2028-06-30"),
]
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({"year": 2026, "synthetic": True, "tenants": tenants, "excel_summary_sheet": {}}, indent=1) + "\n")
print(f"wrote {OUT}")
