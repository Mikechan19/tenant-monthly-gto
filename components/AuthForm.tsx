"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { sendMagicLink, signIn, signUp, type AuthState } from "@/app/auth/actions";
import { Field, btnPrimary, inputCls } from "./ui";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative mx-auto mt-[max(0.5rem,env(safe-area-inset-top))] w-full max-w-md sm:mt-14">
      {/* soft teal glow behind the card */}
      <div className="pointer-events-none absolute -top-10 right-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute top-40 left-0 h-40 w-40 rounded-full bg-chart-emerald/10 blur-3xl" aria-hidden />
      <div className="relative mb-6 flex items-center gap-3">
        <div className="num grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-[#134e4a] text-xs font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_4px_14px_rgb(15_118_110/0.25)]">GTO</div>
        <div className="leading-tight">
          <div className="text-base font-bold tracking-tight text-ink">Tenant GTO</div>
          <div className="label-caps text-[10px] text-primary">GTO Leasing • Leasing &amp; Finance</div>
        </div>
      </div>
      {/* overflow-wrap:anywhere — long email addresses must wrap on 360px phones */}
      <div className="relative rounded-3xl border border-line bg-white/95 p-6 shadow-lift backdrop-blur-xl [overflow-wrap:anywhere] sm:p-8">
        <h1 className="text-2xl leading-8 font-bold tracking-[-0.02em] text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function Notice({ state }: { state: AuthState }) {
  if (state.errors?.form)
    return (
      <p role="alert" className="rounded-xl bg-neg-bg px-3 py-2 text-sm text-rose-800">
        {state.errors.form}
      </p>
    );
  if (state.ok && state.message)
    return (
      <p role="status" className="rounded-xl bg-pos-bg px-3 py-2 text-sm text-emerald-800">
        {state.message}
      </p>
    );
  return null;
}

export function AuthForm({ mode, next, initialError }: { mode: "login" | "signup"; next: string; initialError?: string }) {
  const [magic, setMagic] = useState(false);
  const [state, action, pending] = useActionState<AuthState, FormData>(
    (prev, fd) => (fd.get("via") === "magic" ? sendMagicLink(prev, fd) : mode === "login" ? signIn(prev, fd) : signUp(prev, fd)),
    initialError ? { ok: false, errors: { form: initialError } } : {},
  );
  const e = state.errors ?? {};
  const q = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="via" value={magic ? "magic" : "password"} />
        <Field label="Work email" htmlFor="email" error={e.email}>
          <input id="email" name="email" type="email" autoComplete="email" required className={inputCls} placeholder="you@company.com.my" />
        </Field>
        {!magic && (
          <Field label="Password" htmlFor="password" error={e.password}>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={mode === "signup" ? 8 : undefined}
              className={inputCls}
              placeholder={mode === "signup" ? "At least 8 characters" : ""}
            />
          </Field>
        )}
        <Notice state={state} />
        <button type="submit" className={`${btnPrimary} w-full justify-center`} disabled={pending}>
          {pending ? "Please wait…" : magic ? "Email me a sign-in link" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
      <div className="flex flex-col gap-2 text-center text-sm text-ink-2">
        {mode === "login" && (
          <button type="button" className="min-h-11 font-semibold text-primary underline-offset-4 hover:underline sm:min-h-0" onClick={() => setMagic((m) => !m)}>
            {magic ? "Use a password instead" : "Email me a magic link instead"}
          </button>
        )}
        {mode === "login" ? (
          <span>
            New here?{" "}
            <Link href={`/signup${q}`} className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </span>
        ) : (
          <span>
            Already have an account?{" "}
            <Link href={`/login${q}`} className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </span>
        )}
      </div>
    </div>
  );
}
