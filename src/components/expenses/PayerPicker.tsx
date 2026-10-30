"use client";

import { useMemo, useState } from "react";
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { formatPhone, initials, softColor } from "@/lib/types";
import { inputClass } from "@/components/customers/ui";
import type { PayerOption } from "@/components/expenses/ExpensesWorkspace";

// =====================================================================
// "Received from" de Money In: busca en tus CUSTOMERS (la misma base de datos).
// Si no existe, lo creas aquí mismo y queda guardado en Customers como cualquier otro.
// =====================================================================
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const NEW = "__new__";

// Sube el buscador al tope del formulario SOLO en vertical (nunca de lado: así la pantalla no se corre)
function liftUp(el: HTMLElement) {
  const box = el.closest("[data-payer]") as HTMLElement | null;
  let sc: HTMLElement | null = box?.parentElement ?? null;
  while (sc && !(sc.scrollHeight > sc.clientHeight && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
  if (!box || !sc) return;
  const top = sc.scrollTop + box.getBoundingClientRect().top - sc.getBoundingClientRect().top - 12;
  sc.scrollTo({ top, left: 0, behavior: "smooth" });
  sc.scrollLeft = 0;
}

function Dot({ name, seed, size = 30 }: { name: string; seed: string; size?: number }) {
  const c = softColor(seed);
  return <span className="flex shrink-0 items-center justify-center rounded-full font-semibold" style={{ width: size, height: size, background: c.bg, color: c.text, fontSize: size * 0.38 }}>{initials(name)}</span>;
}

export default function PayerPicker({ companyId, people, customerId, name, onPick, onType, onCreated }: {
  companyId: string; people: PayerOption[]; customerId: string | null; name: string;
  onPick: (c: PayerOption | null) => void; onType: (text: string) => void; onCreated: (c: PayerOption) => void;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState<string | null>(null);
  const current = people.find((p) => p.id === customerId) ?? null;
  const list = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return people.slice(0, 50);
    const terms = q.split(/\s+/);
    return people.filter((p) => { const blob = fold(`${p.display_name} ${p.company_name ?? ""} ${p.email ?? ""} ${p.phone ?? ""}`); return terms.every((t) => blob.includes(t)); }).slice(0, 50);
  }, [people, query]);
  const exact = list.some((p) => fold(p.display_name) === fold(query.trim()));

  if (creating !== null) {
    return <QuickCustomer companyId={companyId} initial={creating} onCancel={() => setCreating(null)}
      onSaved={(c) => { setCreating(null); setQuery(""); onCreated(c); }} />;
  }

  // Ya elegido: tarjetita con el cliente y una X para cambiarlo
  if (current) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-[#bfe7de] bg-[#f3fbf8] px-3 py-2 animate-[bp-fade_0.2s_ease-out]">
        <Dot name={current.display_name} seed={current.id} size={34} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-[#0b1f3a]">{current.display_name}</span>
          <span className="block truncate text-[12px] text-slate-500">{[current.company_name !== current.display_name ? current.company_name : null, current.phone, current.email].filter(Boolean).join(" · ") || "Customer"}</span>
        </span>
        <span className="hidden rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#0f766e] sm:inline">Linked</span>
        <button type="button" onClick={() => onPick(null)} aria-label="Change customer" title="Change"
          className="group flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-[#fff1f2] hover:text-[#e11d48]">
          <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg>
        </button>
      </div>
    );
  }

  // Al tocar el buscador (y salir el teclado), el campo sube al TOPE del formulario para que la lista se vea completa debajo
  const lift = (el: HTMLElement) => [80, 380].forEach((ms) => setTimeout(() => liftUp(el), ms));
  const typed = query.trim();
  return (
    <div data-payer className="min-w-0 scroll-mt-3">
      <Combobox value={null as string | null} immediate
        onChange={(v: string | null) => {
          if (!v) return;
          if (v === NEW) { setCreating(typed); return; }
          const c = people.find((p) => p.id === v); if (c) { setQuery(""); onPick(c); }
        }}>
        {({ open }) => (
          <>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
                <ComboboxInput autoComplete="off" placeholder="Search customers"
                  displayValue={() => query || name}
                  onFocus={(e) => lift(e.currentTarget)}
                  onClick={(e) => lift(e.currentTarget)}
                  onChange={(e) => { setQuery(e.target.value); onType(e.target.value); }}
                  className={`${inputClass} pl-9`} />
              </div>
              {/* Botón SIEMPRE visible: así cualquiera sabe que puede crear el cliente */}
              <button type="button" onClick={() => setCreating(typed)}
                className="group flex shrink-0 items-center gap-1.5 rounded-lg border border-[#0f766e]/30 bg-[#e9f7f4] px-3 text-[14px] font-semibold text-[#0f766e] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#0f766e] hover:shadow-sm active:scale-95">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0f766e] text-white transition-transform duration-200 group-hover:rotate-90"><svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M10 5v10M5 10h10" /></svg></span>
                New<span className="hidden sm:inline"> customer</span>
              </button>
            </div>
            {/* La lista abre HACIA ABAJO, dentro del formulario (no flota encima ni se va arriba) */}
            {open && (
              <ComboboxOptions static
                className="mt-1.5 w-full max-h-[min(18rem,45vh)] overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_32px_rgba(15,40,60,0.12)] animate-[bp-fade_0.18s_ease-out]">
                {typed && !exact && (
                  <ComboboxOption value={NEW} className="mb-1 flex cursor-pointer items-center gap-2.5 rounded-lg bg-[#f3fbf8] px-2.5 py-2.5 text-[14px] font-semibold text-[#0f766e] data-[focus]:bg-[#e3f4ef]">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0f766e] text-white"><svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M10 5v10M5 10h10" /></svg></span>
                    <span className="min-w-0 truncate">Create “{typed}” as a new customer</span>
                  </ComboboxOption>
                )}
                {list.length === 0 && typed && <p className="px-3 py-2 text-[13px] text-slate-500">No customer named “{typed}” yet.</p>}
                {list.map((p) => (
                  <ComboboxOption key={p.id} value={p.id} className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 data-[focus]:bg-[#eef8f5]">
                    <Dot name={p.display_name} seed={p.id} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] text-[#0b1f3a]">{p.display_name}</span>
                      {(p.company_name && p.company_name !== p.display_name) || p.phone || p.email ? (
                        <span className="block truncate text-[12px] text-slate-500">{[p.company_name !== p.display_name ? p.company_name : null, p.phone, p.email].filter(Boolean).join(" · ")}</span>
                      ) : null}
                    </span>
                  </ComboboxOption>
                ))}
              </ComboboxOptions>
            )}
          </>
        )}
      </Combobox>
      <p className="mt-1 text-[12px] text-slate-400">Search your customers. Not there? Tap <b className="font-semibold text-[#0f766e]">New</b> to add it.</p>
    </div>
  );
}

// Mini formulario: crea el cliente en Customers (misma función save_customer que el formulario completo)
function QuickCustomer({ companyId, initial, onCancel, onSaved }: { companyId: string; initial: string; onCancel: () => void; onSaved: (c: PayerOption) => void }) {
  const parts = initial.trim().split(/\s+/);
  const [type, setType] = useState<"residential" | "commercial">("residential");
  const [first, setFirst] = useState(parts[0] ?? "");
  const [last, setLast] = useState(parts.slice(1).join(" "));
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const display = (type === "commercial" && company.trim()) || [first.trim(), last.trim()].filter(Boolean).join(" ") || company.trim();

  async function save() {
    if (!display) return setError(type === "commercial" ? "Enter the company or contact name." : "Enter the customer's name.");
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) return setError("That email doesn't look right.");
    setBusy(true); setError("");
    const s = createClient();
    const digits = phone.replace(/\D/g, "");
    const { data, error: e } = await s.rpc("save_customer", {
      p_company_id: companyId, p_customer_id: null,
      p_customer: { customer_type: type, salutation: "", first_name: first.trim(), last_name: last.trim(), company_name: company.trim(), notes: "" },
      p_phones: digits ? [{ label: "Main", country: "US", dial_code: "+1", number: formatPhone(digits), is_primary: true }] : [],
      p_emails: email.trim() ? [{ label: "Main", email: email.trim().toLowerCase(), is_primary: true }] : [],
      p_addresses: [],
    });
    if (e || !data) { setBusy(false); return setError("The customer couldn't be created. Try again."); }
    await s.rpc("save_customer_extras", { p_customer_id: data, p_extras: { display_name: display } });
    setBusy(false);
    onSaved({ id: data as string, display_name: display, company_name: company.trim() || null, email: email.trim().toLowerCase() || null, phone: digits ? formatPhone(digits) : null });
  }

  return (
    <div data-payer className="scroll-mt-3 rounded-xl border border-[#bfe7de] bg-[#f6fbfa] p-3.5 animate-[bp-pop-in_0.25s_ease-out]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[14px] font-semibold text-[#0b1f3a]">New customer</p>
        <div className="flex rounded-lg bg-white p-0.5 ring-1 ring-slate-200">
          {(["residential", "commercial"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`rounded-md px-2.5 py-1 text-[12.5px] font-semibold transition-colors ${type === t ? "bg-[#0f766e] text-white" : "text-slate-500 hover:text-[#0f766e]"}`}>
              {t === "residential" ? "Residential" : "Commercial"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <input autoFocus onFocus={(e) => { const el = e.currentTarget; setTimeout(() => liftUp(el), 350); }} value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First name" className={inputClass} />
        <input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last name" className={inputClass} />
        {type === "commercial" && <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" className={`${inputClass} sm:col-span-2`} />}
        <input inputMode="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="Phone (optional)" className={inputClass} />
        <input inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className={inputClass} />
      </div>
      {error && <p role="alert" className="mt-2 text-[13px] text-red-600">{error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={save} disabled={busy} className="whitespace-nowrap rounded-lg bg-[#0f766e] px-4 py-2 text-[14px] font-semibold text-white transition-transform hover:bg-[#0c5f59] active:scale-95 disabled:opacity-60">{busy ? "Creating..." : "Create customer"}</button>
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-[14px] font-medium text-slate-500 hover:bg-white">Cancel</button>
        <span className="ml-auto hidden truncate text-[12px] text-slate-400 sm:inline">Saved in Customers</span>
      </div>
    </div>
  );
}
