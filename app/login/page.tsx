import { AuthForm, AuthShell } from "@/components/AuthForm";
import { safeNext } from "@/lib/logic/team";

export const metadata = { title: "Sign in · Tenant GTO" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  return (
    <AuthShell
      title="Sign in"
      subtitle={next.startsWith("/invite/") ? "Sign in (or create an account) to accept your team invite." : "Tenant sales & GTO tracking for your team."}
    >
      <AuthForm mode="login" next={next} initialError={sp.error ? String(sp.error).slice(0, 200) : undefined} />
    </AuthShell>
  );
}
