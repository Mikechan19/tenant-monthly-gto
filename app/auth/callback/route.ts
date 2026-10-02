import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/logic/team";

/**
 * Landing URL for Supabase email links (signup confirmation, magic link, invite-driven signup).
 * Handles both the PKCE `?code=` flow and the `?token_hash=&type=` email-template flow.
 * Add `https://<your-domain>/auth/callback` to Supabase → Auth → URL Configuration → Redirect URLs.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}&next=${encodeURIComponent(next)}`, url.origin));

  const upstreamError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (upstreamError) return fail(upstreamError);

  try {
    const supabase = await createClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return fail("That link has expired or was already used. Sign in, or request a new link.");
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (error) return fail("That link has expired or was already used. Sign in, or request a new link.");
    } else {
      return fail("Invalid sign-in link.");
    }
  } catch {
    return fail("Could not complete sign-in. Please try again.");
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
