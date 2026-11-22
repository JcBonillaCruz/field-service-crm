"use client";

import { useLocale, useTranslations } from "next-intl";
import { intlTag } from "@/i18n/config";
import { Role } from "@/lib/types";
import { Member, Presence, ROLE_INFO, teamError } from "@/lib/team";

// =====================================================================
// Paso 6.2c — Equipo en el idioma de quien lo ve (roles, conexión, errores y fechas)
// =====================================================================
const ERR: Record<string, string> = {
  "The company needs at least one active owner.": "lastOwner",
  "You can't do that to yourself.": "self",
  "You don't have permission to do this.": "noAccess",
  "This email already has a pending invitation. Resend it from Invitations.": "pending",
  "This invitation expired. Ask for a new one.": "expired",
  "This invitation was cancelled.": "revoked",
  "This invitation was already used by another account.": "used",
  "This invitation doesn't exist.": "notFound",
  "Run the SQL for Paso 4.3 (Team) in Supabase first.": "sql",
  "Something went wrong. Try again.": "generic",
};

export function useTeamTx() {
  const t = useTranslations("teamLib");
  const tag = intlTag(useLocale());
  const ago = (ms: number) => {
    const m = Math.round(ms / 60000);
    if (m < 1) return t("justNow");
    if (m < 60) return t("minAgo", { n: m });
    const h = Math.round(m / 60);
    if (h < 24) return t("hAgo", { n: h });
    return t("dAgo", { n: Math.round(h / 24) });
  };
  function presence(m: Pick<Member, "last_seen_at" | "last_active_at" | "last_sign_in_at">, now = Date.now()): Presence {
    const seen = m.last_seen_at ? now - new Date(m.last_seen_at).getTime() : Infinity;
    const active = m.last_active_at ? now - new Date(m.last_active_at).getTime() : Infinity;
    if (seen < 3 * 60000 && active < 3 * 60000) return { tone: "on", label: t("activeNow"), detail: t("usingNow") };
    if (seen < 3 * 60000) return { tone: "idle", label: t("idle", { x: ago(active) }), detail: active === Infinity ? t("openNotActive") : t("openLast", { x: ago(active) }) };
    if (seen !== Infinity) return { tone: "off", label: t("offline", { x: ago(seen) }), detail: t("lastSeen", { x: new Date(m.last_seen_at as string).toLocaleString(tag, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) }) };
    return { tone: "off", label: m.last_sign_in_at ? t("offline", { x: ago(now - new Date(m.last_sign_in_at).getTime()) }) : t("never"), detail: m.last_sign_in_at ? t("beforeTracking") : t("notOpened") };
  }
  return {
    t, tag, presence,
    role: (r: Role) => ({ ...ROLE_INFO[r], label: t(`role.${r}.label`), text: t(`role.${r}.text`), can: [0, 1, 2].map((i) => t(`role.${r}.can${i}` as never)) }),
    err: (e: Parameters<typeof teamError>[0]) => { const m = teamError(e); return ERR[m] ? t(`err.${ERR[m]}` as never) : m; },
    date: (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(tag, { month: "short", day: "numeric", year: "numeric" }) : "—"),
  };
}
