"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { PdfSettings, PdfTemplate, TEMPLATES, pdfOf } from "@/lib/sales";
import { inputClass } from "@/components/customers/ui";
import { Modal, btnGhost, btnPrimary } from "@/components/sales/SalesBits";

const SWATCHES = ["#2f3437", "#1a2744", "#e8713a", "#0f766e", "#2563eb", "#7c3aed", "#be123c", "#15803d"];

async function savePdf(companyId: string, pdf: PdfSettings) {
  return createClient().from("sales_prefs").upsert({ company_id: companyId, pdf_settings: pdf, updated_at: new Date().toISOString() });
}

// Mini dibujo de cada plantilla
export function TemplateThumb({ t, accent }: { t: PdfTemplate; accent: string }) {
  return (
    <div className="space-y-1.5 bg-white p-3">
      {t === "modern" ? <div className="-mx-3 -mt-3 mb-2 flex h-7 items-center justify-between px-3" style={{ background: accent }}><span className="h-2 w-10 rounded bg-white/80" /><span className="h-3 w-8 rounded bg-white" /></div>
        : <div className="flex justify-between"><span className="h-4 w-10 rounded" style={{ background: `${accent}66` }} /><span className={`h-3 ${t === "minimal" ? "w-8" : "w-12"} rounded bg-slate-400`} /></div>}
      {[...Array(4)].map((_, i) => <span key={i} className="block h-1.5 rounded bg-slate-200" style={{ width: `${90 - i * 12}%` }} />)}
      {t === "minimal" ? <span className="block h-0.5" style={{ background: accent }} /> : <span className="block h-2.5 rounded-sm" style={{ background: accent }} />}
      {[...Array(3)].map((_, i) => <span key={i} className="block h-1.5 rounded bg-slate-200" />)}
      <div className="flex justify-end"><span className="h-2.5 w-16 rounded bg-slate-300" /></div>
    </div>
  );
}

export function ChangeTemplateModal({ open, onClose, companyId, pdf }: { open: boolean; onClose: () => void; companyId: string; pdf: PdfSettings }) {
  const router = useRouter();
  const cur = pdfOf(pdf);
  const [sel, setSel] = useState<PdfTemplate>(cur.template);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setSel(pdfOf(pdf).template); setError(""); } }, [open, pdf]);
  async function save() {
    setBusy(true);
    const { error: e } = await savePdf(companyId, { ...pdf, template: sel, ...(sel === "modern" && cur.accent === "#2f3437" ? { accent: "#1a2744" } : {}) });
    setBusy(false);
    if (e) return setError("It couldn't be saved. Did you run the SQL for Paso 3.31?");
    router.refresh(); onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title="Choose Template" width="max-w-2xl"
      footer={<><button type="button" onClick={save} disabled={busy} className={btnPrimary}>{busy ? "Saving..." : "Use this template"}</button><button type="button" onClick={onClose} className={btnGhost}>Cancel</button>{error && <p className="text-sm text-red-600">{error}</p>}</>}>
      <div className="grid gap-4 sm:grid-cols-3">
        {TEMPLATES.map((t) => {
          const on = sel === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setSel(t.id)}
              className={`overflow-hidden rounded-xl border-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${on ? "border-[#2563eb] shadow-md" : "border-slate-200"}`}>
              <TemplateThumb t={t.id} accent={t.id === "modern" && cur.accent === "#2f3437" ? "#1a2744" : cur.accent} />
              {on ? <p className="bg-[#eef6ff] py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-[#2563eb]">★ Selected</p> : <p className="py-1 text-center text-[11px] text-transparent">.</p>}
              <div className="px-3 pb-3 pt-1"><p className="text-sm font-semibold text-[#0b1f3a]">{t.name} Template</p><p className="text-[12px] text-slate-500">{t.hint}</p></div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

export function EditTemplateModal({ open, onClose, companyId, pdf, whiteLabel }: { open: boolean; onClose: () => void; companyId: string; pdf: PdfSettings; whiteLabel: boolean }) {
  const router = useRouter();
  const [p, setP] = useState(pdfOf(pdf));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setP(pdfOf(pdf)); setError(""); } }, [open, pdf]);
  const set = (patch: Partial<typeof p>) => setP((x) => ({ ...x, ...patch }));
  async function save() {
    if (!/^#[0-9a-f]{6}$/i.test(p.accent)) return setError("Enter a color like #1a2744.");
    setBusy(true);
    const { error: e } = await savePdf(companyId, p);
    setBusy(false);
    if (e) return setError("It couldn't be saved. Did you run the SQL for Paso 3.31?");
    router.refresh(); onClose();
  }
  const seg = <T extends string>(value: T, opts: [T, string][], on: (v: T) => void) => (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-sm">
      {opts.map(([v, l]) => <button key={v} type="button" onClick={() => on(v)} className={`rounded-md px-3 py-1.5 transition-all ${value === v ? "bg-white font-semibold text-[#0b1f3a] shadow-sm" : "text-slate-500 hover:text-[#0b1f3a]"}`}>{l}</button>)}
    </div>
  );
  return (
    <Modal open={open} onClose={onClose} title="Edit Template" width="max-w-2xl"
      footer={<><button type="button" onClick={save} disabled={busy} className={btnPrimary}>{busy ? "Saving..." : "Save"}</button><button type="button" onClick={onClose} className={btnGhost}>Cancel</button>{error && <p className="text-sm text-red-600">{error}</p>}</>}>
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_170px]">
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Brand color</p>
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((c) => (
                <button key={c} type="button" onClick={() => set({ accent: c })} aria-label={c} title={c}
                  className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${p.accent.toLowerCase() === c ? "border-[#0b1f3a] ring-2 ring-white ring-offset-2 ring-offset-[#0b1f3a]" : "border-white shadow"}`} style={{ background: c }} />
              ))}
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1">
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(p.accent) ? p.accent : "#000000"} onChange={(e) => set({ accent: e.target.value })} className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0" />
                <input value={p.accent} onChange={(e) => set({ accent: e.target.value.slice(0, 7) })} className="w-20 bg-transparent text-sm focus:outline-none" />
              </label>
            </div>
          </div>
          <div><p className="mb-2 text-sm font-medium text-slate-700">Margins</p>{seg(p.margin, [["narrow", "Narrow"], ["normal", "Normal"], ["wide", "Wide"]], (v) => set({ margin: v }))}</div>
          <div><p className="mb-2 text-sm font-medium text-slate-700">Font size</p>{seg(p.font_size, [["small", "Small"], ["normal", "Normal"], ["large", "Large"]], (v) => set({ font_size: v }))}</div>
          <div><p className="mb-2 text-sm font-medium text-slate-700">Logo size</p>{seg(p.logo_size, [["small", "Small"], ["medium", "Medium"], ["large", "Large"]], (v) => set({ logo_size: v }))}</div>
          <label className="flex cursor-pointer items-center gap-2.5 text-[15px] text-slate-700"><input type="checkbox" checked={p.show_org_address} onChange={(e) => set({ show_org_address: e.target.checked })} className="h-4 w-4 accent-[#0f766e]" />Show my address, phone and email</label>
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Footer text</p>
            <input value={p.footer_text} onChange={(e) => set({ footer_text: e.target.value.slice(0, 140) })} placeholder="e.g. Licensed & insured · TACLA00000C" className={inputClass} />
          </div>
          <label className={`flex items-start gap-2.5 text-[15px] ${whiteLabel ? "cursor-pointer text-slate-700" : "text-slate-400"}`}>
            <input type="checkbox" disabled={!whiteLabel} checked={whiteLabel ? p.show_powered : true} onChange={(e) => set({ show_powered: e.target.checked })} className="mt-1 h-4 w-4 accent-[#0f766e]" />
            <span>Show &quot;Powered by BrightPro&quot; in the footer
              {!whiteLabel && <span className="block text-[13px] text-slate-500">Paid plans can remove it and use their own brand only (white label).</span>}</span>
          </label>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Preview</p>
          <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm"><TemplateThumb t={p.template} accent={/^#[0-9a-f]{6}$/i.test(p.accent) ? p.accent : "#2f3437"} /></div>
          <p className="mt-2 text-[12px] text-slate-500">{TEMPLATES.find((t) => t.id === p.template)?.name} Template</p>
        </div>
      </div>
    </Modal>
  );
}

// Botón "Customize ▾" encima del documento (como Zoho)
export function CustomizeMenu({ companyId, pdf, whiteLabel, onLogo }: { companyId: string; pdf: PdfSettings; whiteLabel: boolean; onLogo: () => void }) {
  const [modal, setModal] = useState<null | "change" | "edit">(null);
  const name = TEMPLATES.find((t) => t.id === pdfOf(pdf).template)?.name ?? "Standard";
  const item = "block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 data-[focus]:bg-[#2563eb] data-[focus]:text-white";
  return (
    <>
      <Menu>
        <MenuButton className="group flex items-center gap-1.5 rounded-md bg-[#2563eb] px-3 py-1.5 text-[13px] font-medium text-white shadow-sm hover:bg-[#1d4ed8] focus:outline-none print:hidden">
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-90" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="10" r="2.5" /><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" strokeLinecap="round" /></svg>
          Customize
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 transition-transform group-data-[open]:rotate-180" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
        </MenuButton>
        <MenuItems anchor="bottom end" transition className="z-[80] mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
          <p className="px-3 pb-1 pt-1.5 text-[12px] font-semibold text-slate-400">{name} Template</p>
          <MenuItem><button type="button" onClick={() => setModal("change")} className={item}>Change Template</button></MenuItem>
          <MenuItem><button type="button" onClick={() => setModal("edit")} className={item}>Edit Template</button></MenuItem>
          <div className="my-1 border-t border-slate-100" />
          <MenuItem><button type="button" onClick={onLogo} className={item}>Update Logo & Address</button></MenuItem>
          <MenuItem disabled><span className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-300">Manage Custom Fields<span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">Soon</span></span></MenuItem>
        </MenuItems>
      </Menu>
      <ChangeTemplateModal open={modal === "change"} onClose={() => setModal(null)} companyId={companyId} pdf={pdf} />
      <EditTemplateModal open={modal === "edit"} onClose={() => setModal(null)} companyId={companyId} pdf={pdf} whiteLabel={whiteLabel} />
    </>
  );
}
