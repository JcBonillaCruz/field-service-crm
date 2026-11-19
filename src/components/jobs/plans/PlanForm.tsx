"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { inputClass } from "@/components/customers/ui";
import { FormHeader, FormRow, SaveBar, SectionTitle } from "@/components/catalog/FormBits";
import SelectMenu from "@/components/ui/SelectMenu";
import DatePicker from "@/components/ui/DatePicker";
import PayerPicker from "@/components/expenses/PayerPicker";
import type { PayerOption } from "@/components/expenses/ExpensesWorkspace";
import { TechDot } from "@/components/jobs/EventBar";
import { ARRIVAL_WINDOWS, JobSettings, JobType, TeamMember, addressLine, arrivalLabel, durationLabel, fmtHour, isoDay, receivesJobs, timeToMin, usd } from "@/lib/jobs";
import { askConfirm } from "@/lib/confirm";
import { BILLING, FREQ_PRESETS, FreqPreset, HORIZON_DAYS, MONTHS, Plan, PlanBilling, PlanService, freqFromPreset, planError, presetOf } from "@/lib/maintenance";

type Addr = { id: string; label: string | null; street: string | null; unit: string | null; city: string | null; state: string | null; zip: string | null };
type Service = { id: string; name: string; unit: string | null; description: string | null; price: number | null };
type Sub = { id: string; number: string; profile_name: string | null; status: string };

const TIMES = Array.from({ length: 96 }, (_, i) => i * 15);
const timeLabel = (m: number) => `${fmtHour(m).replace(" ", ":" + String(m % 60).padStart(2, "0") + " ")}`;
const DURATIONS = [30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480];
const seg = (on: boolean) => `rounded-lg border px-3 py-1.5 text-[13.5px] font-medium transition-all ${on ? "border-[#0f766e] bg-[#f3fbf8] text-[#0b1f3a]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`;

// Jobs → Maintenance plans → New / Edit (Paso 5.11). Pantalla completa: solo el menú y el formulario.
export default function PlanForm({ companyId, actor, settings, types, team, customers: initialCustomers, initial, defaults }: {
  companyId: string; actor: string; settings: JobSettings; types: JobType[]; team: TeamMember[]; customers: PayerOption[]; initial?: Plan; defaults?: { customer?: string };
}) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState<string | null>(initial?.customer_id ?? defaults?.customer ?? null);
  const [typed, setTyped] = useState("");
  const [addresses, setAddresses] = useState<Addr[]>([]);
  const [addressId, setAddressId] = useState(initial?.address_id ?? "");
  const [typeId, setTypeId] = useState(initial?.job_type_id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [nameTouched, setNameTouched] = useState(editing);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [techNotes, setTechNotes] = useState(initial?.tech_notes ?? "");

  const [preset, setPreset] = useState<FreqPreset>(initial ? presetOf(initial) : "n_months");
  const [everyN, setEveryN] = useState(String(initial ? initial.every_n : 6));
  const [months, setMonths] = useState<number[]>(initial?.season_months?.length ? initial.season_months : [4, 10]);
  const [startDate, setStartDate] = useState(initial?.start_date ?? isoDay(new Date()));
  const [startMin, setStartMin] = useState(initial?.start_min ?? Math.max(timeToMin(settings.day_start), 9 * 60));
  const [duration, setDuration] = useState(initial?.duration_min ?? settings.default_duration_min);
  const [arrival, setArrival] = useState(initial?.arrival_window_min ?? settings.default_arrival_window_min);
  const [skipClosed, setSkipClosed] = useState(initial?.skip_closed_days ?? true);
  const [techIds, setTechIds] = useState<string[]>(initial?.tech_ids ?? []);
  const [endKind, setEndKind] = useState<"never" | "count" | "date">(initial?.end_kind ?? "never");
  const [endCount, setEndCount] = useState(String(initial?.end_count ?? 2));
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");

  const [billing, setBilling] = useState<PlanBilling>(initial?.billing ?? "per_visit");
  const [subs, setSubs] = useState<Sub[]>([]);
  const [subId, setSubId] = useState(initial?.subscription_id ?? "");
  const [catalog, setCatalog] = useState<Service[]>([]);
  const [services, setServices] = useState<PlanService[]>(initial?.services ?? []);
  const [price, setPrice] = useState(initial ? String(initial.price || "") : "");
  const [priceTouched, setPriceTouched] = useState(editing);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const customer = customers.find((c) => c.id === customerId) ?? null;
  const activeTypes = types.filter((t) => t.is_active || t.id === typeId);
  const techs = useMemo(() => team.filter((m) => receivesJobs(m) || techIds.includes(m.user_id)), [team, techIds]);
  const [techQ, setTechQ] = useState("");
  const manyTechs = techs.length > 8;
  const techShown = useMemo(() => {
    if (!manyTechs) return techs;
    const q = techQ.trim().toLowerCase();
    return [...techs.filter((m) => techIds.includes(m.user_id)), ...techs.filter((m) => !techIds.includes(m.user_id) && (!q || m.full_name.toLowerCase().includes(q))).slice(0, q ? 12 : 6)];
  }, [manyTechs, techs, techQ, techIds]);

  // Job Sites y suscripciones del cliente elegido
  useEffect(() => {
    if (!customerId) { setAddresses([]); setSubs([]); return; }
    let alive = true;
    const sb = createClient();
    sb.from("customer_addresses").select("id, label, street, unit, city, state, zip, is_primary").eq("customer_id", customerId)
      .order("is_primary", { ascending: false }).order("created_at").then(({ data }) => {
        if (!alive) return;
        const list = (data ?? []) as Addr[];
        setAddresses(list);
        setAddressId((cur) => (cur && list.some((a) => a.id === cur) ? cur : list[0]?.id ?? ""));
      });
    sb.from("subscriptions").select("id, number, profile_name, status").eq("company_id", companyId).eq("customer_id", customerId).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => { if (alive) setSubs(((data ?? []) as Sub[]).filter((s) => s.status !== "cancelled" || s.id === subId)); }, () => undefined);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, companyId]);
  // Servicios del catálogo (los mismos que se agregan a un trabajo)
  useEffect(() => {
    createClient().rpc("tech_services", { p_company: companyId }).then(({ data }) => setCatalog(((data as { items?: Service[] } | null)?.items ?? []) as Service[]), () => undefined);
  }, [companyId]);

  // Nombre sugerido: "Tune-Up · every 6 months"
  const every = Math.max(1, Math.round(Number(everyN) || 1));
  const freq = freqFromPreset(preset, every);
  const freqText = preset === "seasonal" ? (months.length ? [...months].sort((a, b) => a - b).map((m) => MONTHS[m - 1]).join(" & ") : "by season")
    : preset === "weekly" ? "every week" : preset === "biweekly" ? "every 2 weeks" : preset === "monthly" ? "every month" : preset === "n_months" ? `every ${freq.every_n} months` : `every ${freq.every_n} days`;
  const typeName = types.find((t) => t.id === typeId)?.name ?? "";
  useEffect(() => { if (!nameTouched) setName(`${typeName || "Maintenance"} · ${freqText}`); }, [nameTouched, typeName, freqText]);
  // Precio sugerido: la suma de los servicios (si la persona puede ver precios)
  const servicesTotal = services.reduce((a, s) => a + (Number(catalog.find((c) => c.id === s.item_id)?.price) || 0) * s.qty, 0);
  useEffect(() => { if (!priceTouched && servicesTotal > 0) setPrice(servicesTotal.toFixed(2)); }, [priceTouched, servicesTotal]);

  function pickType(id: string) {
    setTypeId(id);
    const t = types.find((x) => x.id === id);
    if (t && !editing) setDuration(t.default_duration_min);
  }
  const toggleTech = (id: string) => setTechIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const makeLead = (id: string) => setTechIds((l) => [id, ...l.filter((x) => x !== id)]);
  const addService = (id: string) => { const s = catalog.find((c) => c.id === id); if (s && !services.some((x) => x.item_id === id)) setServices((l) => [...l, { item_id: s.id, name: s.name, qty: 1 }]); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) return setError("Choose the customer.");
    if (!name.trim()) return setError("Give the plan a name.");
    if (!startDate) return setError("Choose the date of the first visit.");
    if (preset === "seasonal" && !months.length) return setError("Choose at least one month.");
    if (billing === "subscription" && !subId) return setError("Choose the subscription that pays for this plan, or pick another way to charge.");
    if (endKind === "count" && !(Number(endCount) >= 1)) return setError("Enter how many visits the plan includes.");
    if (endKind === "date" && (!endDate || endDate < startDate)) return setError("The end date must be after the first visit.");
    if (editing && !(await askConfirm({ title: "Save the changes to this plan?", message: "Visits that haven't started are created again with the new details. Visits already started or finished stay as they are.", confirmLabel: "Save plan", tone: "teal" }))) return;
    setSaving(true); setError("");
    const { data, error: err } = await createClient().rpc("maintenance_plan_save", {
      p_company: companyId, p_id: initial?.id ?? null,
      p: {
        name: name.trim(), customer_id: customerId, address_id: addressId || null, job_type_id: typeId || null, description: description.trim(), tech_notes: techNotes.trim(),
        price: Number(price) || 0, services, ...freq, season_months: preset === "seasonal" ? months : [], start_date: startDate, start_min: startMin, duration_min: duration,
        arrival_window_min: arrival, tech_ids: techIds, skip_closed_days: skipClosed, end_kind: endKind, end_count: endKind === "count" ? Math.round(Number(endCount)) : null,
        end_date: endKind === "date" ? endDate : null, billing, subscription_id: billing === "subscription" ? subId : null, actor,
      },
    });
    if (err || !data) { setSaving(false); return setError(planError(err)); }
    router.push(`/dashboard/jobs/plans/${data}?saved=1`);
    router.refresh();
  }

  const closeHref = initial ? `/dashboard/jobs/plans/${initial.id}` : "/dashboard/jobs/plans";
  const timeOpts = TIMES.map((m) => ({ value: String(m), label: timeLabel(m) }));
  const durOpts = Array.from(new Set([...DURATIONS, duration])).sort((a, b) => a - b).map((m) => ({ value: String(m), label: durationLabel(m) }));
  const canAdd = catalog.filter((c) => !services.some((s) => s.item_id === c.id));

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="flex min-h-[calc(100vh-4rem)] min-w-0 flex-col overflow-x-hidden bg-white">
      <FormHeader title={editing ? "Edit maintenance plan" : "New maintenance plan"} closeHref={closeHref} />

      <div className="space-y-6 border-b border-slate-200 px-5 py-7 sm:px-8">
        <div className="grid max-w-[1000px] grid-cols-[minmax(0,1fr)] gap-6">
          <FormRow label="Customer" required hint="Search your customers or add a new one here." alignTop width="max-w-[560px]">
            <PayerPicker companyId={companyId} people={customers} customerId={customerId} name={typed}
              onPick={(c) => setCustomerId(c?.id ?? null)} onType={setTyped}
              onCreated={(c) => { setCustomers((l) => [c, ...l]); setCustomerId(c.id); }} hint="Search by name, phone or email. Not there? Tap New to add it." />
          </FormRow>
          {customerId && (
            <FormRow label="Job Site" hint="The house or building where the visits happen. Equipment and readings stay linked to this address." width="max-w-[560px]">
              <SelectMenu value={addressId} ariaLabel="Job site" placeholder={addresses.length ? "Choose a job site" : "No address on file (add it in the customer)"}
                options={addresses.map((a) => ({ value: a.id, label: `${a.label ? `${a.label} · ` : ""}${addressLine(a)}` }))} onChange={setAddressId} />
            </FormRow>
          )}
          <FormRow label="Job type" hint="Each visit is created with this type. A Tune-Up type opens the Tune-Up form for the technician." width="max-w-[340px]">
            <SelectMenu value={typeId} ariaLabel="Job type" placeholder="Choose a type"
              options={[{ value: "", label: "No type" }, ...activeTypes.map((t) => ({ value: t.id, label: `${t.name}${t.form_kind === "tune_up" ? " (Tune-Up form)" : ""}` }))]} onChange={pickType} />
          </FormRow>
          <FormRow label="Plan name" required htmlFor="p-name" hint="Shows on every visit of the plan: on the calendar, in Operations and on the technician's phone." width="max-w-[560px]">
            <input id="p-name" value={name} onChange={(e) => { setName(e.target.value); setNameTouched(true); }} maxLength={120} placeholder="e.g. AC Tune-Up · twice a year" className={inputClass} />
          </FormRow>
          <FormRow label="What's included" htmlFor="p-desc" alignTop width="max-w-[560px]">
            <textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What the visit covers (optional)" className={`${inputClass} resize-y`} />
          </FormRow>
          <FormRow label="Notes for the technician" htmlFor="p-tech" alignTop width="max-w-[560px]">
            <textarea id="p-tech" value={techNotes} onChange={(e) => setTechNotes(e.target.value)} rows={2} placeholder="Gate code, where the unit is, pets… (optional)" className={`${inputClass} resize-y`} />
          </FormRow>
        </div>
      </div>

      {/* Cada cuánto */}
      <div className="border-b border-slate-200 px-5 py-7 sm:px-8">
        <div className="grid max-w-[1000px] grid-cols-[minmax(0,1fr)] gap-6">
          <SectionTitle>Visits</SectionTitle>
          <FormRow label="Repeats" alignTop width="max-w-[560px]">
            <SelectMenu value={preset} ariaLabel="Repeats" options={FREQ_PRESETS} onChange={(v) => { const p = v as FreqPreset; setPreset(p); if (p === "n_months" && every < 2) setEveryN("6"); if (p === "n_days") setEveryN("10"); }} />
            {(preset === "n_months" || preset === "n_days") && (
              <div className="mt-2.5 flex items-center gap-2 text-[14px] text-slate-600 animate-[bp-fade_0.2s_ease-out]">
                Every
                <input inputMode="numeric" aria-label={preset === "n_months" ? "Months" : "Days"} value={everyN} onChange={(e) => setEveryN(e.target.value.replace(/\D/g, "").slice(0, 3))} className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-center text-[15px] focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
                {preset === "n_months" ? "months" : "days"}
              </div>
            )}
            {preset === "seasonal" && (
              <div className="mt-2.5 animate-[bp-fade_0.2s_ease-out]">
                <div className="grid grid-cols-6 gap-1.5 sm:max-w-[420px]">
                  {MONTHS.map((m, i) => { const on = months.includes(i + 1); return (
                    <button key={m} type="button" aria-pressed={on} onClick={() => setMonths((l) => (on ? l.filter((x) => x !== i + 1) : [...l, i + 1]))}
                      className={`rounded-lg border py-1.5 text-[13px] font-medium transition-all ${on ? "border-[#0f766e] bg-[#f3fbf8] text-[#0b1f3a]" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>{m}</button>
                  ); })}
                </div>
                <p className="mt-1.5 text-[12px] text-slate-400">One visit in each month you pick, every year, on the same day of the month as the first visit. Example: April and October for the AC and the heating season.</p>
              </div>
            )}
          </FormRow>
          <FormRow label="First visit" hint="The following visits are counted from this date." width="max-w-[260px]"><DatePicker value={startDate} onChange={setStartDate} /></FormRow>
          <FormRow label="Time" width="max-w-[460px]">
            <div className="flex items-center gap-2">
              <div className="flex-1"><SelectMenu value={String(startMin)} ariaLabel="Start time" options={timeOpts} onChange={(v) => setStartMin(Number(v))} /></div>
              <span className="text-slate-400">for</span>
              <div className="flex-1"><SelectMenu value={String(duration)} ariaLabel="Duration" options={durOpts} onChange={(v) => setDuration(Number(v))} /></div>
            </div>
          </FormRow>
          <FormRow label="Arrival window" hint="What the customer is told: the technician arrives between the start time and the end of this window." width="max-w-[560px]">
            <div className="flex flex-wrap gap-2">
              {ARRIVAL_WINDOWS.map((m) => <button key={m} type="button" onClick={() => setArrival(m)} className={seg(arrival === m)}>{arrivalLabel(m)}</button>)}
            </div>
          </FormRow>
          <FormRow label="Closed days" width="max-w-[560px]">
            <label className="flex cursor-pointer items-start gap-2.5 text-[14px] text-slate-700">
              <input type="checkbox" checked={skipClosed} onChange={(e) => setSkipClosed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0f766e]" />
              If a visit lands on a day you don&apos;t work, move it to the next working day
            </label>
          </FormRow>
          <FormRow label="Collaborators" hint="Who usually does these visits. The first one is the lead. Leave it empty and each visit shows up in Unassigned on its day." alignTop width="max-w-[640px]">
            {techs.length === 0 ? <p className="pt-2 text-[13.5px] text-slate-500">No collaborators yet. Invite technicians in Team.</p> : (
              <div className="flex flex-wrap gap-2">
                {manyTechs && <input value={techQ} onChange={(e) => setTechQ(e.target.value)} placeholder={`Search ${techs.length} collaborators`} className={`${inputClass} mb-1 w-full`} />}
                {techShown.map((m) => {
                  const i = techIds.indexOf(m.user_id), on = i >= 0;
                  return (
                    <div key={m.user_id} className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[13.5px] transition-all ${on ? "border-transparent text-[#0b1f3a] shadow-sm" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                      style={on ? { background: `${m.color}18`, boxShadow: `inset 0 0 0 1.5px ${m.color}` } : undefined}>
                      <button type="button" onClick={() => toggleTech(m.user_id)} className="flex items-center gap-2" aria-pressed={on}>
                        <TechDot t={m} size={26} ring={false} /><span className="font-medium">{m.full_name}</span>
                      </button>
                      {on && (i === 0 ? <span className="rounded-full bg-white px-1.5 text-[10.5px] font-semibold" style={{ color: m.color }}>Lead</span>
                        : <button type="button" onClick={() => makeLead(m.user_id)} className="rounded-full px-1.5 text-[10.5px] font-semibold text-slate-400 hover:bg-white hover:text-[#0f766e]">Make lead</button>)}
                    </div>
                  );
                })}
              </div>
            )}
          </FormRow>
          <FormRow label="Plan ends" alignTop width="max-w-[560px]">
            <div className="flex flex-wrap gap-2">
              {([["never", "Never"], ["count", "After a number of visits"], ["date", "On a date"]] as const).map(([v, l]) => <button key={v} type="button" onClick={() => setEndKind(v)} className={seg(endKind === v)}>{l}</button>)}
            </div>
            {endKind === "count" && (
              <div className="mt-2.5 flex items-center gap-2 text-[14px] text-slate-600 animate-[bp-fade_0.2s_ease-out]">
                <input inputMode="numeric" aria-label="Number of visits" value={endCount} onChange={(e) => setEndCount(e.target.value.replace(/\D/g, "").slice(0, 3))} className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-center text-[15px] focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" /> visits in total
              </div>
            )}
            {endKind === "date" && <div className="mt-2.5 max-w-[260px] animate-[bp-fade_0.2s_ease-out]"><DatePicker value={endDate} onChange={setEndDate} minDate={startDate || undefined} /></div>}
          </FormRow>
        </div>
      </div>

      {/* Servicios y cobro */}
      <div className="px-5 py-7 sm:px-8">
        <div className="grid max-w-[1000px] grid-cols-[minmax(0,1fr)] gap-6">
          <SectionTitle>Services and billing</SectionTitle>
          <FormRow label="Services" hint="From your catalog. They are added to every visit, ready for the invoice. Parts are still scanned on site." alignTop width="max-w-[560px]">
            {services.length > 0 && (
              <ul className="mb-2.5 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {services.map((s) => (
                  <li key={s.item_id} className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-[14px] text-[#0b1f3a]">{s.name}</span>
                    <input inputMode="decimal" aria-label={`Quantity of ${s.name}`} value={String(s.qty)} onChange={(e) => { const q = Number(e.target.value.replace(/[^\d.]/g, "")); setServices((l) => l.map((x) => (x.item_id === s.item_id ? { ...x, qty: q || 0 } : x))); }}
                      onBlur={() => setServices((l) => l.map((x) => (x.item_id === s.item_id && !(x.qty > 0) ? { ...x, qty: 1 } : x)))} className="w-14 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-center text-[13.5px] focus:border-[#0f766e] focus:bg-white focus:outline-none" />
                    <button type="button" aria-label={`Remove ${s.name}`} onClick={() => setServices((l) => l.filter((x) => x.item_id !== s.item_id))} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-[#fff1f2] hover:text-[#be123c]">
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {catalog.length === 0 ? (services.length === 0 && <p className="pt-2 text-[13.5px] text-slate-500">No services in your catalog yet. You can still add them on each job.</p>)
              : canAdd.length > 0 && <SelectMenu value="" ariaLabel="Add a service" placeholder="+ Add a service from the catalog" options={canAdd.slice(0, 300).map((c) => ({ value: c.id, label: c.price != null ? `${c.name} · ${usd(Number(c.price))}` : c.name }))} onChange={addService} />}
          </FormRow>
          <FormRow label="Price per visit" htmlFor="p-price" hint="The expected amount of each visit. It shows as the job's estimate." width="max-w-[220px]">
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input id="p-price" inputMode="decimal" value={price} onChange={(e) => { setPrice(e.target.value.replace(/[^\d.]/g, "")); setPriceTouched(true); }} placeholder="0.00" className={`${inputClass} pl-7`} />
            </div>
          </FormRow>
          <FormRow label="How it's charged" alignTop width="max-w-[560px]">
            <div className="grid gap-2">
              {BILLING.map((b) => (
                <label key={b.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-all ${billing === b.value ? "border-[#0f766e] bg-[#f3fbf8]" : "border-slate-200 hover:border-slate-300"}`}>
                  <input type="radio" name="billing" checked={billing === b.value} onChange={() => setBilling(b.value)} className="mt-0.5 h-4 w-4 accent-[#0f766e]" />
                  <span className="min-w-0"><span className="block text-[14px] font-semibold text-[#0b1f3a]">{b.label}</span><span className="block text-[12.5px] text-slate-500">{b.hint}</span></span>
                </label>
              ))}
            </div>
            {billing === "subscription" && (
              <div className="mt-2.5 animate-[bp-fade_0.2s_ease-out]">
                {!customerId ? <p className="text-[13px] text-slate-500">Choose the customer first.</p>
                  : subs.length === 0 ? <p className="rounded-xl border border-[#fcd38d] bg-[#fffbf3] px-3.5 py-2.5 text-[13px] text-[#92400e]">{customer?.display_name ?? "This customer"} has no subscription yet. Create it in Finances → Subscriptions, then come back and pick it here.</p>
                  : <SelectMenu value={subId} ariaLabel="Subscription" placeholder="Choose the subscription" options={subs.map((s) => ({ value: s.id, label: `${s.number}${s.profile_name ? ` · ${s.profile_name}` : ""}` }))} onChange={setSubId} />}
              </div>
            )}
          </FormRow>
          <p className="max-w-[760px] rounded-xl bg-slate-50 px-4 py-3 text-[13px] leading-relaxed text-slate-600">
            BrightPro creates the visits of the next {HORIZON_DAYS} days by itself and adds the following ones every morning. Each visit is a normal job: you can move it, reassign it or cancel it without affecting the rest of the plan.
          </p>
        </div>
      </div>

      <SaveBar saving={saving} cancelHref={closeHref} error={error} saveLabel={editing ? "Save plan" : "Create plan"} />
    </form>
  );
}
