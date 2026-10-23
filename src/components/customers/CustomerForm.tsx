"use client";

import { useMemo, useState } from "react";
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
import PhoneList from "@/components/customers/PhoneList";
import EmailList from "@/components/customers/EmailList";
import SelectMenu from "@/components/ui/SelectMenu";
import SearchSelect, { Check, Chevron, optionClass, panelClass } from "@/components/ui/SearchSelect";
import { useNoFill } from "@/components/customers/noFill";
import { inputClass, primaryButton, secondaryButton } from "@/components/customers/ui";

// Formulario de cliente con el mismo diseño de Zoho: etiqueta a la izquierda, campo a la derecha, pestañas abajo
const SALUTATION_OPTIONS = [{ value: "", label: "Salutation" }, ...SALUTATIONS.map((s) => ({ value: s, label: s }))];
const LANGUAGE_OPTIONS = LANGUAGES.map((l) => ({ value: l, label: l }));
const TERM_OPTIONS = PAYMENT_TERMS.map((t) => ({ value: t, label: t }));
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
    { id: "other", label: "Other Details" },
    { id: "address", label: "Address" },
    { id: "sites", label: "Job Sites" },
    { id: "contacts", label: "Contact Persons", soon: true },
    { id: "custom", label: "Custom Fields", soon: true },
    { id: "remarks", label: "Remarks" },
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
    if (type === "residential" && !firstName.trim() && !lastName.trim()) return "Enter the customer's name.";
    if (type === "commercial" && !companyName.trim()) return "Enter the company name.";
    if (!shownDisplay.trim()) return "Choose or type a display name.";
    if (phones.some((p) => phoneError(p))) return "Check the phone numbers marked in red.";
    if (emails.some((e) => emailError(e))) return "Check the emails marked in red.";
    {
      const checks: [Address, string, string][] = [
        [billing, "address", "Billing address: "],
        [shipping, "address", "Shipping address: "],
        ...sites.map((s, i): [Address, string, string] => [s, "sites", `Job site ${i + 1}: `]),
      ];
      for (const [a, t, prefix] of checks) {
        if (addressIsEmpty(a)) continue;
        const msg = addressError(a);
        if (msg) { setTab(t); return prefix + msg; }
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
      return setError(editing ? "The changes couldn't be saved. Try again." : "The customer couldn't be saved. Try again.");
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
        if (aErr) { setSaving(false); return setError("The customer was saved, but an address couldn't be saved. Try again."); }
      }
    }

    // Display name, idioma, moneda, términos y attention (función del SQL paso 3.21)
    const extras: Record<string, unknown> = { display_name: shownDisplay.trim(), language, currency, payment_terms: terms, portal_enabled: portal };
    Object.assign(extras, { billing_attention: billAttn, shipping_attention: shipAttn });
    const { error: extraErr } = await supabase.rpc("save_customer_extras", { p_customer_id: data, p_extras: extras });
    if (extraErr) console.error("save_customer_extras:", extraErr.message);

    router.push(`/dashboard/customers/${data}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate autoComplete="off">
      <input type="text" tabIndex={-1} aria-hidden="true" autoComplete="off" className="hidden" />

      <div className="space-y-5">
        <Row label="Customer Type" hint="Residential for homes, Commercial for businesses and builders.">
          <div className="flex flex-wrap gap-6 py-1.5" role="radiogroup" aria-label="Customer type">
            {(["residential", "commercial"] as CustomerType[]).map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 text-[15px] text-slate-700">
                <input type="radio" name="customer-type" checked={type === t} onChange={() => { setType(t); clear(); }} className="h-4 w-4 accent-[#0f766e]" />
                {t === "residential" ? "Residential" : "Commercial"}
              </label>
            ))}
          </div>
        </Row>

        <Row label="Primary Contact" htmlFor="c-given" wide hint="The person you talk to.">
          <div className="grid gap-3 sm:grid-cols-[9rem_1fr_1fr]">
            <SelectMenu id="c-salutation" ariaLabel="Salutation" value={salutation} options={SALUTATION_OPTIONS} onChange={(v) => { setSalutation(v); clear(); }} placeholder="Salutation" />
            <input id="c-given" value={firstName} {...noFill("c2")} placeholder="First Name" onChange={(e) => { setFirstName(e.target.value); clear(); }} className={inputClass} />
            <input id="c-family" value={lastName} {...noFill("c3")} placeholder="Last Name" onChange={(e) => { setLastName(e.target.value); clear(); }} className={inputClass} />
          </div>
        </Row>

        <Row label="Company Name" htmlFor="c-company">
          <input id="c-company" value={companyName} {...noFill("c1")} placeholder={type === "commercial" ? "e.g. Carlos AC Builders" : ""}
            onChange={(e) => { setCompanyName(e.target.value); clear(); }} className={inputClass} />
        </Row>

        <Row label="Display Name" htmlFor="c-display" required hint="How this customer appears in lists, quotes and invoices.">
          <Combobox immediate value={shownDisplay} onChange={(v: string | null) => { if (v != null) { setDisplay(v); clear(); } }}>
            <div className="relative">
              <ComboboxInput id="c-display" autoComplete="off" data-lpignore="true" data-1p-ignore="true" spellCheck={false}
                placeholder="Select or type to add" displayValue={(v: string) => v}
                onChange={(e) => { setDisplay(e.target.value); clear(); }}
                className={`${inputClass} pr-10`} />
              <ComboboxButton aria-label="Show suggestions" className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"><Chevron /></ComboboxButton>
            </div>
            <ComboboxOptions anchor="bottom start" transition className={`${panelClass} w-[var(--input-width)]`}>
              {suggestions.length === 0
                ? <div className="px-4 py-3 text-sm text-slate-500">Type the name or company above to see suggestions.</div>
                : suggestions.map((s) => (
                  <ComboboxOption key={s} value={s} className={optionClass}><span className="truncate">{s}</span><Check /></ComboboxOption>
                ))}
            </ComboboxOptions>
          </Combobox>
        </Row>

        <Row label="Email Address" wide alignTop hint="Use labels like Quotes or Invoices to know where each document goes.">
          <EmailList emails={emails} showErrors={showErrors} onChange={(l) => { setEmails(l); clear(); }} />
        </Row>

        <Row label="Phone" wide alignTop>
          <PhoneList phones={phones} showErrors={showErrors} onChange={(l) => { setPhones(l); clear(); }} />
        </Row>

        <Row label="Customer Language" htmlFor="c-language" hint="The language you use to talk to and send documents to this customer.">
          <SearchSelect id="c-language" ariaLabel="Customer language" value={language} options={LANGUAGE_OPTIONS} onChange={setLanguage} placeholder="Search or choose" />
        </Row>
      </div>

      {/* ---------- Pestañas ---------- */}
      <div className="mt-10 flex gap-8 overflow-x-auto overflow-y-hidden border-b border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
        {TABS.map((t) => t.soon ? (
          <span key={t.id} title="Coming soon" className="flex shrink-0 items-center gap-1.5 whitespace-nowrap pb-3 text-[15px] text-slate-400">
            {t.label}<span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium">Soon</span>
          </span>
        ) : (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`relative shrink-0 whitespace-nowrap pb-3 text-[15px] transition-colors ${tab === t.id ? "font-semibold text-[#0b1f3a]" : "text-slate-500 hover:text-[#0b1f3a]"}`}>
            {t.label}
            {tab === t.id && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-[#0f766e]" />}
          </button>
        ))}
      </div>

      <div className="py-7">
        {tab === "other" && (
          <div className="space-y-5">
            <Row label="Currency" htmlFor="c-currency">
              <SearchSelect id="c-currency" ariaLabel="Currency" value={currency} options={CURRENCIES} onChange={setCurrency} />
            </Row>
            <Row label="Payment Terms" htmlFor="c-terms" hint="When invoices for this customer are due.">
              <SearchSelect id="c-terms" ariaLabel="Payment terms" value={terms} options={TERM_OPTIONS} onChange={setTerms} />
            </Row>
            <Row label="Enable Portal?" hint="The customer portal arrives with Quotes and Invoices.">
              <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-[15px] text-slate-700">
                <input type="checkbox" checked={portal} onChange={(e) => setPortal(e.target.checked)} className="h-4 w-4 rounded accent-[#0f766e]" />
                Allow portal access for this customer
              </label>
            </Row>
            <Row label="Documents" alignTop>
              <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-[15px] text-slate-400">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
                Upload File
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium">Soon</span>
              </span>
              <p className="mt-1.5 text-[13px] text-slate-400">You’ll be able to upload up to 10 files, 10 MB each.</p>
            </Row>
          </div>
        )}

        {tab === "address" && (
          <div className="grid max-w-[1040px] gap-x-14 gap-y-10 xl:grid-cols-2">
            <div>
              <h3 className="mb-5 text-base font-semibold text-[#0b1f3a]">Billing Address</h3>
              <label htmlFor="bill-attn" className="mb-1.5 block text-sm font-medium text-slate-700">Attention</label>
              <input id="bill-attn" value={billAttn} {...noFill("b0")} placeholder="Who should receive it" onChange={(e) => setBillAttn(e.target.value)} className={`${inputClass} mb-3`} />
              <AddressFields hideLabel idPrefix="bill" value={billing} onChange={(a) => { setBilling(a); clear(); }} />
            </div>
            <div>
              <h3 className="mb-5 flex flex-wrap items-center gap-x-2 text-base font-semibold text-[#0b1f3a]">
                Shipping Address
                <button type="button" onClick={() => { setShipping({ ...billing, label: "Shipping address", is_primary: false }); setShipAttn(billAttn); clear(); }}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[#2563eb] hover:underline">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M10 3a1 1 0 0 1 1 1v9.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.4L9 13.6V4a1 1 0 0 1 1-1z" /></svg>
                  Copy billing address
                </button>
              </h3>
              <label htmlFor="ship-attn" className="mb-1.5 block text-sm font-medium text-slate-700">Attention</label>
              <input id="ship-attn" value={shipAttn} {...noFill("s0")} placeholder="Who should receive it" onChange={(e) => setShipAttn(e.target.value)} className={`${inputClass} mb-3`} />
              <AddressFields hideLabel idPrefix="ship" value={shipping} onChange={(a) => { setShipping(a); clear(); }} />
            </div>
          </div>
        )}

        {tab === "sites" && (
          <div className="max-w-4xl">
            <p className="text-[15px] text-slate-600">Add every house or property you work at for this customer, like each home a builder sends you. Invoices can go to a specific job site instead of the office.</p>
            <div className="mt-5 space-y-5">
              {sites.map((s, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">Job site {i + 1}</p>
                    <button type="button" onClick={() => setSites((l) => l.filter((_, j) => j !== i))} className="text-sm font-medium text-red-600 hover:underline">Remove</button>
                  </div>
                  <AddressFields idPrefix={`site-${i}`} value={s} onChange={(a) => { setSites((l) => l.map((x, j) => (j === i ? a : x))); clear(); }} />
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setSites((l) => [...l, { ...EMPTY_ADDRESS, country: billing.country || "US", state: l.length ? "" : billing.state }])}
              className="mt-4 text-sm font-semibold text-[#0f766e] hover:underline">+ Add job site</button>
          </div>
        )}

        {tab === "remarks" && (
          <div className="max-w-3xl">
            <label htmlFor="c-notes" className="mb-1.5 block text-sm font-medium text-slate-700">Remarks <span className="font-normal text-slate-400">(for internal use)</span></label>
            <textarea id="c-notes" rows={5} value={notes} {...noFill("c4")} placeholder="Gate code, pets, best time to call..." onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </div>
        )}
      </div>

      {/* ---------- Barra fija para guardar (como Zoho) ---------- */}
      <div className="sticky bottom-0 z-10 -mx-5 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-5 py-3 sm:-mx-8 sm:px-8">
        <button type="submit" disabled={saving} className={primaryButton}>{saving ? "Saving..." : editing ? "Save changes" : "Save"}</button>
        <Link prefetch={false} href={editing && customer ? `/dashboard/customers/${customer.id}` : "/dashboard/customers"} className={secondaryButton}>Cancel</Link>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
    </form>
  );
}

function splitAddresses(list: Address[]) {
  const clean = list.map((a) => ({ ...EMPTY_ADDRESS, ...a, label: a.label ?? "", unit: a.unit ?? "", zip: a.zip ?? "", state: a.state ?? "", country: a.country || "US" }));
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
