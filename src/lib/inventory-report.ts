import { InvItem, InvLocation, InvMember, InvStock, KitRow, qtyFmt } from "@/lib/inventory";
import { locationStats, lowRows, shoppingList } from "@/lib/inventory-insights";
import type { CountPdfCol, CountPdfInput, CountPdfRow } from "@/lib/count-pdf";

// =====================================================================
// Paso 6.12f · Reportes que arma el dueño (Inventory → Settings → Reportes o Reports → Crear reporte)
// Cada reporte guarda qué secciones lleva, de qué ubicaciones, el periodo y la hoja. Siempre sale en PDF.
// =====================================================================
export const REPORT_SECTIONS = ["summary", "stock", "low", "buy", "out", "vans", "usage", "restocks", "counts", "missing"] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];
export type ReportPreset = { id: string; name: string; sections: ReportSection[]; locations: string[]; days: number; orientation: "portrait" | "landscape" };
export const NEEDS_MOVES: ReportSection[] = ["usage", "restocks", "counts", "missing"];

export const presetsOf = (raw: unknown): ReportPreset[] => (Array.isArray(raw) ? raw : []).map((r) => r as Partial<ReportPreset>)
  .filter((r) => r && typeof r.id === "string" && typeof r.name === "string")
  .map((r) => ({
    id: r.id!, name: r.name!, sections: (r.sections ?? []).filter((x): x is ReportSection => (REPORT_SECTIONS as readonly string[]).includes(x)),
    locations: Array.isArray(r.locations) ? r.locations : [], days: [7, 30, 90, 365].includes(Number(r.days)) ? Number(r.days) : 30,
    orientation: r.orientation === "landscape" ? "landscape" : "portrait",
  }));

export type ReportMove = {
  item_id: string; kind: string; qty: number; from_location: string | null; to_location: string | null; unit_cost: number | null; reason: string | null;
  actor_name: string | null; responsible_name: string | null; batch_id: string | null; created_at: string; items: { name: string; sku: string | null } | null;
};
type T = (key: string, values?: Record<string, string | number>) => string;

export function buildPresetInput(p: ReportPreset, data: {
  items: InvItem[]; stock: InvStock[]; locations: InvLocation[]; members: InvMember[]; kit: KitRow[]; moves: ReportMove[]; reversed: Set<string>;
}, t: T, fmt: { money: (n: number) => string; day: (iso: string) => string }, company: string): CountPdfInput {
  const locs = p.locations.length ? data.locations.filter((l) => p.locations.includes(l.id)) : data.locations;
  const ids = new Set(locs.map((l) => l.id));
  const stock = data.stock.filter((s) => ids.has(s.location_id));
  const item = new Map(data.items.map((i) => [i.id, i]));
  const since = new Date(Date.now() - p.days * 86400000).toISOString();
  const moves = data.moves.filter((m) => m.created_at >= since && (ids.has(m.from_location ?? "") || ids.has(m.to_location ?? "")));
  const usd = fmt.money;
  const C = (label: string, w: number, align?: "left" | "right" | "center"): CountPdfCol => ({ label, w, align });
  const sections: NonNullable<CountPdfInput["sections"]> = [];
  const stats = locationStats(data.items, stock, locs, data.kit, moves);
  const low = lowRows(data.items, stock, locs, data.kit);
  let summary: CountPdfInput["summary"];

  for (const s of p.sections) {
    if (s === "summary") {
      const value = locs.reduce((a, l) => a + (stats[l.id]?.value ?? 0), 0);
      const units = locs.reduce((a, l) => a + (stats[l.id]?.units ?? 0), 0);
      summary = [[t("sValue"), usd(value), null], [t("sUnits"), qtyFmt(units), null], [t("sLow"), String(low.filter((r) => !r.out).length), low.some((r) => !r.out) ? "neg" : null], [t("sOut"), String(low.filter((r) => r.out).length), low.some((r) => r.out) ? "neg" : null]];
    }
    if (s === "stock") {
      const many = locs.length > 4;
      const rows: CountPdfRow[] = data.items.filter((i) => stock.some((x) => x.item_id === i.id && (x.qty !== 0 || x.min_qty > 0))).map((i) => {
        const q = (l: string) => stock.find((x) => x.item_id === i.id && x.location_id === l)?.qty ?? 0;
        const total = locs.reduce((a, l) => a + q(l.id), 0);
        return { cells: [i.name, i.sku ?? "", ...(many ? [] : locs.map((l) => qtyFmt(q(l.id)))), qtyFmt(total), usd(Math.max(0, total) * i.cost_price)], ...(total <= 0 ? { alert: "red" as const } : {}) };
      });
      sections.push({ heading: t("hStock"), empty: t("none"), rows, columns: [C(t("cProduct"), 22), C("SKU", 11), ...(many ? [] : locs.map((l) => C(l.name, 9, "right"))), C(t("cTotal"), 7, "right"), C(t("cValue"), 9, "right")] });
    }
    if (s === "low") sections.push({ heading: t("hLow"), empty: t("none"), columns: [C(t("cProduct"), 24), C(t("cWhere"), 16), C(t("cHave"), 7, "right"), C(t("cMin"), 7, "right")],
      rows: low.filter((r) => !r.out).map((r) => ({ cells: [r.item.name, r.loc.name, qtyFmt(r.qty), qtyFmt(r.min)], tone: [null, null, "neg", null], alert: "amber" as const })) });
    if (s === "out") sections.push({ heading: t("hOut"), empty: t("none"), columns: [C(t("cProduct"), 26), C(t("cWhere"), 18), C(t("cMin"), 7, "right"), C(t("cUnitCost"), 9, "right")],
      rows: low.filter((r) => r.out).map((r) => ({ cells: [r.item.name, r.loc.name, r.min ? qtyFmt(r.min) : "-", usd(r.item.cost_price)], tone: [null, null, null, null], alert: "red" as const })) });
    if (s === "buy") {
      const buy = shoppingList(data.items, stock, locs, data.kit);
      const rows: CountPdfRow[] = buy.map((r) => ({ cells: [r.item.name, r.item.sku ?? "", qtyFmt(r.whQty), qtyFmt(r.vanQty), qtyFmt(r.need), usd(r.cost)] }));
      if (rows.length) rows.push({ cells: [t("cTotal"), "", "", "", "", usd(buy.reduce((a, r) => a + r.cost, 0))], total: true });
      sections.push({ heading: t("hBuy"), empty: t("none"), rows, columns: [C(t("cProduct"), 22), C("SKU", 11), C(t("cWh"), 8, "right"), C(t("cVans"), 8, "right"), C(t("cBuy"), 8, "right"), C(t("cCost"), 10, "right")] });
    }
    if (s === "vans") sections.push({ heading: t("hVans"), empty: t("none"), columns: [C(t("cVan"), 18), C(t("cTech"), 16), C(t("cUnits"), 7, "right"), C(t("cValue"), 9, "right"), C(t("cLow"), 7, "right"), C(t("cKit"), 7, "right")],
      rows: locs.filter((l) => l.kind === "van").map((l) => { const x = stats[l.id]; return { cells: [l.name, data.members.find((m) => m.user_id === l.assigned_user_id)?.full_name ?? "-", qtyFmt(x.units), usd(x.value), String(x.low), x.kitTotal ? `${Math.round((x.kitOk / x.kitTotal) * 100)}%` : "-"], ...(x.low > 0 ? { alert: "amber" as const, tone: [null, null, null, null, "neg" as const, null] } : {}) }; }) });
    const agg = (list: ReportMove[], key: (m: ReportMove) => string) => {
      const m = new Map<string, { units: number; value: number }>();
      list.forEach((x) => { const k = key(x); const a = m.get(k) ?? { units: 0, value: 0 }; a.units += Math.abs(x.qty); a.value += Math.abs(x.qty) * Number(x.unit_cost ?? item.get(x.item_id)?.cost_price ?? 0); m.set(k, a); });
      return Array.from(m.entries()).sort((a, b) => b[1].value - a[1].value).map(([k, v]) => ({ cells: [k, qtyFmt(v.units), usd(v.value)] }));
    };
    const nameOf = (id: string | null) => data.locations.find((l) => l.id === id)?.name ?? "-";
    if (s === "usage") sections.push({ heading: t("hUsage", { n: p.days }), empty: t("none"), columns: [C(t("cTech"), 26), C(t("cUnits"), 8, "right"), C(t("cValue"), 10, "right")],
      rows: agg(moves.filter((m) => m.kind === "use"), (m) => m.responsible_name || m.actor_name || "-") });
    if (s === "restocks") sections.push({ heading: t("hRestocks", { n: p.days }), empty: t("none"), columns: [C(t("cVan"), 26), C(t("cUnits"), 8, "right"), C(t("cValue"), 10, "right")],
      rows: agg(moves.filter((m) => m.kind === "transfer" && data.locations.find((l) => l.id === m.to_location)?.kind === "van"), (m) => nameOf(m.to_location)) });
    if (s === "missing") sections.push({ heading: t("hMissing", { n: p.days }), empty: t("none"), columns: [C(t("cWho"), 26), C(t("cUnits"), 8, "right"), C(t("cValue"), 10, "right")],
      rows: agg(moves.filter((m) => m.kind === "count" && m.reason === "Missing" && !(m.batch_id && data.reversed.has(m.batch_id))), (m) => m.responsible_name || nameOf(m.from_location)).map((r) => ({ ...r, tone: [null, "neg" as const, "neg" as const], alert: "red" as const })) });
    if (s === "counts") {
      const g = new Map<string, ReportMove[]>();
      moves.filter((m) => m.kind === "count").forEach((m) => { const k = m.batch_id ?? m.created_at; g.set(k, [...(g.get(k) ?? []), m]); });
      sections.push({ heading: t("hCounts", { n: p.days }), empty: t("none"), columns: [C(t("cDate"), 12), C(t("cWhere"), 18), C(t("cBy"), 16), C(t("cItems"), 7, "right"), C(t("cMissing"), 9, "right"), C(t("cStatus"), 10)],
        rows: Array.from(g.entries()).map(([k, list]) => {
          const miss = list.filter((m) => m.reason === "Missing");
          return { cells: [fmt.day(list[0].created_at), nameOf(list[0].from_location ?? list[0].to_location), list[0].actor_name ?? "-", String(list.length), `${qtyFmt(miss.reduce((a, m) => a + m.qty, 0))} · ${usd(miss.reduce((a, m) => a + m.qty * Number(m.unit_cost ?? 0), 0))}`, data.reversed.has(k) ? t("reversed") : t("ok")] };
        }) });
    }
  }
  return {
    company, title: p.name, subtitle: t("pdfSub", { date: fmt.day(new Date().toISOString()), n: p.days }), orientation: "portrait", // los reportes siempre en vertical
    meta: [[t("mDate"), fmt.day(new Date().toISOString())], [t("mLocs"), p.locations.length ? locs.map((l) => l.name).join(", ") : t("allLocs")], [t("mPeriod"), t("lastDays", { n: p.days })]],
    summary, columns: [], rows: [], sections, sign: [t("sPrepared"), t("sReviewed"), t("sDate")],
    footer: `BrightPro · ${company}`, page: (n, total) => t("page", { n, total }),
  };
}
