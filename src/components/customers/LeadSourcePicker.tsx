"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import SearchSelect from "@/components/ui/SearchSelect";
import { Check, Chevron, optionClass, panelClass } from "@/components/ui/SearchSelect";
import { inputClass } from "@/components/customers/ui";
import { LeadSource, leadLabel } from "@/lib/lead-sources";

// =====================================================================
// Paso 6.8 · Lead source del cliente (con "+ Add new source" al final) y "Referred by"
// =====================================================================
const NEW = "__new";

export function LeadSourceSelect({ id, companyId, sources, value, onChange, onCreated }: {
  id: string; companyId: string; sources: LeadSource[]; value: string;
  onChange: (id: string) => void; onCreated: (s: LeadSource) => void;
}) {
  const t = useTranslations("lead");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Ocultas en Settings no salen, salvo la que ya tiene este cliente
  const options = useMemo(() => [
    { value: "", label: t("none") },
    ...sources.filter((s) => s.is_active || s.id === value).map((s) => ({ value: s.id, label: leadLabel(t, s), search: s.code ?? "" })),
    { value: NEW, label: t("addNew") },
  ], [sources, value, t]);

  async function add() {
    const clean = name.trim();
    if (!clean) return setErr(t("eName"));
    const dup = sources.find((s) => leadLabel(t, s).toLowerCase() === clean.toLowerCase());
    if (dup) { onChange(dup.id); setAdding(false); setName(""); return; }
    setBusy(true); setErr("");
    const pos = Math.max(0, ...sources.filter((s) => s.code !== "other").map((s) => s.position)) + 1;
    const { data, error } = await createClient().from("lead_sources")
      .insert({ company_id: companyId, name: clean, position: pos }).select("id, code, name, is_active, position").single();
    setBusy(false);
    if (error || !data) return setErr(/duplicate|unique/i.test(error?.message ?? "") ? t("eDup") : t("eAdd"));
    onCreated(data as LeadSource); onChange((data as LeadSource).id); setAdding(false); setName("");
  }

  if (adding) return (
    <div className="flex flex-wrap items-center gap-2 animate-[bp-pop-in_0.18s_ease-out]">
      <input autoFocus value={name} maxLength={60} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder={t("newPh")}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } if (e.key === "Escape") setAdding(false); }}
        autoComplete="bp-off" className={`${inputClass} min-w-0 flex-1`} />
      <button type="button" onClick={add} disabled={busy}
        className="rounded-lg bg-[#0f766e] px-4 py-2.5 text-[14px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-[#0c5f59] disabled:opacity-60">{busy ? "…" : t("add")}</button>
      <button type="button" onClick={() => { setAdding(false); setErr(""); }} className="rounded-lg px-3 py-2.5 text-[14px] font-medium text-slate-500 hover:bg-slate-100">{t("cancel")}</button>
      {err && <p className="w-full text-[13px] text-red-600">{err}</p>}
    </div>
  );
  return (
    <div>
      <SearchSelect id={id} ariaLabel={t("label")} value={value} options={options} placeholder={t("choose")}
        onChange={(v) => (v === NEW ? setAdding(true) : onChange(v))} />
      <Link prefetch={false} href="/dashboard/settings/lead-sources" className="mt-1.5 inline-block text-[12.5px] font-medium text-slate-500 hover:text-[#0f766e] hover:underline">{t("manage")}</Link>
    </div>
  );
}

type Person = { id: string; display_name: string };

// Buscador de clientes para "Referido por" (busca en vivo; no carga toda la lista)
export function ReferrerSelect({ id, companyId, selfId, value, onChange }: {
  id: string; companyId: string; selfId?: string; value: string; onChange: (id: string) => void;
}) {
  const t = useTranslations("lead");
  const [picked, setPicked] = useState<Person | null>(null);
  const [q, setQ] = useState("");
  const [list, setList] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  // Nombre del ya elegido (al editar)
  useEffect(() => {
    if (!value) { setPicked(null); return; }
    if (picked?.id === value) return;
    createClient().from("customers").select("id, display_name").eq("id", value).maybeSingle()
      .then(({ data }) => data && setPicked(data as Person));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const n = ++seq.current;
    const term = q.trim().replace(/[%,()]/g, " ");
    const timer = setTimeout(async () => {
      setLoading(true);
      let req = createClient().from("customers").select("id, display_name").eq("company_id", companyId).order("display_name").limit(8);
      if (term) req = req.ilike("display_name", `%${term}%`);
      if (selfId) req = req.neq("id", selfId);
      const { data } = await req;
      if (n === seq.current) { setList((data ?? []) as Person[]); setLoading(false); }
    }, term ? 220 : 0);
    return () => clearTimeout(timer);
  }, [q, companyId, selfId]);

  return (
    <Combobox immediate value={picked} by="id" onChange={(p: Person | null) => { setPicked(p); onChange(p?.id ?? ""); setQ(""); }} onClose={() => setQ("")}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
        </span>
        <ComboboxInput id={id} aria-label={t("referredBy")} autoComplete="bp-off" data-lpignore="true" data-1p-ignore="true" spellCheck={false}
          placeholder={t("searchCustomer")} displayValue={(p: Person | null) => p?.display_name ?? ""}
          onFocus={(e) => e.currentTarget.select()} onChange={(e) => setQ(e.target.value)}
          className={`${inputClass} pl-10 pr-16`} />
        {picked && (
          <button type="button" aria-label={t("clear")} title={t("clear")} onClick={() => { setPicked(null); onChange(""); }}
            className="absolute inset-y-0 right-9 flex items-center px-1.5 text-slate-400 hover:text-red-500">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
          </button>
        )}
        <ComboboxButton aria-label={t("showAll")} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"><Chevron /></ComboboxButton>
      </div>
      <ComboboxOptions anchor="bottom start" transition className={`${panelClass} w-[var(--input-width)]`}>
        {list.length === 0 && <div className="px-4 py-3 text-sm text-slate-500">{loading ? t("searching") : t("noMatch")}</div>}
        {list.map((p) => (
          <ComboboxOption key={p.id} value={p} className={optionClass}>
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e9f7f4] text-[12px] font-bold text-[#0f766e]">{p.display_name.slice(0, 1).toUpperCase()}</span>
              <span className="truncate">{p.display_name}</span>
            </span>
            <Check />
          </ComboboxOption>
        ))}
      </ComboboxOptions>
    </Combobox>
  );
}
