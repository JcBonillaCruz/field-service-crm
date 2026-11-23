"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { dialCode } from "@/lib/geo";
import {
  Address, CURRENCIES, Customer, CustomerType, EMPTY_ADDRESS, Email, LANGUAGES, PAYMENT_TERMS, Phone, SALUTATIONS,
  addressError, addressIsEmpty, cleanAddress, emailError, newEmail, newPhone, phoneError,
} from "@/lib/customers";
import AddressFields from "@/components/customers/AddressFields";
import JobSitesEditor from "@/components/customers/JobSitesEditor";
import PhoneList from "@/components/customers/PhoneList";
import EmailList from "@/components/customers/EmailList";
import SelectMenu from "@/components/ui/SelectMenu";
import SearchSelect, { Check, Chevron, optionClass, panelClass } from "@/components/ui/SearchSelect";
import { useNoFill } from "@/components/customers/noFill";
import { inputClass, primaryButton, secondaryButton } from "@/components/customers/ui";
import { useTranslations } from "next-intl";
import { useCustTx } from "@/i18n/useCustTx";
import { LeadSourceSelect, ReferrerSelect } from "@/components/customers/LeadSourcePicker";
import { LeadSource, REFERRAL, loadLeadSources } from "@/lib/lead-sources";
import TaxFields from "@/components/customers/TaxFields";
import { TaxRate, TaxSetting, loadTaxRates, taxPayload } from "@/lib/tax";

// Formulario de cliente con el mismo diseño de Zoho: etiqueta a la izquierda, campo a la derecha, pestañas abajo
const sameAddress = (a: Address, b: Address) =>
  (["street", "unit", "city", "state", "zip", "country"] as const).every((k) => a[k].trim() === b[k].trim());

export default function CustomerForm({
  companyId, customer, initialPhones, initialEmails, initialAddresses,
}: {
  companyId: string;
  customer?: Customer;
  initialPhones?: Phone[];
  initialEmails?: Email[];
  initialAddresses?: Address[];
}) {
  const t = useTranslations("custForm");
  const cx = useCustTx();
  const SALUTATION_OPTIONS = [{ value: "", label: t("salutation") }, ...SALUTATIONS.map((s) => ({ value: s, label: s }))];
  const LANGUAGE_OPTIONS = LANGUAGES.map((l) => ({ value: l, label: cx.lang(l) }));
  const TERM_OPTIONS = PAYMENT_TERMS.map((x) => ({ value: x, label: cx.term(x) }));
  const router = useRouter();
  const noFill = useNoFill();
  const editing = Boolean(customer);

  const [type, setType] = useState<CustomerType>(customer?.customer_type ?? "residential");
  const [salutation, setSalutation] = useState(customer?.salutation ?? "");
  const [firstName, setFirstName] = useState(customer?.first_name ?? "");
  const [lastName, setLastName] = useState(customer?.last_name ?? "");
  const [companyName, setCompanyName] = useState(customer?.company_name ?? "");
  const [display, setDisplay] = useState(customer?.display_name ?? "");
  const [phones, setPhones] = useState<Phone[]>(initialPhones?.length ? initialPhones : [newPhone(true)]);
  const [emails, setEmails] = useState<Email[]>(initialEmails?.length ? initialEmails : [newEmail(true)]);
  const [language, setLanguage] = useState(customer?.language || "English");
  const [currency, setCurrency] = useState(customer?.currency || "USD");
  const [terms, setTerms] = useState(customer?.payment_terms || "Due on Receipt");
  const [portal, setPortal] = useState(Boolean(customer?.portal_enabled));
  const [notes, setNotes] = useState(customer?.notes ?? "");
  // Paso 6.8: cómo llegó el cliente
  const tl = useTranslations("lead");
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [leadSql, setLeadSql] = useState(true); // true = ya está el SQL del 6.8
  const [leadId, setLeadId] = useState(customer?.lead_source_id ?? "");
  const [referredId, setReferredId] = useState(customer?.referred_by_id ?? "");
  useEffect(() => {
    loadLeadSources(createClient(), companyId).then((r) => { setSources(r.list); setLeadSql(!r.needsSql); });
  }, [companyId]);
  const isReferral = sources.find((s) => s.id === leadId)?.code === REFERRAL;
  // Paso 6.9: impuesto del cliente (y de cada Job Site, en su pestaña)
  const tt = useTranslations("tax");
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [taxSql, setTaxSql] = useState(false);
  const [tax, setTax] = useState<TaxSetting>({
    tax_mode: customer?.tax_mode ?? "company", tax_rate_id: customer?.tax_rate_id ?? null, tax_exempt_reason: customer?.tax_exempt_reason ?? null,
    tax_cert_number: customer?.tax_cert_number ?? null, tax_cert_expires: customer?.tax_cert_expires ?? null, tax_cert_path: customer?.tax_cert_path ?? null,
  });
  useEffect(() => {
    loadTaxRates(createClient(), companyId).then((r) => { setRates(r.rates); setTaxSql(!r.needsSql); });
  }, [companyId]);
  // Direcciones guardadas: "Billing address" y "Shipping address" van en su pestaña; las demás son Job Sites
  const [initial] = useState(() => splitAddresses(initialAddresses ?? []));
  const [billing, setBilling] = useState<Address>(initial.billing);
  const [billAttn, setBillAttn] = useState(customer?.billing_attention ?? "");
  const [shipping, setShipping] = useState<Address>(initial.shipping);
  const [shipAttn, setShipAttn] = useState(customer?.shipping_attention ?? "");
  const [sites, setSites] = useState<Address[]>(initial.sites);
  const [tab, setTab] = useState("other");
  const [error, setError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const TABS: { id: string; label: string; soon?: boolean }[] = [
    { id: "other", label: t("tOther") },
    { id: "address", label: t("tAddress") },
    { id: "sites", label: t("tSites") },
    { id: "remarks", label: t("tRemarks") },
  ];

  // Sugerencias del Display Name (como Zoho): Mr. Juan Bonilla, Juan Bonilla, Bonilla, Juan, Carlos AC
  const suggestions = useMemo(() => {
    const f = firstName.trim(), l = lastName.trim(), s = salutation.trim(), c = companyName.trim();
    const full = [f, l].filter(Boolean).join(" ");
    const list = [s && full ? `${s} ${full}` : "", full, f && l ? `${l}, ${f}` : "", c];
    return list.filter((x, i) => x && list.indexOf(x) === i);
  }, [firstName, lastName, salutation, companyName]);
  const shownDisplay = display; // como Zoho: vacío hasta que eliges una sugerencia o lo escribes
  const clear = () => setError("");

  function validate() {
    if (type === "residential" && !firstName.trim() && !lastName.trim()) return t("eName");
    if (type === "commercial" && !companyName.trim()) return t("eCompany");
    if (!shownDisplay.trim()) return t("eDisplay");
    if (phones.some((p) => phoneError(p))) return t("ePhones");
    if (emails.some((e) => emailError(e))) return t("eEmails");
    {
      const checks: [Address, string, string][] = [
        [billing, "address", `${t("billingAddr")}: `],
        [shipping, "address", `${t("shippingAddr")}: `],
        ...sites.map((s, i): [Address, string, string] => [s, "sites", `${t("siteNCap", { n: i + 1 })}: `]),
      ];
      for (const [a, tb, prefix] of checks) {
        if (addressIsEmpty(a)) continue;
        const msg = addressError(a);
        if (msg) { setTab(tb); return prefix + cx.err(msg); }
      }
    }
    return "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setShowErrors(true);
    const msg = validate();
    if (msg) return setError(msg);
    setSaving(true);
    setError("");

    // Billing = principal; Shipping solo si es diferente; luego los job sites
    const list: Address[] = [];
    if (!addressIsEmpty(billing)) list.push({ ...billing, label: "Billing address", is_primary: true });
    if (!addressIsEmpty(shipping) && !(list.length && !shipping.id && sameAddress(billing, shipping))) list.push({ ...shipping, label: "Shipping address", is_primary: false });
    sites.filter((s) => !addressIsEmpty(s)).forEach((s) => list.push({ ...s, is_primary: false }));
    if (list.length && !list.some((a) => a.is_primary)) list[0] = { ...list[0], is_primary: true };

    const supabase = createClient();
    const { data, error } = await supabase.rpc("save_customer", {
      p_company_id: companyId,
      p_customer_id: customer?.id ?? null,
      p_customer: { customer_type: type, salutation, first_name: firstName, last_name: lastName, company_name: companyName, notes },
      p_phones: phones.filter((p) => p.number.replace(/\D/g, "")).map((p) => ({
        label: p.label.trim() || "Main", country: p.country, dial_code: dialCode(p.country), number: p.number.trim(), is_primary: p.is_primary,
      })),
      p_emails: emails.filter((x) => x.email.trim()).map((x) => ({ label: x.label.trim() || "Main", email: x.email.trim().toLowerCase(), is_primary: x.is_primary })),
      p_addresses: editing ? null : list.map(cleanAddress),
    });
    if (error || !data) {
      setSaving(false);
      return setError(editing ? t("eSaveChanges") : t("eSave"));
    }

    // Al editar: actualiza, agrega o borra direcciones directamente
    if (editing) {
      const keep = new Set(list.filter((a) => a.id).map((a) => a.id));
      const gone = (initialAddresses ?? []).filter((a) => a.id && !keep.has(a.id)).map((a) => a.id as string);
      if (gone.length) await supabase.from("customer_addresses").delete().in("id", gone);
      await supabase.from("customer_addresses").update({ is_primary: false }).eq("customer_id", data);
      for (const a of list) {
        const row = cleanAddress(a);
        const { error: aErr } = a.id
          ? await supabase.from("customer_addresses").update(row).eq("id", a.id)
          : await supabase.from("customer_addresses").insert({ ...row, customer_id: data, company_id: companyId });
        if (aErr) { setSaving(false); return setError(t("eAddrSave")); }
      }
    }

    // Display name, idioma, moneda, términos y attention (función del SQL paso 3.21)
    const extras: Record<string, unknown> = { display_name: shownDisplay.trim(), language, currency, payment_terms: terms, portal_enabled: portal };
    Object.assign(extras, { billing_attention: billAttn, shipping_attention: shipAttn });
    const { error: extraErr } = await supabase.rpc("save_customer_extras", { p_customer_id: data, p_extras: extras });
    if (extraErr) console.error("save_customer_extras:", extraErr.message);

    // Paso 6.8: lead source y referido (si falta el SQL, el cliente se guarda igual)
    const ref = isReferral ? referredId : "";
    if (leadSql && (leadId !== (customer?.lead_source_id ?? "") || ref !== (customer?.referred_by_id ?? ""))) {
      const { error: leadErr } = await supabase.rpc("customer_set_lead", { p_customer: data, p_source: leadId || null, p_referred: ref || null });
      if (leadErr) console.error("customer_set_lead:", leadErr.message);
    }

    // Paso 6.9: impuesto del cliente y de sus Job Sites (los sitios nuevos se buscan por su dirección)
    if (taxSql) {
      const { data: saved } = await supabase.from("customer_addresses").select("id, label, street, unit, city, zip").eq("customer_id", data);
      const norm = (a: { label?: string | null; street?: string | null; unit?: string | null; city?: string | null; zip?: string | null }) =>
        [a.label, a.street, a.unit, a.city, a.zip].map((x) => (x ?? "").trim().toLowerCase()).join("|");
      const used = new Set<string>();
      const sitesTax = sites.filter((x) => !addressIsEmpty(x)).map((x) => {
        const row = cleanAddress(x);
        const hit = x.id ?? (saved ?? []).find((r) => !used.has(r.id) && norm(r) === norm(row))?.id;
        if (hit) used.add(hit);
        return hit ? { id: hit, ...taxPayload(x.tax ?? { tax_mode: "inherit" }) } : null;
      }).filter(Boolean);
      const { error: taxErr } = await supabase.rpc("customer_save_tax", { p_customer: data, p_tax: taxPayload(tax), p_sites: sitesTax });
      if (taxErr) { setSaving(false); return setError(tt("eSaveCustomer")); }
    }

    router.push(`/dashboard/customers/${data}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate autoComplete="off">
      <input type="text" tabIndex={-1} aria-hidden="true" autoComplete="off" className="hidden" />

      <div className="space-y-5">
        <Row label={t("custType")} hint={t("custTypeHint")}>
          <div className="flex flex-wrap gap-6 py-1.5" role="radiogroup" aria-label={t("custType")}>
            {(["residential", "commercial"] as CustomerType[]).map((ct) => (
              <label key={ct} className="flex cursor-pointer items-center gap-2 text-[15px] text-slate-700">
                <input type="radio" name="customer-type" checked={type === ct} onChange={() => { setType(ct); clear(); }} className="h-4 w-4 accent-[#0f766e]" />
                {cx.type(ct)}
              </label>
            ))}
          </div>
        </Row>

        <Row label={t("primaryContact")} htmlFor="c-given" wide hint={t("primaryContactHint")}>
          <div className="grid gap-3 sm:grid-cols-[9rem_1fr_1fr]">
            <SelectMenu id="c-salutation" ariaLabel={t("salutation")} value={salutation} options={SALUTATION_OPTIONS} onChange={(v) => { setSalutation(v); clear(); }} placeholder={t("salutation")} />
            <input id="c-given" value={firstName} {...noFill("c2")} placeholder={t("firstName")} onChange={(e) => { setFirstName(e.target.value); clear(); }} className={inputClass} />
            <input id="c-family" value={lastName} {...noFill("c3")} placeholder={t("lastName")} onChange={(e) => { setLastName(e.target.value); clear(); }} className={inputClass} />
          </div>
        </Row>

        <Row label={t("companyName")} htmlFor="c-company">
          <input id="c-company" value={companyName} {...noFill("c1")} placeholder={type === "commercial" ? t("companyPh") : ""}
            onChange={(e) => { setCompanyName(e.target.value); clear(); }} className={inputClass} />
        </Row>

        <Row label={t("displayName")} htmlFor="c-display" required hint={t("displayHint")}>
          <Combobox immediate value={shownDisplay} onChange={(v: string | null) => { if (v != null) { setDisplay(v); clear(); } }}>
            <div className="relative">
              <ComboboxInput id="c-display" autoComplete="off" data-lpignore="true" data-1p-ignore="true" spellCheck={false}
                placeholder={t("selectOrType")} displayValue={(v: string) => v}
                onChange={(e) => { setDisplay(e.target.value); clear(); }}
                className={`${inputClass} pr-10`} />
              <ComboboxButton aria-label={t("showSugg")} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"><Chevron /></ComboboxButton>
            </div>
            <ComboboxOptions anchor="bottom start" transition className={`${panelClass} w-[var(--input-width)]`}>
              {suggestions.length === 0
                ? <div className="px-4 py-3 text-sm text-slate-500">{t("suggHint")}</div>
                : suggestions.map((s) => (
                  <ComboboxOption key={s} value={s} className={optionClass}><span className="truncate">{s}</span><Check /></ComboboxOption>
                ))}
            </ComboboxOptions>
          </Combobox>
        </Row>

        <Row label={t("emailAddr")} wide alignTop hint={t("emailHint")}>
          <EmailList emails={emails} showErrors={showErrors} onChange={(l) => { setEmails(l); clear(); }} />
        </Row>

        <Row label={t("phone")} wide alignTop>
          <PhoneList phones={phones} showErrors={showErrors} onChange={(l) => { setPhones(l); clear(); }} />
        </Row>

        <Row label={t("custLang")} htmlFor="c-language" hint={t("custLangHint")}>
          <SearchSelect id="c-language" ariaLabel={t("custLang")} value={language} options={LANGUAGE_OPTIONS} onChange={setLanguage} placeholder={t("searchOrChoose")} />
        </Row>

        {leadSql && (
          <Row label={tl("label")} htmlFor="c-lead" hint={tl("hint")} alignTop>
            <LeadSourceSelect id="c-lead" companyId={companyId} sources={sources} value={leadId}
              onChange={setLeadId} onCreated={(s) => setSources((l) => [...l, s])} />
          </Row>
        )}
        {leadSql && isReferral && (
          <div className="animate-[bp-fade_0.25s_ease-out]">
            <Row label={tl("referredBy")} htmlFor="c-referrer" hint={tl("referredHint")}>
              <ReferrerSelect id="c-referrer" companyId={companyId} selfId={customer?.id} value={referredId} onChange={setReferredId} />
            </Row>
          </div>
        )}
      </div>

      {/* ---------- Pestañas ---------- */}
      <div className="mt-10 flex gap-8 overflow-x-auto overflow-y-hidden border-b border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
        {TABS.map((x) => x.soon ? (
          <span key={x.id} title={t("comingSoon")} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap pb-3 text-[15px] text-slate-400">
            {x.label}<span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium">{t("soon")}</span>
          </span>
        ) : (
          <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}
            className={`relative shrink-0 whitespace-nowrap pb-3 text-[15px] transition-colors ${tab === x.id ? "font-semibold text-[#0b1f3a]" : "text-slate-500 hover:text-[#0b1f3a]"}`}>
            {x.label}
            {tab === x.id && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-[#0f766e]" />}
          </button>
        ))}
      </div>

      <div className="py-7">
        {tab === "other" && (
          <div className="space-y-5">
            <Row label={t("currency")} htmlFor="c-currency">
              <SearchSelect id="c-currency" ariaLabel={t("currency")} value={currency} options={CURRENCIES} onChange={setCurrency} />
            </Row>
            <Row label={t("terms")} htmlFor="c-terms" hint={t("termsHint")}>
              <SearchSelect id="c-terms" ariaLabel={t("terms")} value={terms} options={TERM_OPTIONS} onChange={setTerms} />
            </Row>
            {taxSql && (
              <Row label={tt("label")} hint={tt("custHint")} alignTop wide>
                <TaxFields companyId={companyId} rates={rates} value={tax} onChange={setTax} idPrefix="c" />
              </Row>
            )}
            <Row label={t("portal")} hint={t("portalHint")}>
              <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-[15px] text-slate-700">
                <input type="checkbox" checked={portal} onChange={(e) => setPortal(e.target.checked)} className="h-4 w-4 rounded accent-[#0f766e]" />
                {t("portalAllow")}
              </label>
            </Row>
          </div>
        )}

        {tab === "address" && (
          <div className="grid max-w-[1040px] gap-x-14 gap-y-10 xl:grid-cols-2">
            <div>
              <h3 className="mb-5 text-base font-semibold text-[#0b1f3a]">{t("billingAddrT")}</h3>
              <label htmlFor="bill-attn" className="mb-1.5 block text-sm font-medium text-slate-700">{t("attention")}</label>
              <input id="bill-attn" value={billAttn} {...noFill("b0")} placeholder={t("attentionPh")} onChange={(e) => setBillAttn(e.target.value)} className={`${inputClass} mb-3`} />
              <AddressFields hideLabel idPrefix="bill" value={billing} onChange={(a) => { setBilling(a); clear(); }} />
            </div>
            <div>
              <h3 className="mb-5 flex flex-wrap items-center gap-x-2 text-base font-semibold text-[#0b1f3a]">
                {t("shippingAddrT")}
                <button type="button" onClick={() => { setShipping({ ...billing, label: "Shipping address", is_primary: false }); setShipAttn(billAttn); clear(); }}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[#2563eb] hover:underline">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M10 3a1 1 0 0 1 1 1v9.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.4L9 13.6V4a1 1 0 0 1 1-1z" /></svg>
                  {t("copyBilling")}
                </button>
              </h3>
              <label htmlFor="ship-attn" className="mb-1.5 block text-sm font-medium text-slate-700">{t("attention")}</label>
              <input id="ship-attn" value={shipAttn} {...noFill("s0")} placeholder={t("attentionPh")} onChange={(e) => setShipAttn(e.target.value)} className={`${inputClass} mb-3`} />
              <AddressFields hideLabel idPrefix="ship" value={shipping} onChange={(a) => { setShipping(a); clear(); }} />
            </div>
          </div>
        )}

        {tab === "sites" && (
          <div className="max-w-4xl">
            <p className="text-[15px] text-slate-600">{t("sitesIntro")}</p>
            <div className="mt-5">
              <JobSitesEditor sites={sites} onChange={(l) => { setSites(l); clear(); }} defaultCountry={billing.country || "US"} defaultState={billing.state}
                tax={taxSql ? { companyId, rates } : undefined} />
            </div>
          </div>
        )}

        {tab === "remarks" && (
          <div className="max-w-3xl">
            <label htmlFor="c-notes" className="mb-1.5 block text-sm font-medium text-slate-700">{t("tRemarks")} <span className="font-normal text-slate-400">({t("internal")})</span></label>
            <textarea id="c-notes" rows={5} value={notes} {...noFill("c4")} placeholder={t("remarksPh")} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </div>
        )}
      </div>

      {/* ---------- Barra fija para guardar (como Zoho) ---------- */}
      <div className="sticky bottom-0 z-10 -mx-5 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-5 py-3 sm:-mx-8 sm:px-8">
        <button type="submit" disabled={saving} className={primaryButton}>{saving ? t("saving") : editing ? t("saveChanges") : t("save")}</button>
        <Link prefetch={false} href={editing && customer ? `/dashboard/customers/${customer.id}` : "/dashboard/customers"} className={secondaryButton}>{t("cancel")}</Link>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
    </form>
  );
}

function splitAddresses(list: Address[]) {
  const clean = list.map((a) => {
    // Paso 6.9: la fila trae el impuesto del Job Site (select "*") → se guarda en "tax"
    const r = a as Address & TaxSetting;
    const tax: TaxSetting | undefined = r.tax_mode ? { tax_mode: r.tax_mode, tax_rate_id: r.tax_rate_id, tax_exempt_reason: r.tax_exempt_reason, tax_cert_number: r.tax_cert_number, tax_cert_expires: r.tax_cert_expires, tax_cert_path: r.tax_cert_path } : a.tax;
    return {
      ...EMPTY_ADDRESS, id: a.id, street: a.street ?? "", city: a.city ?? "", is_primary: Boolean(a.is_primary), tax,
      label: a.label ?? "", unit: a.unit ?? "", zip: a.zip ?? "", state: a.state ?? "", country: a.country || "US",
    } as Address;
  });
  const isBill = (a: Address) => /^billing/i.test(a.label);
  const billing = clean.find(isBill) ?? clean.find((a) => a.is_primary && !a.label.trim());
  const shipping = clean.find((a) => /^shipping/i.test(a.label));
  return {
    billing: billing ?? { ...EMPTY_ADDRESS, label: "Billing address", is_primary: true },
    shipping: shipping ?? { ...EMPTY_ADDRESS, label: "Shipping address" },
    sites: clean.filter((a) => a !== billing && a !== shipping),
  };
}

function Row({ label, htmlFor, required, hint, wide, alignTop, children }: {
  label: string; htmlFor?: string; required?: boolean; hint?: string; wide?: boolean; alignTop?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`grid gap-1.5 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-6 ${alignTop ? "lg:items-start" : "lg:items-center"}`}>
      <label htmlFor={htmlFor} className={`flex items-center gap-1.5 text-[15px] ${alignTop ? "lg:pt-2.5" : ""} ${required ? "text-red-600" : "text-slate-700"}`}>
        {label}{required && "*"}
        {hint && (
          <span title={hint} className="text-slate-400">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10" cy="10" r="7.5" /><path d="M10 9v4.5M10 6.5v.01" strokeLinecap="round" /></svg>
            <span className="sr-only">{hint}</span>
          </span>
        )}
      </label>
      <div className={wide ? "max-w-[720px]" : "max-w-[480px]"}>{children}</div>
    </div>
  );
}
