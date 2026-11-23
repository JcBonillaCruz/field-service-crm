"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SelectMenu from "@/components/ui/SelectMenu";
import { inputClass } from "@/components/customers/ui";
import { FormHeader, SaveBar } from "@/components/catalog/FormBits";
import { LocArt } from "@/components/inventory/InvArt";
import CountSheetModal, { SheetIcon } from "@/components/inventory/CountSheetModal";
import { countList } from "@/lib/inventory-insights";
import ItemPicker from "@/components/inventory/ItemPicker";
import { InvItem, InvLocation, InvStock, invError, pingAlerts, qtyFmt } from "@/lib/inventory";
import { useTranslations } from "next-intl";
import { useInvTx } from "@/i18n/useInvTx";

type Result = { items: number; missing: number; extra: number; missing_cost: number };

// Conteo físico: cuentas lo que de verdad hay. La diferencia queda firmada y, si es una van, a nombre de su técnico.
export default function CountForm({ companyId, items, stock, locations, initialLocation, barcodes = {}, company = "", prefill, fromBatch }: {
  barcodes?: Record<string, string>; companyId: string; items: InvItem[]; stock: InvStock[]; locations: InvLocation[]; initialLocation?: string;
  company?: string; prefill?: Record<string, string>; fromBatch?: string; // Paso 6.12d: corregir un conteo (ya revertido) con sus números
}) {
  const t = useTranslations("invCount");
  const ix = useInvTx();
  const usd = ix.money;
  const router = useRouter();
  const [loc, setLoc] = useState(initialLocation && locations.some((l) => l.id === initialLocation) ? initialLocation : locations[0]?.id ?? "");
  const [counts, setCounts] = useState<Record<string, string>>(prefill ?? {});
  const [extra, setExtra] = useState<InvItem[]>(() => (prefill ? items.filter((i) => prefill[i.id] !== undefined) : []));
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(false);
  const [showExpected, setShowExpected] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const at = (item: string) => Number(stock.find((s) => s.item_id === item && s.location_id === loc)?.qty ?? 0);
  const location = locations.find((l) => l.id === loc);
  // Mismo orden que la hoja impresa (por nombre): el número de renglón coincide
  const list = useMemo(() => countList(items, stock, loc, extra.map((e) => e.id)), [items, stock, loc, extra]);
  const filled = list.filter((i) => (counts[i.id] ?? "").trim() !== "");
  const diff = (i: InvItem) => Number(counts[i.id]) - at(i.id);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!loc) return setError(t("eLoc"));
    if (!filled.length) return setError(t("eNone"));
    setSaving(true); setError("");
    const { data, error: err } = await createClient().rpc("inv_count_batch", {
      p_company: companyId, p_location: loc, p_note: note.trim() || null, p_lines: filled.map((i) => ({ item: i.id, counted: Number(counts[i.id]) })),
    });
    setSaving(false);
    if (err) return setError(ix.err(invError(err)));
    pingAlerts();
    setResult(data as Result);
    router.refresh();
  }

  if (result) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
        <FormHeader title={t("saved")} closeHref="/dashboard/inventory/history?tab=counts" />
        <div className="mx-auto w-full max-w-lg px-5 py-10 text-center">
          <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${result.missing > 0 ? "bg-[#fff1f2] text-[#be123c]" : "bg-[#e7f6f1] text-[#0f766e]"}`}>
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={result.missing > 0 ? "M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" : "M5 12.5 9.5 17 19 7"} />
            </svg>
          </span>
          <h2 className="mt-4 text-xl font-semibold text-[#0b1f3a]">{t("counted", { loc: location?.name ?? "", n: result.items })}</h2>
          <div className="mt-6 grid grid-cols-3 gap-3 text-left">
            {[[t("missing"), qtyFmt(result.missing), "text-[#be123c]"], [t("missingValue"), usd(result.missing_cost), "text-[#be123c]"], [t("extra"), qtyFmt(result.extra), "text-[#0f766e]"]].map(([k, v, c]) => (
              <div key={k} className="rounded-xl border border-slate-200 p-3"><p className="text-[12px] text-slate-500">{k}</p><p className={`text-[18px] font-semibold tabular-nums ${c}`}>{v}</p></div>
            ))}
          </div>
          {result.missing > 0 && location?.kind === "van" && <p className="mt-4 text-[14px] text-slate-600">{t("vanNote")}</p>}
          <div className="mt-8 flex justify-center gap-3">
            <Link prefetch={false} href="/dashboard/inventory/history?tab=counts" className="rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59]">{t("done")}</Link>
            <Link prefetch={false} href="/dashboard/inventory/reports" className="rounded-lg border border-slate-200 px-5 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50">{t("reports")}</Link>
          </div>
        </div>
      </div>
    );
  }

  const pct = list.length ? Math.round((filled.length / list.length) * 100) : 0;
  const live = useMemo(() => filled.reduce((acc, i) => { const d = diff(i); if (d < 0) { acc.missing += -d; acc.cost += -d * i.cost_price; } else acc.extra += d; return acc; }, { missing: 0, extra: 0, cost: 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filled, counts, loc]);
  const shown = q.trim() ? list.filter((i) => `${i.name} ${i.sku ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())) : list;
  const step = (id: string, by: number) => { setCounts((c) => { const v = Math.max(0, (Number(c[id]) || 0) + by); return { ...c, [id]: String(v) }; }); setError(""); };

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="flex min-h-[calc(100vh-4rem)] flex-col bg-[#f4f6f8]">
      <FormHeader title={t("newTitle")} closeHref="/dashboard/inventory/history?tab=counts" />
      <div className="flex-1 px-4 py-5 sm:px-8 sm:py-7">
        <div className="mx-auto grid max-w-[1100px] gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            {/* Dónde y cómo se cuenta */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-4">
                <span className="shrink-0">{location ? <LocArt kind={location.kind} size={56} /> : null}</span>
                <div className="min-w-0 flex-1 basis-56">
                  <label className="mb-1 block text-[12.5px] font-semibold uppercase tracking-wide text-slate-500">{t("loc")}</label>
                  <SelectMenu ariaLabel={t("loc")} value={loc} onChange={(v) => { setLoc(v); setCounts({}); setExtra([]); }} options={locations.map((l) => ({ value: l.id, label: `${l.name}${l.kind === "van" ? ` ${t("vanTag")}` : ""}` }))} />
                </div>
                <button type="button" onClick={() => setSheet(true)} className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-semibold text-[#0f766e] transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:bg-[#e9f7f4]">
                  <SheetIcon />{t("printSheet")}
                </button>
              </div>
              <button type="button" role="switch" aria-checked={showExpected} onClick={() => setShowExpected((v) => !v)} className="mt-4 flex items-start gap-3 text-left">
                <span className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${showExpected ? "bg-[#0f766e]" : "bg-slate-300"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${showExpected ? "left-[22px]" : "left-0.5"}`} />
                </span>
                <span><span className="block text-[15px] font-medium text-slate-700">{showExpected ? t("showing") : t("blind")}</span><span className="block text-[12.5px] text-slate-500">{t("showExpectedHint")}</span></span>
              </button>
              {fromBatch && <p className="mt-4 rounded-xl bg-[#fffaf0] px-3.5 py-2.5 text-[13.5px] text-[#b45309] ring-1 ring-[#fcdca4]">{t("correcting")}</p>}
            </section>

            {/* Lo que contaste */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="space-y-3 border-b border-slate-100 p-4 sm:p-5">
                <h2 className="text-[17px] font-semibold text-[#0b1f3a]">{t("whatCounted")}</h2>
                {list.length > 8 && (
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("filterPh")} aria-label={t("filterPh")}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[15px] placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
                )}
                <ItemPicker barcodes={barcodes} items={items.filter((i) => !list.some((x) => x.id === i.id))} onPick={(it) => setExtra((l) => [...l, it])} placeholder={t("foundPh")}
                  onNotFound={(code) => setError(t("notIn", { code }))} />
              </div>
              {list.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500">{t("noStock")}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {shown.map((i) => {
                    const n = list.indexOf(i) + 1;
                    const done = (counts[i.id] ?? "").trim() !== "";
                    const d = done ? diff(i) : null;
                    return (
                      <li key={i.id} className={`flex items-center gap-3 px-4 py-3 transition-colors sm:px-5 ${done ? "bg-[#f6fbfa]" : ""}`}>
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums transition-colors ${done ? "bg-[#0f766e] text-white" : "bg-slate-100 text-slate-500"}`}>
                          {done ? <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 10.5 8.5 14 15 6.5" /></svg> : n}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-[#0b1f3a]">{i.name}</span>
                          <span className="block truncate font-mono text-[12px] text-slate-400">{i.sku}{showExpected ? <span className="font-sans"> · {t("expected", { n: qtyFmt(at(i.id)) })}</span> : null}</span>
                        </span>
                        {d !== null && showExpected && d !== 0 && <span className={`hidden rounded-full px-2 py-0.5 text-[12.5px] font-semibold tabular-nums sm:inline ${d < 0 ? "bg-[#fff1f2] text-[#be123c]" : "bg-[#e7f6f1] text-[#0f766e]"}`}>{d > 0 ? "+" : "−"}{qtyFmt(Math.abs(d))}</span>}
                        <div className="flex shrink-0 items-center overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-[#0f766e] focus-within:ring-4 focus-within:ring-[#14a39a]/15">
                          <button type="button" onClick={() => step(i.id, -1)} aria-label={t("less")} className="flex h-10 w-9 items-center justify-center text-[18px] text-slate-500 hover:bg-slate-50 hover:text-[#0b1f3a]">−</button>
                          <input value={counts[i.id] ?? ""} inputMode="decimal" placeholder="—" aria-label={t("countedX", { name: i.name })}
                            onChange={(e) => { setCounts((c) => ({ ...c, [i.id]: e.target.value.replace(/[^0-9.]/g, "") })); setError(""); }}
                            className="h-10 w-14 border-x border-slate-100 bg-transparent text-center text-[15px] font-semibold tabular-nums focus:outline-none" />
                          <button type="button" onClick={() => step(i.id, 1)} aria-label={t("more")} className="flex h-10 w-9 items-center justify-center text-[18px] text-slate-500 hover:bg-slate-50 hover:text-[#0b1f3a]">+</button>
                        </div>
                        <span className="hidden w-10 text-[13px] text-slate-500 sm:block">{i.unit ?? ""}</span>
                      </li>
                    );
                  })}
                  {shown.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">{t("noMatch")}</li>}
                </ul>
              )}
            </section>
          </div>

          {/* Resumen (en la computadora se queda fijo a la derecha) */}
          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex items-baseline justify-between">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">{t("progressT")}</p>
                <p className="text-[22px] font-semibold tabular-nums text-[#0b1f3a]">{filled.length}<span className="text-[15px] text-slate-400">/{list.length}</span></p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#14a39a] to-[#0f766e] transition-all duration-500" style={{ width: `${pct}%` }} /></div>
              <p className="mt-2 text-[12.5px] text-slate-500">{t("progress", { n: filled.length, total: list.length })}</p>
              {showExpected && filled.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-[#fff1f2] p-2.5"><p className="text-[11.5px] text-[#be123c]">{t("missing")}</p><p className="text-[17px] font-semibold tabular-nums text-[#be123c]">{qtyFmt(live.missing)}</p><p className="text-[11.5px] tabular-nums text-[#be123c]/80">{usd(live.cost)}</p></div>
                  <div className="rounded-xl bg-[#e7f6f1] p-2.5"><p className="text-[11.5px] text-[#0f766e]">{t("extra")}</p><p className="text-[17px] font-semibold tabular-nums text-[#0f766e]">{qtyFmt(live.extra)}</p></div>
                </div>
              )}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <label htmlFor="ct-note" className="mb-1.5 block text-[13px] font-semibold uppercase tracking-wide text-slate-500">{t("note")}</label>
              <textarea id="ct-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("optional")} className={inputClass} />
            </section>
          </aside>
        </div>
      </div>
      <SaveBar saving={saving} cancelHref="/dashboard/inventory/history?tab=counts" error={error} saveLabel={t("saveCount")} />
      <CountSheetModal open={sheet} onClose={() => setSheet(false)} items={items} stock={stock} locations={locations} company={company} initialLocation={loc} />
    </form>
  );
}
