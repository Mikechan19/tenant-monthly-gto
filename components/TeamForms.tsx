"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  acceptInvite,
  changeRole,
  createTeam,
  inviteMember,
  leaveTeam,
  removeMember,
  renameTeam,
  revokeInvite,
  type TeamState,
} from "@/app/team/actions";
import { inviteUrl, ROLE_HELP, ROLE_LABEL, ROLES, type Role } from "@/lib/logic/team";
import { useToast } from "./Toast";
import { Field, btnDanger, btnPrimary, btnSecondary, inputCls } from "./ui";

function FormError({ state }: { state: TeamState }) {
  return state.errors?.form ? (
    <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
      {state.errors.form}
    </p>
  ) : null;
}

export function CreateTeamForm({ cta = "Create workspace" }: { cta?: string }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(createTeam, {});
  return (
    <form action={action} className="space-y-3" noValidate>
      <Field label="Team name" htmlFor="team-name" error={state.errors?.name}>
        <input id="team-name" name="name" className={inputCls} placeholder="e.g. SPSB Leasing" maxLength={80} />
      </Field>
      <FormError state={state} />
      <button type="submit" className={btnPrimary} disabled={pending}>
        {pending ? "Creating…" : cta}
      </button>
    </form>
  );
}

export function AcceptInviteButton({ token, label = "Accept invite" }: { token: string; label?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        className={btnPrimary}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await acceptInvite(token);
            if (r && !r.ok) setError(r.errors?.form ?? "Could not accept invite.");
          })
        }
      >
        {pending ? "Joining…" : label}
      </button>
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function RenameTeamForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(renameTeam, {});
  const toast = useToast();
  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
  }, [state.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end" noValidate>
      <div className="flex-1">
        <Field label="Team name" htmlFor="rename" error={state.errors?.name ?? state.errors?.form}>
          <input id="rename" name="name" defaultValue={name} className={inputCls} maxLength={80} />
        </Field>
      </div>
      <button type="submit" className={btnSecondary} disabled={pending}>
        {pending ? "Saving…" : "Rename"}
      </button>
    </form>
  );
}

function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(`/invite/${token}`);
  useEffect(() => setUrl(inviteUrl(window.location.origin, token)), [token]);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <input readOnly value={url} className={`${inputCls} min-w-0 font-mono text-xs`} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} data-testid="invite-link" />
      <button
        type="button"
        className={`${btnSecondary} shrink-0 px-3 py-1.5`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked — the field is selectable */
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function InviteForm() {
  // The action revalidates the layout itself, so the pending-invites list updates without router.refresh().
  const [state, action, pending] = useActionState<TeamState, FormData>(inviteMember, {});
  return (
    <div className="space-y-3">
      <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end" noValidate>
        <Field label="Colleague's email" htmlFor="invite-email" error={state.errors?.email}>
          <input id="invite-email" name="email" type="email" className={inputCls} placeholder="colleague@selangorproperties.com.my" />
        </Field>
        <Field label="Role" htmlFor="invite-role" error={state.errors?.role}>
          <select id="invite-role" name="role" defaultValue="analyst" className={inputCls}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        <button type="submit" className={btnPrimary} disabled={pending}>
          {pending ? "Creating…" : "Create invite"}
        </button>
      </form>
      <FormError state={state} />
      {state.ok && state.token && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
          <p className="mb-2">
            {state.message} Email isn’t sent automatically — copy this link and send it to them. They sign in (or sign up) with that email
            address and join the team.
          </p>
          <CopyLink token={state.token} />
        </div>
      )}
      <ul className="text-xs text-slate-500">
        {ROLES.map((r) => (
          <li key={r}>
            <b className="text-slate-700">{ROLE_LABEL[r]}</b> — {ROLE_HELP[r]}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InviteRow({ id, token }: { id: string; token: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <CopyLink token={token} />
      </div>
      <button
        type="button"
        className={btnDanger}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await revokeInvite(id);
            toast(r.ok ? "Invite revoked." : r.errors?.form ?? "Could not revoke.", r.ok ? undefined : "error");
            router.refresh();
          })
        }
      >
        {pending ? "Revoking…" : "Revoke"}
      </button>
    </div>
  );
}

export function MemberControls({ userId, role, isSelf }: { userId: string; role: Role; isSelf: boolean }) {
  const [pending, start] = useTransition();
  const [armed, setArmed] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const run = (fn: () => Promise<TeamState>, ok: string) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? ok : r.errors?.form ?? "Something went wrong.", r.ok ? undefined : "error");
      setArmed(false);
      router.refresh();
    });
  return (
    <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
      <label className="sr-only" htmlFor={`role-${userId}`}>
        Role
      </label>
      <select
        id={`role-${userId}`}
        value={role}
        disabled={pending}
        onChange={(e) => run(() => changeRole(userId, e.target.value as Role), "Role updated.")}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
      {!isSelf &&
        (armed ? (
          <>
            <button type="button" className={`${btnDanger} bg-rose-50`} disabled={pending} onClick={() => run(() => removeMember(userId), "Member removed.")}>
              Confirm remove
            </button>
            <button type="button" className="rounded-lg px-2 text-sm text-slate-600 hover:bg-slate-100" onClick={() => setArmed(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" className={btnDanger} onClick={() => setArmed(true)}>
            Remove
          </button>
        ))}
    </div>
  );
}

export function LeaveTeamButton({ teamName }: { teamName: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  if (!armed)
    return (
      <button type="button" className={btnDanger} onClick={() => setArmed(true)}>
        Leave team
      </button>
    );
  return (
    <span className="inline-flex gap-1">
      <button
        type="button"
        className={`${btnDanger} bg-rose-50`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await leaveTeam();
            if (r && !r.ok) toast(r.errors?.form ?? "Could not leave team.", "error");
            setArmed(false);
          })
        }
      >
        {pending ? "Leaving…" : `Leave ${teamName}`}
      </button>
      <button type="button" className="rounded-lg px-2 text-sm text-slate-600 hover:bg-slate-100" onClick={() => setArmed(false)}>
        Cancel
      </button>
    </span>
  );
}
