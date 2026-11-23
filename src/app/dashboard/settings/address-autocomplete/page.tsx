import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import NoAccess from "@/components/customers/NoAccess";
import { placesKey } from "@/lib/places-server";
import PlacesSettingsForm, { type UsageDay } from "@/components/settings/PlacesSettingsForm";

export const dynamic = "force-dynamic";

// Paso 6.8: Settings → Address autocomplete (Google). Dueño y manager.
export default async function AddressAutocompletePage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (current.role !== "owner" && current.role !== "manager") return <NoAccess />;
  const since = new Date(Date.now() - 31 * 864e5).toISOString().slice(0, 10);
  const [s, u, today] = await Promise.all([
    supabase.from("places_settings").select("enabled, daily_limit, alert_pct").eq("company_id", current.id).maybeSingle(),
    supabase.from("places_usage").select("day, searches, picks").eq("company_id", current.id).gte("day", since).order("day"),
    supabase.rpc("places_today", { p_company: current.id }),
  ]);
  const needsSql = Boolean(s.error || u.error);
  const row = (s.data ?? {}) as { enabled?: boolean; daily_limit?: number; alert_pct?: number };
  return (
    <PlacesSettingsForm companyId={current.id} needsSql={needsSql} hasKey={Boolean(placesKey())}
      systemCap={Math.max(0, Math.floor(Number(process.env.GOOGLE_PLACES_DAILY_CAP) || 0))}
      initial={{ enabled: row.enabled ?? true, dailyLimit: row.daily_limit ?? 100, alertPct: row.alert_pct ?? 80 }}
      usage={(u.data ?? []) as UsageDay[]} today={typeof today.data === "string" ? today.data : new Date().toISOString().slice(0, 10)} />
  );
}
