"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { SurchargePreset, TaxRate } from "@/lib/tax";
import { inputClass } from "@/components/customers/ui";

// =====================================================================
// Paso 6.9 · Settings → Taxes
// Tasas de la compañía (nombre + %). Una es la predeterminada: la que usan los clientes con "tasa de la compañía".
// Dueño y manager editan; oficina solo ve.
// =====================================================================
const clean = (v: string) => v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
const pct = (n: number) => `${+Number(n).toFixed(4)}%`;

export default function TaxRatesForm({ companyId, initial, surcharges, needsSql, canEdit }: {
  companyId: string; initial: TaxRate[]; surcharges: SurchargePreset[]; needsSql: boolean; canEdit: boolean;
}) {
  const t = useTranslations("tax");
  const router = useRouter();
  const [list, setList] = useState<TaxRate[]>(initial);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [edit, setEdit] = useState<{ id: string; name: string; rate: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const say = (text: string, error = false) => { setMsg({ text, error }); setTimeout(() => setMsg((m) => (m?.text === text ? null : m)), 2600); };
  const sb = () => createClient().from("tax_rates");
  const valid = (n: string, r: string) => n.trim() && r.trim() !== "" && Number(r) >= 0 && Number(r) <= 100;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!valid(name, rate)) return say(t("eRate"), true);
    setBusy(true);
    const first = list.filter((r) => r.is_active).length === 0;
    const pos = Math.max(0, ...list.map((r) => r.position)) + 1;
    const { data, error } = await sb().insert({ company_id: companyId, name: name.trim(), rate: Number(rate), position: pos })
      .select("id, name, rate, is_default, is_active, position").single();
    if (error || !data) { setBusy(false); return say(/duplicate|unique/i.test(error?.message ?? "") ? t("eDup") : t("eSave"), true); }
    let row = { ...(data as TaxRate), rate: Number(data.rate) };
    // La primera tasa queda como predeterminada
    if (first) {
      const r = await createClient().rpc("tax_rate_set_default", { p_company: companyId, p_id: row.id });
      if (!r.error) row = { ...row, is_default: true };
    }
    setList((l) => [...l, row]); setName(""); setRate(""); setBusy(false); say(t("added")); router.refresh();
  }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    if (!valid(edit.name, edit.rate)) return say(t("eRate"), true);
    const row = { name: edit.name.trim(), rate: Number(edit.rate) };
    const { error } = await sb().update(row).eq("id", edit.id);
    if (error) return say(/duplicate|unique/i.test(error.message) ? t("eDup") : t("eSave"), true);
    setList((l) => l.map((r) => (r.id === edit.id ? { ...r, ...row } : r))); setEdit(null); say(t("saved"));
  }
  async function makeDefault(r: TaxRate) {
    const id = r.is_default ? null : r.id;
    const { error } = await createClient().rpc("tax_rate_set_default", { p_company: companyId, p_id: id });
    if (error) return say(t("eSave"), true);
    setList((l) => l.map((x) => ({ ...x, is_default: x.id === id, is_active: x.id === id ? true : x.is_active })));
    say(id ? t("nowDefault", { name: r.name }) : t("noDefaultNow"));
  }
  async function toggle(r: TaxRate) {
    const { error } = await sb().update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) return say(t("eSave"), true);
    setList((l) => l.map((x) => (x.id === r.id ? { ...x, is_active: !r.is_active, is_default: r.is_active ? false : x.is_default } : x)));
    say(r.is_active ? t("archived") : t("restored"));
  }
  async function remove(r: TaxRate) {
    if (!(await confirmDelete({ title: t("delTitle", { name: r.name }), message: t("delMsg"), confirmLabel: t("delete") }))) return;
    const { error } = await sb().delete().eq("id", r.id);
    if (error) return say(t("eSave"), true);
    setList((l) => l.filter((x) => x.id !== r.id)); say(t("deleted")); router.refresh();
  }

  const def = list.find((r) => r.is_default && r.is_active);
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f6f8f9] px-4 pb-24 pt-5 lg:px-8 lg:pb-10 lg:pt-7">
      <Link prefetch={false} href="/dashboard/settings" className="text-[13px] font-medium text-[#0f766e] hover:underline">← {t("allSettings")}</Link>
      <div className="mt-1 flex items-center gap-3.5">
        <TaxArt />
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a] lg:text-2xl">{t("title")}</h1>
          <p className="mt-0.5 text-[14px] text-slate-500">{t("subtitle")}</p>
        </div>
      </div>

      {needsSql ? (
        <p className="mt-6 max-w-2xl rounded-xl bg-amber-50 px-4 py-3 text-[14px] text-amber-800">{t("needSql")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,44rem)_21rem]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            {canEdit ? (
              <form onSubmit={add} className="grid grid-cols-[minmax(0,1fr)_6.5rem_auto] gap-2">
                <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={t("namePh")} aria-label={t("name")} autoComplete="bp-off" className={`${inputClass} min-w-0`} />
                <div className="relative">
                  <input value={rate} inputMode="decimal" onChange={(e) => setRate(clean(e.target.value))} placeholder="8.25" aria-label={t("rate")} autoComplete="bp-off" className={`${inputClass} pr-7 text-right`} />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">%</span>
                </div>
                <button type="submit" disabled={busy || !valid(name, rate)}
                  className="shrink-0 rounded-lg bg-[#0f766e] px-4 text-[14px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-[#0c5f59] disabled:opacity-50">{t("add")}</button>
              </form>
            ) : (
              <p className="rounded-xl bg-[#f6fbfa] px-3.5 py-2.5 text-[13.5px] text-slate-600">{t("viewOnly")}</p>
            )}

            {list.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-[14px] text-slate-500">{t("empty")}</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {list.map((r) => {
                  return (
                    <li key={r.id} className={`group/r flex items-center gap-3 py-2.5 transition-opacity ${r.is_active ? "" : "opacity-55"}`}>
                      <span className={`flex h-9 min-w-[3.5rem] shrink-0 items-center justify-center rounded-xl px-2 text-[12.5px] font-bold tabular-nums transition-transform duration-200 group-hover/r:scale-105 ${r.is_default ? "bg-[#e9f7f4] text-[#0f766e]" : "bg-[#eef6ff] text-[#2563eb]"}`}>{pct(r.rate)}</span>
                      <span className="min-w-0 flex-1">
                        {edit?.id === r.id ? (
                          <form onSubmit={saveEdit} className="grid grid-cols-[minmax(0,1fr)_5.5rem_auto] gap-1.5">
                            <input autoFocus value={edit.name} maxLength={60} onChange={(e) => setEdit({ ...edit, name: e.target.value })} onKeyDown={(e) => e.key === "Escape" && setEdit(null)} autoComplete="bp-off" className={`${inputClass} py-1.5`} />
                            <input value={edit.rate} inputMode="decimal" onChange={(e) => setEdit({ ...edit, rate: clean(e.target.value) })} autoComplete="bp-off" className={`${inputClass} py-1.5 text-right`} />
                            <button type="submit" className="rounded-lg bg-[#0f766e] px-3 text-[13px] font-semibold text-white">{t("save")}</button>
                          </form>
                        ) : (
                          <>
                            <span className="flex items-center gap-2">
                              <span className="truncate text-[14.5px] font-semibold text-[#0b1f3a]">{r.name}</span>
                              {r.is_default && <span className="shrink-0 rounded-full bg-[#e9f7f4] px-2 py-0.5 text-[11px] font-semibold text-[#0f766e]">{t("default")}</span>}
                            </span>
                            <span className="block text-[12.5px] text-slate-500">{r.is_default ? t("defaultNote") : r.is_active ? t("optionalNote") : t("archivedTag")}</span>
                          </>
                        )}
                      </span>
                      {canEdit && edit?.id !== r.id && (
                        <span className="flex shrink-0 items-center gap-0.5">
                          <IconBtn label={r.is_default ? t("unsetDefault") : t("setDefault")} onClick={() => makeDefault(r)} active={r.is_default}
                            d="M10 3.2l2 4.3 4.6.5-3.4 3.1 1 4.6L10 13.4l-4.2 2.3 1-4.6L3.4 8l4.6-.5z" />
                          <IconBtn label={t("edit")} onClick={() => setEdit({ id: r.id, name: r.name, rate: String(+Number(r.rate).toFixed(4)) })} d="M12.5 4.5l3 3L7 16H4v-3zM11 6l3 3" />
                          <IconBtn label={r.is_active ? t("archive") : t("restore")} onClick={() => toggle(r)} d={r.is_active ? "M3.5 5.5h13v3h-13zM5 8.5v7h10v-7M8.5 11.5h3" : "M4 10a6 6 0 1 0 2-4.5M4 4v3h3"} />
                          <IconBtn label={t("delete")} danger onClick={() => remove(r)} d="M4.5 6h11M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6" />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <aside className="h-fit space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 xl:sticky xl:top-5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("howTitle")}</p>
            <ol className="space-y-2.5 text-[13.5px] leading-relaxed text-slate-600">
              {(["how1", "how2", "how3", "how4"] as const).map((k, i) => (
                <li key={k} className="flex gap-2.5"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e9f7f4] text-[11px] font-bold text-[#0f766e]">{i + 1}</span><span>{t(k)}</span></li>
              ))}
            </ol>
            <div className="rounded-xl bg-[#f6fbfa] px-3.5 py-3 text-[13px] text-[#0f766e]">{def ? t("defaultIs", { name: def.name, rate: pct(def.rate) }) : t("noDefault")}</div>
          </aside>
          <SurchargesCard companyId={companyId} initial={surcharges} canEdit={canEdit} say={say} />
        </div>
      )}
      {msg && <div role="status" className={`fixed bottom-5 left-1/2 z-[95] max-w-[92vw] -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13.5px] font-medium text-white shadow-lg animate-[bp-pop-in_0.2s_ease-out] ${msg.error ? "bg-[#be123c]" : "bg-[#0b1f3a]"}`}>{msg.text}</div>}
    </div>
  );
}

function IconBtn({ label, onClick, d, danger, active }: { label: string; onClick: () => void; d: string; danger?: boolean; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150 hover:bg-slate-100 ${active ? "text-[#e8a33a]" : "text-slate-400"} ${danger ? "hover:text-red-500" : active ? "" : "hover:text-[#0f766e]"}`}>
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
    </button>
  );
}

function TaxArt() {
  return (
    <svg viewBox="0 0 48 48" width={48} height={48} aria-hidden="true" className="shrink-0 transition-transform duration-300 hover:-rotate-6 hover:scale-105">
      <rect x="3" y="3" width="42" height="42" rx="12" fill="#eef6ff" stroke="#cfe0fb" strokeWidth="1.5" />
      <path d="M14 11h20v26l-3.3-2.2L27.3 37 24 34.8 20.7 37l-3.4-2.2L14 37z" fill="#fff" stroke="#2563eb" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M19.5 27.5l9-9" stroke="#14a39a" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20.5" cy="19.5" r="1.8" fill="#14a39a" /><circle cx="27.5" cy="26.5" r="1.8" fill="#14a39a" />
    </svg>
  );
}

// Paso 6.9b: recargos guardados (Trip charge, Distance fee…). No son impuesto: se agregan a mano en cada cotización o factura.
function SurchargesCard({ companyId, initial, canEdit, say }: { companyId: string; initial: SurchargePreset[]; canEdit: boolean; say: (m: string, e?: boolean) => void }) {
  const t = useTranslations("tax");
  const [list, setList] = useState(initial);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [kind, setKind] = useState<"flat" | "percent">("flat");
  const sb = () => createClient().from("surcharges");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || value.trim() === "") return;
    const { data, error } = await sb().insert({ company_id: companyId, name: name.trim(), kind, value: Number(value), position: list.length + 1 })
      .select("id, name, kind, value, is_active, position").single();
    if (error || !data) return say(/duplicate|unique/i.test(error?.message ?? "") ? t("eDupSurch") : t("eSave"), true);
    setList((l) => [...l, { ...(data as SurchargePreset), value: Number(data.value) }]); setName(""); setValue(""); say(t("added"));
  }
  async function remove(x: SurchargePreset) {
    if (!(await confirmDelete({ title: t("delTitle", { name: x.name }), message: t("delSurchMsg"), confirmLabel: t("delete") }))) return;
    const { error } = await sb().delete().eq("id", x.id);
    if (error) return say(t("eSave"), true);
    setList((l) => l.filter((y) => y.id !== x.id)); say(t("deleted"));
  }
  return (
    <section id="surcharges" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 xl:col-start-1">
      <h2 className="text-[16px] font-semibold text-[#0b1f3a]">{t("surchTitle")}</h2>
      <p className="mt-0.5 text-[13.5px] text-slate-500">{t("surchSub")}</p>
      {canEdit && (
        <form onSubmit={add} className="mt-4 grid grid-cols-[minmax(0,1fr)_6.5rem_4.5rem_auto] gap-2">
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={t("surchPh")} aria-label={t("surchName")} autoComplete="bp-off" className={`${inputClass} min-w-0`} />
          <input value={value} inputMode="decimal" onChange={(e) => setValue(clean(e.target.value))} placeholder="50" aria-label={t("amount")} autoComplete="bp-off" className={`${inputClass} text-right`} />
          <button type="button" onClick={() => setKind((k) => (k === "flat" ? "percent" : "flat"))} title={t("surchType")}
            className="rounded-lg border border-slate-200 bg-slate-50 text-[15px] font-semibold text-slate-600 transition-colors hover:border-[#14a39a] hover:text-[#0f766e]">{kind === "flat" ? "$" : "%"}</button>
          <button type="submit" disabled={!name.trim() || value.trim() === ""}
            className="shrink-0 rounded-lg bg-[#0f766e] px-4 text-[14px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-[#0c5f59] disabled:opacity-50">{t("add")}</button>
        </form>
      )}
      {list.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-[14px] text-slate-500">{t("surchEmpty")}</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {list.map((x) => (
            <li key={x.id} className="group/r flex items-center gap-3 py-2.5">
              <span className="flex h-9 min-w-[3.5rem] shrink-0 items-center justify-center rounded-xl bg-[#fff4ec] px-2 text-[12.5px] font-bold tabular-nums text-[#e8713a] transition-transform duration-200 group-hover/r:scale-105">{x.kind === "percent" ? `${+x.value}%` : `$${(+x.value).toFixed(2)}`}</span>
              <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-[#0b1f3a]">{x.name}</span>
              {canEdit && <IconBtn label={t("delete")} danger onClick={() => remove(x)} d="M4.5 6h11M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6" />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
