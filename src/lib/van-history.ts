import type { SupabaseClient } from "@supabase/supabase-js";
import { buildParts, type RawReport } from "@/lib/job-reports";

// =====================================================================
// Paso 6.13 · Ficha por van (o almacén): lo que hay, lo usado, lo recibido, los conteos y lo no escaneado
//   · El mismo cálculo sirve para la pantalla y para Exportar
//   · El técnico (solo su van) nunca recibe costos: llegan en null desde aquí
// =====================================================================
export type VanTab = "stock" | "used" | "received" | "counts" | "unscanned";
export const VAN_TABS: VanTab[] = ["stock", "used", "received", "counts", "unscanned"];
export type HistPeriod = "7" | "30" | "90" | "month" | "last_month" | "year";
export const HIST_PERIODS: HistPeriod[] = ["7", "30", "90", "month", "last_month", "year"];

export function histRange(p: HistPeriod, today = new Date()): { from: Date; to: Date } {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tomorrow = new Date(start.getTime() + 86400000);
  if (p === "month") return { from: new Date(start.getFullYear(), start.getMonth(), 1), to: tomorrow };
  if (p === "last_month") return { from: new Date(start.getFullYear(), start.getMonth() - 1, 1), to: new Date(start.getFullYear(), start.getMonth(), 1) };
  if (p === "year") return { from: new Date(start.getFullYear(), 0, 1), to: tomorrow };
  return { from: new Date(tomorrow.getTime() - Number(p) * 86400000), to: tomorrow };
}
export const asPeriod = (v: string | undefined): HistPeriod => (HIST_PERIODS.includes(v as HistPeriod) ? (v as HistPeriod) : "30");

export type UsedRow = {
  id: string; item_id: string; name: string; sku: string | null; unit: string | null; qty: number; when: string; kind: string;
  job_id: string | null; job_number: string | null; customer: string | null; address: string | null; reason: string | null; by: string | null; cost: number | null;
};
export type RecvRow = {
  id: string; item_id: string; name: string; sku: string | null; unit: string | null; qty: number; when: string; kind: string;
  inbound: boolean; other: string | null; by: string | null; note: string | null; cost: number | null;
};
export type CountRow = { batch: string; when: string; by: string | null; items: number; diff: number; short: number; shortValue: number | null; reversed: boolean };
export type UnscannedRow = {
  key: string; job_id: string; number: string; customer: string; when: string | null; name: string; sku: string | null; unit: string | null;
  billed: number; scanned: number; missing: number; value: number | null;
};
export type VanHistory = { used: UsedRow[]; received: RecvRow[]; counts: CountRow[]; unscanned: UnscannedRow[] | null; consumables: string[] };

type Mv = {
  id: string; item_id: string; kind: string; qty: number; from_location: string | null; to_location: string | null; unit_cost: number | null;
  reason: string | null; note: string | null; actor_name: string | null; expected_qty: number | null; counted_qty: number | null; batch_id: string | null;
  job_id?: string | null; address_id?: string | null; created_at: string; items: { name: string; sku: string | null; unit: string | null; cost_price: number | null } | null;
};
const BASE = "id, item_id, kind, qty, from_location, to_location, unit_cost, reason, note, actor_name, expected_qty, counted_qty, batch_id, created_at, items ( name, sku, unit, cost_price )";
const r2 = (v: number) => Math.round(v * 100) / 100;

export async function loadVanHistory(
  supabase: SupabaseClient, companyId: string,
  loc: { id: string; kind: "warehouse" | "van"; assigned_user_id: string | null },
  range: { from: Date; to: Date }, showCost: boolean, locName: (id: string | null) => string,
): Promise<VanHistory> {
  const q = (sel: string) => supabase.from("inventory_movements").select(sel).eq("company_id", companyId)
    .or(`from_location.eq.${loc.id},to_location.eq.${loc.id}`)
    .gte("created_at", range.from.toISOString()).lt("created_at", range.to.toISOString())
    .order("created_at", { ascending: false }).limit(5000);
  // job_id / address_id llegaron con Jobs (5.1); si faltaran, se lee sin ellos
  let res = await q(`${BASE}, job_id, address_id`);
  if (res.error) res = await q(BASE);
  const moves = ((res.data ?? []) as unknown as Mv[]).map((m) => ({ ...m, qty: Number(m.qty) }));
  const costOf = (m: Mv) => (showCost ? r2(Math.abs(m.qty) * Number(m.unit_cost ?? m.items?.cost_price ?? 0)) : null);

  // ¿Dónde se usó? trabajo → número, cliente y la dirección del Job Site
  const jobIds = Array.from(new Set(moves.filter((m) => m.job_id).map((m) => m.job_id as string)));
  const jobs = new Map<string, { number: string; customer_id: string | null; address_id: string | null }>();
  const customers = new Map<string, string>();
  const addrs = new Map<string, string>();
  if (jobIds.length) {
    const { data } = await supabase.from("jobs").select("id, number, customer_id, address_id").in("id", jobIds.slice(0, 900));
    (data ?? []).forEach((j) => jobs.set(j.id as string, { number: String(j.number ?? ""), customer_id: (j.customer_id as string) ?? null, address_id: (j.address_id as string) ?? null }));
    const custIds = Array.from(new Set(Array.from(jobs.values()).map((j) => j.customer_id).filter(Boolean) as string[]));
    const addrIds = Array.from(new Set([...Array.from(jobs.values()).map((j) => j.address_id), ...moves.map((m) => m.address_id)].filter(Boolean) as string[]));
    const [cs, as] = await Promise.all([
      custIds.length ? supabase.from("customers").select("id, display_name").in("id", custIds.slice(0, 900)) : Promise.resolve({ data: [] }),
      addrIds.length ? supabase.from("customer_addresses").select("id, street, city, state").in("id", addrIds.slice(0, 900)) : Promise.resolve({ data: [] }),
    ]);
    ((cs.data ?? []) as { id: string; display_name: string | null }[]).forEach((c) => customers.set(c.id, c.display_name ?? ""));
    ((as.data ?? []) as { id: string; street: string | null; city: string | null; state: string | null }[])
      .forEach((a) => addrs.set(a.id, [a.street, [a.city, a.state].filter(Boolean).join(", ")].filter(Boolean).join(", ")));
  }

  const used: UsedRow[] = [];
  const received: RecvRow[] = [];
  const countMap = new Map<string, Mv[]>();
  for (const m of moves) {
    const it = m.items;
    if (!it) continue;
    if (m.kind === "count") { const k = m.batch_id ?? m.id; countMap.set(k, [...(countMap.get(k) ?? []), m]); continue; }
    const out = m.from_location === loc.id && m.to_location !== loc.id;
    if (m.kind === "use" || (m.kind === "adjust" && out)) {
      const j = m.job_id ? jobs.get(m.job_id) : undefined;
      const addrId = m.address_id ?? j?.address_id ?? null;
      used.push({
        id: m.id, item_id: m.item_id, name: it.name, sku: it.sku, unit: it.unit, qty: Math.abs(m.qty), when: m.created_at, kind: m.kind,
        job_id: m.job_id ?? null, job_number: j?.number ?? null, customer: j?.customer_id ? customers.get(j.customer_id) ?? null : null,
        address: addrId ? addrs.get(addrId) ?? null : null, reason: m.reason, by: m.actor_name, cost: costOf(m),
      });
    } else {
      const inbound = m.to_location === loc.id;
      received.push({
        id: m.id, item_id: m.item_id, name: it.name, sku: it.sku, unit: it.unit, qty: Math.abs(m.qty), when: m.created_at, kind: m.kind, inbound,
        other: m.kind === "receive" ? null : m.kind === "adjust" ? m.reason : locName(inbound ? m.from_location : m.to_location),
        by: m.actor_name, note: m.note, cost: costOf(m),
      });
    }
  }

  // Conteos: uno por lote, con lo que faltó (a costo)
  let reversed = new Set<string>();
  if (countMap.size) {
    const { data, error } = await supabase.from("inventory_count_reversals").select("batch_id").eq("company_id", companyId).in("batch_id", Array.from(countMap.keys()).slice(0, 900));
    if (!error) reversed = new Set((data ?? []).map((r) => r.batch_id as string));
  }
  const counts: CountRow[] = Array.from(countMap.entries()).map(([batch, g]) => {
    let diff = 0, short = 0, val = 0;
    for (const m of g) {
      const d = Number(m.counted_qty ?? 0) - Number(m.expected_qty ?? 0);
      diff += d;
      if (d < 0) { short += -d; val += -d * Number(m.unit_cost ?? m.items?.cost_price ?? 0); }
    }
    return { batch, when: g[0].created_at, by: g[0].actor_name, items: g.length, diff, short, shortValue: showCost ? r2(val) : null, reversed: reversed.has(batch) };
  });

  // Consumibles (6.14): no se cuentan como "no escaneados"
  const cons = await supabase.from("items").select("id").eq("company_id", companyId).eq("is_consumable", true).limit(5000);
  const consumables = cons.error ? [] : (cons.data ?? []).map((c) => c.id as string);

  // No escaneado: lo que se cobró en los trabajos del técnico de esta van y nunca salió escaneado
  let unscanned: UnscannedRow[] | null = null;
  if (loc.kind === "van" && loc.assigned_user_id) {
    const { data, error } = await supabase.rpc("job_reports", { p_company: companyId, p_from: range.from.toISOString(), p_to: range.to.toISOString() });
    if (!error && data) {
      const raw = data as RawReport;
      const row = buildParts({ ...raw, parts: (raw.parts ?? []).filter((p) => !p.item_id || !consumables.includes(p.item_id)) }, []).rows.find((r) => r.user_id === loc.assigned_user_id);
      unscanned = (row?.lines ?? []).map((l) => ({
        key: l.key, job_id: l.job_id, number: l.number, customer: l.customer, when: l.when, name: l.name, sku: l.sku, unit: l.unit,
        billed: l.billed, scanned: l.scanned, missing: l.missing, value: showCost ? l.value : null,
      }));
    }
  }
  return { used, received, counts: counts.sort((a, b) => b.when.localeCompare(a.when)), unscanned, consumables };
}
