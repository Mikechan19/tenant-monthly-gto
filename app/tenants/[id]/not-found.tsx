import { ButtonLink, EmptyState } from "@/components/ui";

export default function TenantNotFound() {
  return <EmptyState title="Tenant not found" body="It may have been deleted." action={<ButtonLink href="/tenants">Back to tenants</ButtonLink>} />;
}
