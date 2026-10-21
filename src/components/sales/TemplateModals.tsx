"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { PdfSettings, SalesDoc, SalesLine, SalesPrefs, TEMPLATES, pdfOf } from "@/lib/sales";
import DocPaper from "@/components/sales/DocPaper";
import { tplOf } from "@/lib/pdf-templates";
import { inputClass } from "@/components/customers/ui";
import { Modal, btnGhost, btnPrimary } from "@/components/sales/SalesBits";

const SWATCHES = ["#2f3437", "#1a2744", "#e8713a", "#0f766e", "#2563eb", "#7c3aed", "#be123c", "#15803d"];

export async function savePdf(companyId: string, pdf: PdfSettings) {
  return createClient().from("sales_prefs").upsert({ company_id: companyId, pdf_settings: pdf, updated_at: new Date().toISOString() });
}

// Mini dibujo de una plantilla (para el editor)
export function TemplateThumb({ t, accent }: { t: string; accent: string }) {
  const d = tplOf(t);
  return (
    <div className={`space-y-1.5 bg-white p-3 ${d.border ? "border-2 border-slate-300" : ""} ${d.receipt ? "mx-auto w-2/3" : ""}`}>
      {d.header === "band" ? <div className="-mx-3 -mt-3 mb-2 flex h-7 items-center justify-between px-3" style={{ background: accent }}><span className="h-2 w-10 rounded bg-white/80" /><span className="h-3 w-8 rounded bg-white" /></div>
        : d.header === "centered" ? <div className="flex flex-col items-center gap-1"><span className="h-4 w-10 rounded" style={{ background: `${accent}55` }} /><span className="h-2.5 w-12 rounded bg-slate-400" /></div>
          : <div className={`flex justify-between ${d.header === "reversed" ? "flex-row-reverse" : ""}`}><span className="h-4 w-10 rounded" style={{ background: `${accent}55` }} /><span className="h-3 w-12 rounded" style={{ background: d.header === "split" ? accent : "#94a3b8" }} /></div>}
      {[...Array(4)].map((_, i) => <span key={i} className="block h-1.5 rounded bg-slate-200" style={{ width: `${90 - i * 12}%` }} />)}
      {d.table === "lines" ? <span className="block h-0.5" style={{ background: accent }} /> : d.table === "light" || d.table === "grid" ? <span className="block h-2.5 rounded-sm" style={{ background: `${accent}26` }} /> : <span className="block h-2.5 rounded-sm" style={{ background: accent }} />}
      {[...Array(3)].map((_, i) => <span key={i} className={`block h-1.5 rounded ${d.table === "grid" ? "border border-slate-300 bg-white" : "bg-slate-200"}`} />)}
      <div className="flex justify-end"><span className="h-2.5 w-16 rounded" style={{ background: d.totals === "accent" ? accent : "#cbd5e1" }} /></div>
    </div>
  );
}

export function EditTemplateModal({ open, onClose, companyId, pdf, whiteLabel, preview }: {
  open: boolean; onClose: () => void; companyId: string; pdf: PdfSettings; whiteLabel: boolean;
  preview?: { doc: SalesDoc; lines: SalesLine[]; prefs: SalesPrefs; companyName: string };
}) {
  const router = useRouter();
  const [p, setP] = useState(pdfOf(pdf));
  const [logo, setLogo] = useState<string | null>(preview?.prefs.logo_url ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const cur = pdfOf(pdf);
    setP({ ...cur, logo_px: cur.logo_px > 0 ? cur.logo_px : cur.logo_size === "small" ? 96 : cur.logo_size === "large" ? 240 : 160 });
    setLogo(preview?.prefs.logo_url ?? null); setError("");
  }, [open, pdf, preview?.prefs.logo_url]);
  const set = (patch: Partial<typeof p>) => setP((x) => ({ ...x, ...patch }));

  async function upload(x?: File) {
    if (!x) return;
    if (!["image/png", "image/jpeg"].includes(x.type)) return setError("Use a PNG or JPG logo so it also shows in the PDF.");
    if (x.size > 2 * 1024 * 1024) return setError("The logo must be smaller than 2 MB.");
    setBusy(true);
    const sb = createClient();
    const path = `${companyId}/logo-${Date.now()}.${x.type === "image/png" ? "png" : "jpg"}`;
    const { error: e } = await sb.storage.from("org-logos").upload(path, x, { upsert: true });
    setBusy(false);
    if (e) return setError("The logo couldn't be uploaded.");
    setLogo(sb.storage.from("org-logos").getPublicUrl(path).data.publicUrl); setError("");
  }
  async function save() {
    if (!/^#[0-9a-f]{6}$/i.test(p.accent)) return setError("Enter a color like #1a2744.");
    setBusy(true);
    const { error: e } = await createClient().from("sales_prefs").upsert({ company_id: companyId, pdf_settings: p, logo_url: logo, updated_at: new Date().toISOString() });
    setBusy(false);
    if (e) return setError("It couldn't be saved. Did you run the SQL for Paso 3.31?");
    router.refresh(); onClose();
  }
  const seg = <T extends string>(value: T, opts: [T, string][], on: (v: T) => void) => (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-sm">
      {opts.map(([v, l]) => <button key={v} type="button" onClick={() => on(v)} className={`rounded-md px-3 py-1.5 transition-all ${value === v ? "bg-white font-semibold text-[#0b1f3a] shadow-sm" : "text-slate-500 hover:text-[#0b1f3a]"}`}>{l}</button>)}
    </div>
  );
  const livePrefs = preview ? { ...preview.prefs, logo_url: logo, pdf_settings: p } : null;
  return (
    <Modal open={open} onClose={onClose} title="Edit Template" width="max-w-5xl"
      footer={<><button type="button" onClick={save} disabled={busy} className={btnPrimary}>{busy ? "Saving..." : "Save"}</button><button type="button" onClick={onClose} className={btnGhost}>Cancel</button>{error && <p className="text-sm text-red-600">{error}</p>}</>}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          {/* Logo: subir, cambiar y tamaño exacto con la barrita */}
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="mb-3 text-sm font-semibold text-[#0b1f3a]">Logo</p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-32 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {logo ? <img src={logo} alt="Logo" className="max-h-full max-w-full object-contain p-1" /> : <span className="text-xs text-slate-400">No logo</span>}
              </div>
              <div className="flex gap-3">
                <input ref={file} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
                <button type="button" onClick={() => file.current?.click()} disabled={busy} className="text-sm font-medium text-[#2563eb] hover:underline">{logo ? "Change logo" : "Upload logo"}</button>
                {logo && <button type="button" onClick={() => setLogo(null)} className="text-sm text-red-600 hover:underline">Remove</button>}
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-sm"><span className="text-slate-700">Logo size</span><span className="font-semibold tabular-nums text-[#0f766e]">{p.logo_px}px</span></div>
              <input type="range" min={40} max={320} step={2} value={p.logo_px} onChange={(e) => set({ logo_px: Number(e.target.value) })} className="w-full accent-[#0f766e]" aria-label="Logo size in pixels" />
              <div className="flex justify-between text-[11px] text-slate-400"><span>Small</span><span>Large</span></div>
            </div>
          </div>
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
          <div className="flex flex-wrap gap-6">
            <div><p className="mb-2 text-sm font-medium text-slate-700">Margins</p>{seg(p.margin, [["narrow", "Narrow"], ["normal", "Normal"], ["wide", "Wide"]], (v) => set({ margin: v }))}</div>
            <div><p className="mb-2 text-sm font-medium text-slate-700">Font size</p>{seg(p.font_size, [["small", "Small"], ["normal", "Normal"], ["large", "Large"]], (v) => set({ font_size: v }))}</div>
          </div>
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
          <p className="mb-2 text-sm font-medium text-slate-700">Live preview <span className="font-normal text-slate-400">· {tplOf(p.template).name}</span></p>
          {preview && livePrefs ? (
            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-[#f4f6f8]" style={{ height: 520 }}>
              <div className="absolute left-0 top-0 origin-top-left" style={{ width: 820, transform: "scale(0.46)" }}>
                <DocPaper doc={preview.doc} lines={preview.lines} prefs={livePrefs} companyName={preview.companyName} ribbon={false} stack={false} />
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm"><TemplateThumb t={p.template} accent={/^#[0-9a-f]{6}$/i.test(p.accent) ? p.accent : "#2f3437"} /></div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// Botón "Customize ▾" encima del documento (como Zoho). Change Template abre la galería en su propia página.
export function CustomizeMenu({ companyId, pdf, whiteLabel, onLogo, kind, back, preview }: {
  companyId: string; pdf: PdfSettings; whiteLabel: boolean; onLogo: () => void; kind: "quote" | "invoice"; back?: string;
  preview?: { doc: SalesDoc; lines: SalesLine[]; prefs: SalesPrefs; companyName: string };
}) {
  const [edit, setEdit] = useState(false);
  const name = tplOf(pdfOf(pdf).template).name;
  const item = "block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 data-[focus]:bg-[#e9f7f4] data-[focus]:text-[#0b1f3a]";
  return (
    <>
      <Menu>
        <MenuButton className="group flex items-center gap-1.5 rounded-bl-lg rounded-tr-[3px] bg-[#2563eb] px-3 py-1.5 text-[13px] font-medium text-white shadow-sm hover:bg-[#1d4ed8] focus:outline-none print:hidden">
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-90" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="10" r="2.5" /><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" strokeLinecap="round" /></svg>
          Customize
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 transition-transform group-data-[open]:rotate-180" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
        </MenuButton>
        <MenuItems anchor="bottom end" transition className="z-[80] mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
          <p className="px-3 pb-1 pt-1.5 text-[12px] font-semibold text-slate-400">{name}</p>
          <MenuItem><Link href={`/dashboard/settings/pdf-templates?for=${kind}${back ? `&back=${encodeURIComponent(back)}` : ""}`} className={item}>Change Template</Link></MenuItem>
          <MenuItem><button type="button" onClick={() => setEdit(true)} className={item}>Edit Template</button></MenuItem>
          <div className="my-1 border-t border-slate-100" />
          <MenuItem><button type="button" onClick={onLogo} className={item}>Update Logo & Address</button></MenuItem>
          <MenuItem disabled><span className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-300">Manage Custom Fields<span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">Soon</span></span></MenuItem>
        </MenuItems>
      </Menu>
      <EditTemplateModal open={edit} onClose={() => setEdit(false)} companyId={companyId} pdf={pdf} whiteLabel={whiteLabel} preview={preview} />
    </>
  );
}
