import { MobileTopBar } from "@/components/TopBar";
import { ButtonLink, EmptyState } from "@/components/ui";

export default function TenantNotFound() {
  return (
    <>
      <MobileTopBar />
      <EmptyState title="Tenant not found" body="It may have been deleted." action={<ButtonLink href="/tenants">Back to tenants</ButtonLink>} />
    </>
  );
}
