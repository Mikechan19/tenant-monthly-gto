import type { GtoTier } from "@/lib/logic/gto";

export type PeriodType = "hourly" | "daily" | "weekly" | "monthly";
export const PERIOD_TYPES: PeriodType[] = ["hourly", "daily", "weekly", "monthly"];

export type Tenant = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  rent_rate_pct: number | null;
  // lease & GTO terms (0003_gto_terms.sql)
  property: string | null;
  base_rent_monthly: number | null;
  gto_tiers: GtoTier[] | null;
  gto_sst_pct: number;
  lease_start: string | null; // YYYY-MM-DD
  lease_end: string | null;
  team_id: string;
  user_id: string | null;
  created_at: string;
};

export type SalesRecord = {
  id: string;
  tenant_id: string;
  period_type: PeriodType;
  amount: number;
  recorded_at: string;
  source: string | null;
  outlet: string | null;
  team_id: string;
  user_id: string | null;
  created_at: string;
};

export type SavedProjection = {
  id: string;
  tenant_id: string;
  target_period: "weekly" | "monthly";
  projected_amount: number;
  method: string | null;
  confidence: number | null;
  source: string | null;
  review_status: string | null;
  team_id: string;
  created_at: string;
};
