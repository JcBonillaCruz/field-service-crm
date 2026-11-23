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
import { useTranslations } from "next-intl";
import { useSalesTx } from "@/i18n/useSalesTx";
import { DocTax, NO_TAX, SurchargePreset, TAX_COLS, TaxRate, TaxSetting, certExpired, rateLabel, resolveTax } from "@/lib/tax";
import type { Surcharge } from "@/lib/sales";
import { SaveTemplateModal, TemplateButton, TemplatePickerModal, useTemplates } from "@/components/templates/TemplatePicker";
import { WorkTemplate, depositAmount, linesToTpl, tplToLines } from "@/lib/templates";

type Addr = { id: string; label: string | null; street: string; unit: string | null; city: string; state: string | null; zip: string | null; country: string | null; is_primary: boolean } & TaxSetting;
const snap = (a?: Addr | null): AddressSnap => (a ? { label: a.label, street: a.street, unit: a.unit, city: a.city, state: a.state, zip: a.zip, country: a.country } : null);
const addrLabel = (a: Addr, billingL: string, siteL: string) => `${a.label || (a.is_primary ? billingL : siteL)} · ${[a.street, a.city].filter(Boolean).join(", ")}`;

export default function DocForm({ kind, companyId, actor, customers, items, coupons, salespeople, prefs, doc, lines: initLines, clone, presetCustomer, taxRates: ratesIn = [], taxSql = false, surchargePresets = [] }: {
  kind: DocKind; companyId: string; actor: string; customers: CustomerOption[]; items: ItemOption[]; coupons: CouponOption[]; salespeople: string[];
  prefs: SalesPrefs; doc?: SalesDoc | null; lines?: SalesLine[]; clone?: boolean; presetCustomer?: string;
  taxRates?: TaxRate[]; taxSql?: boolean; surchargePresets?: SurchargePreset[]; // Paso 6.9
}) {
  const tx = useTranslations("tax");
  const t = useTranslations("docForm");
  const tcm = useTranslations("common");
  const sx = useSalesTx();
  const num2 = sx.num2;
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
  // Paso 6.9: impuesto del documento (tasa / exento / sin impuesto) y de dónde salió
  const taxReady = taxSql;
  const [docTax, setDocTax] = useState<DocTax>(() => src
    ? src.tax_mode
      ? { mode: src.tax_mode, rate_id: src.tax_rate_id ?? null, name: src.tax_name, rate: Number(src.tax_rate) || 0, source: (src.tax_source as DocTax["source"]) || "manual", reason: src.tax_exempt_reason, cert_number: src.tax_cert_number }
      : Number(src.tax_rate) > 0 ? { mode: "rate", rate_id: null, name: src.tax_name || "Tax", rate: Number(src.tax_rate), source: "manual" } : { ...NO_TAX, source: "manual" }
    : { ...NO_TAX });
  const [custTax, setCustTax] = useState<{ id: string; tax: TaxSetting } | null>(null);
  const [taxRates, setTaxRates] = useState<TaxRate[]>(ratesIn);
  const [newRate, setNewRate] = useState(false);
  // Paso 6.9b: recargos (Trip charge, Distance fee…), aparte del impuesto
  const [surch, setSurch] = useState<Surcharge[]>(() => (src?.surcharges ?? []).map((x) => ({ name: x.name, kind: x.kind, value: Number(x.value) })));
  // Paso 6.9c: envío en $ o en % (del subtotal después del descuento)
  const [shipType, setShipType] = useState<"flat" | "percent">(src?.shipping_type === "percent" ? "percent" : "flat");
  const [shipping, setShipping] = useState(String(src?.shipping_type === "percent" ? src?.shipping_value ?? "" : src?.shipping ?? ""));
  const [adjLabel, setAdjLabel] = useState(src?.adjustment_label ?? "Adjustment");
  const [adjustment, setAdjustment] = useState(String(src?.adjustment ?? ""));
  const [notes, setNotes] = useState(src ? src.notes ?? "" : settings.default_notes ?? "");
  // Paso 6.10: depósito que pide la cotización (vacío o 0 = sin depósito)
  const [depType, setDepType] = useState<"percent" | "flat">(src?.deposit_type === "flat" ? "flat" : "percent");
  const [depValue, setDepValue] = useState(src?.deposit_type && Number(src.deposit_value) ? String(+Number(src.deposit_value)) : "");
  const [tplOpen, setTplOpen] = useState(false);
  const [saveTpl, setSaveTpl] = useState(false);
  const [tplMsg, setTplMsg] = useState("");
  const tpls = useTemplates("quote");
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
      const [{ data: a }, { data: e }, ct] = await Promise.all([
        s.from("customer_addresses").select("*").eq("customer_id", customerId).order("is_primary", { ascending: false }).order("created_at"),
        s.from("customer_emails").select("email, is_primary").eq("customer_id", customerId).order("position"),
        taxReady ? s.from("customers").select(TAX_COLS).eq("id", customerId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (!alive) return;
      setAddresses((a ?? []) as Addr[]);
      setCustTax({ id: customerId, tax: (ct.data ?? {}) as TaxSetting });
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
  // Paso 6.9: cada línea lleva la tasa del documento si su artículo es "Taxable" (líneas escritas a mano: sí)
  const itemTaxable = useMemo(() => new Map(items.map((i) => [i.id, i.taxable !== false])), [items]);
  const taxLines = useMemo(() => (taxReady ? lines.map((l) => {
    const taxable = !l.item_id || itemTaxable.get(l.item_id) !== false;
    return docTax.mode === "rate" && taxable ? { ...l, tax_rate_id: docTax.rate_id, tax_name: docTax.name, tax_rate: docTax.rate } : { ...l, tax_rate_id: null, tax_name: null, tax_rate: 0 };
  }) : lines), [lines, taxReady, docTax, itemTaxable]);
  const totals = useMemo(() => computeTotals(taxLines, {
    ...effDisc, shipping: Number(shipping) || 0, shipping_type: shipType, adjustment: Number(adjustment) || 0, surcharges: taxReady ? surch : [],
    ...(taxReady ? {} : { tax_rate: Number(taxRate) || 0, tax_name: taxName }),
  }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [taxLines, discValue, discType, coupon, taxRate, taxName, shipping, shipType, adjustment, surch]);

  // ---------- Paso 6.9: impuesto ----------
  // Exento del cliente o del Job Site (si aplica): se usa al quitar la casilla
  const siteRow = addresses.find((a) => a.id === siteId) ?? null;
  const resolved = custTax && custTax.id === customerId ? resolveTax(taxRates, custTax.tax, siteRow) : null;
  const exemptOf = resolved?.mode === "exempt" ? resolved : null;
  // Cliente o Job Site nuevo → casilla marcada con la tasa predeterminada (o exento). Al abrir uno guardado se respeta.
  const lastTaxKey = useRef<string | null>(null);
  useEffect(() => {
    if (!taxReady || !custTax || custTax.id !== customerId) return;
    const key = `${customerId}|${siteId}`;
    if (lastTaxKey.current === null && src && src.customer_id === customerId && (src.address_id ?? "") === siteId) { lastTaxKey.current = key; return; }
    if (lastTaxKey.current === key) return;
    lastTaxKey.current = key;
    if (resolved) setDocTax(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custTax, siteId, addresses, taxReady]);
  const activeRates = taxRates.filter((r) => r.is_active);
  const legacyKey = docTax.mode === "rate" && !activeRates.some((r) => r.id === docTax.rate_id) ? `c:${docTax.name ?? "Tax"}:${docTax.rate}` : null;
  const rateOpts = [
    ...activeRates.map((r) => ({ value: r.id, label: `${rateLabel(r)}${r.is_default ? ` · ${tx("default")}` : ""}` })),
    ...(legacyKey ? [{ value: legacyKey, label: rateLabel({ name: docTax.name || "Tax", rate: docTax.rate }) }] : []),
    { value: "__new", label: tx("newRateOpt"), divider: true },
  ];
  const charging = docTax.mode === "rate";
  const [lastRate, setLastRate] = useState<string | null>(null);
  function setCharge(on: boolean) {
    if (!on) return setDocTax(exemptOf ?? { ...NO_TAX, source: "manual" });
    const r = activeRates.find((x) => x.id === lastRate) ?? activeRates.find((x) => x.is_default) ?? activeRates[0];
    if (!r) return setNewRate(true);
    setDocTax({ mode: "rate", rate_id: r.id, name: r.name, rate: Number(r.rate), source: "manual" });
  }
  function pickRate(k: string) {
    if (k === "__new") return setNewRate(true);
    const r = activeRates.find((x) => x.id === k);
    if (!r) return;
    setLastRate(r.id);
    setDocTax({ mode: "rate", rate_id: r.id, name: r.name, rate: Number(r.rate), source: "manual" });
  }
  const exemptInfo = (x: DocTax | null) => (x ? [x.reason ? tx(`r.${x.reason}`) : "", x.cert_number ? tx("certShort", { cert: x.cert_number }) : ""].filter(Boolean).join(" · ") : "");
  const addSurch = (x: Surcharge) => setSurch((l) => [...l, x]);
  const setSurchAt = (i: number, patch: Partial<Surcharge>) => setSurch((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  // Paso 6.10: aplicar una plantilla (las líneas vacías se reemplazan; las que ya escribiste se quedan)
  function applyTemplate(tp: WorkTemplate) {
    const kept = lines.filter((l) => l.name.trim() || Number(l.rate) || l.item_id);
    setLines([...kept, ...tplToLines(tp, kept.length)].map((l, i) => ({ ...l, position: i })));
    if (tp.subject && !subject.trim()) { setSubject(tp.subject); setShowSubject(true); }
    if (tp.notes && (!notes.trim() || notes === (settings.default_notes ?? ""))) setNotes(tp.notes);
    if (tp.terms && !tc.trim()) { setTc(tp.terms); setShowTc(true); }
    if (isQuote && tp.deposit_type && tp.deposit_value > 0) { setDepType(tp.deposit_type); setDepValue(String(+tp.deposit_value)); }
    setTplMsg(t("tplApplied", { name: tp.name }));
    setTimeout(() => setTplMsg(""), 2600);
  }
  const depAmount = isQuote ? depositAmount(totals.total, depType, Number(depValue) || 0) : 0;

  function onTerms(v: string) { setTerms(v); if (v !== "Custom") setDue(dueFromTerms(date, v)); }
  function onDate(d: string) { setDate(d); if (!isQuote && terms !== "Custom") setDue(dueFromTerms(d, terms)); }

  async function submit(mode: "draft" | "send" | "sent") {
    setError("");
    if (!customerId) return setError(t("eCustomer"));
    if (!auto && !editing && !number.trim()) return setError(t("eNumber", { kind }));
    if (editing && !number.trim()) return setError(t("eNumber", { kind }));
    // Paso 6.9: cada línea guarda su impuesto (en un documento exento, ninguna lleva)
    const real = taxLines.map((l, i) => (taxReady ? { ...l, tax_amount: totals.lineTax[i] ?? 0 } : l))
      .filter((l) => l.name.trim() || Number(l.rate) || l.item_id);
    if (!real.length) return setError(t("eItems"));
    if (real.some((l) => !l.name.trim())) return setError(t("eLineName"));
    if (isQuote && expiry && expiry < date) return setError(t("eExpiry"));
    setSaving(mode);
    const supabase = db();
    let num = number.trim();
    if (!editing && auto) {
      const n = await nextNumber(companyId, kind);
      if (!n) { setSaving(""); return setError(t("eGen")); }
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
      ...(taxReady ? {
        tax_mode: docTax.mode, tax_rate_id: docTax.mode === "rate" ? docTax.rate_id : null, tax_source: docTax.source,
        tax_name: docTax.mode === "rate" ? docTax.name : docTax.mode === "exempt" ? "Exempt" : null, tax_rate: docTax.mode === "rate" ? docTax.rate : 0,
        tax_exempt_reason: docTax.mode === "exempt" ? docTax.reason ?? null : null, tax_cert_number: docTax.mode === "exempt" ? docTax.cert_number?.trim() || null : null,
        tax_breakdown: totals.taxes,
        surcharges: totals.surcharges.filter((x) => x.name.trim() && x.amount !== 0).map((x) => ({ ...x, name: x.name.trim() })), surcharge_total: totals.surchargeTotal,
      } : { tax_name: taxName.trim() || null, tax_rate: Number(taxRate) || 0 }),
      tax_amount: totals.tax, shipping: totals.shipping,
      // Paso 6.9c (SQL 6.9c): solo se manda si el envío es en % o si la columna ya existe
      ...(shipType === "percent" || (src && "shipping_type" in src) ? { shipping_type: shipType, shipping_value: Number(shipping) || 0 } : {}),
      adjustment: totals.adjustment, adjustment_label: adjLabel.trim() || "Adjustment", subtotal: totals.subtotal, total: totals.total,
      notes: notes.trim() || null, terms: tc.trim() || null, updated_at: now,
      // Paso 6.10: depósito (solo si lo pidieron o ya estaba guardado; sin el SQL 6.10 se guarda sin él)
      ...(isQuote && (Number(depValue) > 0 || src?.deposit_type) ? { deposit_type: Number(depValue) > 0 ? depType : null, deposit_value: Number(depValue) > 0 ? round2(Number(depValue)) : 0 } : {}),
    };
    const noDep = (e: { message?: string } | null) => Boolean(e && /deposit_/i.test(e.message ?? ""));
    const strip = (r: Record<string, unknown>) => { const { deposit_type: _a, deposit_value: _b, ...rest } = r; return rest; };
    let id = editing ? src!.id : "";
    if (editing) {
      const upd = { ...row, number: num, ...(mode === "sent" && src!.status === "draft" ? { status: "sent", sent_at: now } : {}) };
      let { error: e } = await supabase.from("sales_docs").update(upd).eq("id", id);
      if (noDep(e)) ({ error: e } = await supabase.from("sales_docs").update(strip(upd)).eq("id", id));
      if (e) { setSaving(""); return setError(e.code === "23505" ? t("eDup", { kind, num }) : t("eSave", { kind })); }
    } else {
      const ins = { ...row, company_id: companyId, kind, number: num, status: mode === "sent" ? "sent" : "draft", sent_at: mode === "sent" ? now : null, created_by_name: actor };
      let { data, error: e } = await supabase.from("sales_docs").insert(ins).select("id").single();
      if (noDep(e)) ({ data, error: e } = await supabase.from("sales_docs").insert(strip(ins)).select("id").single());
      if (e || !data) { setSaving(""); return setError(e?.code === "23505" ? t("eDup", { kind, num }) : t("eSaveSql", { kind })); }
      id = data.id;
    }
    const le = await saveLines(companyId, { doc_id: id }, real);
    if (le) { setSaving(""); return setError(t("eLines")); }
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
            <span className="relative py-2 text-xl font-semibold text-[#0b1f3a]">{editing ? t("editQuote") : t("quote")}<span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-[#0f766e]" /></span>
            {!editing && <Link prefetch={false} href={`/dashboard/subscriptions/new${customerId ? `?customer=${customerId}` : ""}`} className="py-2 text-xl text-slate-500 transition-colors hover:text-[#0b1f3a]">{t("subQuote")}</Link>}
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[#0b1f3a]">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" strokeLinejoin="round" /></svg>
              {editing ? t("editInvoice") : clone ? t("cloneInvoice") : t("newInvoice")}
            </h1>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              {t("simple")}
              <button type="button" role="switch" aria-checked={simple} onClick={toggleSimple} className={`relative h-5 w-9 rounded-full transition-colors ${simple ? "bg-[#2563eb]" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${simple ? "left-[18px]" : "left-0.5"}`} />
              </button>
            </label>
          </div>
        )}
        <Link prefetch={false} href={editing ? `${base}/${src!.id}` : base} aria-label={tcm("close")} className="group/x flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600">
          <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-300 group-hover/x:rotate-90" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
        </Link>
      </div>

      <div className="flex-1">
        {/* Cliente */}
        <div className="border-b border-slate-200 bg-[#fafbfc] px-5 py-6 sm:px-8 max-sm:mx-3 max-sm:mt-3 max-sm:rounded-2xl max-sm:border max-sm:border-slate-200 max-sm:bg-white max-sm:px-4 max-sm:shadow-[0_1px_4px_rgba(15,40,60,0.06)]">
          <div className="max-w-[1100px] space-y-4">
            <FormRow {...label(t("customer"), true)} htmlFor="d-cust" width="max-w-[560px]">
              <CustomerSelect id="d-cust" value={customerId} customers={customers} onChange={setCustomerId} />
              <div className="mt-1 flex flex-wrap items-center gap-x-4">
                <CustomerDrawer customerId={customerId || null} />
              </div>
            </FormRow>
            {customerId && (
              <div className="grid gap-4 lg:ml-[calc(10.5rem+1.5rem)] lg:max-w-[760px] lg:grid-cols-2">
                <div>
                  <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("billingAddr")}</p>
                  {billing ? addressLines(snap(billing)).map((l, i) => <p key={i} className="text-[14px] text-slate-700">{l}</p>) : <p className="text-sm text-slate-400">{t("noAddr")}</p>}
                </div>
                <div>
                  <p className="mb-1 flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                    {t("jobSite")}
                    <Tip text={t("jobSiteTip")} side="top"><span className="cursor-help"><InfoIcon /></span></Tip>
                  </p>
                  <SelectMenu value={siteId} ariaLabel={t("jobSite")} placeholder={t("sameBilling")}
                    options={[{ value: "", label: t("sameBilling") }, ...addresses.map((a) => ({ value: a.id, label: addrLabel(a, t("billingL"), t("siteL")) }))]} onChange={setSiteId} />
                  {site && <div className="mt-1.5">{addressLines(snap(site)).map((l, i) => <p key={i} className="text-[13px] text-slate-600">{l}</p>)}</div>}
                </div>
                {emailOpts.length > 0 && (
                  <div className="lg:col-span-2">
                    <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("emailTo")}</p>
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
            <FormRow {...label(isQuote ? t("quoteNo") : t("invoiceNo"), true)} htmlFor="d-num" width="max-w-[340px]">
              <div className="relative">
                <input id="d-num" value={editing || !auto ? number : previewNumber(livePrefs, kind)} readOnly={!editing && auto}
                  onChange={(e) => setNumber(e.target.value)} className={`${inputClass} pr-11 ${!editing && auto ? "text-slate-600" : ""}`} />
                <button type="button" onClick={() => setNumModal(true)} aria-label={t("numPrefs")} title={t("numPrefsTip")}
                  className="group/g absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[#2563eb]">
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] transition-transform duration-500 group-hover/g:rotate-90" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
                </button>
              </div>
            </FormRow>
            {(isQuote || !simple) && (
              <FormRow {...label(isQuote ? t("reference") : t("order"), false, isQuote ? t("referenceHint") : t("orderHint"))} htmlFor="d-ref" width="max-w-[340px]">
                <input id="d-ref" value={isQuote ? reference : orderNo} onChange={(e) => (isQuote ? setReference(e.target.value) : setOrderNo(e.target.value))} className={inputClass} />
              </FormRow>
            )}
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <FormRow {...label(isQuote ? t("quoteDate") : t("invoiceDate"), true)} width="max-w-[340px]">
                <DatePicker value={date} onChange={onDate} />
              </FormRow>
              {isQuote ? (
                <FormRow {...label(t("expiry"), false, t("expiryHint"))} width="max-w-[340px]">
                  <DatePicker value={expiry} onChange={setExpiry} minDate={date} placeholder={t("datePh")} />
                </FormRow>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:pl-0">
                  <div className="flex items-center gap-3"><span className="w-12 shrink-0 text-[15px] text-slate-700">{t("terms")}</span><div className="min-w-0 flex-1"><SelectMenu value={terms} options={TERMS.map((x) => ({ value: x, label: sx.term(x) }))} onChange={onTerms} ariaLabel={t("terms")} /></div></div>
                  <div className="flex items-center gap-3"><span className="w-[4.5rem] shrink-0 text-[15px] text-slate-700">{t("dueDate")}</span><div className="min-w-0 flex-1"><DatePicker value={due} onChange={(v) => { setDue(v); setTerms("Custom"); }} minDate={date} /></div></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {(isQuote || !simple) && (
          <div className="space-y-5 border-b border-slate-200 px-5 py-6 sm:px-8 max-sm:mx-3 max-sm:mt-3 max-sm:rounded-2xl max-sm:border max-sm:border-slate-200 max-sm:bg-white max-sm:px-4 max-sm:shadow-[0_1px_4px_rgba(15,40,60,0.06)]">
            <div className="grid max-w-[1100px] gap-5">
              <FormRow label={t("salesperson")} htmlFor="d-sp" width="max-w-[340px]">
                <Combobox immediate value={salesperson} onChange={(v: string | null) => v != null && setSalesperson(v)}>
                  <div className="relative">
                    <ComboboxInput id="d-sp" autoComplete="off" placeholder={t("salespersonPh")} displayValue={(v: string) => v} onChange={(e) => setSalesperson(e.target.value)} className={`${inputClass} pr-10`} />
                    <ComboboxButton className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400"><Chevron /></ComboboxButton>
                  </div>
                  <ComboboxOptions anchor="bottom start" transition className={`${panelClass} w-[var(--input-width)]`}>
                    {[actor, ...salespeople].filter((v, i, a) => v && a.indexOf(v) === i).map((p) => <ComboboxOption key={p} value={p} className={optionClass}><span>{p}</span><Check /></ComboboxOption>)}
                  </ComboboxOptions>
                </Combobox>
              </FormRow>
              {mobile && !showSubject ? (
                <button type="button" onClick={() => setShowSubject(true)} className="text-left text-[14px] font-medium text-[#2563eb]">{t("addSubject")}</button>
              ) : (
                <FormRow label={t("subject")} htmlFor="d-subj" alignTop width="max-w-[460px]" hint={t("subjectHint", { kind })}>
                  <textarea id="d-subj" rows={2} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("subjectHint", { kind })} className={inputClass} />
                </FormRow>
              )}
            </div>
          </div>
        )}

        {/* Artículos + totales */}
        <div className="px-5 py-6 sm:px-8 max-sm:mx-3 max-sm:mt-3 max-sm:rounded-2xl max-sm:border max-sm:border-slate-200 max-sm:bg-white max-sm:px-4 max-sm:shadow-[0_1px_4px_rgba(15,40,60,0.06)]">
          <div className="max-w-[1100px]">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <TemplateButton onClick={() => setTplOpen(true)} count={tpls.list?.length || undefined} />
              {tplMsg && <span role="status" className="text-[13px] font-medium text-[#0f766e] animate-[bp-fade_0.2s_ease-out]">{tplMsg}</span>}
            </div>
            <LineItems lines={lines} setLines={setLines} items={items} />
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <label className="mb-1.5 block text-[15px] text-slate-700">{t("notes")}</label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
                <p className="mt-1 text-[12px] text-slate-500">{t("notesHint", { kind })}</p>
              </div>
              <div className="min-w-0 rounded-xl bg-[#f7f9fa] p-4">
                {(!compactTotals || showSummary) && (
                  <div className="space-y-3.5 text-[15px]">
                    <div className="flex justify-between font-semibold text-[#0b1f3a]"><span>{t("subtotal")}</span><span className="tabular-nums">{num2(grossOf(lines))}</span></div>
                    {grossOf(lines) - totals.subtotal > 0.004 && (
                      <div className="flex justify-between text-[14px]"><span className="text-slate-600">{t("itemDisc")}</span><span className="tabular-nums text-[#e11d48]">(-) {num2(grossOf(lines) - totals.subtotal)}</span></div>
                    )}
                    {/* Paso 6.9c: cada renglón = etiqueta · campo · monto (en el celular el campo baja a su propia línea) */}
                    <TotRow label={t("discount")} amount={<span className={totals.discount > 0 ? "text-[#e11d48]" : ""}>(-) {num2(totals.discount)}</span>}
                      after={coupons.length > 0 && !couponObj ? (
                        <Popover className="relative">
                          <PopoverButton className="text-[13px] font-medium text-[#2563eb] hover:underline focus:outline-none">{t("applyCoupon")}</PopoverButton>
                          <PopoverPanel anchor="bottom start" className="z-[70] mt-1 w-64 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                            {({ close }) => <>{coupons.map((c) => (
                              <button key={c.id} type="button" onClick={() => { setCoupon(c.code); close(); }} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-[#f0faf7]">
                                <span><b className="text-[#0b1f3a]">{c.code}</b><span className="block text-xs text-slate-500">{c.name}</span></span><span className="text-[#0f766e]">{c.discount_type === "percent" ? `${+c.discount_value}%` : `$${num2(c.discount_value)}`}</span>
                              </button>))}</>}
                          </PopoverPanel>
                        </Popover>
                      ) : null}>
                      {couponObj ? (
                        <span className="flex items-center gap-2 rounded-lg border border-[#14a39a] bg-white px-2.5 py-1.5 text-sm"><b className="text-[#0f766e]">{couponObj.code}</b><span className="text-slate-500">{couponObj.discount_type === "percent" ? `${+couponObj.discount_value}%` : `$${num2(couponObj.discount_value)}`}</span>
                          <button type="button" onClick={() => setCoupon("")} className="ml-auto text-slate-400 hover:text-red-600" aria-label={t("removeCoupon")}>×</button></span>
                      ) : (
                        <AmountKind value={discValue} onValue={setDiscValue} kind={discType === "flat" ? "flat" : "percent"} onKind={(k) => setDiscType(k === "flat" ? "flat" : "percent")} label={t("discType")} />
                      )}
                    </TotRow>
                    {taxReady ? (
                      <>
                        {/* Recargos: Trip charge, Distance fee… (no son impuesto) */}
                        {surch.map((x, i) => (
                          <TotRow key={i} amount={num2(totals.surcharges[i]?.amount ?? 0)} onRemove={() => setSurch((l) => l.filter((_, j) => j !== i))} removeLabel={tx("remove")}
                            label={<LabelInput value={x.name} onChange={(v) => setSurchAt(i, { name: v })} placeholder={tx("surchName")} />}>
                            <AmountKind value={String(x.value)} onValue={(v) => setSurchAt(i, { value: v as unknown as number })} kind={x.kind} onKind={(k) => setSurchAt(i, { kind: k })} label={tx("surchType")} />
                          </TotRow>
                        ))}
                        <Popover className="relative">
                          <PopoverButton className="flex items-center gap-1.5 text-[13px] font-medium text-[#2563eb] hover:underline focus:outline-none">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2563eb] text-white"><svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M10 5v10M5 10h10" /></svg></span>{tx("addSurch")}
                          </PopoverButton>
                          <PopoverPanel anchor="bottom start" className="z-[70] mt-1 w-64 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                            {({ close }) => <>
                              {surchargePresets.filter((p) => p.is_active).map((p) => (
                                <button key={p.id} type="button" onClick={() => { addSurch({ name: p.name, kind: p.kind, value: p.value }); close(); }} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-[#f0faf7]">
                                  <span className="text-[#0b1f3a]">{p.name}</span><span className="text-[#0f766e]">{p.kind === "percent" ? `${+p.value}%` : `$${num2(p.value)}`}</span>
                                </button>))}
                              <button type="button" onClick={() => { addSurch({ name: "", kind: "flat", value: 0 }); close(); }} className="block w-full border-t border-slate-100 px-4 py-2 text-left text-sm text-[#0f766e] hover:bg-[#f0faf7]">{tx("customSurch")}</button>
                              <Link prefetch={false} href="/dashboard/settings/taxes#surcharges" target="_blank" className="block px-4 py-2 text-[12.5px] text-slate-500 hover:text-[#2563eb]">{tx("manageSurch")}</Link>
                            </>}
                          </PopoverPanel>
                        </Popover>

                        {/* Impuesto: casilla + tasa (la predeterminada ya elegida) */}
                        <TotRow amount={num2(totals.tax)}
                          label={<label className="flex cursor-pointer items-center gap-2 text-slate-700"><input type="checkbox" checked={charging} onChange={(e) => setCharge(e.target.checked)} className="h-4 w-4 rounded accent-[#0f766e]" />{t("tax")}</label>}
                          after={<>
                            {docTax.mode === "exempt" && (
                              <p className="text-[12.5px] text-[#b45309]">
                                {docTax.source === "site" ? tx("siteExempt") : tx("custExempt")}{exemptInfo(docTax) && ` · ${exemptInfo(docTax)}`}
                                {certExpired(docTax.cert_expires) && <span className="block font-medium">{tx("certExpiredDoc")}</span>}
                              </p>
                            )}
                            {charging && exemptOf && <p className="text-[12.5px] font-medium text-[#b45309]">{tx("chargingExempt")}</p>}
                            {charging && lines.some((l) => l.item_id && itemTaxable.get(l.item_id) === false) && <p className="text-[12.5px] text-slate-500">{tx("someNotTaxable")}</p>}
                            {!activeRates.length && <button type="button" onClick={() => setNewRate(true)} className="text-[12.5px] font-medium text-[#2563eb] hover:underline">{tx("addFirstRate")}</button>}
                          </>}>
                          {charging ? (
                            <SelectMenu value={docTax.rate_id ?? legacyKey ?? ""} ariaLabel={t("tax")} onChange={pickRate} options={rateOpts} />
                          ) : (
                            <button type="button" onClick={() => setCharge(true)} className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-left text-[14px] text-slate-500 transition-colors hover:border-[#14a39a] hover:text-[#0f766e]">
                              {docTax.mode === "exempt" ? <span className="font-medium text-[#b45309]">{tx("exempt")}</span> : tx("chargeTax")}
                            </button>
                          )}
                        </TotRow>
                      </>
                    ) : (
                      <TotRow amount={num2(totals.tax)} label={<LabelInput value={taxName} onChange={setTaxName} placeholder={t("tax")} />}>
                        <div className="flex items-center gap-1"><input inputMode="decimal" value={taxRate} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setTaxRate(e.target.value.replace(/[^0-9.]/g, ""))} className={`${inputClass} !py-2 text-right`} /><span className="text-slate-500">%</span></div>
                      </TotRow>
                    )}
                    <TotRow label={t("shipping")} amount={num2(totals.shipping)}>
                      <AmountKind value={shipping} onValue={setShipping} kind={shipType} onKind={setShipType} label={t("shipType")} />
                    </TotRow>
                    <TotRow label={<LabelInput value={adjLabel} onChange={setAdjLabel} placeholder={t("adjustment")} />} amount={num2(totals.adjustment)}>
                      <input inputMode="decimal" value={adjustment} onChange={(e) => setAdjustment(e.target.value.replace(/[^0-9.\-]/g, ""))} placeholder="+/-" aria-label={adjLabel || t("adjustment")} className={`${inputClass} !py-2 text-right`} />
                    </TotRow>
                  </div>
                )}
                <div className={`flex justify-between text-[18px] font-semibold text-[#0b1f3a] ${(!compactTotals || showSummary) ? "mt-4 border-t border-slate-200 pt-4" : ""}`}><span>{t("total")}</span><span className="tabular-nums">{num2(totals.total)}</span></div>
                {/* Paso 6.10: depósito al aceptar (ej. 50% al aceptar y 50% al terminar) */}
                {isQuote && (
                  <div className="mt-4 space-y-1.5 border-t border-dashed border-slate-200 pt-4 text-[15px]">
                    <TotRow label={t("deposit")}
                      amount={<span className={depAmount > 0 ? "font-semibold text-[#0b1f3a]" : ""}>{num2(depAmount)}</span>}>
                      <AmountKind value={depValue} onValue={setDepValue} kind={depType} onKind={setDepType} label={t("depositType")} />
                    </TotRow>
                    <p className="text-right text-[13px] text-slate-500">{depAmount > 0 ? t("depositRest", { amount: num2(round2(totals.total - depAmount)) }) : t("depositTip")}</p>
                  </div>
                )}
                {compactTotals && (
                  <button type="button" onClick={() => setShowSummary((v) => !v)} className="mt-2 flex w-full items-center justify-end gap-1 text-sm font-medium text-[#2563eb]">
                    {showSummary ? t("hideSummary") : t("showSummary")}<svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${showSummary ? "rotate-180" : ""}`} fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
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
              <button type="button" onClick={() => setShowTc(true)} className="flex items-center gap-2 text-[15px] text-[#0b1f3a]"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2563eb] text-white">+</span>{t("addTc")}</button>
            </div>
          ) : (
            <div className="grid max-w-[1100px] gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div>
                <label className="mb-1.5 block text-[15px] text-slate-700">{t("tc")}</label>
                <textarea rows={4} value={tc} onChange={(e) => setTc(e.target.value)} placeholder={t("tcPh")} className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-[15px] text-slate-700">{t("attach", { kind })}</label>
                <UploadChoices onFiles={(list) => {
                  const add = Array.from(list ?? []);
                  const max = isQuote ? 5 : 15;
                  if (files.length + add.length > max) return setError(t("eMaxFiles", { max }));
                  if (add.some((f) => f.size > 10 * 1024 * 1024)) return setError(t("eFileSize"));
                  setFiles((l) => [...l, ...add]);
                }} />
                <p className="mt-1 text-[12px] text-slate-500">{isQuote ? t("filesQuote") : t("filesInvoice")}</p>
                {files.map((f, i) => (
                  <p key={i} className="mt-1 flex items-center gap-2 text-sm text-slate-700">{f.name}<button type="button" onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} className="text-red-500 hover:underline">{t("remove")}</button></p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-5 py-3 max-sm:flex-nowrap max-sm:gap-2 max-sm:px-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
        <button type="button" onClick={() => submit("draft")} disabled={!!saving} className={`${btnGhost} max-sm:px-3 max-sm:py-2 max-sm:text-[13px] max-sm:shrink-0`}>{saving === "draft" ? tcm("saving") : editing ? tcm("save") : t("saveDraft")}</button>
        <div className="flex">
          <button type="button" onClick={() => submit("send")} disabled={!!saving} className={`${btnPrimary} rounded-r-none max-sm:px-3 max-sm:py-2 max-sm:text-[13px] max-sm:whitespace-nowrap`}>{saving === "send" ? tcm("saving") : t("saveSend")}</button>
          <Menu>
            <MenuButton aria-label={t("moreSave")} className="group flex items-center rounded-r-lg border-l border-white/25 bg-[#0f766e] px-2 text-white hover:bg-[#0c5f59] focus:outline-none">
              <svg viewBox="0 0 20 20" className="h-4 w-4 rotate-180 transition-transform group-data-[open]:rotate-0" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
            </MenuButton>
            <MenuItems anchor="top end" transition className="z-[80] mb-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
              <MenuItem><button type="button" onClick={() => submit("sent")} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 data-[focus]:bg-[#e9f7f4] data-[focus]:text-[#0b1f3a]">{t("saveSent")}</button></MenuItem>
              {isQuote && <MenuItem><button type="button" onClick={() => setSaveTpl(true)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 data-[focus]:bg-[#e9f7f4] data-[focus]:text-[#0b1f3a]">{t("saveTpl")}</button></MenuItem>}
            </MenuItems>
          </Menu>
        </div>
        <Link prefetch={false} href={editing ? `${base}/${src!.id}` : base} className={`${btnGhost} max-sm:px-3 max-sm:py-2 max-sm:text-[13px] max-sm:ml-auto max-sm:border-0 max-sm:bg-transparent`}>{tcm("cancel")}</Link>
        {error && <p role="alert" className="text-sm text-red-600 max-sm:fixed max-sm:inset-x-3 max-sm:bottom-16 max-sm:rounded-lg max-sm:bg-white max-sm:p-2 max-sm:shadow">{error}</p>}
        <span className="ml-auto hidden text-[13px] text-slate-500 sm:block">{t("pdfTpl", { name: tplOf(pdfOf(prefs.pdf_settings).template).name })} <TemplatePicker kind={kind} /></span>
        {!isQuote && <span className="hidden text-[13px] text-slate-500 xl:block">{t.rich("footTotals", { amount: `$${num2(totals.total)}`, qty: round2(lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0)), b: (c) => <b className="text-[#0b1f3a]">{c}</b> })}</span>}
      </div>

      {taxReady && <NewRateModal open={newRate} onClose={() => setNewRate(false)} companyId={companyId} first={!taxRates.length}
        onSaved={(r) => { setTaxRates((l) => [...l, r]); setLastRate(r.id); setDocTax({ mode: "rate", rate_id: r.id, name: r.name, rate: r.rate, source: "manual" }); }} />}
      <TemplatePickerModal open={tplOpen} onClose={() => setTplOpen(false)} use="quote" list={tpls.list} needsSql={tpls.needsSql} onPick={applyTemplate} manageHref="/dashboard/settings/templates" />
      {isQuote && <SaveTemplateModal open={saveTpl} onClose={() => setSaveTpl(false)} companyId={companyId} actor={actor}
        onSaved={(name) => { setTplMsg(t("tplSaved", { name })); setTimeout(() => setTplMsg(""), 2600); }}
        data={{ lines: linesToTpl(lines), subject: subject.trim() || null, notes: notes.trim() || null, terms: tc.trim() || null, deposit_type: Number(depValue) > 0 ? depType : null, deposit_value: Number(depValue) > 0 ? round2(Number(depValue)) : 0 }} />}
      <NumberModal open={numModal} onClose={() => setNumModal(false)} kind={kind} companyId={companyId} prefs={livePrefs}
        onSaved={(p, isAuto) => { setLivePrefs(p); setAuto(isAuto); if (!isAuto && !editing) setNumber(""); }} />
    </div>
  );
}

const money2 = (v: number) => `$${num2(v)}`; // el historial se guarda en inglés (se traduce al mostrarlo)

function TemplatePicker({ kind }: { kind: DocKind }) {
  const t = useTranslations("docForm");
  return <Link prefetch={false} href={`/dashboard/settings/pdf-templates?for=${kind}`} target="_blank" className="font-medium text-[#2563eb] hover:underline">{t("change")}</Link>;
}
// "Configure Invoice Number Preferences" (el engranito del número)
function NumberModal({ open, onClose, kind, companyId, prefs, onSaved }: {
  open: boolean; onClose: () => void; kind: DocKind; companyId: string; prefs: SalesPrefs; onSaved: (p: SalesPrefs, auto: boolean) => void;
}) {
  const t = useTranslations("docForm");
  const tcm = useTranslations("common");
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
    if (e) return setError(t("eNumSave"));
    onSaved({ ...prefs, ...patch } as SalesPrefs, auto);
    onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title={t("numTitle", { kind })}
      footer={<><button type="button" onClick={save} disabled={busy} className={btnPrimary}>{tcm("save")}</button><button type="button" onClick={onClose} className={btnGhost}>{tcm("cancel")}</button>{error && <p className="text-sm text-red-600">{error}</p>}</>}>
      <p className="mb-4 text-[15px] text-slate-600">{t("numIntro", { kind })}</p>
      <label className="flex cursor-pointer items-center gap-2.5 text-[15px] font-medium text-[#0b1f3a]"><input type="radio" checked={auto} onChange={() => setAuto(true)} className="h-4 w-4 accent-[#2563eb]" />{t("numAuto", { kind })}</label>
      {auto && (
        <div className="mt-3 grid grid-cols-[7rem_minmax(0,1fr)] gap-3 pl-6">
          <div><label className="mb-1 block text-[13px] text-slate-500">{t("prefix")}</label><input value={prefix} onChange={(e) => setPrefix(e.target.value.slice(0, 12))} className={inputClass} /></div>
          <div><label className="mb-1 block text-[13px] text-slate-500">{t("nextNo")}</label><input inputMode="numeric" value={next} onChange={(e) => setNext(e.target.value.replace(/\D/g, ""))} className={inputClass} /></div>
        </div>
      )}
      <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[15px] text-slate-700"><input type="radio" checked={!auto} onChange={() => setAuto(false)} className="h-4 w-4 accent-[#2563eb]" />{t("numManual", { kind })}</label>
    </Modal>
  );
}

// Paso 6.9b: nueva tasa desde la cotización o factura (queda guardada en Settings → Taxes)
function NewRateModal({ open, onClose, companyId, first, onSaved }: {
  open: boolean; onClose: () => void; companyId: string; first: boolean; onSaved: (r: TaxRate) => void;
}) {
  const tx = useTranslations("tax");
  const tcm = useTranslations("common");
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setName(first ? "Sales tax" : ""); setRate(first ? "8.25" : ""); setError(""); } }, [open, first]);
  async function save() {
    const n = Number(rate);
    if (!name.trim() || rate.trim() === "" || n < 0 || n > 100) return setError(tx("eRate"));
    setBusy(true);
    const sb = db();
    const { data, error: e } = await sb.from("tax_rates").insert({ company_id: companyId, name: name.trim(), rate: n, position: 99 }).select("id, name, rate, is_default, is_active, position").single();
    if (e || !data) { setBusy(false); return setError(/row-level|permission/i.test(e?.message ?? "") ? tx("eOnlyAdmin") : /duplicate|unique/i.test(e?.message ?? "") ? tx("eDup") : tx("eSave")); }
    let row = { ...(data as TaxRate), rate: Number(data.rate) };
    if (first && !(await sb.rpc("tax_rate_set_default", { p_company: companyId, p_id: row.id })).error) row = { ...row, is_default: true };
    setBusy(false); onSaved(row); onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title={tx("newRateTitle")}
      footer={<><button type="button" onClick={save} disabled={busy} className={btnPrimary}>{tcm("save")}</button><button type="button" onClick={onClose} className={btnGhost}>{tcm("cancel")}</button>{error && <p className="text-sm text-red-600">{error}</p>}</>}>
      <p className="mb-4 text-[14px] text-slate-600">{first ? tx("newRateFirst") : tx("newRateIntro")}</p>
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <div><label className="mb-1 block text-[13px] text-slate-500">{tx("name")}</label><input autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={inputClass} /></div>
        <div><label className="mb-1 block text-[13px] text-slate-500">{tx("rate")} (%)</label><input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ""))} className={`${inputClass} text-right`} /></div>
      </div>
    </Modal>
  );
}

// Paso 6.9c: renglón de totales. Computadora: etiqueta · campo · monto. Celular: etiqueta y monto arriba, campo abajo.
function TotRow({ label, amount, children, after, onRemove, removeLabel }: {
  label: React.ReactNode; amount: React.ReactNode; children: React.ReactNode; after?: React.ReactNode; onRemove?: () => void; removeLabel?: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[7.5rem_minmax(0,1fr)_6.5rem]">
      <div className="min-w-0 text-slate-700">{label}</div>
      <div className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">{children}</div>
      <div className="flex items-center justify-end gap-1.5 text-right tabular-nums text-slate-600 sm:col-start-3 sm:row-start-1">
        {amount}
        {onRemove && <button type="button" onClick={onRemove} aria-label={removeLabel} title={removeLabel} className="group/x flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600">
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 transition-transform duration-200 group-hover/x:rotate-90" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6.5 6.5 7 7M13.5 6.5l-7 7" strokeLinecap="round" /></svg>
        </button>}
      </div>
      {after && <div className="col-span-2 min-w-0 space-y-1 sm:col-span-1 sm:col-start-2">{after}</div>}
    </div>
  );
}
// Etiqueta que se puede editar (Adjustment, nombre del recargo): se ve como texto con una raya punteada abajo
function LabelInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} title={value} aria-label={placeholder}
      className="w-full min-w-0 border-0 border-b border-dashed border-slate-300 bg-transparent px-0 py-1 text-[15px] text-slate-700 placeholder:text-slate-400 hover:border-slate-400 focus:border-[#0f766e] focus:outline-none focus:ring-0" />
  );
}
// Cantidad + $/% (descuento, recargos, envío)
function AmountKind({ value, onValue, kind, onKind, label }: { value: string; onValue: (v: string) => void; kind: "flat" | "percent"; onKind: (k: "flat" | "percent") => void; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <input inputMode="decimal" value={value} onFocus={(e) => e.currentTarget.select()} onChange={(e) => onValue(e.target.value.replace(/[^0-9.]/g, ""))} className={`${inputClass} min-w-0 !py-2 text-right`} />
      <div className="w-[4.5rem] shrink-0"><SelectMenu value={kind} options={[{ value: "flat", label: "$" }, { value: "percent", label: "%" }]} onChange={(v) => onKind(v === "percent" ? "percent" : "flat")} ariaLabel={label} /></div>
    </div>
  );
}
