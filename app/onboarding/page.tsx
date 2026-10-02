import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { AuthShell } from "@/components/AuthForm";
import { AcceptInviteButton, CreateTeamForm } from "@/components/TeamForms";
import { Avatar, ErrorPanel } from "@/components/ui";
import { getWorkspace, myPendingInvites } from "@/lib/data/team";
import { safe } from "@/lib/data/load";
import { ROLE_LABEL } from "@/lib/logic/team";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your workspace · Tenant GTO" };

export default async function Onboarding() {
  const res = await safe(async () => {
    const ws = await getWorkspace();
    if (!ws) redirect("/login");
    return { ws, invites: await myPendingInvites() };
  });
  if (!res.ok) return <ErrorPanel message={res.error} />;
  const { ws, invites } = res.data;

  return (
    <AuthShell
      title={ws.teams.length ? "Join or create a workspace" : "Welcome — set up your workspace"}
      subtitle={<>Signed in as <b>{ws.user.email}</b>. Each team has its own tenants, sales and projections.</>}
    >
      {invites.length > 0 && (
        <section className="mb-6">
          <h2 className="label-caps mb-2 text-ink-2">You’ve been invited</h2>
          <ul className="space-y-3">
            {invites.map((i) => (
              <li key={i.token} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-canvas p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={i.team_name} seed={i.token} size="sm" />
                  <div className="min-w-0">
                    <div className="font-bold text-ink">{i.team_name}</div>
                    <div className="label-caps text-[10px] text-muted">as {ROLE_LABEL[i.role]}</div>
                  </div>
                </div>
                <AcceptInviteButton token={i.token} label="Join" />
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2 className="label-caps mb-2 text-ink-2">{invites.length ? "Or create a new team" : "Create your team"}</h2>
        <p className="mb-3 text-sm text-muted">You’ll be its admin and can invite colleagues as admin, analyst or viewer.</p>
        <CreateTeamForm />
      </section>
      {!invites.length && (
        <p className="mt-6 text-xs text-muted">
          Expecting an invite? Ask your team admin for the invite link — it must be sent to <b>{ws.user.email}</b>.
        </p>
      )}
      <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-sm">
        {ws.teams.length > 0 ? (
          <Link href="/" className="font-medium text-primary hover:underline">
            ← Back to the app
          </Link>
        ) : (
          <span />
        )}
        <form action={signOut}>
          <button type="submit" className="text-ink-2 hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
