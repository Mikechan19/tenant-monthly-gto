"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/app/auth/actions";
import { switchTeam } from "@/app/team/actions";
import { ROLE_LABEL } from "@/lib/logic/team";
import { useToast } from "./Toast";
import { useWorkspace } from "./Workspace";

/** Team switcher + team settings + signed-in user + sign out. Rendered inside the sidebar. */
export function WorkspaceMenu() {
  const ws = useWorkspace();
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  if (!ws) return null;
  const active = ws.active;

  return (
    <div className="mx-3 space-y-2.5 rounded-2xl border border-line bg-canvas p-3.5 text-sm shadow-card" data-testid="workspace-menu">
      {active && (
        <>
          <label htmlFor="team-switch" className="label-caps block text-[11px] text-muted">
            Team workspace
          </label>
          {ws.teams.length > 1 ? (
            <select
              id="team-switch"
              value={active.id}
              disabled={pending}
              onChange={async (e) => {
                // Plain async (not a transition) + full reload: every screen's data changes with the team,
                // and a reload can't get stuck behind an in-flight client navigation.
                setPending(true);
                try {
                  const r = await switchTeam(e.target.value);
                  if (!r.ok) {
                    toast(r.errors?.form ?? "Could not switch team.", "error");
                    setPending(false);
                    router.refresh();
                    return;
                  }
                  // A tenant page of the old team would 404 in the new one.
                  window.location.assign(/^\/tenants\/[^/]+/.test(window.location.pathname) ? "/tenants" : window.location.pathname);
                } catch {
                  toast("Couldn’t reach the server. Try again.", "error");
                  setPending(false);
                }
              }}
              className="min-h-11 w-full rounded-xl border border-line-strong bg-white px-3 py-2 text-sm font-semibold text-ink shadow-[0_1px_2px_rgb(15_23_42/0.04)] focus:border-primary focus:ring-[3px] focus:ring-primary/15 focus:outline-none md:min-h-10"
            >
              {ws.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : (
            <div id="team-switch" className="truncate text-[15px] font-bold tracking-tight text-ink">{active.name}</div>
          )}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex min-h-6 items-center rounded-full bg-primary-tint px-2.5 text-[11px] font-semibold tracking-[0.02em] text-primary" data-testid="active-role">
              {ROLE_LABEL[active.role]}
            </span>
            <Link href="/team" className="inline-flex min-h-8 items-center font-semibold text-primary underline-offset-4 hover:underline">
              Team settings
            </Link>
          </div>
        </>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-line pt-2.5 text-xs text-muted">
        <span className="truncate" title={ws.email}>{ws.email}</span>
        <form action={signOut}>
          <button type="submit" className="min-h-8 shrink-0 font-semibold text-ink-2 underline-offset-4 hover:text-neg hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
