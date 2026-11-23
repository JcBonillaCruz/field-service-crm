import type { LeadSource } from "@/lib/lead-sources";

// =====================================================================
// Marketing ROI (Paso 6.16-M): cuánto se gastó en cada fuente de clientes (Lead source)
// y cuánto dinero regresó de los clientes que llegaron por esa fuente.
//   · Gastado: gastos de Expenses con "¿Para qué fuente?" (categoría Marketing & Ads).
//     Los gastos de Marketing sin fuente salen en su propio renglón ("Sin fuente").
//   · Cobrado: pagos de facturas (sin la parte del impuesto) + Money In ligado al cliente,
//     de clientes que tienen esa fuente. Los clientes sin fuente salen aparte.
//   · Clientes nuevos: clientes creados en el periodo con esa fuente.
// Aquí solo se hacen cuentas (sirve en el servidor y en el navegador).
// =====================================================================
export const MARKETING_CATEGORY = "Marketing & Ads";
export const NO_SOURCE = "none";

export type MkSpend = { day: string; amount: number; source: string | null };
export type MkPay = { day: string; amount: number; source: string | null };
export type MkCustomer = { day: string; source: string | null };
export type MkRaw = {
  from: string; to: string; // lo que se cargó
  sources: LeadSource[]; spend: MkSpend[]; pays: MkPay[]; customers: MkCustomer[];
  needsSql: boolean;        // falta el SQL 6.16-M (no hay columna lead_source_id en Expenses)
  untaggedCustomers: number; // clientes (de todos los tiempos) sin fuente
};
export type MkRow = {
  key: string; source: LeadSource | null; spent: number; collected: number; newCustomers: number;
  roi: number | null;        // dólares que regresan por cada $1 gastado
  perCustomer: number | null; // costo de cada cliente nuevo
};
export type MkTotals = {
  spent: number; collected: number; newCustomers: number;
  newPaid: number;            // clientes nuevos de esas fuentes
  collectedPaid: number;      // cobrado de las fuentes en las que SÍ se gastó (con esto se mide el retorno)
  roi: number | null; perCustomer: number | null;
};
export type MkResult = { rows: MkRow[]; totals: MkTotals; best: MkRow | null; losers: MkRow[]; empty: boolean };

const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const inside = (d: string, a: string, b: string) => d >= a && d <= b;

export function buildRoi(raw: MkRaw, from: string, to: string): MkResult {
  const byId = new Map(raw.sources.map((s) => [s.id, s]));
  const rows = new Map<string, MkRow>();
  const row = (id: string | null) => {
    const key = id && byId.has(id) ? id : NO_SOURCE;
    let r = rows.get(key);
    if (!r) { r = { key, source: byId.get(key) ?? null, spent: 0, collected: 0, newCustomers: 0, roi: null, perCustomer: null }; rows.set(key, r); }
    return r;
  };
  for (const s of raw.spend) if (inside(s.day, from, to)) row(s.source).spent += Number(s.amount) || 0;
  for (const p of raw.pays) if (inside(p.day, from, to)) row(p.source).collected += Number(p.amount) || 0;
  for (const c of raw.customers) if (inside(c.day, from, to)) row(c.source).newCustomers += 1;
  const list = Array.from(rows.values()).map((r) => ({
    ...r, spent: r2(r.spent), collected: r2(r.collected),
    roi: r.spent > 0 ? Math.round((r.collected / r.spent) * 100) / 100 : null,
    perCustomer: r.spent > 0 && r.newCustomers > 0 ? r2(r.spent / r.newCustomers) : null,
  })).filter((r) => r.spent > 0 || r.collected > 0 || r.newCustomers > 0);
  // Primero las fuentes con gasto (las que hay que juzgar), luego lo que más dejó; "Sin fuente" al final
  list.sort((a, b) => (a.key === NO_SOURCE ? 1 : 0) - (b.key === NO_SOURCE ? 1 : 0) || (b.spent > 0 ? 1 : 0) - (a.spent > 0 ? 1 : 0) || b.collected - a.collected || b.spent - a.spent);
  const spent = r2(list.reduce((a, r) => a + r.spent, 0));
  // El retorno se mide solo con las fuentes en las que se gastó (lo gastado sin fuente y lo que llegó gratis van aparte)
  const judged = list.filter((r) => r.key !== NO_SOURCE && r.spent > 0);
  const collectedPaid = r2(judged.reduce((a, r) => a + r.collected, 0));
  const spentTagged = r2(judged.reduce((a, r) => a + r.spent, 0));
  const newTagged = judged.reduce((a, r) => a + r.newCustomers, 0);
  const best = [...judged].sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0))[0] ?? null;
  const losers = judged.filter((r) => (r.roi ?? 0) < 1).sort((a, b) => (a.roi ?? 0) - (b.roi ?? 0));
  return {
    rows: list,
    totals: {
      spent, collected: r2(list.reduce((a, r) => a + r.collected, 0)), newCustomers: list.reduce((a, r) => a + r.newCustomers, 0),
      collectedPaid, newPaid: newTagged,
      roi: spentTagged > 0 ? Math.round((collectedPaid / spentTagged) * 100) / 100 : null,
      perCustomer: spentTagged > 0 && newTagged > 0 ? r2(spentTagged / newTagged) : null,
    },
    best: best && (best.roi ?? 0) >= 1 ? best : null, losers, empty: list.length === 0,
  };
}

// Color de cada fuente (fijo por puesto en la lista, para que no se repita)
export const MK_COLORS = ["#0f766e", "#e8713a", "#2563eb", "#7c3aed", "#db2777", "#ca8a04", "#0891b2", "#65a30d", "#be123c", "#475569"];

// Tono del retorno: rojo = no regresó ni lo gastado, ámbar = apenas, verde = buen retorno
export const roiTone = (roi: number | null): "neg" | "warn" | "pos" | "muted" => (roi == null ? "muted" : roi < 1 ? "neg" : roi < 2 ? "warn" : "pos");
