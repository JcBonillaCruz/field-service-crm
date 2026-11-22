"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions, Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { db, logActivity, nextNumber, saveLines } from "@/lib/sales-client";
import { AddressSnap, DiscType, SalesLine, SalesPrefs, Subscription, TERMS, addressLines, computeTotals, num2, previewNumber, today } from "@/lib/sales";
import { useTranslations } from "next-intl";
import { useSalesTx } from "@/i18n/useSalesTx";
import type { CouponOption, CustomerOption, ItemOption } from "@/lib/sales-server";
import { inputClass } from "@/components/customers/ui";
import { Check, Chevron, optionClass, panelClass } from "@/components/ui/SearchSelect";
import SelectMenu from "@/components/ui/SelectMenu";
import DatePicker from "@/components/ui/DatePicker";
import { FormRow } from "@/components/catalog/FormBits";
import LineItems, { blankLine } from "@/components/sales/LineItems";
import CustomerDrawer from "@/components/sales/CustomerDrawer";
import CustomerSelect from "@/components/sales/CustomerSelect";
import { btnGhost, btnPrimary } from "@/components/sales/SalesBits";

type Addr = { id: string; label: string | null; street: string; unit: string | null; city: string; state: string | null; zip: string | null; country: string | null; is_primary: boolean };
const snap = (a?: Addr | null): AddressSnap => (a ? { label: a.label, street: a.street, unit: a.unit, city: a.city, state: a.state, zip: a.zip, country: a.country } : null);
type Mode = "none" | "item" | "transaction";
type Apply = "one_time" | "every" | "cycles";

export default function SubscriptionForm({ companyId, actor, customers, items, salespeople, prefs, sub, lines: initLines, clone, presetCustomer }: {
  companyId: string; actor: string; customers: CustomerOption[]; items: ItemOption[]; coupons: CouponOption[]; salespeople: string[];
  prefs: SalesPrefs; sub?: Subscription | null; lines?: SalesLine[]; clone?: boolean; presetCustomer?: string;
}) {
  const t = useTranslations("subForm");
  const tcm = useTranslations("common");
  const sx = useSalesTx();
  const MODE_LABEL: Record<Mode, string> = { none: t("mode.none"), item: t("mode.item"), transaction: t("mode.transaction") };
  const APPLY_LABEL: Record<Apply, string> = { one_time: t("apply.one_time"), every: t("apply.every"), cycles: t("apply.cycles") };
  const router = useRouter();
  const editing = Boolean(sub && !clone);
  const src = sub ?? null;
  const base = "/dashboard/subscriptions";
  const [customerId, setCustomerId] = useState(src?.customer_id ?? presetCustomer ?? "");
  const [addresses, setAddresses] = useState<Addr[]>([]);
  const [siteId, setSiteId] = useState(src?.address_id ?? "");
  const [emailOpts, setEmailOpts] = useState<string[]>([]);
  const [emails, setEmails] = useState<string[]>(src?.emails ?? []);
  const [mode, setMode] = useState<Mode>(src?.discount_mode ?? "none");
  const [apply, setApply] = useState<Apply>(src?.discount_apply ?? "every");
  const [cycles, setCycles] = useState(String(src?.discount_cycles ?? 3));
  const [discValue, setDiscValue] = useState(String(src?.discount_value ?? 0));
  const [discType, setDiscType] = useState<DiscType>(src?.discount_type ?? "percent");
  const [lines, setLines] = useState<SalesLine[]>(initLines?.length ? initLines.map((l) => ({ ...l, id: undefined })) : [blankLine()]);
  const [profile, setProfile] = useState(src?.profile_name ?? "");
  const [every, setEvery] = useState(String(src?.bill_every ?? 1));
  const [unit, setUnit] = useState<"week" | "month" | "year">(src?.bill_unit ?? "month");
  const [start, setStart] = useState(editing ? src!.start_date : today());
  const [expires, setExpires] = useState(src?.expires_after ? String(src.expires_after) : "");
  const [never, setNever] = useState(!src?.expires_after);
  const [salesperson, setSalesperson] = useState(src?.salesperson ?? "");
  const [terms, setTerms] = useState(src?.payment_terms ?? "Due on Receipt");
  const [notes, setNotes] = useState(src?.notes ?? "");
  const [tc, setTc] = useState(src?.terms ?? "");
  const [more, setMore] = useState(Boolean(src?.notes || src?.terms));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!customerId) { setAddresses([]); setEmailOpts([]); return; }
    let alive = true;
    (async () => {
      const s = db();
      const [{ data: a }, { data: e }] = await Promise.all([
        s.from("customer_addresses").select("id, label, street, unit, city, state, zip, country, is_primary").eq("customer_id", customerId).order("is_primary", { ascending: false }).order("created_at"),
        s.from("customer_emails").select("email").eq("customer_id", customerId).order("position"),
      ]);
      if (!alive) return;
      setAddresses((a ?? []) as Addr[]);
      const c = customers.find((x) => x.id === customerId);
      const opts = Array.from(new Set([...(e ?? []).map((x) => x.email as string), ...(c?.email ? [c.email] : [])].filter(Boolean)));
      setEmailOpts(opts);
      if (!src || src.customer_id !== customerId) { setEmails(opts.slice(0, 1)); setSiteId(""); if (c?.payment_terms) setTerms(c.payment_terms); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const customer = customers.find((c) => c.id === customerId);
  const billing = addresses.find((a) => a.is_primary) ?? addresses[0] ?? null;
  const site = addresses.find((a) => a.id === siteId) ?? null;
  const calcLines = mode === "item" ? lines : lines.map((l) => ({ ...l, discount: 0 }));
  const totals = useMemo(() => computeTotals(calcLines, mode === "transaction" ? { discount_value: Number(discValue) || 0, discount_type: discType } : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, mode, discValue, discType]);

  async function submit() {
    setError("");
    if (!customerId) return setError(t("eCustomer"));
    const real = lines.filter((l) => l.name.trim() || Number(l.rate) || l.item_id);
    if (!real.length) return setError(t("eItems"));
    if (real.some((l) => !l.name.trim())) return setError(t("eLineName"));
    if (!profile.trim()) return setError(t("eProfile"));
    const n = Math.max(1, Number(every) || 1);
    if (!never && !(Number(expires) > 0)) return setError(t("eExpires"));
    setSaving(true);
    const supabase = db();
    const now = new Date().toISOString();
    const row = {
      customer_id: customerId, customer_name: customer?.display_name ?? "", emails, billing_address: snap(billing), site_address: snap(site), address_id: site?.id ?? null,
      profile_name: profile.trim(), bill_every: n, bill_unit: unit, start_date: start, expires_after: never ? null : Number(expires),
      discount_mode: mode, discount_value: mode === "none" ? 0 : Number(discValue) || 0, discount_type: discType, discount_apply: apply,
      discount_cycles: apply === "cycles" ? Number(cycles) || 1 : null, salesperson: salesperson.trim() || null, payment_terms: terms,
      collect_offline: true, notes: notes.trim() || null, terms: tc.trim() || null, subtotal: totals.subtotal, total: totals.total, updated_at: now,
    };
    let id = editing ? src!.id : "";
    if (editing) {
      const { error: e } = await supabase.from("subscriptions").update({ ...row, ...(src!.invoices_generated === 0 ? { next_billing_date: start } : {}) }).eq("id", id);
      if (e) { setSaving(false); return setError(t("eSave")); }
    } else {
      const number = await nextNumber(companyId, "subscription");
      if (!number) { setSaving(false); return setError(t("eGen")); }
      const { data, error: e } = await supabase.from("subscriptions").insert({ ...row, company_id: companyId, number, next_billing_date: start, status: "live", created_by_name: actor }).select("id").single();
      if (e || !data) { setSaving(false); return setError(t("eSaveSql")); }
      id = data.id;
    }
    const le = await saveLines(companyId, { subscription_id: id }, mode === "item" ? real : real.map((l) => ({ ...l, discount: 0 })));
    if (le) { setSaving(false); return setError(t("eLines")); }
    await logActivity(companyId, "subscription", id, editing ? "Subscription updated" : `Subscription created · ${num2(totals.total)} every ${n} ${unit}${n === 1 ? "" : "s"}`, actor);
    router.push(`${base}/${id}`);
    router.refresh();
  }

  const dot = <span className="relative ml-1 flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2563eb] opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2563eb]" /></span>;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-white max-sm:bg-[#f4f6f8] max-sm:pb-3">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f3a]">{editing ? t("edit") : clone ? t("clone") : t("new")}</h1>
        <Link prefetch={false} href={editing ? `${base}/${src!.id}` : base} aria-label={tcm("close")} className="group/x flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600">
          <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-300 group-hover/x:rotate-90" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
        </Link>
      </div>

      <div className="flex-1">
        <div className="border-b border-slate-200 bg-[#fafbfc] px-5 py-6 sm:px-8 max-sm:mx-3 max-sm:mt-3 max-sm:rounded-2xl max-sm:border max-sm:border-slate-200 max-sm:bg-white max-sm:px-4 max-sm:shadow-[0_1px_4px_rgba(15,40,60,0.06)]">
          <div className="max-w-[1100px] space-y-4">
            <FormRow label={t("customer")} required htmlFor="s-cust" width="max-w-[620px]">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1"><CustomerSelect id="s-cust" value={customerId} customers={customers} onChange={setCustomerId} /></div>
                {customerId && <span className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700"><span className="h-2.5 w-2.5 rounded-full bg-[#16a34a]" />{customer?.currency || "USD"}</span>}
              </div>
              <div className="mt-1"><CustomerDrawer customerId={customerId || null} /></div>
            </FormRow>
            {customerId && (
              <div className="grid gap-5 lg:ml-[calc(10.5rem+1.5rem)] lg:max-w-[760px] lg:grid-cols-2">
                <div>
                  <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("billingAddr")}</p>
                  {billing ? addressLines(snap(billing)).map((l, i) => <p key={i} className={`text-[14px] ${i === 0 ? "font-semibold text-[#0b1f3a]" : "text-slate-700"}`}>{l}</p>) : <p className="text-sm text-slate-400">{t("noAddr")}</p>}
                </div>
                <div>
                  <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("site")}</p>
                  <SelectMenu value={siteId} ariaLabel={t("jobSite")} placeholder={t("sameBilling")}
                    options={[{ value: "", label: t("sameBilling") }, ...addresses.map((a) => ({ value: a.id, label: `${a.label || (a.is_primary ? t("billingL") : t("jobSite"))} · ${a.street}` }))]} onChange={setSiteId} />
                  {site && <div className="mt-1.5">{addressLines(snap(site)).map((l, i) => <p key={i} className="text-[13px] text-slate-600">{l}</p>)}</div>}
                </div>
                <div className="lg:col-span-2">
                  <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("emailTo")}</p>
                  <div className="flex flex-wrap gap-2">
                    <Link prefetch={false} href={`/dashboard/customers/${customerId}/edit`} target="_blank" className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-[#14a39a]">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2563eb] text-[11px] text-white">+</span>New Contact Person
                    </Link>
                    {emailOpts.map((e) => (
                      <label key={e} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
                        <input type="checkbox" checked={emails.includes(e)} onChange={() => setEmails((l) => (l.includes(e) ? l.filter((x) => x !== e) : [...l, e]))} className="h-4 w-4 accent-[#2563eb]" />{e}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-6 sm:px-8 max-sm:mx-3 max-sm:mt-3 max-sm:rounded-2xl max-sm:border max-sm:border-slate-200 max-sm:bg-white max-sm:px-4 max-sm:shadow-[0_1px_4px_rgba(15,40,60,0.06)]">
          <div className="max-w-[1100px]">
            {/* Descuento: puntito azul animado, como Zoho */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Popover className="relative">
                <PopoverButton className="group flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:border-[#14a39a] data-[open]:border-[#0f766e] focus:outline-none">
                  <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="10" r="7" /><path d="m7 13 6-6M7.5 7.5h.01M12.5 12.5h.01" strokeLinecap="round" /></svg>
                  {MODE_LABEL[mode]}
                  <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400 transition-transform group-data-[open]:rotate-180" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
                </PopoverButton>
                <PopoverPanel anchor="bottom start" transition className="z-[70] mt-1 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0">
                  {({ close }) => (
                    <>
                      <p className="font-semibold text-[#0b1f3a]">{t("discPref")}</p>
                      <p className="mb-3 text-[13px] text-slate-500">{t("discPrefHint")}</p>
                      {(["none", "item", "transaction"] as Mode[]).map((m) => (
                        <label key={m} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-[15px] text-slate-700 hover:bg-[#f0faf7]">
                          <input type="radio" name="disc-mode" checked={mode === m} onChange={() => { setMode(m); close(); }} className="h-4 w-4 accent-[#2563eb]" />
                          {m === "none" ? t("noDiscount") : MODE_LABEL[m]}
                        </label>
                      ))}
                    </>
                  )}
                </PopoverPanel>
              </Popover>
              {mode === "none" && dot}
              {mode !== "none" && (
                <div className="w-44"><SelectMenu value={apply} ariaLabel={t("applyDisc")} options={(Object.keys(APPLY_LABEL) as Apply[]).map((a) => ({ value: a, label: APPLY_LABEL[a] }))} onChange={(v) => setApply(v as Apply)} /></div>
              )}
              {mode !== "none" && apply === "cycles" && (
                <span className="flex items-center gap-2 text-sm text-slate-600">{t("for")} <input inputMode="numeric" value={cycles} onChange={(e) => setCycles(e.target.value.replace(/\D/g, ""))} className={`${inputClass} !w-16 !py-1.5 text-center`} /> {t("cycles")}</span>
              )}
            </div>

            <LineItems lines={lines} setLines={setLines} items={items} showDiscount={mode === "item"} priceLabel={t("price")} />

            <div className="mt-5 ml-auto max-w-md space-y-3 rounded-xl bg-[#f7f9fa] p-4 text-[15px]">
              <div className="flex justify-between font-semibold text-[#0b1f3a]"><span>{t("subtotal")}</span><span className="tabular-nums">{num2(totals.subtotal)}</span></div>
              {mode === "transaction" && (
                <div className="flex items-center gap-2">
                  <span className="w-20 text-slate-700">{t("discount")}</span>
                  <input inputMode="decimal" value={discValue} onChange={(e) => setDiscValue(e.target.value.replace(/[^0-9.]/g, ""))} className={`${inputClass} flex-1 !py-1.5 text-right`} />
                  <div className="w-20 shrink-0"><SelectMenu value={discType} options={[{ value: "percent", label: "%" }, { value: "flat", label: "$" }]} onChange={(v) => setDiscType(v as DiscType)} ariaLabel={t("discType")} /></div>
                  <span className="w-20 text-right tabular-nums text-slate-600">-{num2(totals.discount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-3 text-[18px] font-semibold text-[#0b1f3a]"><span>{t("totalCycle")}</span><span className="tabular-nums">{num2(totals.total)}</span></div>
            </div>

            <h2 className="mb-4 mt-10 border-b border-slate-200 pb-3 text-[18px] text-slate-600">{t("term")}</h2>
            <div className="max-w-[760px] space-y-4">
              <FormRow label={t("number")} required width="max-w-[300px]">
                <input readOnly value={editing ? src!.number : previewNumber(prefs, "subscription")} className={`${inputClass} text-slate-600`} />
              </FormRow>
              <FormRow label={t("profile")} required htmlFor="s-prof" width="max-w-[300px]" hint={t("profileHint")}>
                <input id="s-prof" value={profile} onChange={(e) => setProfile(e.target.value)} className={inputClass} />
              </FormRow>
              <FormRow label={t("billEvery")} required width="max-w-[300px]">
                <div className="flex gap-2">
                  <input inputMode="numeric" value={every} onChange={(e) => setEvery(e.target.value.replace(/\D/g, "").slice(0, 3))} className={`${inputClass} !w-16 text-center`} />
                  <div className="min-w-0 flex-1"><SelectMenu value={unit} ariaLabel={t("unit")} options={[{ value: "week", label: t("weeks") }, { value: "month", label: t("months") }, { value: "year", label: t("years") }]} onChange={(v) => setUnit(v as typeof unit)} /></div>
                </div>
              </FormRow>
              <FormRow label={t("start")} width="max-w-[300px]">
                <DatePicker value={start} onChange={setStart} />
              </FormRow>
              <FormRow label={t("expiresAfter")} width="max-w-[300px]">
                <div className="flex">
                  <input inputMode="numeric" disabled={never} value={never ? "" : expires} onChange={(e) => setExpires(e.target.value.replace(/\D/g, ""))} className={`${inputClass} rounded-r-none disabled:opacity-60`} />
                  <span className="flex items-center rounded-r-lg border border-l-0 border-slate-200 bg-slate-100 px-3 text-sm text-slate-600">{t("cycles")}</span>
                </div>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-[15px] text-slate-700"><input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} className="h-4 w-4 accent-[#2563eb]" />{t("never")}</label>
              </FormRow>
              <FormRow label={t("salesperson")} htmlFor="s-sp" width="max-w-[300px]">
                <Combobox immediate value={salesperson} onChange={(v: string | null) => v != null && setSalesperson(v)}>
                  <div className="relative">
                    <ComboboxInput id="s-sp" autoComplete="off" placeholder={t("salespersonPh")} displayValue={(v: string) => v} onChange={(e) => setSalesperson(e.target.value)} className={`${inputClass} pr-10`} />
                    <ComboboxButton className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400"><Chevron /></ComboboxButton>
                  </div>
                  <ComboboxOptions anchor="bottom start" transition className={`${panelClass} w-[var(--input-width)]`}>
                    {[actor, ...salespeople].filter((v, i, a) => v && a.indexOf(v) === i).map((p) => <ComboboxOption key={p} value={p} className={optionClass}><span>{p}</span><Check /></ComboboxOption>)}
                  </ComboboxOptions>
                </Combobox>
              </FormRow>
              <FormRow label={t("projects")} width="max-w-[420px]">
                <p className="py-2 text-[15px] text-slate-500">{t("noProjects")}</p>
              </FormRow>
              <FormRow label={t("payMode")} width="max-w-[420px]">
                <label className="flex items-center gap-2 py-2 text-[15px] text-slate-700"><input type="checkbox" checked readOnly className="h-4 w-4 accent-[#93c5fd]" />{t("offline")}</label>
              </FormRow>
              <FormRow label={t("payTerms")} width="max-w-[300px]">
                <SelectMenu value={terms} options={TERMS.filter((x) => x !== "Custom").map((x) => ({ value: x, label: sx.term(x) }))} onChange={setTerms} ariaLabel={t("payTerms")} />
              </FormRow>
              <p className="text-[14px] text-slate-600">{t("faster")} <span className="text-slate-400">{t("stripe")}</span></p>
              <button type="button" onClick={() => setMore((v) => !v)} className="flex items-center gap-1.5 pt-2 text-[17px] text-[#2563eb]">
                {t("otherPrefs")}<svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${more ? "rotate-90" : ""}`} fill="currentColor"><path d="M7 5l6 5-6 5z" /></svg>
              </button>
              {more && (
                <div className="space-y-4 animate-[bp-fade_0.2s_ease-out]">
                  <FormRow label={t("notes")} alignTop width="max-w-[460px]"><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} /></FormRow>
                  <FormRow label={t("tc")} alignTop width="max-w-[460px]"><textarea rows={4} value={tc} onChange={(e) => setTc(e.target.value)} className={inputClass} /></FormRow>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-5 py-3 max-sm:flex-nowrap max-sm:gap-2 max-sm:px-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
        <button type="button" onClick={submit} disabled={saving} className={btnPrimary}>{saving ? tcm("saving") : editing ? tcm("save") : tcm("continue")}</button>
        <Link prefetch={false} href={editing ? `${base}/${src!.id}` : base} className={`${btnGhost} max-sm:px-3 max-sm:py-2 max-sm:text-[13px] max-sm:ml-auto max-sm:border-0 max-sm:bg-transparent`}>{tcm("cancel")}</Link>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
