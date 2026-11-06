"use client";

import { usePathname } from "next/navigation";

// Team se abre DENTRO de la app desde donde lo abriste (Finances, Inventory o Jobs):
// /dashboard/team · /dashboard/inventory/team · /dashboard/jobs/team
export function useTeamBase() {
  const pathname = usePathname() || "";
  const m = /^(.*?\/team)(?:\/|$)/.exec(pathname);
  return m ? m[1] : "/dashboard/team";
}
