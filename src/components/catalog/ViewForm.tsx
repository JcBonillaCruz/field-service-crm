"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CatalogModule, Criterion, FIELDS, MODULE_INFO, NO_VALUE_OPS, OPS, ViewDef, Visibility } from "@/lib/catalog-views";
import { ROLE_LABEL, Role } from "@/lib/types";
import SearchSelect from "@/components/ui/SearchSelect";
import SelectMenu from "@/components/ui/SelectMenu";
import DatePicker from "@/components/ui/DatePicker";
import { inputClass } from "@/components/customers/ui";
import { FormHeader, InfoIcon, Tip } from "@/components/catalog/FormBits";

const ROLES: Role[] = ["owner", "manager", "office", "technician"];
const blank = (): Criterion => ({ field: "", op: "", value: "" });

// "New View" como Zoho: nombre, favorito, criterios, columnas (arrastrar) y quién la ve
export default function ViewForm({ module, companyId, view, from }: { module: CatalogModule; companyId: string; view?: ViewDef; from?: ViewDef }) {
  const router = useRouter();
  const base = MODULE_INFO[module].base;
  const src = view ?? from;
  const fields = FIELDS[module];
  const [name, setName] = useState(view?.name ?? "");
  const [fav, setFav] = useState(view?.is_favorite ?? false);
  const [criteria, setCriteria] = useState<Criterion[]>(src?.criteria.length ? src.criteria.map((c) => ({ ...c })) : [blank()]);
  const [match, setMatch] = useState<"all" | "any">(src?.match ?? "all");
  const [selected, setSelected] = useState<string[]>(src?.columns ?? ["name"]);
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(view?.visibility ?? "me");
  const [roles, setRoles] = useState<string[]>(view?.roles ?? ["owner", "manager"]);
  const [drag, setDrag] = useState<{ key: string; from: "avail" | "sel" } | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const available = useMemo(
    () => fields.filter((f) => !selected.includes(f.key) && f.label.toLowerCase().includes(search.trim().toLowerCase())),
    [fields, selected, search],
  );
  const label = (k: string) => fields.find((f) => f.key === k)?.label ?? k;

  const setC = (i: number, patch: Partial<Criterion>) => setCriteria((l) => l.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const addAfter = (i: number) => setCriteria((l) => [...l.slice(0, i + 1), blank(), ...l.slice(i + 1)]);
  const removeC = (i: number) => setCriteria((l) => (l.length === 1 ? [blank()] : l.filter((_, j) => j !== i)));

  function addCol(key: string, at?: number) {
    setSelected((l) => { const n = l.filter((k) => k !== key); n.splice(at ?? n.length, 0, key); return n; });
  }
  function removeCol(key: string) { if (key !== "name") setSelected((l) => l.filter((k) => k !== key)); }
  function dropOnSelected(at: number) {
    if (!drag) return;
    if (drag.key === "name" && at !== 0) { setDrag(null); setOverIdx(null); return; }
    addCol(drag.key, Math.max(1, at));
    setDrag(null); setOverIdx(null);
  }

  async function save() {
    if (!name.trim()) return setError("Enter a name for this view.");
    const clean = criteria.filter((c) => c.field && c.op && (NO_VALUE_OPS.has(c.op) || c.value !== ""));
    if (criteria.some((c) => c.field && !c.op)) return setError("Choose a comparator for every criterion.");
    setSaving(true); setError("");
    const row = {
      company_id: companyId, module, name: name.trim(), is_favorite: fav, criteria: clean, match,
      columns: ["name", ...selected.filter((k) => k !== "name")], visibility, roles: visibility === "roles" ? roles : [],
    };
    const db = createClient().from("list_views");
    const { data, error: e } = view
      ? await db.update(row).eq("id", view.id).select("id").single()
      : await db.insert(row).select("id").single();
    if (e || !data) { setSaving(false); return setError("The view couldn't be saved. Did you run the SQL for Paso 3.24?"); }
    try { localStorage.setItem(`bp-view-last:${module}:${companyId}`, data.id); } catch { /* */ }
    router.push(`${base}?view=${data.id}`);
    router.refresh();
  }
  async function remove() {
    if (!view || !window.confirm(`Delete the view "${view.name}"?`)) return;
    await createClient().from("list_views").delete().eq("id", view.id);
    try { localStorage.removeItem(`bp-view-last:${module}:${companyId}`); } catch { /* */ }
    router.push(base);
    router.refresh();
  }

  const fieldOptions = fields.map((f) => ({ value: f.key, label: f.label }));

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title={view ? "Edit View" : "New View"} closeHref={base} />
      <div className="flex-1">
        <div className="border-b border-slate-200 bg-[#fafbfc] px-5 py-6 sm:px-8">
          <label htmlFor="vw-name" className="mb-1.5 block text-[15px] text-red-600">Name*</label>
          <div className="flex flex-wrap items-center gap-5">
            <input id="vw-name" autoFocus value={name} onChange={(e) => { setName(e.target.value); setError(""); }} className={`${inputClass} max-w-[560px]`} />
            <button type="button" onClick={() => setFav((v) => !v)} className="group/f flex items-center gap-2 text-[15px] text-slate-700">
              <svg viewBox="0 0 20 20" className={`h-5 w-5 transition-transform duration-200 group-hover/f:scale-125 ${fav ? "fill-[#f59e0b] text-[#f59e0b]" : "fill-none text-slate-400"}`} stroke="currentColor" strokeWidth="1.5"><path d="m10 2.8 2.2 4.5 5 .7-3.6 3.5.8 5L10 14.2l-4.5 2.3.9-5L2.8 8l5-.7z" strokeLinejoin="round" /></svg>
              Mark as Favorite
            </button>
          </div>
        </div>

        <div className="space-y-10 px-5 py-8 sm:px-8">
          {/* Criterios */}
          <section>
            <h2 className="mb-4 text-[17px] font-semibold text-[#0b1f3a]">Define the criteria <span className="font-normal text-slate-500">( if any )</span></h2>
            <div className="space-y-3">
              {criteria.map((c, i) => {
                const f = fields.find((x) => x.key === c.field);
                const ops = f ? OPS[f.type] : [];
                const needsValue = Boolean(c.op) && !NO_VALUE_OPS.has(c.op);
                return (
                  <div key={i}>
                    {i > 0 && (
                      <button type="button" onClick={() => setMatch((m) => (m === "all" ? "any" : "all"))} title="Click to switch between AND / OR"
                        className="mb-3 ml-1 rounded-md border border-[#14a39a]/50 bg-[#e9f7f4] px-2.5 py-0.5 text-xs font-semibold text-[#0f766e] transition-colors hover:bg-[#0f766e] hover:text-white">
                        {match === "all" ? "AND" : "OR"}
                      </button>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex w-full max-w-[18rem] items-stretch">
                        <span className="flex w-11 shrink-0 items-center justify-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-100 text-sm text-slate-600">{i + 1}</span>
                        <div className="min-w-0 flex-1 [&_input]:rounded-l-none">
                          <SearchSelect ariaLabel={`Field ${i + 1}`} value={c.field} placeholder="Select a field" options={fieldOptions}
                            onChange={(v) => setC(i, { field: v, op: OPS[fields.find((x) => x.key === v)!.type][0].value, value: "" })} />
                        </div>
                      </div>
                      <div className="w-full max-w-[13rem]">
                        <SearchSelect ariaLabel={`Comparator ${i + 1}`} value={c.op} placeholder="Select a comparator" options={ops} onChange={(v) => setC(i, { op: v })} />
                      </div>
                      <div className="w-full max-w-[20rem]">
                        {f?.type === "choice" ? (
                          <SelectMenu ariaLabel={`Value ${i + 1}`} value={c.value} placeholder="Select a value" options={f.choices ?? []} onChange={(v) => setC(i, { value: v })} />
                        ) : f?.type === "date" && needsValue ? (
                          <DatePicker value={c.value} onChange={(v) => setC(i, { value: v })} />
                        ) : (
                          <input aria-label={`Value ${i + 1}`} value={c.value} disabled={!needsValue} inputMode={f?.type === "number" ? "decimal" : undefined}
                            onChange={(e) => setC(i, { value: f?.type === "number" ? e.target.value.replace(/[^0-9.-]/g, "") : e.target.value })}
                            className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`} />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => addAfter(i)} aria-label="Add criterion below" className="group/a flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-[#e9f7f4] hover:text-[#0f766e]">
                          <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-200 group-hover/a:rotate-90" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>
                        </button>
                        <button type="button" onClick={() => removeC(i)} aria-label="Remove criterion" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600">
                          <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h12M8 6V4.5h4V6M6 6l.7 10a1.5 1.5 0 0 0 1.5 1.4h3.6a1.5 1.5 0 0 0 1.5-1.4L14 6" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={() => setCriteria((l) => [...l, blank()])} className="mt-4 flex items-center gap-2 text-[15px] font-medium text-[#0f766e] hover:underline">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0f766e] text-white"><svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M10 5v10M5 10h10" /></svg></span>
              Add Criterion
            </button>
          </section>

          {/* Columnas */}
          <section>
            <h2 className="mb-4 text-[17px] font-semibold text-[#0b1f3a]">Columns Preference:</h2>
            <div className="grid max-w-[980px] overflow-hidden rounded-xl border border-slate-200 md:grid-cols-2">
              <div className="border-b border-slate-200 md:border-b-0 md:border-r">
                <p className="border-b border-slate-100 bg-[#fafbfc] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Available Columns</p>
                <div className="border-b border-slate-100 px-3 py-2">
                  <div className="flex items-center gap-2 rounded-lg px-2">
                    <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="w-full bg-transparent py-1.5 text-sm focus:outline-none" />
                  </div>
                </div>
                <ul className="h-80 overflow-y-auto py-1" onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag?.from === "sel") removeCol(drag.key); setDrag(null); setOverIdx(null); }}>
                  {available.map((f) => (
                    <li key={f.key} draggable onDragStart={() => setDrag({ key: f.key, from: "avail" })} onDragEnd={() => { setDrag(null); setOverIdx(null); }}
                      className="group/col flex cursor-grab items-center gap-3 px-4 py-2 text-[15px] text-slate-700 transition-colors hover:bg-[#d7f1eb] active:cursor-grabbing">
                      <Grip />
                      <span className="flex-1">{f.label}</span>
                      <button type="button" onClick={() => addCol(f.key)} aria-label={`Add ${f.label}`} className="rounded-md px-2 py-0.5 text-xs font-semibold text-[#0f766e] opacity-0 transition-opacity hover:bg-[#0f766e] hover:text-white group-hover/col:opacity-100">Add</button>
                    </li>
                  ))}
                  {available.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">No more columns</li>}
                </ul>
              </div>
              <div>
                <p className="flex items-center gap-2 border-b border-slate-100 bg-[#fafbfc] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#16a34a]" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10" cy="10" r="7.5" /><path d="m6.8 10.2 2.2 2.2 4.2-4.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Selected Columns
                </p>
                <ul className="h-[23.3rem] overflow-y-auto py-1" onDragOver={(e) => { e.preventDefault(); if (overIdx == null) setOverIdx(selected.length); }} onDrop={() => dropOnSelected(overIdx ?? selected.length)}>
                  {selected.map((k, i) => (
                    <li key={k} draggable={k !== "name"} onDragStart={() => setDrag({ key: k, from: "sel" })} onDragEnd={() => { setDrag(null); setOverIdx(null); }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOverIdx(i); }} onDrop={(e) => { e.stopPropagation(); dropOnSelected(i); }}
                      className={`group/col flex items-center gap-3 px-4 py-2 text-[15px] transition-colors ${k === "name" ? "bg-[#eef2ff]/60 text-[#0b1f3a]" : "cursor-grab text-slate-700 hover:bg-[#d7f1eb] active:cursor-grabbing"} ${overIdx === i && drag ? "border-t-2 border-[#0f766e]" : "border-t-2 border-transparent"}`}>
                      <Grip />
                      <span className="flex-1">{label(k)}{k === "name" && <span className="ml-0.5 text-red-500">*</span>}</span>
                      {k !== "name" && (
                        <button type="button" onClick={() => removeCol(k)} aria-label={`Remove ${label(k)}`} className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover/col:opacity-100">
                          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-400">Drag columns between the lists, or drag inside Selected Columns to change the order.</p>
          </section>

          {/* Visibilidad */}
          <section>
            <h2 className="mb-4 text-[17px] font-semibold text-[#0b1f3a]">Visibility Preference</h2>
            <div className="max-w-[980px] rounded-xl border border-slate-200 bg-[#fafbfc] px-5 py-5">
              <p className="mb-3 text-[15px] text-slate-700">Share With</p>
              <div className="flex flex-wrap gap-3">
                {([["me", "Only Me", "Only you will see this view."], ["roles", "Only Selected Users & Roles", "People with the roles you choose will see this view."], ["everyone", "Everyone", "Everyone in this organization will see this view."]] as [Visibility, string, string][]).map(([v, l, tip]) => (
                  <Tip key={v} text={tip} side="top">
                    <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg border bg-white px-4 py-2.5 text-[15px] transition-colors ${visibility === v ? "border-[#0f766e] text-[#0b1f3a] ring-2 ring-[#14a39a]/20" : "border-slate-200 text-slate-700 hover:border-[#14a39a]"}`}>
                      <input type="radio" name="visibility" checked={visibility === v} onChange={() => setVisibility(v)} className="h-4 w-4 accent-[#0f766e]" />
                      {l}<InfoIcon />
                    </label>
                  </Tip>
                ))}
              </div>
              {visibility === "roles" && (
                <div className="mt-4 flex flex-wrap gap-2 animate-[bp-fade_0.2s_ease-out]">
                  {ROLES.map((r) => {
                    const on = roles.includes(r);
                    return (
                      <button key={r} type="button" onClick={() => setRoles((l) => (on ? l.filter((x) => x !== r) : [...l, r]))}
                        className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${on ? "border-[#0f766e] bg-[#0f766e] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-[#14a39a]"}`}>
                        {ROLE_LABEL[r]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-5 py-3 sm:px-8">
        <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
        <button type="button" onClick={() => router.push(base)} className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {view && <button type="button" onClick={remove} className="ml-auto text-sm font-medium text-red-600 hover:underline">Delete view</button>}
      </div>
    </div>
  );
}

const Grip = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400" fill="currentColor" aria-hidden="true">
    {[6, 10, 14].map((y) => [7.5, 12.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" />))}
  </svg>
);
