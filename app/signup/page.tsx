import { AuthForm, AuthShell } from "@/components/AuthForm";
import { safeNext } from "@/lib/logic/team";

export const metadata = { title: "Create account · Tenant GTO" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  return (
    <AuthShell
      title="Create your account"
      subtitle={
        next.startsWith("/invite/")
          ? "Use the email address your invite was sent to."
          : "You'll create a team workspace next, or join one you've been invited to."
      }
    >
      <AuthForm mode="signup" next={next} />
    </AuthShell>
  );
}
