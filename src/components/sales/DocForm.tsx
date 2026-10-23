"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions, Menu, MenuButton, MenuItem, MenuItems, Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { db, logActivity, nextNumber, saveLines } from "@/lib/sales-client";
import {
  AddressSnap, DiscType, DocKind, SalesDoc, SalesLine, TERMS, addressLines, computeTotals, grossOf, dueFromTerms, num2, previewNumber, round2, today,
} from "@/lib/sales";
import type { CouponOption, CustomerOption, ItemOption } from "@/lib/sales-server";
import { pdfOf } from "@/lib/sales";
import { tplOf } from "@/lib/pdf-templates";
import UploadChoices from "@/components/ui/UploadChoices";
import type { SalesPrefs } from "@/lib/sales";
import { inputClass } from "@/components/customers/ui";
import { Check, Chevron, optionClass, panelClass } from "@/components/ui/SearchSelect";
import SelectMenu from "@/components/ui/SelectMenu";
import DatePicker from "@/components/ui/DatePicker";
import { FormRow, Tip, InfoIcon } from "@/components/catalog/FormBits";
import LineItems, { blankLine } from "@/components/sales/LineItems";
import CustomerDrawer from "@/components/sales/CustomerDrawer";
import CustomerSelect from "@/components/sales/CustomerSelect";
import { Modal, btnGhost, btnPrimary } from "@/components/sales/SalesBits";

type Addr = { id: string; label: string | null; street: string; unit: string | null; city: string; state: string | null; zip: string | null; country: string | null; is_primary: boolean };
const snap = (a?: Addr | null): AddressSnap => (a ? { label: a.label, street: a.street, unit: a.unit, city: a.city, state: a.state, zip: a.zip, country: a.country } : null);
const addrLabel = (a: Addr) => `${a.label || (a.is_primary ? "Billing address" : "Job site")} · ${[a.street, a.city].filter(Boolean).join(", ")}`;

export default function DocForm({ kind, companyId, actor, customers, items, coupons, salespeople, prefs, doc, lines: initLines, clone, presetCustomer }: {
  kind: DocKind; companyId: string; actor: string; customers: CustomerOption[]; items: ItemOption[]; coupons: CouponOption[]; salespeople: string[];
  prefs: SalesPrefs; doc?: SalesDoc | null; lines?: SalesLine[]; clone?: boolean; presetCustomer?: string;
}) {
  const router = useRouter();
  const isQuote = kind === "quote";
  const noun = isQuote ? "Quote" : "Invoice";
  const base = isQuote ? "/dashboard/quotes" : "/dashboard/invoices";
  const editing = Boolean(doc && !clone);
  const src = doc ?? null;
  const settings = isQuote ? prefs.quote_settings : prefs.invoice_settings;

  const [customerId, setCustomerId] = useState(src?.customer_id ?? presetCustomer ?? "");
  const [addresses, setAddresses] = useState<Addr[]>([]);
  const [siteId, setSiteId] = useState(src?.address_id ?? "");
  const [emailOpts, setEmailOpts] = useState<string[]>([]);
  const [emails, setEmails] = useState<string[]>(src?.emails ?? []);
  const [auto, setAuto] = useState(isQuote ? prefs.quote_auto : prefs.invoice_auto);
  const [number, setNumber] = useState(editing ? src!.number : "");
  const [numModal, setNumModal] = useState(false);
  const [livePrefs, setLivePrefs] = useState(prefs);
  const [reference, setReference] = useState(src?.reference ?? "");
  const [orderNo, setOrderNo] = useState(src?.order_number ?? "");
  const [date, setDate] = useState(editing ? src!.doc_date : today());
  const [expiry, setExpiry] = useState(src?.expiry_date ?? "");
  const [terms, setTerms] = useState(src?.payment_terms ?? "Due on Receipt");
  const [due, setDue] = useState(src?.due_date ?? today());
  const [salesperson, setSalesperson] = useState(src?.salesperson ?? "");
  const [subject, setSubject] = useState(src?.subject ?? "");
  const [lines, setLines] = useState<SalesLine[]>(initLines?.length ? initLines.map((l) => ({ ...l, id: undefined })) : [blankLine()]);
  const [discValue, setDiscValue] = useState(String(src?.discount_value ?? 0));
  const [discType, setDiscType] = useState<DiscType>(src?.discount_type ?? "percent");
  const [coupon, setCoupon] = useState(src?.coupon_code ?? "");
  const [taxName, setTaxName] = useState(src?.tax_name ?? "");
  const [taxRate, setTaxRate] = useState(String(src?.tax_rate ?? 0));
  const [shipping, setShipping] = useState(String(src?.shipping ?? ""));
  const [adjLabel, setAdjLabel] = useState(src?.adjustment_label ?? "Adjustment");
  const [adjustment, setAdjustment] = useState(String(src?.adjustment ?? ""));
  const [notes, setNotes] = useState(src ? src.notes ?? "" : settings.default_notes ?? "");
  const [tc, setTc] = useState(src ? src.terms ?? "" : settings.default_terms ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [simple, setSimple] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showTc, setShowTc] = useState(Boolean(src?.terms));
  const [saving, setSaving] = useState<"" | "draft" | "send" | "sent">("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [mobile, setMobile] = useState(false);
  const [showSubject, setShowSubject] = useState(Boolean(src?.subject));
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setMobile(mq.matches); on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const compactTotals = (simple && !isQuote) || mobile;

  useEffect(() => { if (!isQuote) { try { setSimple(localStorage.getItem("bp-inv-simple") === "1"); } catch { /* */ } } }, [isQuote]);
  function toggleSimple() { const v = !simple; setSimple(v); try { localStorage.setItem("bp-inv-simple", v ? "1" : "0"); } catch { /* */ } }

  // Cuando eliges cliente: direcciones (facturación + job sites), correos y términos
  useEffect(() => {
    if (!customerId) { setAddresses([]); setEmailOpts([]); return; }
    let alive = true;
    (async () => {
      const s = db();
      const [{ data: a }, { data: e }] = await Promise.all([
        s.from("customer_addresses").select("id, label, street, unit, city, state, zip, country, is_primary").eq("customer_id", customerId).order("is_primary", { ascending: false }).order("created_at"),
        s.from("customer_emails").select("email, is_primary").eq("customer_id", customerId).order("position"),
      ]);
      if (!alive) return;
      setAddresses((a ?? []) as Addr[]);
      const c = customers.find((x) => x.id === customerId);
      const opts = Array.from(new Set([...(e ?? []).map((x) => x.email as string), ...(c?.email ? [c.email] : [])].filter(Boolean)));
      setEmailOpts(opts);
      if (!src || src.customer_id !== customerId) {
        setEmails(opts.slice(0, 1));
        setSiteId("");
        if (!isQuote && c?.payment_terms) { setTerms(c.payment_terms); setDue(dueFromTerms(date, c.payment_terms)); }
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const customer = customers.find((c) => c.id === customerId);
  const billing = addresses.find((a) => a.is_primary) ?? addresses[0] ?? null;
  const site = addresses.find((a) => a.id === siteId) ?? null;
  const couponObj = coupons.find((c) => c.code === coupon);
  const effDisc = couponObj ? { discount_value: Number(couponObj.discount_value), discount_type: couponObj.discount_type } : { discount_value: Number(discValue) || 0, discount_type: discType };
  const totals = useMemo(() => computeTotals(lines, { ...effDisc, tax_rate: Number(taxRate) || 0, shipping: Number(shipping) || 0, adjustment: Number(adjustment) || 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, discValue, discType, coupon, taxRate, shipping, adjustment]);


  function onTerms(t: string) { setTerms(t); if (t !== "Custom") setDue(dueFromTerms(date, t)); }
  function onDate(d: string) { setDate(d); if (!isQuote && terms !== "Custom") setDue(dueFromTerms(d, terms)); }

  async function submit(mode: "draft" | "send" | "sent") {
    setError("");
    if (!customerId) return setError("Select a customer.");
    if (!auto && !editing && !number.trim()) return setError(`Enter the ${noun.toLowerCase()} number.`);
    if (editing && !number.trim()) return setError(`Enter the ${noun.toLowerCase()} number.`);
    const real = lines.filter((l) => l.name.trim() || Number(l.rate) || l.item_id);
    if (!real.length) return setError("Add at least one item.");
    if (real.some((l) => !l.name.trim())) return setError("Every line needs an item name.");
    if (isQuote && expiry && expiry < date) return setError("The expiry date can't be before the quote date.");
    setSaving(mode);
    const supabase = db();
    let num = number.trim();
    if (!editing && auto) {
      const n = await nextNumber(companyId, kind);
      if (!n) { setSaving(""); return setError("The number couldn't be generated. Did you run the SQL for Paso 3.30?"); }
      num = n;
    }
    const now = new Date().toISOString();
    const row = {
      customer_id: customerId, customer_name: customer?.display_name ?? "", emails,
      billing_address: snap(billing), site_address: snap(site), address_id: site?.id ?? null,
      reference: reference.trim() || null, order_number: orderNo.trim() || null, doc_date: date,
      expiry_date: isQuote ? expiry || null : null, due_date: isQuote ? null : due || date, payment_terms: isQuote ? null : terms,
      salesperson: salesperson.trim() || null, subject: subject.trim() || null,
      discount_value: effDisc.discount_value, discount_type: effDisc.discount_type, coupon_code: couponObj?.code ?? null,
      tax_name: taxName.trim() || null, tax_rate: Number(taxRate) || 0, tax_amount: totals.tax, shipping: totals.shipping,
      adjustment: totals.adjustment, adjustment_label: adjLabel.trim() || "Adjustment", subtotal: totals.subtotal, total: totals.total,
      notes: notes.trim() || null, terms: tc.trim() || null, updated_at: now,
    };
    let id = editing ? src!.id : "";
    if (editing) {
      const { error: e } = await supabase.from("sales_docs").update({ ...row, number: num, ...(mode === "sent" && src!.status === "draft" ? { status: "sent", sent_at: now } : {}) }).eq("id", id);
      if (e) { setSaving(""); return setError(e.code === "23505" ? `${noun} number ${num} is already in use.` : `The ${noun.toLowerCase()} couldn't be saved.`); }
    } else {
      const { data, error: e } = await supabase.from("sales_docs").insert({
        ...row, company_id: companyId, kind, number: num, status: mode === "sent" ? "sent" : "draft", sent_at: mode === "sent" ? now : null, created_by_name: actor,
      }).select("id").single();
      if (e || !data) { setSaving(""); return setError(e?.code === "23505" ? `${noun} number ${num} is already in use.` : `The ${noun.toLowerCase()} couldn't be saved. Did you run the SQL for Paso 3.30?`); }
      id = data.id;
    }
    const le = await saveLines(companyId, { doc_id: id }, real);
    if (le) { setSaving(""); return setError("The items couldn't be saved."); }
    for (const f of files) {
      const path = `${companyId}/${id}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error: ue } = await supabase.storage.from("sales-attachments").upload(path, f);
      if (!ue) await supabase.from("sales_files").insert({ company_id: companyId, entity: kind, entity_id: id, name: f.name, path, size: f.size, mime: f.type });
    }
    await logActivity(companyId, kind, id, editing ? `${noun} updated` : clone ? `${noun} created (cloned from ${src!.number})` : `${noun} created for ${money2(totals.total)}`, actor);
    if (mode === "sent") await logActivity(companyId, kind, id, `${noun} marked as sent`, actor);
    router.push(`${base}/${id}${mode === "send" ? "?send=1" : ""}`);
    router.refresh();
  }

  const label = (text: string, req = false, hint?: string) => ({ label: text, required: req, hint });

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-white max-sm:bg-[#f4f6f8] max-sm:pb-3">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 sm:px-8">
        {isQuote ? (
          <div className="flex gap-6">
            <span className="relative py-2 text-xl font-semibold text-[#0b1f3a]">{editing ? "Edit Quote" : "Quote"}<span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-[#0f766e]" /></span>
            {!editing && <Link prefetch={false} href={`/dashboard/subscriptions/new${customerId ? `?customer=${customerId}` : ""}`} className="py-2 text-xl text-slate-500 transition-colors hover:text-[#0b1f3a]">Subscription Quote</Link>}
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[#0b1f3a]">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" strokeLinejoin="round" /></svg>
              {editing ? "Edit Invoice" : clone ? "Clone Invoice" : "New Invoice"}
            </h1>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              Use Simplified View
              <button type="button" role="switch" aria-checked={simple} onClick={toggleSimple} className={`relative h-5 w-9 rounded-full transition-colors ${simple ? "bg-[#2563eb]" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${simple ? "left-[18px]" : "left-0.5"}`} />
              </button>
            </label>
          </div>
        )}
        <Link prefetch={false} href={editing ? `${base}/${src!.id}` : base} aria-label="Close" className="group/x flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600">
          <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-300 group-hover/x:rotate-90" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
        </Link>
      </div>

      <div className="flex-1">
        {/* Cliente */}
        <div className="border-b border-slate-200 bg-[#fafbfc] px-5 py-6 sm:px-8 max-sm:mx-3 max-sm:mt-3 max-sm:rounded-2xl max-sm:border max-sm:border-slate-200 max-sm:bg-white max-sm:px-4 max-sm:shadow-[0_1px_4px_rgba(15,40,60,0.06)]">
          <div className="max-w-[1100px] space-y-4">
            <FormRow {...label("Customer Name", true)} htmlFor="d-cust" width="max-w-[560px]">
              <CustomerSelect id="d-cust" value={customerId} customers={customers} onChange={setCustomerId} />
              <div className="mt-1 flex flex-wrap items-center gap-x-4">
                <CustomerDrawer customerId={customerId || null} />
              </div>
            </FormRow>
            {customerId && (
              <div className="grid gap-4 lg:ml-[calc(10.5rem+1.5rem)] lg:max-w-[760px] lg:grid-cols-2">
                <div>
                  <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Billing Address</p>
                  {billing ? addressLines(snap(billing)).map((l, i) => <p key={i} className="text-[14px] text-slate-700">{l}</p>) : <p className="text-sm text-slate-400">No address on file</p>}
                </div>
                <div>
                  <p className="mb-1 flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                    Job Site
                    <Tip text="The house or building where the work happens. Builders often send jobs at different addresses: pick the right one so the document goes to that house." side="top"><span className="cursor-help"><InfoIcon /></span></Tip>
                  </p>
                  <SelectMenu value={siteId} ariaLabel="Job site" placeholder="Same as billing address"
                    options={[{ value: "", label: "Same as billing address" }, ...addresses.map((a) => ({ value: a.id, label: addrLabel(a) }))]} onChange={setSiteId} />
                  {site && <div className="mt-1.5">{addressLines(snap(site)).map((l, i) => <p key={i} className="text-[13px] text-slate-600">{l}</p>)}</div>}
                </div>
                {emailOpts.length > 0 && (
                  <div className="lg:col-span-2">
                    <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">E-mail To</p>
                    <div className="flex flex-wrap gap-2">
                      {emailOpts.map((e) => (
                        <label key={e} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${emails.includes(e) ? "border-[#14a39a] bg-white" : "border-slate-200 bg-white text-slate-500"}`}>
                          <input type="checkbox" checked={emails.includes(e)} onChange={() => setEmails((l) => (l.includes(e) ? l.filter((x) => x !== e) : [...l, e]))} className="h-4 w-4 accent-[#2563eb]" />{e}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5 border-b border-slate-200 px-5 py-6 sm:px-8 max-sm:mx-3 max-sm:mt-3 max-sm:rounded-2xl max-sm:border max-sm:border-slate-200 max-sm:bg-white max-sm:px-4 max-sm:shadow-[0_1px_4px_rgba(15,40,60,0.06)]">
          <div className="grid max-w-[1100px] gap-5">
            <FormRow {...label(isQuote ? "Quote#" : "Invoice#", true)} htmlFor="d-num" width="max-w-[340px]">
              <div className="relative">
                <input id="d-num" value={editing || !auto ? number : previewNumber(livePrefs, kind)} readOnly={!editing && auto}
                  onChange={(e) => setNumber(e.target.value)} className={`${inputClass} pr-11 ${!editing && auto ? "text-slate-600" : ""}`} />
                <button type="button" onClick={() => setNumModal(true)} aria-label="Number preferences" title="Configure number preferences"
                  className="group/g absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[#2563eb]">
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] transition-transform duration-500 group-hover/g:rotate-90" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
                </button>
              </div>
            </FormRow>
            {(isQuote || !simple) && (
              <FormRow {...label(isQuote ? "Reference#" : "Order Number", false, isQuote ? "Your own reference, like the builder's job number or PO." : "The customer's purchase order or job number.")} htmlFor="d-ref" width="max-w-[340px]">
                <input id="d-ref" value={isQuote ? reference : orderNo} onChange={(e) => (isQuote ? setReference(e.target.value) : setOrderNo(e.target.value))} className={inputClass} />
              </FormRow>
            )}
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <FormRow {...label(isQuote ? "Quote Date" : "Invoice Date", true)} width="max-w-[340px]">
                <DatePicker value={date} onChange={onDate} />
              </FormRow>
              {isQuote ? (
                <FormRow {...label("Expiry Date", false, "After this date the quote shows as Expired.")} width="max-w-[340px]">
                  <DatePicker value={expiry} onChange={setExpiry} minDate={date} placeholder="dd MMM yyyy" />
                </FormRow>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:pl-0">
                  <div className="flex items-center gap-3"><span className="w-12 shrink-0 text-[15px] text-slate-700">Terms</span><div className="min-w-0 flex-1"><SelectMenu value={terms} options={TERMS.map((t) => ({ value: t, label: t }))} onChange={onTerms} ariaLabel="Terms" /></div></div>
                  <div className="flex items-center gap-3"><span className="w-[4.5rem] shrink-0 text-[15px] text-slate-700">Due Date</span><div className="min-w-0 flex-1"><DatePicker value={due} onChange={(v) => { setDue(v); setTerms("Custom"); }} minDate={date} /></div></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {(isQuote || !simple) && (
          <div className="space-y-5 border-b border-slate-200 px-5 py-6 sm:px-8 max-sm:mx-3 max-sm:mt-3 max-sm:rounded-2xl max-sm:border max-sm:border-slate-200 max-sm:bg-white max-sm:px-4 max-sm:shadow-[0_1px_4px_rgba(15,40,60,0.06)]">
            <div className="grid max-w-[1100px] gap-5">
              <FormRow label="Salesperson" htmlFor="d-sp" width="max-w-[340px]">
                <Combobox immediate value={salesperson} onChange={(v: string | null) => v != null && setSalesperson(v)}>
                  <div className="relative">
                    <ComboboxInput id="d-sp" autoComplete="off" placeholder="Select or Add Salesperson" displayValue={(v: string) => v} onChange={(e) => setSalesperson(e.target.value)} className={`${inputClass} pr-10`} />
                    <ComboboxButton className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400"><Chevron /></ComboboxButton>
                  </div>
                  <ComboboxOptions anchor="bottom start" transition className={`${panelClass} w-[var(--input-width)]`}>
                    {[actor, ...salespeople].filter((v, i, a) => v && a.indexOf(v) === i).map((p) => <ComboboxOption key={p} value={p} className={optionClass}><span>{p}</span><Check /></ComboboxOption>)}
                  </ComboboxOptions>
                </Combobox>
              </FormRow>
              <div className="hidden sm:block"><FormRow label="Project Name" width="max-w-[340px]">
                <div className="relative">
                  <input disabled placeholder="Select a project" className={`${inputClass} cursor-not-allowed opacity-70`} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">Soon</span>
                </div>
                <p className="mt-1 text-[13px] text-slate-500">{customerId ? "Projects arrive with Time Tracking." : "Select a customer to associate a project."}</p>
              </FormRow></div>
              {mobile && !showSubject ? (
                <button type="button" onClick={() => setShowSubject(true)} className="text-left text-[14px] font-medium text-[#2563eb]">+ Add a subject</button>
              ) : (
                <FormRow label="Subject" htmlFor="d-subj" alignTop width="max-w-[460px]" hint={`Let your customer know what this ${noun} is for.`}>
                  <textarea id="d-subj" rows={2} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={`Let your customer know what this ${noun} is for`} className={inputClass} />
                </FormRow>
              )}
            </div>
          </div>
        )}

        {/* Artículos + totales */}
        <div className="px-5 py-6 sm:px-8 max-sm:mx-3 max-sm:mt-3 max-sm:rounded-2xl max-sm:border max-sm:border-slate-200 max-sm:bg-white max-sm:px-4 max-sm:shadow-[0_1px_4px_rgba(15,40,60,0.06)]">
          <div className="max-w-[1100px]">
            <LineItems lines={lines} setLines={setLines} items={items} />
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <label className="mb-1.5 block text-[15px] text-slate-700">Customer Notes</label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
                <p className="mt-1 text-[12px] text-slate-500">Will be displayed on the {noun.toLowerCase()}</p>
              </div>
              <div className="rounded-xl bg-[#f7f9fa] p-4">
                {(!compactTotals || showSummary) && (
                  <div className="space-y-3 text-[15px]">
                    <div className="flex justify-between font-semibold text-[#0b1f3a]"><span>Sub Total</span><span className="tabular-nums">{num2(grossOf(lines))}</span></div>
                    {grossOf(lines) - totals.subtotal > 0.004 && (
                      <div className="flex justify-between text-[14px]"><span className="text-slate-600">Item discounts</span><span className="tabular-nums text-[#e11d48]">(-) {num2(grossOf(lines) - totals.subtotal)}</span></div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-24 text-slate-700">Discount</span>
                      {couponObj ? (
                        <span className="flex flex-1 items-center gap-2 rounded-lg border border-[#14a39a] bg-white px-2.5 py-1.5 text-sm"><b className="text-[#0f766e]">{couponObj.code}</b><span className="text-slate-500">{couponObj.discount_type === "percent" ? `${+couponObj.discount_value}%` : `$${num2(couponObj.discount_value)}`}</span>
                          <button type="button" onClick={() => setCoupon("")} className="ml-auto text-slate-400 hover:text-red-600" aria-label="Remove coupon">×</button></span>
                      ) : (
                        <div className="flex flex-1 items-center gap-1.5">
                          <input inputMode="decimal" value={discValue} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setDiscValue(e.target.value.replace(/[^0-9.]/g, ""))} className={`${inputClass} !py-1.5 text-right`} />
                          <div className="w-20 shrink-0"><SelectMenu value={discType} options={[{ value: "percent", label: "%" }, { value: "flat", label: "$" }]} onChange={(v) => setDiscType(v as DiscType)} ariaLabel="Discount type" /></div>
                        </div>
                      )}
                      <span className={`w-24 text-right tabular-nums ${totals.discount > 0 ? "text-[#e11d48]" : "text-slate-600"}`}>(-) {num2(totals.discount)}</span>
                      {coupons.length > 0 && !couponObj && (
                        <Popover className="relative w-full">
                          <PopoverButton className="text-[13px] font-medium text-[#2563eb] hover:underline focus:outline-none">Apply a coupon</PopoverButton>
                          <PopoverPanel anchor="bottom start" className="z-[70] mt-1 w-64 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                            {({ close }) => <>{coupons.map((c) => (
                              <button key={c.id} type="button" onClick={() => { setCoupon(c.code); close(); }} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-[#f0faf7]">
                                <span><b className="text-[#0b1f3a]">{c.code}</b><span className="block text-xs text-slate-500">{c.name}</span></span><span className="text-[#0f766e]">{c.discount_type === "percent" ? `${+c.discount_value}%` : `$${num2(c.discount_value)}`}</span>
                              </button>))}</>}
                          </PopoverPanel>
                        </Popover>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input value={taxName} onChange={(e) => setTaxName(e.target.value)} placeholder="Tax" className={`${inputClass} !w-24 !py-1.5`} />
                      <div className="flex flex-1 items-center gap-1"><input inputMode="decimal" value={taxRate} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setTaxRate(e.target.value.replace(/[^0-9.]/g, ""))} className={`${inputClass} !py-1.5 text-right`} /><span className="text-slate-500">%</span></div>
                      <span className="w-24 text-right tabular-nums text-slate-600">{num2(totals.tax)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-24 text-slate-700">Shipping Charges</span>
                      <input inputMode="decimal" value={shipping} onChange={(e) => setShipping(e.target.value.replace(/[^0-9.\-]/g, ""))} className={`${inputClass} flex-1 !py-1.5 text-right`} />
                      <span className="w-24 text-right tabular-nums text-slate-600">{num2(totals.shipping)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input value={adjLabel} onChange={(e) => setAdjLabel(e.target.value)} className={`${inputClass} !w-24 border-dashed !py-1.5`} />
                      <input inputMode="decimal" value={adjustment} onChange={(e) => setAdjustment(e.target.value.replace(/[^0-9.\-]/g, ""))} placeholder="+/-" className={`${inputClass} flex-1 !py-1.5 text-right`} />
                      <span className="w-24 text-right tabular-nums text-slate-600">{num2(totals.adjustment)}</span>
                    </div>
                  </div>
                )}
                <div className={`flex justify-between text-[18px] font-semibold text-[#0b1f3a] ${(!compactTotals || showSummary) ? "mt-4 border-t border-slate-200 pt-4" : ""}`}><span>Total ( $ )</span><span className="tabular-nums">{num2(totals.total)}</span></div>
                {compactTotals && (
                  <button type="button" onClick={() => setShowSummary((v) => !v)} className="mt-2 flex w-full items-center justify-end gap-1 text-sm font-medium text-[#2563eb]">
                    {showSummary ? "Hide Total Summary" : "Show Total Summary"}<svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${showSummary ? "rotate-180" : ""}`} fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Términos y adjuntos */}
        <div className="border-t border-slate-200 bg-[#fafbfc] px-5 py-6 sm:px-8 max-sm:mx-3 max-sm:mt-3 max-sm:rounded-2xl max-sm:border max-sm:border-slate-200 max-sm:bg-white max-sm:px-4 max-sm:shadow-[0_1px_4px_rgba(15,40,60,0.06)]">
          {simple && !isQuote && !showTc ? (
            <div className="space-y-3">
              <button type="button" onClick={() => setShowTc(true)} className="flex items-center gap-2 text-[15px] text-[#0b1f3a]"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2563eb] text-white">+</span>Add Terms and conditions</button>
              <span className="flex items-center gap-2 text-[15px] text-slate-400"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-300 text-white">+</span>Add Payment Gateway <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">Soon</span></span>
            </div>
          ) : (
            <div className="grid max-w-[1100px] gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div>
                <label className="mb-1.5 block text-[15px] text-slate-700">Terms & Conditions</label>
                <textarea rows={4} value={tc} onChange={(e) => setTc(e.target.value)} placeholder="Enter the terms and conditions of your business to be displayed in your transaction" className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-[15px] text-slate-700">Attach File(s) to {noun}</label>
                <UploadChoices onFiles={(list) => {
                  const add = Array.from(list ?? []);
                  const max = isQuote ? 5 : 15;
                  if (files.length + add.length > max) return setError(`You can upload a maximum of ${max} files.`);
                  if (add.some((f) => f.size > 10 * 1024 * 1024)) return setError("Each file must be 10 MB or smaller.");
                  setFiles((l) => [...l, ...add]);
                }} />
                <p className="mt-1 text-[12px] text-slate-500">{isQuote ? "You can upload a maximum of 5 files, 10MB each" : "Up to 15 files, 10MB each. JPG/PNG job photos are added to the invoice PDF (4 per page, up to 12)."}</p>
                {files.map((f, i) => (
                  <p key={i} className="mt-1 flex items-center gap-2 text-sm text-slate-700">{f.name}<button type="button" onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} className="text-red-500 hover:underline">remove</button></p>
                ))}
              </div>
            </div>
          )}
          <p className="mt-6 hidden text-[13px] text-slate-500 sm:block"><b className="font-medium text-slate-600">Additional Fields:</b> custom fields for {noun.toLowerCase()}s are coming soon.</p>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-5 py-3 max-sm:flex-nowrap max-sm:gap-2 max-sm:px-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
        <button type="button" onClick={() => submit("draft")} disabled={!!saving} className={`${btnGhost} max-sm:px-3 max-sm:py-2 max-sm:text-[13px] max-sm:shrink-0`}>{saving === "draft" ? "Saving..." : editing ? "Save" : "Save as Draft"}</button>
        <div className="flex">
          <button type="button" onClick={() => submit("send")} disabled={!!saving} className={`${btnPrimary} rounded-r-none max-sm:px-3 max-sm:py-2 max-sm:text-[13px] max-sm:whitespace-nowrap`}>{saving === "send" ? "Saving..." : "Save and Send"}</button>
          <Menu>
            <MenuButton aria-label="More save options" className="group flex items-center rounded-r-lg border-l border-white/25 bg-[#0f766e] px-2 text-white hover:bg-[#0c5f59] focus:outline-none">
              <svg viewBox="0 0 20 20" className="h-4 w-4 rotate-180 transition-transform group-data-[open]:rotate-0" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
            </MenuButton>
            <MenuItems anchor="top end" transition className="z-[80] mb-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
              <MenuItem><button type="button" onClick={() => submit("sent")} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 data-[focus]:bg-[#e9f7f4] data-[focus]:text-[#0b1f3a]">Save and Mark as Sent</button></MenuItem>
            </MenuItems>
          </Menu>
        </div>
        <Link prefetch={false} href={editing ? `${base}/${src!.id}` : base} className={`${btnGhost} max-sm:px-3 max-sm:py-2 max-sm:text-[13px] max-sm:ml-auto max-sm:border-0 max-sm:bg-transparent`}>Cancel</Link>
        {error && <p role="alert" className="text-sm text-red-600 max-sm:fixed max-sm:inset-x-3 max-sm:bottom-16 max-sm:rounded-lg max-sm:bg-white max-sm:p-2 max-sm:shadow">{error}</p>}
        <span className="ml-auto hidden text-[13px] text-slate-500 sm:block">PDF Template: &apos;{tplOf(pdfOf(prefs.pdf_settings).template).name}&apos; <TemplatePicker kind={kind} /></span>
        {!isQuote && <span className="hidden text-[13px] text-slate-500 xl:block">Total Amount: <b className="text-[#0b1f3a]">${num2(totals.total)}</b> · Total Quantity: {round2(lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0))}</span>}
      </div>

      <NumberModal open={numModal} onClose={() => setNumModal(false)} kind={kind} companyId={companyId} prefs={livePrefs}
        onSaved={(p, isAuto) => { setLivePrefs(p); setAuto(isAuto); if (!isAuto && !editing) setNumber(""); }} />
    </div>
  );
}

const money2 = (v: number) => `$${num2(v)}`;

function TemplatePicker({ kind }: { kind: DocKind }) {
  return <Link prefetch={false} href={`/dashboard/settings/pdf-templates?for=${kind}`} target="_blank" className="font-medium text-[#2563eb] hover:underline">Change</Link>;
}
// "Configure Invoice Number Preferences" (el engranito del número)
function NumberModal({ open, onClose, kind, companyId, prefs, onSaved }: {
  open: boolean; onClose: () => void; kind: DocKind; companyId: string; prefs: SalesPrefs; onSaved: (p: SalesPrefs, auto: boolean) => void;
}) {
  const isQuote = kind === "quote";
  const [auto, setAuto] = useState(isQuote ? prefs.quote_auto : prefs.invoice_auto);
  const [prefix, setPrefix] = useState(isQuote ? prefs.quote_prefix : prefs.invoice_prefix);
  const [next, setNext] = useState(String(isQuote ? prefs.quote_next : prefs.invoice_next).padStart(6, "0"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setAuto(isQuote ? prefs.quote_auto : prefs.invoice_auto); setPrefix(isQuote ? prefs.quote_prefix : prefs.invoice_prefix);
    setNext(String(isQuote ? prefs.quote_next : prefs.invoice_next).padStart(6, "0")); setError("");
  }, [open, prefs, isQuote]);
  async function save() {
    const n = Math.max(1, Number(next.replace(/\D/g, "")) || 1);
    setBusy(true);
    const k = isQuote ? "quote" : "invoice";
    const patch = { [`${k}_prefix`]: prefix, [`${k}_next`]: n, [`${k}_auto`]: auto };
    const { error: e } = await db().from("sales_prefs").upsert({ company_id: companyId, ...patch, updated_at: new Date().toISOString() });
    setBusy(false);
    if (e) return setError("It couldn't be saved. Did you run the SQL for Paso 3.30?");
    onSaved({ ...prefs, ...patch } as SalesPrefs, auto);
    onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title={`Configure ${isQuote ? "Quote" : "Invoice"} Number Preferences`}
      footer={<><button type="button" onClick={save} disabled={busy} className={btnPrimary}>Save</button><button type="button" onClick={onClose} className={btnGhost}>Cancel</button>{error && <p className="text-sm text-red-600">{error}</p>}</>}>
      <p className="mb-4 text-[15px] text-slate-600">Your {isQuote ? "quote" : "invoice"} numbers are set on auto-generate mode to save your time. Are you sure about changing this setting?</p>
      <label className="flex cursor-pointer items-center gap-2.5 text-[15px] font-medium text-[#0b1f3a]"><input type="radio" checked={auto} onChange={() => setAuto(true)} className="h-4 w-4 accent-[#2563eb]" />Continue auto-generating {isQuote ? "quote" : "invoice"} numbers</label>
      {auto && (
        <div className="mt-3 grid grid-cols-[7rem_minmax(0,1fr)] gap-3 pl-6">
          <div><label className="mb-1 block text-[13px] text-slate-500">Prefix</label><input value={prefix} onChange={(e) => setPrefix(e.target.value.slice(0, 12))} className={inputClass} /></div>
          <div><label className="mb-1 block text-[13px] text-slate-500">Next Number</label><input inputMode="numeric" value={next} onChange={(e) => setNext(e.target.value.replace(/\D/g, ""))} className={inputClass} /></div>
        </div>
      )}
      <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[15px] text-slate-700"><input type="radio" checked={!auto} onChange={() => setAuto(false)} className="h-4 w-4 accent-[#2563eb]" />Enter {isQuote ? "quote" : "invoice"} numbers manually</label>
    </Modal>
  );
}
