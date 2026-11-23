"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { inputClass } from "@/components/customers/ui";
import { Toast } from "@/components/sales/SalesBits";
import { AlertFrequency, InvCategory, InvItem, InvLocation, InvMember, InvStock, KitRow } from "@/lib/inventory";
import { FullDesign, PDF_TEMPLATES, PDF_TEMPLATE_IDS, PdfDesign, PdfTemplateId, buildCountPdf, companyLogoPng, designOf, imageToPng, loadPdfBrand, logoBytesOf } from "@/lib/count-pdf";
import { REPORT_SECTIONS, ReportPreset, ReportSection } from "@/lib/inventory-report";
import KitEditor from "@/components/inventory/KitEditor";
import { useRunPreset } from "@/components/inventory/ReportPresets";
import { LowArt, CartArt, ItemsArt } from "@/components/inventory/KpiArt";
import { VanArt, WarehouseArt } from "@/components/inventory/InvArt";
import { SheetIcon } from "@/components/inventory/CountSheetModal";

// =====================================================================
// Paso 6.12f · Ajustes de Inventario en una ventana grande con menú:
//   Categorías · Avisos · Mínimos · Camionetas (kit y solicitudes) · Diseño del PDF (con vista previa) · Reportes
// =====================================================================
export type InvSettingsRow = {
  alert_frequency: AlertFrequency; notify_office: boolean; notify_tech: boolean; tech_can_request: boolean;
  default_wh_min: number; default_van_min: number; pdf_design: PdfDesign; report_presets: ReportPreset[]; van_kit: KitRow[];
};
type Section = "categories" | "alerts" | "minimums" | "vans" | "pdf" | "reports";
const SECTIONS: { k: Section; d: string }[] = [
  { k: "categories", d: "M4 6h7v5H4zM13 6h7v5h-7zM4 13h7v5H4zM13 13h7v5h-7z" },
  { k: "alerts", d: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" },
  { k: "minimums", d: "M4 18h16M7 14V9M12 14V5M17 14v-3" },
  { k: "vans", d: "M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 7 19zM17 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z" },
  { k: "pdf", d: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h4" },
  { k: "reports", d: "M4 4v16h16M8.5 16v-4M12.5 16V8M16.5 16v-6" },
];
const FREQ: AlertFrequency[] = ["once", "daily", "weekly"];

export default function InvSettingsModal({ companyId, company, canEdit, needsSql, newSql, categories, counts, settings, items, stock, locations, members, barcodes }: {
  companyId: string; company: string; canEdit: boolean; needsSql: boolean; newSql: boolean;
  categories: InvCategory[]; counts: Record<string, number>; settings: InvSettingsRow;
  items: InvItem[]; stock: InvStock[]; locations: InvLocation[]; members: InvMember[]; barcodes: Record<string, string>;
}) {
  const t = useTranslations("invSet");
  const tc = useTranslations("common");
  const router = useRouter();
  const sp = useSearchParams();
  const es = useLocale().startsWith("es");
  const first = (SECTIONS.find((x) => x.k === sp.get("s"))?.k ?? "categories") as Section;
  const [sec, setSec] = useState<Section>(first);
  const [cfg, setCfg] = useState(settings);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2400); };
  const close = () => router.push("/dashboard/inventory/dashboard");
  useEffect(() => { document.querySelector(`[data-sec="${sec}"]`)?.scrollIntoView({ inline: "center", block: "nearest" }); }, [sec]);
  useEffect(() => { const on = (e: KeyboardEvent) => { if (e.key === "Escape") close(); }; window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on); }); // eslint-disable-line react-hooks/exhaustive-deps

  // Guarda una parte de los ajustes (upsert de inventory_settings)
  async function save(patch: Partial<InvSettingsRow>, msg = t("saved")) {
    if (!canEdit) return setError(t("eRole"));
    const prev = cfg; const next = { ...cfg, ...patch }; setCfg(next); setError("");
    const { error: e } = await createClient().from("inventory_settings").upsert({ company_id: companyId, alert_frequency: next.alert_frequency, ...patch, updated_at: new Date().toISOString() });
    if (e) { setCfg(prev); return setError(/column|schema/i.test(e.message) ? t("needsSql") : t("eSave")); }
    if ("pdf_design" in patch) loadPdfBrand(companyId, true).catch(() => undefined);
    say(msg); router.refresh();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-slate-900/45 p-0 backdrop-blur-[2px] sm:p-6 lg:p-10" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="flex w-full max-w-[1180px] flex-col overflow-hidden bg-[#f6f8f9] shadow-2xl animate-[bp-pop-in_0.2s_ease-out] sm:rounded-3xl lg:flex-row">
        {/* Menú */}
        <aside className="shrink-0 border-b border-slate-200 bg-white lg:w-64 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
            <div className="min-w-0"><h1 className="truncate text-[19px] font-semibold text-[#0b1f3a]">{t("title")}</h1><p className="truncate text-[12.5px] text-slate-500">{company}</p></div>
            <button type="button" onClick={close} aria-label={tc("close")} className="group/x flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600 lg:hidden">
              <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-300 group-hover/x:rotate-90" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
            </button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 [scrollbar-width:none] lg:flex-col lg:overflow-visible">
            {SECTIONS.map((s) => (
              <button key={s.k} data-sec={s.k} type="button" onClick={() => setSec(s.k)} aria-current={sec === s.k}
                className={`group flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-[14px] transition-colors ${sec === s.k ? "bg-[#dcf2ec] font-semibold text-[#0b5e57]" : "text-slate-700 hover:bg-[#eef7f4]"}`}>
                <svg viewBox="0 0 24 24" className="h-[19px] w-[19px] shrink-0 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={s.d} /></svg>
                {t(`n.${s.k}`)}
              </button>
            ))}
          </nav>
        </aside>

        {/* Contenido */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="hidden items-center justify-between border-b border-slate-200 bg-white px-7 py-4 lg:flex">
            <div><h2 className="text-[18px] font-semibold text-[#0b1f3a]">{t(`n.${sec}`)}</h2><p className="text-[13px] text-slate-500">{t(`d.${sec}`)}</p></div>
            <button type="button" onClick={close} aria-label={tc("close")} className="group/x flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600">
              <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-300 group-hover/x:rotate-90" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
            <p className="mb-4 text-[13px] text-slate-500 lg:hidden">{t(`d.${sec}`)}</p>
            {(needsSql || !newSql) && <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{needsSql ? t("needsBase") : t("needsSql")}</p>}
            {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            {sec === "categories" && <Categories companyId={companyId} categories={categories} counts={counts} say={say} setError={setError} />}
            {sec === "alerts" && <Alerts cfg={cfg} save={save} />}
            {sec === "minimums" && <Minimums companyId={companyId} cfg={cfg} save={save} items={items} stock={stock} locations={locations} say={say} canEdit={canEdit} />}
            {sec === "vans" && <Vans cfg={cfg} save={save} items={items} barcodes={barcodes} />}
            {sec === "pdf" && <PdfDesigner companyId={companyId} company={company} cfg={cfg} save={save} items={items} es={es} />}
            {sec === "reports" && <Reports companyId={companyId} company={company} cfg={cfg} save={save} items={items} stock={stock} locations={locations} members={members} />}
          </div>
        </div>
      </div>
      <Toast text={toast} />
    </div>
  );
}

// ---------- Piezas ----------
const Card = ({ title, hint, art, children }: { title: string; hint?: string; art?: React.ReactNode; children: React.ReactNode }) => (
  <section className="mb-4 rounded-2xl border border-slate-200 bg-white">
    <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">{art}<div className="min-w-0"><h3 className="text-[15.5px] font-semibold text-[#0b1f3a]">{title}</h3>{hint && <p className="text-[13px] text-slate-500">{hint}</p>}</div></div>
    <div className="px-5 py-4">{children}</div>
  </section>
);
function Switch({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-start gap-3 rounded-xl px-1 py-2 text-left hover:bg-slate-50">
      <span className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-[#0f766e]" : "bg-slate-300"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} /></span>
      <span><span className="block text-[14.5px] font-medium text-slate-800">{label}</span>{hint && <span className="block text-[12.5px] text-slate-500">{hint}</span>}</span>
    </button>
  );
}
const numCls = "h-11 w-24 rounded-xl border border-slate-200 bg-white px-3 text-right text-[15px] font-semibold tabular-nums focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15";
type Save = (patch: Partial<InvSettingsRow>, msg?: string) => Promise<void>;

function Categories({ companyId, categories, counts, say, setError }: { companyId: string; categories: InvCategory[]; counts: Record<string, number>; say: (m: string) => void; setError: (m: string) => void }) {
  const t = useTranslations("invSettings");
  const tc = useTranslations("common");
  const router = useRouter();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const dup = (code?: string) => (code === "23505" ? t("exists") : tc("cantSave"));
  async function add(e: React.FormEvent) {
    e.preventDefault(); if (!name.trim()) return;
    const { error } = await createClient().from("item_categories").insert({ company_id: companyId, name: name.trim() });
    if (error) return setError(dup(error.code));
    setName(""); say(t("added")); router.refresh();
  }
  async function rename(id: string) {
    if (!editName.trim()) return;
    const { error } = await createClient().from("item_categories").update({ name: editName.trim() }).eq("id", id);
    if (error) return setError(dup(error.code));
    setEditing(null); say(t("renamed")); router.refresh();
  }
  async function remove(c: InvCategory) {
    const n = counts[c.id] ?? 0;
    if (!(await confirmDelete({ title: t("delQ", { name: c.name }), message: n ? t("delMsg", { n }) : undefined }))) return;
    const { error } = await createClient().from("item_categories").delete().eq("id", c.id);
    if (error) return setError(t("eDel"));
    say(t("deleted")); router.refresh();
  }
  return (
    <Card title={t("cats")} hint={t("catsEx")} art={<ItemsArt size={40} />}>
      <form onSubmit={add} className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("newPh")} maxLength={60} className={inputClass} />
        <button type="submit" disabled={!name.trim()} className="shrink-0 whitespace-nowrap rounded-xl bg-[#0f766e] px-4 text-[15px] font-semibold text-white hover:bg-[#0c5f59] disabled:opacity-50">{tc("add")}</button>
      </form>
      <ul className="mt-3 divide-y divide-slate-100">
        {categories.length === 0 && <li className="py-6 text-center text-sm text-slate-500">{t("none")}</li>}
        {categories.map((c) => (
          <li key={c.id} className="group flex items-center gap-3 py-2.5">
            {editing === c.id ? (
              <>
                <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") rename(c.id); if (e.key === "Escape") setEditing(null); }} className={`${inputClass} py-2`} />
                <button type="button" onClick={() => rename(c.id)} className="whitespace-nowrap rounded-lg bg-[#0f766e] px-3 py-2 text-sm font-semibold text-white">{tc("save")}</button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-[15px] text-slate-800">{c.name}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[12px] tabular-nums text-slate-500">{t("nItems", { n: counts[c.id] ?? 0 })}</span>
                <button type="button" onClick={() => { setEditing(c.id); setEditName(c.name); }} aria-label={t("renameX", { name: c.name })} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-[#e9f7f4] hover:text-[#0f766e] lg:opacity-0 lg:group-hover:opacity-100">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M13.5 3.5l3 3L7 16H4v-3z" /></svg></button>
                <button type="button" onClick={() => remove(c)} aria-label={t("deleteX", { name: c.name })} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 lg:opacity-0 lg:group-hover:opacity-100">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" /></svg></button>
              </>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Alerts({ cfg, save }: { cfg: InvSettingsRow; save: Save }) {
  const t = useTranslations("invSet");
  const ts = useTranslations("invSettings");
  return (
    <>
      <Card title={t("whoTitle")} hint={t("whoHint")} art={<LowArt size={40} />}>
        <Switch on={cfg.notify_office} onChange={(v) => save({ notify_office: v })} label={t("notifyOffice")} hint={t("notifyOfficeHint")} />
        <Switch on={cfg.notify_tech} onChange={(v) => save({ notify_tech: v })} label={t("notifyTech")} hint={t("notifyTechHint")} />
      </Card>
      <Card title={ts("alerts")} hint={ts("alertsHint")}>
        <div className="grid gap-2 sm:grid-cols-3">
          {FREQ.map((f) => (
            <button key={f} type="button" onClick={() => save({ alert_frequency: f })} aria-pressed={cfg.alert_frequency === f}
              className={`rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 ${cfg.alert_frequency === f ? "border-[#0f766e] bg-[#f3fbf8]" : "border-slate-200 hover:border-[#14a39a]"}`}>
              <span className="block text-[14.5px] font-semibold text-[#0b1f3a]">{ts(`f.${f}`)}</span><span className="block text-[12.5px] text-slate-500">{ts(`f.${f}Text`)}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[12.5px] text-slate-500">{ts("phoneHint")}</p>
      </Card>
    </>
  );
}

function Minimums({ companyId, cfg, save, items, stock, locations, say, canEdit }: { companyId: string; cfg: InvSettingsRow; save: Save; items: InvItem[]; stock: InvStock[]; locations: InvLocation[]; say: (m: string) => void; canEdit: boolean }) {
  const t = useTranslations("invSet");
  const router = useRouter();
  const [wh, setWh] = useState(cfg.default_wh_min ? String(cfg.default_wh_min) : "");
  const [van, setVan] = useState(cfg.default_van_min ? String(cfg.default_van_min) : "");
  const [busy, setBusy] = useState("");
  const active = items.filter((i) => i.is_active);
  const minAt = (item: string, loc: string) => stock.find((s) => s.item_id === item && s.location_id === loc)?.min_qty ?? 0;
  async function apply(kind: "warehouse" | "van", all: boolean) {
    const v = Number(kind === "warehouse" ? wh : van) || 0;
    if (!canEdit || v <= 0) return;
    await save(kind === "warehouse" ? { default_wh_min: v } : { default_van_min: v }, t("savedMin"));
    const locs = locations.filter((l) => l.kind === kind);
    const jobs = active.flatMap((i) => locs.filter((l) => all || minAt(i.id, l.id) <= 0).map((l) => ({ i: i.id, l: l.id })));
    let done = 0;
    setBusy(`${kind}0`);
    const sb = createClient();
    for (const j of jobs) {
      const { error } = await sb.rpc("inv_set_min", { p_company: companyId, p_item: j.i, p_location: j.l, p_min: v });
      if (!error) done++;
      setBusy(`${kind}${done}`);
    }
    setBusy(""); say(t("applied", { n: done })); router.refresh();
  }
  const block = (kind: "warehouse" | "van", value: string, setValue: (v: string) => void) => {
    const locs = locations.filter((l) => l.kind === kind);
    const missing = active.reduce((a, i) => a + locs.filter((l) => minAt(i.id, l.id) <= 0).length, 0);
    return (
      <Card title={kind === "warehouse" ? t("whMin") : t("vanMin")} hint={kind === "warehouse" ? t("whMinHint") : t("vanMinHint")} art={kind === "warehouse" ? <WarehouseArt size={44} /> : <VanArt size={44} />}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[14.5px] text-slate-700">{t("alertAt")}
            <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="3" className={numCls} />
          </label>
          <button type="button" disabled={!Number(value) || !!busy || !locs.length} onClick={() => apply(kind, false)}
            className="inline-flex h-11 items-center whitespace-nowrap rounded-xl bg-[#0f766e] px-4 text-[14px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#0c5f59] disabled:opacity-50">{t("applyMissing", { n: missing })}</button>
          <button type="button" disabled={!Number(value) || !!busy || !locs.length} onClick={() => apply(kind, true)}
            className="inline-flex h-11 items-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:text-[#0f766e] disabled:opacity-50">{t("applyAll")}</button>
          {busy.startsWith(kind) && <span className="text-[13px] text-slate-500">{t("working", { n: busy.slice(kind.length) })}</span>}
        </div>
        <p className="mt-3 text-[12.5px] text-slate-500">{locs.length ? t("minNote", { n: locs.length }) : kind === "warehouse" ? t("noWh") : t("noVans")}</p>
      </Card>
    );
  };
  return (<>{block("warehouse", wh, setWh)}{block("van", van, setVan)}<p className="px-1 text-[12.5px] text-slate-500">{t("perItem")}</p></>);
}

function Vans({ cfg, save, items, barcodes }: { cfg: InvSettingsRow; save: Save; items: InvItem[]; barcodes: Record<string, string> }) {
  const t = useTranslations("invSet");
  const ts = useTranslations("invSettings");
  const [kit, setKit] = useState<KitRow[]>(cfg.van_kit);
  const [dirty, setDirty] = useState(false);
  return (
    <>
      <Card title={t("reqTitle")} hint={t("reqHint")} art={<VanArt size={44} />}>
        <Switch on={cfg.tech_can_request} onChange={(v) => save({ tech_can_request: v })} label={t("reqSwitch")} hint={t("reqSwitchHint")} />
        <Link prefetch={false} href="/dashboard/inventory/dashboard#requests" className="mt-2 inline-block text-[13.5px] font-semibold text-[#0f766e] hover:underline">{t("seeRequests")}</Link>
      </Card>
      <Card title={ts("kit")} hint={ts("kitHint")} art={<CartArt size={40} />}>
        <KitEditor items={items} rows={kit} barcodes={barcodes} onChange={(r) => { setKit(r); setDirty(true); }} />
        {dirty && <button type="button" onClick={async () => { await save({ van_kit: kit }, ts("kitSaved")); setDirty(false); }} className="mt-4 whitespace-nowrap rounded-xl bg-[#0f766e] px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59]">{ts("saveKit")}</button>}
      </Card>
    </>
  );
}

// Marca: colores en pares (principal + acento). El primero es el de BrightPro; el segundo, navy + naranja.
// Color de la marca: se usa en el título y la línea del encabezado. Todo lo demás va en blanco y grises (se imprime bien).
const PALETTES: { name: string; primary: string }[] = [
  { name: "Navy", primary: "#1a2744" }, { name: "BrightPro", primary: "#0b1f3a" }, { name: "Teal", primary: "#0f766e" },
  { name: "Orange", primary: "#e8713a" }, { name: "Blue", primary: "#1d4ed8" }, { name: "Graphite", primary: "#1f2937" },
];
type Preview = "report" | "sheet";

function PdfDesigner({ companyId, company, cfg, save, items, es }: { companyId: string; company: string; cfg: InvSettingsRow; save: Save; items: InvItem[]; es: boolean }) {
  const t = useTranslations("invSet");
  const ts = useTranslations("countSheet");
  const tr = useTranslations("invReport");
  const [d, setD] = useState(designOf(cfg.pdf_design));
  const [url, setUrl] = useState("");
  const [dirty, setDirty] = useState(false);
  const [kind, setKind] = useState<Preview>("report");
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [logoErr, setLogoErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const last = useRef("");
  const set = (p: Partial<FullDesign>) => { setD((x) => ({ ...x, ...p })); setDirty(true); };
  useEffect(() => { companyLogoPng(companyId).then(setCompanyLogo).catch(() => setCompanyLogo("")); }, [companyId]);
  const logo = d.logo ? d.logoData || companyLogo || "" : "";

  async function upload(f: File | undefined) {
    if (!f) return;
    if (!/^image\//.test(f.type) || f.size > 5_000_000) return setLogoErr(t("logoBad"));
    try { setLogoErr(""); set({ logoData: await imageToPng(f), logo: true }); } catch { setLogoErr(t("logoBad")); }
  }

  // Vista previa real: el mismo PDF que se imprime, con datos de ejemplo
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      const day = new Date().toLocaleDateString(es ? "es-US" : "en-US", { month: "short", day: "numeric", year: "numeric" });
      const list = items.length ? items.slice(0, 14) : ([{ name: "Capacitor 45/5 MFD", sku: "070330600065", unit: "pcs", cost_price: 12 }, { name: "Contactor 30A 2-pole", sku: "610214681249", unit: "pcs", cost_price: 18 }] as unknown as InvItem[]);
      const common = { design: d, logoBytes: logoBytesOf(logo), logoPng: true, company, footer: `BrightPro · ${company}`, page: (n: number, total: number) => ts("page", { n, total }) };
      const bytes = kind === "sheet" ? await buildCountPdf({
        ...common, title: ts("pdfTitle"), subtitle: ts("pdfSubBlind"), orientation: "landscape",
        meta: [[ts("mLoc"), "Main Warehouse"], [ts("mDate"), day], [ts("mItems"), String(list.length)], [ts("mType"), ts("blind")]],
        columns: [{ label: "#", w: 3, align: "center" }, { label: ts("cItem"), w: 26 }, { label: "SKU", w: 12 }, { label: ts("cUnit"), w: 5, align: "center" }, { label: ts("cCounted"), w: 8, box: true }, { label: ts("cNotes"), w: 18, box: true }],
        rows: list.map((r, i) => ({ cells: [String(i + 1), r.name, r.sku ?? "", r.unit ?? "", "", ""] })), note: ts("pdfNote"), sign: [ts("sCounted"), ts("sChecked"), ts("sDate")],
      }) : await buildCountPdf({
        ...common, title: tr("s.summary"), subtitle: tr("pdfSub", { date: day, n: 30 }), orientation: "portrait",
        meta: [[tr("mDate"), day], [tr("mLocs"), tr("allLocs")], [tr("mPeriod"), tr("lastDays", { n: 30 })]],
        summary: [[tr("sValue"), "$4,820.00", null], [tr("sUnits"), "318", null], [tr("sLow"), "3", "neg"], [tr("sOut"), "1", "neg"]],
        columns: [], rows: [], sign: [tr("sPrepared"), tr("sReviewed"), tr("sDate")],
        sections: [
          { heading: tr("hLow"), columns: [{ label: tr("cProduct"), w: 24 }, { label: tr("cWhere"), w: 16 }, { label: tr("cHave"), w: 7, align: "right" }, { label: tr("cMin"), w: 7, align: "right" }],
            rows: list.slice(0, 4).map((r, i) => ({ cells: [r.name, i % 2 ? "Van 2 - Carlos" : "Main Warehouse", String(i === 0 ? 0 : i + 1), "3"], alert: i === 0 ? "red" as const : "amber" as const, tone: [null, null, "neg" as const, null] })) },
          { heading: tr("hBuy"), columns: [{ label: tr("cProduct"), w: 22 }, { label: "SKU", w: 11 }, { label: tr("cWh"), w: 8, align: "right" }, { label: tr("cVans"), w: 8, align: "right" }, { label: tr("cBuy"), w: 8, align: "right" }, { label: tr("cCost"), w: 10, align: "right" }],
            rows: [...list.slice(0, 8).map((r, i) => ({ cells: [r.name, r.sku ?? "", String(i + 1), String(i * 2 + 3), String(5 - (i % 3)), `$${((5 - (i % 3)) * Number(r.cost_price || 10)).toFixed(2)}`] })), { cells: [tr("cTotal"), "", "", "", "", "$245.00"], total: true }] },
        ],
      });
      if (!alive) return;
      const u = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      if (last.current) URL.revokeObjectURL(last.current);
      last.current = u; setUrl(u);
    }, 350);
    return () => { alive = false; clearTimeout(timer); };
  }, [d, logo, kind, company, items, es, ts, tr]);

  return (
    <div className="space-y-4">
    {/* Paso 6.12h: Plantillas arriba, personalizar abajo */}
    <Card title={t("templates")} hint={t("templatesHint")}>
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin] sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-5">
        {PDF_TEMPLATE_IDS.map((id) => (
          <button key={id} type="button" onClick={() => { set({ template: id }); setKind("report"); }} aria-pressed={d.template === id}
            className={`group w-[132px] shrink-0 snap-start rounded-2xl border p-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,40,60,0.08)] sm:w-auto ${d.template === id ? "border-[#0f766e] bg-[#f3fbf8] ring-2 ring-[#0f766e]/15" : "border-slate-200 bg-white hover:border-[#14a39a]"}`}>
            <TemplateThumb id={id} color={d.primary} />
            <span className="mt-2 flex items-center gap-1.5 px-0.5">
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#0b1f3a]">{t(`tpl.${id}`)}</span>
              {d.template === id && <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#0f766e]" fill="currentColor"><path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.7-9.7-4.2 4.2a1 1 0 0 1-1.4 0l-1.8-1.8a1 1 0 1 1 1.4-1.4l1.1 1.1 3.5-3.5a1 1 0 1 1 1.4 1.4z" /></svg>}
            </span>
            <span className="block truncate px-0.5 text-[11.5px] text-slate-500">{t(`tplD.${id}`)}</span>
          </button>
        ))}
      </div>
    </Card>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,370px)_minmax(0,1fr)]">
      <div className="space-y-4">
        <p className="px-1 text-[13px] font-semibold uppercase tracking-wide text-slate-500">{t("customize")}</p>
        <Card title={t("brand")} hint={t("brandHint")}>
          <div className="flex flex-wrap items-center gap-2.5">
            {PALETTES.map((p) => (
              <button key={p.name} type="button" onClick={() => set({ primary: p.primary })} aria-label={p.name} aria-pressed={d.primary === p.primary}
                className={`h-9 w-9 rounded-full ring-offset-2 transition-transform hover:scale-110 ${d.primary === p.primary ? "ring-2 ring-[#0b1f3a]" : ""}`} style={{ background: p.primary }} />
            ))}
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-2 py-1.5 hover:border-[#14a39a]">
              <input type="color" value={d.primary} onChange={(e) => set({ primary: e.target.value })} aria-label={t("custom")} className="h-7 w-8 cursor-pointer rounded-md border-0 bg-transparent p-0" />
              <span className="font-mono text-[11.5px] uppercase text-slate-500">{d.primary}</span>
            </label>
          </div>
        </Card>
        <Card title={t("logo")} hint={t("logoHint")}>
          <div className="flex items-center gap-3">
            <span className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-[repeating-conic-gradient(#f1f5f9_0_25%,#fff_0_50%)] bg-[length:12px_12px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logo ? <img src={logo} alt="" className="max-h-14 max-w-[100px] object-contain" /> : <span className="text-[11px] text-slate-400">{t("noLogo")}</span>}
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <button type="button" onClick={() => fileRef.current?.click()} className="whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-[#0f766e] hover:border-[#14a39a]">{t("logoUpload")}</button>
              {d.logoData && <button type="button" onClick={() => set({ logoData: "" })} className="whitespace-nowrap text-left text-[12.5px] font-medium text-slate-500 hover:text-[#0f766e]">{t("logoCompany")}</button>}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
          </div>
          {logoErr && <p className="mt-2 text-[12.5px] text-red-600">{logoErr}</p>}
          {!d.logoData && companyLogo === "" && <p className="mt-2 text-[12.5px] text-slate-500">{t("logoNone")}</p>}
          <div className="mt-2"><Switch on={d.logo} onChange={(v) => set({ logo: v })} label={t("logoShow")} /></div>
        </Card>
        <Card title={t("options")}>
          <div>
            <Switch on={d.signatures} onChange={(v) => set({ signatures: v })} label={t("signatures")} />
            <Switch on={d.zebra} onChange={(v) => set({ zebra: v })} label={t("zebra")} />
          </div>
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[12.5px] text-slate-600">{t("pagesRule")}</p>
        </Card>
        <button type="button" disabled={!dirty} onClick={async () => { await save({ pdf_design: d }); setDirty(false); }}
          className="w-full whitespace-nowrap rounded-xl bg-[#0f766e] px-4 py-3 text-[15px] font-semibold text-white transition-all hover:bg-[#0c5f59] disabled:opacity-50">{dirty ? t("saveDesign") : t("designSaved")}</button>
      </div>
      <section className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white xl:sticky xl:top-0 xl:max-h-[calc(90vh-140px)]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
          <div className="flex rounded-xl bg-slate-100 p-1">
            {(["report", "sheet"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${kind === k ? "bg-white text-[#0b1f3a] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{k === "report" ? t("pvReport") : t("pvSheet")}</button>
            ))}
          </div>
          <span className="flex-1" />
          {url && <a href={url} target="_blank" rel="noreferrer" className="whitespace-nowrap text-[13px] font-semibold text-[#0f766e] hover:underline">{t("openPreview")}</a>}
        </div>
        {url ? <iframe title={t("preview")} src={`${url}#toolbar=0&view=FitH`} className="min-h-[520px] w-full flex-1 bg-slate-100" /> : <div className="m-5 flex-1 animate-pulse rounded-xl bg-slate-100" />}
      </section>
    </div>
    </div>
  );
}
// Miniatura de cada plantilla (dibujada con su encabezado, resumen y tabla reales, con tu color)
function TemplateThumb({ id, color }: { id: PdfTemplateId; color: string }) {
  const T = PDF_TEMPLATES[id];
  const serif = T.font === "serif" ? "Georgia, serif" : T.font === "mono" ? "Courier New, monospace" : "Helvetica, Arial, sans-serif";
  const logo = (x: number, y: number) => <g><circle cx={x + 4} cy={y + 4} r="4" fill="#e8713a" /><rect x={x + 10} y={y + 2} width="10" height="4" rx="1" fill={color} /></g>;
  let top = 0; const head: React.ReactNode[] = [];
  if (T.header === "band") { head.push(<rect key="b" width="100" height="16" fill={color} />, <rect key="c" x="6" y="5" width="22" height="2.6" rx="1" fill="#fff" />, <text key="t" x="94" y="10" textAnchor="end" fontSize="5.4" fontWeight="700" fill="#fff" fontFamily={serif}>Lista</text>, <rect key="m" x="70" y="12" width="24" height="1.4" rx=".7" fill="#ffffff99" />); head.push(<g key="l">{logo(6, 19)}</g>); top = 32; }
  else if (T.header === "center") { head.push(<g key="l">{logo(40, 5)}</g>, <rect key="c" x="38" y="16" width="24" height="2.2" rx="1" fill="#334155" />, <text key="t" x="50" y="25" textAnchor="middle" fontSize="5.6" fontWeight="700" fill={color} fontFamily={serif}>Lista</text>, <rect key="m" x="30" y="28" width="40" height="1.4" rx=".7" fill="#cbd5e1" />, <rect key="r" x="6" y="32" width="88" height={T.rule || 0.6} fill={color} />); top = 36; }
  else {
    const r = T.header === "right";
    head.push(<g key="l">{logo(r ? 72 : 6, 6)}</g>, <rect key="c" x={r ? 50 : 30} y="7" width="18" height="2.4" rx="1" fill="#334155" transform={r ? "translate(0,0)" : undefined} />, <rect key="s" x={r ? 52 : 30} y="11" width="16" height="1.4" rx=".7" fill="#cbd5e1" />,
      <text key="t" x={r ? 6 : 94} y="11" textAnchor={r ? "start" : "end"} fontSize="5.6" fontWeight="700" fill={color} fontFamily={serif}>{T.caps ? "LISTA" : "Lista"}</text>, <rect key="m" x={r ? 6 : 72} y="14" width="22" height="1.4" rx=".7" fill="#cbd5e1" />);
    if (T.rule) head.push(<rect key="rl" x="6" y="19" width="88" height={T.rule * 0.6} fill={color} />);
    top = 23;
  }
  const sum: React.ReactNode[] = [];
  for (let i = 0; i < 4; i++) {
    const x = 6 + i * 22.5, bad = i >= 2;
    if (T.summary === "cards") sum.push(<rect key={i} x={x} y={top} width="20" height="10" rx="2.4" fill="#fff" stroke="#dbe1e8" strokeWidth=".5" />);
    if (T.summary === "boxes") sum.push(<rect key={i} x={x} y={top} width="20" height="10" fill="#f1f3f6" stroke="#b8c0ca" strokeWidth=".4" />);
    if (T.summary === "lines" && i) sum.push(<rect key={`d${i}`} x={x - 1.2} y={top + 1.5} width=".4" height="7" fill="#dbe1e8" />);
    sum.push(<rect key={`v${i}`} x={x + 2.5} y={top + 5.5} width={bad ? 4 : 10} height="2.4" rx=".6" fill={bad ? "#e11d48" : "#1e293b"} />);
  }
  if (T.summary === "lines") sum.push(<rect key="l1" x="6" y={top} width="88" height=".4" fill="#dbe1e8" />, <rect key="l2" x="6" y={top + 10} width="88" height=".4" fill="#dbe1e8" />);
  const ty = top + 15, rh = T.compact ? 3.6 : 4.6, n = T.compact ? 13 : 10;
  const rows: React.ReactNode[] = [];
  if (T.head === "brand" && !T.grid) rows.push(<rect key="h" x="6" y={ty} width="88" height="4.2" fill={color} />);
  else if (T.head === "line" && !T.grid) rows.push(<rect key="h" x="6" y={ty + 4} width="88" height=".7" fill={color} />);
  else rows.push(<rect key="h" x="6" y={ty} width="88" height="4.2" fill="#eef1f5" stroke={T.grid ? "#94a3b8" : "none"} strokeWidth=".3" />);
  for (let i = 0; i < n; i++) {
    const yy = ty + 4.4 + i * rh;
    if (T.grid) rows.push(<g key={i}><rect x="6" y={yy} width="88" height={rh} fill="#fff" stroke="#cbd5e1" strokeWidth=".3" />{[40, 62, 76].map((gx) => <rect key={gx} x={gx} y={yy} width=".3" height={rh} fill="#cbd5e1" />)}</g>);
    else { if (i % 2 && T.zebra) rows.push(<rect key={`z${i}`} x="6" y={yy} width="88" height={rh} fill="#f6f8fa" />); rows.push(<rect key={`l${i}`} x="6" y={yy + rh - .3} width="88" height=".3" fill="#e5e9ee" />); }
    rows.push(<rect key={`t${i}`} x="8.5" y={yy + rh / 2 - .7} width={12 + ((i * 7) % 14)} height="1.4" rx=".6" fill={i === 1 ? "#e11d48" : "#64748b"} />, <rect key={`n${i}`} x="86" y={yy + rh / 2 - .7} width="5" height="1.4" rx=".6" fill={i === 1 ? "#e11d48" : "#94a3b8"} />);
  }
  return (
    <svg viewBox="0 0 100 129" className="block w-full rounded-lg bg-white shadow-[0_1px_3px_rgba(15,40,60,0.12)] ring-1 ring-slate-200 transition-transform duration-200 group-hover:scale-[1.02]" aria-hidden="true">
      {head}{sum}{rows}
      <rect x="6" y="122" width="20" height=".4" fill="#cbd5e1" /><rect x="40" y="122" width="20" height=".4" fill="#cbd5e1" /><rect x="74" y="122" width="20" height=".4" fill="#cbd5e1" />
    </svg>
  );
}

function Reports({ companyId, company, cfg, save, items, stock, locations, members }: { companyId: string; company: string; cfg: InvSettingsRow; save: Save; items: InvItem[]; stock: InvStock[]; locations: InvLocation[]; members: InvMember[] }) {
  const t = useTranslations("invSet");
  const tr = useTranslations("invReport");
  const sp = useSearchParams();
  const [edit, setEdit] = useState<ReportPreset | null>(sp.get("new") === "1" ? blankPreset() : null);
  const run = useRunPreset({ companyId, company, items, stock, locations, members, kit: cfg.van_kit });
  async function store(p: ReportPreset) {
    const list = cfg.report_presets.some((x) => x.id === p.id) ? cfg.report_presets.map((x) => (x.id === p.id ? p : x)) : [...cfg.report_presets, p];
    await save({ report_presets: list }, t("reportSaved")); setEdit(null);
  }
  async function remove(p: ReportPreset) {
    if (!(await confirmDelete({ title: t("delReport", { name: p.name }) }))) return;
    await save({ report_presets: cfg.report_presets.filter((x) => x.id !== p.id) }, t("reportDeleted"));
  }
  if (edit) return <PresetForm preset={edit} locations={locations} onCancel={() => setEdit(null)} onSave={store} onPreview={(p) => run(p)} />;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-slate-500">{t("reportsIntro")}</p>
        <button type="button" onClick={() => setEdit(blankPreset())} className="group/n inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#0f766e] px-4 text-[14.5px] font-semibold text-white shadow-sm hover:bg-[#0c5f59]">
          <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-200 group-hover/n:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>{t("newReport")}
        </button>
      </div>
      {cfg.report_presets.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <CartArt size={56} /><p className="mt-3 text-[15.5px] font-semibold text-[#0b1f3a]">{t("noReports")}</p><p className="mt-1 max-w-md text-[13.5px] text-slate-500">{t("noReportsText")}</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {cfg.report_presets.map((p) => (
            <li key={p.id} className="group rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:shadow-[0_12px_28px_rgba(15,40,60,0.08)]">
              <p className="truncate text-[15.5px] font-semibold text-[#0b1f3a]">{p.name}</p>
              <p className="mt-0.5 line-clamp-2 text-[12.5px] text-slate-500">{p.sections.map((s) => tr(`s.${s}`)).join(" · ")}</p>
              <p className="mt-1 text-[12px] text-slate-400">{tr("lastDays", { n: p.days })}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => run(p)} className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#0f766e] px-3 text-[13px] font-semibold text-white hover:bg-[#0c5f59]"><SheetIcon className="h-4 w-4" />PDF</button>
                <button type="button" onClick={() => setEdit(p)} className="inline-flex h-9 items-center whitespace-nowrap rounded-lg border border-slate-200 px-3 text-[13px] font-semibold text-slate-700 hover:border-[#14a39a] hover:text-[#0f766e]">{t("edit")}</button>
                <button type="button" onClick={() => remove(p)} className="inline-flex h-9 items-center whitespace-nowrap rounded-lg px-3 text-[13px] font-semibold text-red-600 hover:bg-red-50">{t("delete")}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
export const blankPreset = (): ReportPreset => ({ id: Math.random().toString(36).slice(2, 10), name: "", sections: ["summary", "low", "buy"], locations: [], days: 30, orientation: "portrait" });

export function PresetForm({ preset, locations, onCancel, onSave, onPreview }: { preset: ReportPreset; locations: InvLocation[]; onCancel: () => void; onSave: (p: ReportPreset) => void; onPreview: (p: ReportPreset) => void }) {
  const t = useTranslations("invSet");
  const tr = useTranslations("invReport");
  const tc = useTranslations("common");
  const [p, setP] = useState(preset);
  const [err, setErr] = useState("");
  const toggle = (s: ReportSection) => setP((x) => ({ ...x, sections: x.sections.includes(s) ? x.sections.filter((y) => y !== s) : [...x.sections, s].sort((a, b) => REPORT_SECTIONS.indexOf(a) - REPORT_SECTIONS.indexOf(b)) }));
  const ok = () => { if (!p.name.trim()) { setErr(t("eReportName")); return false; } if (!p.sections.length) { setErr(t("eReportSections")); return false; } setErr(""); return true; };
  const allLocs = !p.locations.length;
  return (
    <div className="space-y-4">
      <Card title={preset.name ? t("editReport") : t("newReport")}>
        <label className="mb-1 block text-[13px] font-semibold text-slate-600" htmlFor="rp-name">{t("reportName")}</label>
        <input id="rp-name" autoFocus value={p.name} maxLength={80} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder={t("reportNamePh")} className={inputClass} />
      </Card>
      <Card title={t("include")} hint={t("includeHint")}>
        <div className="grid gap-2 sm:grid-cols-2">
          {REPORT_SECTIONS.map((s) => {
            const on = p.sections.includes(s);
            return (
              <button key={s} type="button" onClick={() => toggle(s)} aria-pressed={on}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 ${on ? "border-[#0f766e] bg-[#f3fbf8]" : "border-slate-200 hover:border-[#14a39a]"}`}>
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-[#0f766e] bg-[#0f766e] text-white" : "border-slate-300"}`}>
                  {on && <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 10.5 8.5 14 15 6.5" /></svg>}
                </span>
                <span><span className="block text-[14px] font-semibold text-[#0b1f3a]">{tr(`s.${s}`)}</span><span className="block text-[12px] text-slate-500">{tr(`sd.${s}`)}</span></span>
              </button>
            );
          })}
        </div>
      </Card>
      <Card title={t("filters")}>
        <p className="mb-2 text-[13px] font-semibold text-slate-600">{t("whichLocs")}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setP({ ...p, locations: [] })} aria-pressed={allLocs} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-medium ${allLocs ? "border-[#0f766e] bg-[#e9f7f4] text-[#0b5e57]" : "border-slate-200 text-slate-600"}`}>{tr("allLocs")}</button>
          {locations.map((l) => {
            const on = p.locations.includes(l.id);
            return <button key={l.id} type="button" onClick={() => setP({ ...p, locations: on ? p.locations.filter((x) => x !== l.id) : [...p.locations, l.id] })} aria-pressed={on}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-medium ${on ? "border-[#0f766e] bg-[#e9f7f4] text-[#0b5e57]" : "border-slate-200 text-slate-600"}`}>{l.name}</button>;
          })}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><p className="mb-2 text-[13px] font-semibold text-slate-600">{t("period")}</p>
            <div className="flex flex-wrap gap-2">{[7, 30, 90, 365].map((n) => <button key={n} type="button" onClick={() => setP({ ...p, days: n })} aria-pressed={p.days === n} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-medium ${p.days === n ? "border-[#0f766e] bg-[#e9f7f4] text-[#0b5e57]" : "border-slate-200 text-slate-600"}`}>{tr("lastDays", { n })}</button>)}</div></div>
          <div><p className="mb-2 text-[13px] font-semibold text-slate-600">{t("page")}</p><p className="text-[13px] text-slate-500">{t("alwaysPortrait")}</p></div>
        </div>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => ok() && onSave({ ...p, name: p.name.trim() })} className="whitespace-nowrap rounded-xl bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59]">{t("saveReport")}</button>
        <button type="button" onClick={() => ok() && onPreview({ ...p, name: p.name.trim() })} className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[15px] font-semibold text-[#0f766e] hover:border-[#14a39a]"><SheetIcon />{t("tryPdf")}</button>
        <button type="button" onClick={onCancel} className="whitespace-nowrap rounded-xl px-4 py-2.5 text-[15px] font-medium text-slate-600 hover:bg-slate-100">{tc("cancel")}</button>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      </div>
    </div>
  );
}
