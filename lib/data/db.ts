import "server-only";
import { createClient } from "@/lib/supabase/server";

export class DataError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export function isConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function db() {
  if (!isConfigured()) {
    throw new DataError(
      "Database is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      "not_configured",
    );
  }
  return createClient();
}

export function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    if (res.error.code === "42P01" || /relation .* does not exist|Could not find the table/i.test(res.error.message)) {
      throw new DataError(
        "Database tables are missing — apply supabase/migrations/0001_init.sql in the Supabase SQL editor.",
        "no_schema",
      );
    }
    if (res.error.code === "42703" && /team_id/.test(res.error.message)) {
      throw new DataError(
        "Team workspaces aren't set up in the database yet — apply supabase/migrations/0002_teams.sql in the Supabase SQL editor.",
        "no_schema",
      );
    }
    if (res.error.code === "42501") {
      throw new DataError("You don't have permission to do that in this team.", res.error.code);
    }
    throw new DataError(res.error.message, res.error.code);
  }
  return res.data as T;
}
