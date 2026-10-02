"use client";

import { createContext, useContext, type ReactNode } from "react";
import { canWrite, isAdmin, type TeamRef } from "@/lib/logic/team";

export type ClientWorkspace = {
  email: string;
  teams: TeamRef[];
  active: TeamRef | null;
} | null;

const Ctx = createContext<ClientWorkspace>(null);

export function WorkspaceContext({ value, children }: { value: ClientWorkspace; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): ClientWorkspace {
  return useContext(Ctx);
}

/** True for admins and analysts of the active team. Write buttons render only when this is true. */
export function useCanWrite(): boolean {
  return canWrite(useContext(Ctx)?.active?.role);
}

export function useIsAdmin(): boolean {
  return isAdmin(useContext(Ctx)?.active?.role);
}
