"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, DataError } from "@/lib/data/db";
import { normalizeEmail, safeNext, TEAM_COOKIE, validateCredentials } from "@/lib/logic/team";

export type AuthState = {
  ok?: boolean;
  message?: string;
  errors?: { email?: string; password?: string; form?: string };
};

async function origin(): Promise<string> {
  const h = await headers();
  const o = h.get("origin");
  if (o) return o;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

async function callbackUrl(next: string) {
  return `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`;
}

function friendly(e: unknown): string {
  if (e instanceof DataError) return e.message;
  const m = e instanceof Error ? e.message : String(e ?? "");
  if (/invalid login credentials/i.test(m)) return "Wrong email or password.";
  if (/email not confirmed/i.test(m)) return "Confirm your email first — check your inbox for the link.";
  if (/already registered|already exists/i.test(m)) return "That email already has an account — sign in instead.";
  if (/rate limit/i.test(m)) return "Too many attempts — wait a minute and try again.";
  return m || "Something went wrong. Please try again.";
}

export async function signIn(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const v = validateCredentials(fd.get("email"), fd.get("password"));
  if (!v.ok) return { ok: false, errors: v.errors };
  const next = safeNext(fd.get("next"));
  try {
    const s = await db();
    const { error } = await s.auth.signInWithPassword({ email: v.email, password: v.password });
    if (error) return { ok: false, errors: { form: friendly(error) } };
  } catch (e) {
    return { ok: false, errors: { form: friendly(e) } };
  }
  redirect(next);
}

export async function signUp(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const v = validateCredentials(fd.get("email"), fd.get("password"), { signup: true });
  if (!v.ok) return { ok: false, errors: v.errors };
  const next = safeNext(fd.get("next"));
  let signedIn = false;
  try {
    const s = await db();
    const { data, error } = await s.auth.signUp({
      email: v.email,
      password: v.password,
      options: { emailRedirectTo: await callbackUrl(next) },
    });
    if (error) return { ok: false, errors: { form: friendly(error) } };
    // Supabase returns a user with no identities when the email is already registered.
    if (data.user && data.user.identities && data.user.identities.length === 0)
      return { ok: false, errors: { form: "That email already has an account — sign in instead." } };
    signedIn = Boolean(data.session); // true when "Confirm email" is off in Supabase
  } catch (e) {
    return { ok: false, errors: { form: friendly(e) } };
  }
  if (signedIn) redirect(next);
  return { ok: true, message: `We sent a confirmation link to ${v.email}. Open it to finish signing up.` };
}

export async function sendMagicLink(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const email = normalizeEmail(fd.get("email"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, errors: { email: "Enter a valid email address." } };
  const next = safeNext(fd.get("next"));
  try {
    const s = await db();
    const { error } = await s.auth.signInWithOtp({ email, options: { emailRedirectTo: await callbackUrl(next) } });
    if (error) return { ok: false, errors: { form: friendly(error) } };
  } catch (e) {
    return { ok: false, errors: { form: friendly(e) } };
  }
  return { ok: true, message: `Check ${email} for a sign-in link.` };
}

export async function signOut(): Promise<void> {
  try {
    const s = await db();
    await s.auth.signOut();
  } catch {
    // fall through — clearing cookies below still signs the browser out of the app
  }
  (await cookies()).delete(TEAM_COOKIE);
  redirect("/login");
}
