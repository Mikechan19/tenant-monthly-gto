import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { AuthShell } from "@/components/AuthForm";
import { AcceptInviteButton } from "@/components/TeamForms";
import { ErrorPanel } from "@/components/ui";
import { getWorkspace, invitePreview } from "@/lib/data/team";
import { safe } from "@/lib/data/load";
import { ROLE_HELP, ROLE_LABEL } from "@/lib/logic/team";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team invite · Tenant GTO" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await safe(async () => {
    const ws = await getWorkspace();
    if (!ws) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
    const invite = /^[0-9a-f]{16,128}$/i.test(token) ? await invitePreview(token) : null;
    return { ws, invite };
  });
  if (!res.ok) return <ErrorPanel message={res.error} />;
  const { ws, invite } = res.data;
  const home = ws.teams.length ? "/" : "/onboarding";

  if (!invite)
    return (
      <AuthShell title="Invite not found" subtitle="This link is invalid or the invite was revoked. Ask your team admin for a new one.">
        <Link href={home} className="text-sm font-medium text-primary hover:underline">Continue →</Link>
      </AuthShell>
    );

  if (invite.accepted)
    return (
      <AuthShell title="Invite already used" subtitle={`This invite to ${invite.team_name} has already been accepted.`}>
        <Link href={home} className="text-sm font-medium text-primary hover:underline">Continue →</Link>
      </AuthShell>
    );

  const mismatch = invite.email.toLowerCase() !== ws.user.email.toLowerCase();
  return (
    <AuthShell
      title={`Join ${invite.team_name}`}
      subtitle={<>You’ve been invited as <b>{ROLE_LABEL[invite.role]}</b> — {ROLE_HELP[invite.role].toLowerCase()}.</>}
    >
      {mismatch ? (
        <div className="space-y-4 text-sm">
          <p className="rounded-xl bg-warn-bg px-3 py-2 text-amber-900" role="alert">
            This invite was sent to <b>{invite.email}</b>, but you’re signed in as <b>{ws.user.email}</b>. Sign out and sign in (or sign
            up) with the invited address.
          </p>
          <form action={signOut}>
            <button type="submit" className="font-medium text-primary hover:underline">Sign out</button>
          </form>
        </div>
      ) : (
        <AcceptInviteButton token={token} label={`Join ${invite.team_name}`} />
      )}
    </AuthShell>
  );
}
