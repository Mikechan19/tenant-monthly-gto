import { CreateTeamForm, InviteForm, InviteRow, LeaveTeamButton, MemberControls, RenameTeamForm } from "@/components/TeamForms";
import { Avatar, Badge, Card, ErrorPanel, PageHeader } from "@/components/ui";
import { safe } from "@/lib/data/load";
import { getWorkspace, listMembers, listOpenInvites, requireTeam } from "@/lib/data/team";
import { isAdmin, ROLE_HELP, ROLE_LABEL } from "@/lib/logic/team";
import { dateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const res = await safe(async () => {
    const team = await requireTeam();
    const ws = (await getWorkspace())!;
    const admin = isAdmin(team.role);
    const [members, invites] = await Promise.all([listMembers(team.id), admin ? listOpenInvites(team.id) : Promise.resolve([])]);
    return { team, ws, admin, members, invites };
  });
  if (!res.ok)
    return (
      <>
        <PageHeader title="Team" />
        <ErrorPanel message={res.error} />
      </>
    );
  const { team, ws, admin, members, invites } = res.data;
  const adminCount = members.filter((m) => m.role === "admin").length;

  return (
    <>
      <PageHeader
        title={team.name}
        subtitle={
          <>
            Team workspace · you are <b>{ROLE_LABEL[team.role]}</b> ({ROLE_HELP[team.role].toLowerCase()})
          </>
        }
      />

      {admin && (
        <Card className="mb-6" eyebrow="Admin" title="Invite a colleague">
          <InviteForm />
        </Card>
      )}

      <Card className="mb-6" eyebrow="Team roster" title={`Members (${members.length})`}>
        <div className="overflow-x-auto">
          <table className="data-grid w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left label-caps text-[11px] text-muted">
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Joined</th>
                <th className="py-2 text-right">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-row">
              {members.map((m) => {
                const self = m.user_id === ws.user.id;
                return (
                  <tr key={m.user_id} data-testid="member-row">
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={m.email} seed={m.user_id} size="sm" />
                        <span className="min-w-0">
                          <span className="font-semibold text-ink [overflow-wrap:anywhere]">{m.email}</span> {self && <Badge tone="teal">you</Badge>}
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted">{dateTime(m.created_at)}</td>
                    <td className="py-2.5 text-right">
                      {admin && !(self && m.role === "admin" && adminCount === 1) ? (
                        <MemberControls userId={m.user_id} role={m.role} isSelf={self} />
                      ) : (
                        <Badge tone={m.role === "admin" ? "emerald" : "slate"}>{ROLE_LABEL[m.role]}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {admin && adminCount === 1 && (
          <p className="mt-3 text-xs text-muted">You’re the only admin. Make someone else admin before changing your own role or leaving.</p>
        )}
      </Card>

      {admin && (
        <Card className="mb-6" title={`Pending invites (${invites.length})`}>
          {invites.length === 0 ? (
            <p className="text-sm text-muted">No open invites.</p>
          ) : (
            <ul className="divide-y divide-row">
              {invites.map((i) => (
                <li key={i.id} className="space-y-2 py-3" data-testid="invite-row">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="min-w-0 font-medium text-ink [overflow-wrap:anywhere]">{i.email}</span>
                    <Badge>{ROLE_LABEL[i.role]}</Badge>
                    <span className="text-xs text-muted">created {dateTime(i.created_at)}</span>
                  </div>
                  <InviteRow id={i.id} token={i.token} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {admin && (
          <Card title="Team name">
            <RenameTeamForm name={team.name} />
          </Card>
        )}
        <Card title="Another workspace">
          <p className="mb-3 text-sm text-muted">Create a separate team (its data is walled off from this one). Switch teams from the workspace menu (sidebar, or “More” on phones).</p>
          <CreateTeamForm cta="Create team" />
        </Card>
        {!(admin && adminCount === 1) && (
          <Card title="Leave this team">
            <p className="mb-3 text-sm text-muted">You’ll lose access to {team.name}’s data until an admin invites you again.</p>
            <LeaveTeamButton teamName={team.name} />
          </Card>
        )}
      </div>
    </>
  );
}
