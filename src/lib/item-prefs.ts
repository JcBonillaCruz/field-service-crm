import { ItemType } from "@/lib/catalog";

// Preferencias de Items (se guardan por organización en este navegador)
export type ItemPrefs = { defaultType: ItemType; defaultUnit: string; defaultAccount: string; requireSku: boolean; warnDuplicates: boolean };
export const DEFAULT_PREFS: ItemPrefs = { defaultType: "service", defaultUnit: "each", defaultAccount: "Service Income", requireSku: false, warnDuplicates: true };
const key = (companyId: string) => `bp-item-prefs:${companyId}`;

export function readItemPrefs(companyId: string): ItemPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(key(companyId)) || "{}") }; } catch { return DEFAULT_PREFS; }
}
export function saveItemPrefs(companyId: string, p: ItemPrefs) {
  try { localStorage.setItem(key(companyId), JSON.stringify(p)); } catch { /* sin espacio */ }
}
