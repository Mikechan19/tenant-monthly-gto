import type { ReactNode } from "react";
import { getWorkspace } from "@/lib/data/team";
import { WorkspaceContext, type ClientWorkspace } from "./Workspace";

/** Loads the signed-in user's teams once per request and exposes them (no secrets) to client components. */
export async function WorkspaceProvider({ children }: { children: ReactNode }) {
  let value: ClientWorkspace = null;
  try {
    const ws = await getWorkspace();
    if (ws) value = { email: ws.user.email, teams: ws.teams, active: ws.active };
  } catch {
    value = null; // not configured / DB unreachable — pages render their own error state
  }
  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}
