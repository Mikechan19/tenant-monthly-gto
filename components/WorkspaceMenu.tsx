"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
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
  const [pending, start] = useTransition();
  if (!ws) return null;
  const active = ws.active;

  return (
    <div className="mx-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm" data-testid="workspace-menu">
      {active && (
        <>
          <label htmlFor="team-switch" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Workspace
          </label>
          {ws.teams.length > 1 ? (
            <select
              id="team-switch"
              value={active.id}
              disabled={pending}
              onChange={(e) =>
                start(async () => {
                  const r = await switchTeam(e.target.value);
                  if (!r.ok) toast(r.errors?.form ?? "Could not switch team.", "error");
                  router.refresh();
                })
              }
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-900"
            >
              {ws.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : (
            <div id="team-switch" className="truncate font-medium text-slate-900">{active.name}</div>
          )}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="rounded bg-white px-1.5 py-0.5 font-medium text-slate-600 ring-1 ring-slate-200" data-testid="active-role">
              {ROLE_LABEL[active.role]}
            </span>
            <Link href="/team" className="font-medium text-teal-700 hover:underline">
              Team settings
            </Link>
          </div>
        </>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2 text-xs text-slate-500">
        <span className="truncate" title={ws.email}>{ws.email}</span>
        <form action={signOut}>
          <button type="submit" className="shrink-0 font-medium text-slate-700 hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
