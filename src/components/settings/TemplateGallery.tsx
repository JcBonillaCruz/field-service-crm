"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES, TEMPLATE_DEFS, TplCategory, TplDef } from "@/lib/pdf-templates";
import { SalesDoc, SalesLine, SalesPrefs, docStatus, pdfOf } from "@/lib/sales";
import DocPaper from "@/components/sales/DocPaper";
import { savePdf } from "@/components/sales/TemplateModals";
import { Toast, XButton } from "@/components/sales/SalesBits";

// Miniatura real del documento con esa plantilla
function Thumb({ tpl, doc, lines, prefs, company, scale }: { tpl: TplDef; doc: SalesDoc; lines: SalesLine[]; prefs: SalesPrefs; company: string; scale: number }) {
  const p = { ...prefs, pdf_settings: { ...prefs.pdf_settings, template: tpl.id, accent: "" } };
  return (
    <div className="pointer-events-none relative overflow-hidden bg-white" style={{ height: 1060 * scale }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: 820, transform: `scale(${scale})` }}>
        <DocPaper doc={doc} lines={lines} prefs={p} companyName={company} ribbon={false} />
      </div>
    </div>
  );
}

export default function TemplateGallery({ companyId, prefs, company, sample, sampleLines }: {
  companyId: string; prefs: SalesPrefs; company: string; sample: SalesDoc; sampleLines: SalesLine[];
}) {
  const router = useRouter();
  const [cat, setCat] = useState<"all" | TplCategory>("all");
  const [current, setCurrent] = useState(pdfOf(prefs.pdf_settings).template);
  const [preview, setPreview] = useState<TplDef | null>(null);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const groups = useMemo(() => CATEGORIES.filter((c) => cat === "all" || c.id === cat).map((c) => ({ ...c, items: TEMPLATE_DEFS.filter((t) => t.category === c.id) })), [cat]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPreview(null); };
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function use(t: TplDef) {
    setBusy(t.id);
    const { error } = await savePdf(companyId, { ...prefs.pdf_settings, template: t.id, accent: "" });
    setBusy("");
    if (error) { setToast("It couldn't be saved. Did you run the SQL for Paso 3.31?"); setTimeout(() => setToast(""), 3000); return; }
    setCurrent(t.id); setPreview(null);
    setToast(`"${t.name}" is now your template.`);
    // Te regresa solo a donde estabas, ya con el cambio
    setTimeout(() => {
      if (window.opener) { window.close(); return; }
      let back = "/dashboard/settings";
      try { const r = new URL(document.referrer); if (r.origin === location.origin && !r.pathname.startsWith("/dashboard/settings/pdf-templates")) back = r.pathname + r.search; } catch { /* sin referer */ }
      window.location.href = back;
    }, 450);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f6f8f9]">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-5 pt-4">
          <div>
            <Link href="/dashboard/settings" className="text-[13px] font-medium text-[#0f766e] hover:underline">← All Settings</Link>
            <h1 className="text-xl font-semibold text-[#0b1f3a]">Choose a Template</h1>
          </div>
          <button type="button" onClick={() => router.back()} aria-label="Close" className="group/x flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600">
            <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-300 group-hover/x:rotate-90" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
          </button>
        </div>
        <div className="mx-auto flex max-w-[1400px] gap-6 overflow-x-auto px-5 [scrollbar-width:none]">
          {[{ id: "all" as const, name: "All", n: TEMPLATE_DEFS.length }, ...CATEGORIES.map((c) => ({ id: c.id, name: c.name, n: TEMPLATE_DEFS.filter((t) => t.category === c.id).length }))].map((c) => (
            <button key={c.id} type="button" onClick={() => setCat(c.id)}
              className={`relative shrink-0 py-3 text-[15px] ${cat === c.id ? "font-semibold text-[#0f766e]" : "text-slate-600 hover:text-[#0b1f3a]"}`}>
              {c.name} ({c.n})<span className={`absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-[#0f766e] transition-transform ${cat === c.id ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] space-y-8 px-5 py-6">
        {groups.map((g) => (
          <section key={g.id}>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-500">{g.name}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {g.items.map((t) => {
                const on = current === t.id;
                return (
                  <div key={t.id} className="group">
                    <div role="button" tabIndex={0} onClick={() => (on ? setPreview(t) : use(t))} onKeyDown={(e) => { if (e.key === "Enter") (on ? setPreview(t) : use(t)); }}
                      className={`relative cursor-pointer overflow-hidden rounded-xl border-2 bg-white transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg ${on ? "border-[#0f766e] shadow-md" : "border-slate-200"}`}>
                      <Thumb tpl={t} doc={sample} lines={sampleLines} prefs={prefs} company={company} scale={0.24} />
                      {on && <span className="absolute left-2 top-2 rounded-full bg-[#0f766e] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">★ Selected</span>}
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0b1f3a]/55 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:hidden">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setPreview(t); }} className="w-28 rounded-lg bg-white py-1.5 text-sm font-medium text-[#0b1f3a] hover:bg-slate-100">Preview</button>
                        {!on && <button type="button" onClick={(e) => { e.stopPropagation(); use(t); }} disabled={!!busy} className="w-28 rounded-lg bg-[#0f766e] py-1.5 text-sm font-semibold text-white hover:bg-[#0c5f59]">{busy === t.id ? "Saving..." : "Use this"}</button>}
                      </div>
                    </div>
                    <button type="button" onClick={() => setPreview(t)} className="mt-2 block text-left text-[14px] font-medium text-[#0b1f3a] hover:text-[#0f766e]">{t.name}</button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {preview && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-slate-900/60 animate-[bp-fade_0.2s_ease-out]" onMouseDown={(e) => { if (e.target === e.currentTarget) setPreview(null); }}>
          <div className="flex items-center justify-between gap-3 bg-white px-5 py-3 shadow">
            <p className="font-semibold text-[#0b1f3a]">{preview.name} <span className="text-sm font-normal text-slate-500">· {CATEGORIES.find((c) => c.id === preview.category)?.name}</span></p>
            <div className="flex items-center gap-2">
              {current !== preview.id ? <button type="button" onClick={() => use(preview)} disabled={!!busy} className="rounded-lg bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0c5f59]">{busy ? "Saving..." : "Use this template"}</button>
                : <span className="rounded-lg bg-[#e9f7f4] px-3 py-2 text-sm font-medium text-[#0f766e]">Current template</span>}
              <XButton onClick={() => setPreview(null)} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-6" onMouseDown={(e) => { if (e.target === e.currentTarget) setPreview(null); }}>
            <DocPaper doc={sample} lines={sampleLines} prefs={{ ...prefs, pdf_settings: { ...prefs.pdf_settings, template: preview.id, accent: "" } }} companyName={company} status={docStatus(sample)} />
          </div>
        </div>
      )}
      <Toast text={toast} />
    </div>
  );
}
