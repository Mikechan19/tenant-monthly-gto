"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { sendMagicLink, signIn, signUp, type AuthState } from "@/app/auth/actions";
import { Field, btnPrimary, inputCls } from "./ui";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-6 w-full max-w-md sm:mt-16">
      <div className="mb-6 flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-teal-700 text-xs font-bold text-white">GTO</div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-slate-900">Tenant GTO</div>
          <div className="text-xs text-slate-500">Leasing &amp; Finance</div>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function Notice({ state }: { state: AuthState }) {
  if (state.errors?.form)
    return (
      <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {state.errors.form}
      </p>
    );
  if (state.ok && state.message)
    return (
      <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
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
      <div className="flex flex-col gap-2 text-center text-sm text-slate-600">
        {mode === "login" && (
          <button type="button" className="font-medium text-teal-700 hover:underline" onClick={() => setMagic((m) => !m)}>
            {magic ? "Use a password instead" : "Email me a magic link instead"}
          </button>
        )}
        {mode === "login" ? (
          <span>
            New here?{" "}
            <Link href={`/signup${q}`} className="font-medium text-teal-700 hover:underline">
              Create an account
            </Link>
          </span>
        ) : (
          <span>
            Already have an account?{" "}
            <Link href={`/login${q}`} className="font-medium text-teal-700 hover:underline">
              Sign in
            </Link>
          </span>
        )}
      </div>
    </div>
  );
}
