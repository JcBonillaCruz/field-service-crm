"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import SelectMenu from "@/components/ui/SelectMenu";
import { FormHeader } from "@/components/catalog/FormBits";
import ItemPicker from "@/components/inventory/ItemPicker";
import { BarcodeSvg, QrSvg } from "@/components/inventory/Barcode";
import { LabelItem, PAPERS, Paper, TEMPLATES, Template, perPage } from "@/lib/labels";
import { InvItem, usd } from "@/lib/inventory";

type Line = { item: LabelItem; qty: number };
type Opts = { template: Template["id"]; showPrice: boolean; showCompany: boolean };

// Diseñador de etiquetas: elige plantilla y papel, cuántas de cada producto, y se imprime en hojas de stickers o en rollo
export default function LabelDesigner({ companyName, items, initial, stock }: {
  companyName: string; items: LabelItem[]; initial: { id: string; qty: number }[]; stock: Record<string, number>;
}) {
  const [lines, setLines] = useState<Line[]>(() => initial.map((x) => ({ item: items.find((i) => i.id === x.id)!, qty: x.qty })).filter((l) => l.item));
  const [template, setTemplate] = useState<Template["id"]>("basic");
  const [paperId, setPaperId] = useState("avery5160");
  const [start, setStart] = useState(1);
  const [showPrice, setShowPrice] = useState(true);
  const [showCompany, setShowCompany] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Recuerda la última plantilla y papel en este equipo
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem("bp-labels") || "{}"); if (s.template) setTemplate(s.template); if (s.paper) setPaperId(s.paper); if (typeof s.showPrice === "boolean") setShowPrice(s.showPrice); if (typeof s.showCompany === "boolean") setShowCompany(s.showCompany); } catch { /* */ }
  }, []);
  useEffect(() => { try { localStorage.setItem("bp-labels", JSON.stringify({ template, paper: paperId, showPrice, showCompany })); } catch { /* */ } }, [template, paperId, showPrice, showCompany]);

  const paper = PAPERS.find((p) => p.id === paperId) ?? PAPERS[0];
  const opts: Opts = { template, showPrice, showCompany };
  const labels = useMemo(() => lines.flatMap((l) => Array.from({ length: Math.max(0, Math.min(500, l.qty)) }, () => l.item)), [lines]);
  const slots: (LabelItem | null)[] = paper.kind === "sheet" ? [...Array(Math.max(0, Math.min(start, perPage(paper)) - 1)).fill(null), ...labels] : labels;
  const pages: (LabelItem | null)[][] = [];
  for (let i = 0; i < slots.length; i += perPage(paper)) pages.push(slots.slice(i, i + perPage(paper)));
  const pageW = paper.kind === "sheet" ? 8.5 : paper.w, pageH = paper.kind === "sheet" ? 11 : paper.h;

  const add = (it: InvItem | LabelItem) => setLines((l) => l.some((x) => x.item.id === it.id) ? l : [...l, { item: items.find((i) => i.id === it.id)!, qty: 1 }]);
  const setQty = (id: string, q: number) => setLines((l) => l.map((x) => (x.item.id === id ? { ...x, qty: Math.max(0, Math.min(500, q)) } : x)));
  const pickable = items.map((i) => ({ id: i.id, name: i.name, sku: i.sku, unit: i.unit, image_url: null, selling_price: i.price, cost_price: 0, category_id: null, description: null, is_active: true, created_at: "" })) as InvItem[];

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title="Print Labels" closeHref="/dashboard/inventory" />
      <div className="flex-1 lg:grid lg:grid-cols-[420px_minmax(0,1fr)]">
        {/* Ajustes */}
        <div className="space-y-6 border-b border-slate-200 bg-[#fafbfc] px-5 py-6 lg:border-b-0 lg:border-r">
          <section>
            <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Template</p>
            <div className="grid grid-cols-2 gap-2.5">
              {TEMPLATES.map((t) => (
                <button key={t.id} type="button" onClick={() => setTemplate(t.id)} aria-pressed={template === t.id}
                  className={`group rounded-xl border bg-white p-2.5 text-left transition-all ${template === t.id ? "border-[#0f766e] ring-1 ring-[#0f766e]" : "border-slate-200 hover:border-[#14a39a] hover:shadow-sm"}`}>
                  <div className="flex h-[58px] items-center justify-center overflow-hidden rounded-lg bg-slate-50">
                    <div style={{ transform: "scale(0.62)" }}><Label item={lines[0]?.item ?? SAMPLE} paper={{ ...PAPERS[0] }} opts={{ ...opts, template: t.id }} company={companyName} outline /></div>
                  </div>
                  <p className="mt-1.5 text-[13.5px] font-semibold text-[#0b1f3a]">{t.name}</p>
                  <p className="text-[11.5px] leading-tight text-slate-500">{t.text}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">Paper</p>
            <SelectMenu ariaLabel="Paper" value={paperId} onChange={(v) => { setPaperId(v); setStart(1); }} options={PAPERS.map((p) => ({ value: p.id, label: p.name }))} />
            <p className="text-[12.5px] text-slate-500">{paper.hint}</p>
            {paper.kind === "sheet" && (
              <label className="flex items-center justify-between gap-3 text-[14px] text-slate-700">
                <span>Start at label # <span className="text-[12px] text-slate-400">(reuse a half-used sheet)</span></span>
                <input type="number" min={1} max={perPage(paper)} value={start} onChange={(e) => setStart(Math.max(1, Math.min(perPage(paper), Number(e.target.value) || 1)))}
                  className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-center tabular-nums focus:border-[#0f766e] focus:outline-none" />
              </label>
            )}
            <Toggle on={showPrice} set={setShowPrice} label="Show price" />
            <Toggle on={showCompany} set={setShowCompany} label={`Show “${companyName}”`} />
          </section>

          <section className="space-y-3">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">Products</p>
            <ItemPicker items={pickable.filter((i) => !lines.some((l) => l.item.id === i.id))} onPick={add} placeholder="Add a product: search or scan" />
            {lines.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">Add the products you want labels for.</p> : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {lines.map((l) => (
                  <li key={l.item.id} className="flex items-center gap-2 px-3 py-2.5">
                    <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium text-[#0b1f3a]">{l.item.name}</span>
                      <span className="block truncate font-mono text-[11.5px] text-slate-400">{l.item.sku}{stock[l.item.id] ? <span className="font-sans"> · {stock[l.item.id]} on hand</span> : null}</span></span>
                    <button type="button" onClick={() => setQty(l.item.id, l.qty - 1)} className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">−</button>
                    <input value={l.qty} inputMode="numeric" aria-label="Copies" onChange={(e) => setQty(l.item.id, Number(e.target.value.replace(/\D/g, "")) || 0)}
                      className="h-8 w-12 rounded-lg border border-slate-200 text-center text-[14px] tabular-nums focus:border-[#0f766e] focus:outline-none" />
                    <button type="button" onClick={() => setQty(l.item.id, l.qty + 1)} className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">+</button>
                    <button type="button" onClick={() => setLines((x) => x.filter((y) => y.item.id !== l.item.id))} aria-label="Remove" className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {lines.length > 0 && (
              <button type="button" onClick={() => setLines((ls) => ls.map((l) => ({ ...l, qty: Math.max(1, Math.round(stock[l.item.id] || 1)) })))} className="text-[13px] font-medium text-[#0f766e] hover:underline">
                One label per unit on hand
              </button>
            )}
          </section>
        </div>

        {/* Vista previa */}
        <div className="bg-[#eef1f4] px-4 py-6 lg:px-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14px] text-slate-600"><b className="text-[#0b1f3a]">{labels.length}</b> label{labels.length === 1 ? "" : "s"} · {pages.length} {paper.kind === "sheet" ? `sheet${pages.length === 1 ? "" : "s"}` : "on the roll"}</p>
            <div className="flex gap-2">
              <Link prefetch={false} href="/dashboard/inventory" className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[14.5px] font-medium text-slate-700 hover:bg-slate-50">Cancel</Link>
              <button type="button" disabled={!labels.length} onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-[#0c5f59] disabled:opacity-50">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 8V3h10v5M6 17H4V9h16v8h-2M7 14h10v7H7z" /></svg>
                Print labels
              </button>
            </div>
          </div>
          {labels.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-slate-500">The preview shows here.</p> : (
            <div className="space-y-5 overflow-x-auto pb-4">
              {pages.slice(0, 6).map((pg, i) => <Page key={i} paper={paper} slots={pg} opts={opts} company={companyName} preview />)}
              {pages.length > 6 && <p className="text-center text-[13px] text-slate-500">+ {pages.length - 6} more page{pages.length - 6 === 1 ? "" : "s"} in the print</p>}
            </div>
          )}
          <p className="mt-3 text-[12.5px] text-slate-500">Tip: in the print window choose <b>Scale 100%</b> (or “Actual size”) and <b>Margins: None</b> so the labels line up with the stickers.</p>
        </div>
      </div>

      {/* Copia para imprimir (fuera de la app, solo aparece al imprimir) */}
      {mounted && createPortal(
        <div id="bp-print-labels">
          <style>{`
            #bp-print-labels { display: none; }
            @media print {
              @page { size: ${pageW}in ${pageH}in; margin: 0; }
              html, body { background: #fff !important; }
              body > *:not(#bp-print-labels) { display: none !important; }
              #bp-print-labels { display: block !important; }
              .bp-label-page { break-after: page; page-break-after: always; }
              .bp-label-page:last-child { break-after: auto; page-break-after: auto; }
            }`}</style>
          {pages.map((pg, i) => <Page key={i} paper={paper} slots={pg} opts={opts} company={companyName} />)}
        </div>, document.body)}
    </div>
  );
}

const SAMPLE: LabelItem = { id: "sample", name: "Contactor 40A 2-pole", sku: "012345678905", price: 39.99, unit: "each" };

function Toggle({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className="flex w-full items-center justify-between gap-3 text-left text-[14px] text-slate-700">
      <span className="truncate">{label}</span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-[#0f766e]" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

// Una hoja (o una etiqueta de rollo) con medidas reales en pulgadas
function Page({ paper, slots, opts, company, preview }: { paper: Paper; slots: (LabelItem | null)[]; opts: Opts; company: string; preview?: boolean }) {
  const sheet = paper.kind === "sheet";
  const style: React.CSSProperties = sheet ? {
    width: "8.5in", height: "11in", paddingTop: `${paper.top}in`, paddingLeft: `${paper.left}in`, boxSizing: "border-box",
    display: "grid", gridTemplateColumns: `repeat(${paper.cols}, ${paper.w}in)`, gridAutoRows: `${paper.h}in`, columnGap: `${paper.gapX}in`, rowGap: `${paper.gapY}in`, alignContent: "start",
  } : { width: `${paper.w}in`, height: `${paper.h}in` };
  return (
    <div className={`bp-label-page bg-white ${preview ? "mx-auto shadow-[0_8px_30px_rgba(15,40,60,0.12)]" : ""}`} style={style}>
      {slots.map((it, i) => it ? <Label key={i} item={it} paper={paper} opts={opts} company={company} outline={preview && sheet} /> : <span key={i} style={{ width: `${paper.w}in`, height: `${paper.h}in` }} className={preview ? "rounded-[0.06in] border border-dashed border-slate-200" : ""} />)}
    </div>
  );
}

// Una etiqueta. Todo se mide en pulgadas/puntos para que salga igual en papel.
function Label({ item, paper, opts, company, outline }: { item: LabelItem; paper: Paper; opts: Opts; company: string; outline?: boolean }) {
  const { w, h } = paper;
  const pad = Math.min(0.08, h * 0.08);
  const pt = (k: number, min = 4.5, max = 40) => `${Math.max(min, Math.min(max, h * k))}pt`;
  const box: React.CSSProperties = {
    width: `${w}in`, height: `${h}in`, padding: `${pad}in`, boxSizing: "border-box", overflow: "hidden", fontFamily: "Arial, Helvetica, sans-serif", color: "#000",
    border: outline ? "1px solid #e2e8f0" : undefined, borderRadius: outline ? "0.06in" : undefined, display: "flex",
  };
  const one: React.CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.1 };
  const two: React.CSSProperties = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.08 };
  const co = opts.showCompany ? <div style={{ ...one, fontSize: pt(5.5, 4, 9), color: "#444" }}>{company}</div> : null;

  if (opts.template === "qr") {
    const q = h - pad * 2;
    return (
      <div style={{ ...box, gap: `${pad}in`, alignItems: "center" }}>
        <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "0.02in" }}>
          {co}
          <div style={{ ...two, fontSize: pt(9, 5, 20), fontWeight: 700 }}>{item.name}</div>
          <div style={{ ...one, fontSize: pt(7, 4.5, 14), fontFamily: "monospace" }}>{item.sku}</div>
          {opts.showPrice && <div style={{ ...one, fontSize: pt(9, 5, 20), fontWeight: 700 }}>{usd(item.price)}</div>}
        </div>
        <QrBox size={q} value={item.sku} />
      </div>
    );
  }
  if (opts.template === "price") {
    return (
      <div style={{ ...box, flexDirection: "column", justifyContent: "space-between" }}>
        {co}
        <div style={{ ...one, fontSize: pt(7.5, 4.5, 16), fontWeight: 600 }}>{item.name}</div>
        {opts.showPrice && <div style={{ ...one, fontSize: pt(20, 7, 60), fontWeight: 800, lineHeight: 1 }}>{usd(item.price)}</div>}
        <div style={{ height: `${h * (opts.showPrice ? 0.22 : 0.45)}in` }}><BarcodeSvg value={item.sku} className="block h-full w-full" /></div>
        <div style={{ ...one, fontSize: pt(5.5, 4, 12), fontFamily: "monospace", textAlign: "center" }}>{item.sku}</div>
      </div>
    );
  }
  if (opts.template === "big") {
    return (
      <div style={{ ...box, flexDirection: "column", justifyContent: "space-between" }}>
        {co}
        <div style={{ ...two, fontSize: pt(16, 6, 48), fontWeight: 800 }}>{item.name}</div>
        <div style={{ height: `${h * 0.32}in` }}><BarcodeSvg value={item.sku} className="block h-full w-full" /></div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.05in", fontSize: pt(7, 4.5, 18) }}>
          <span style={{ ...one, fontFamily: "monospace" }}>{item.sku}</span>
          {opts.showPrice && <b style={one}>{usd(item.price)}</b>}
        </div>
      </div>
    );
  }
  // basic
  return (
    <div style={{ ...box, flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.05in", alignItems: "baseline" }}>
        <span style={{ ...one, fontSize: pt(8.5, 4.5, 22), fontWeight: 700, minWidth: 0 }}>{item.name}</span>
        {opts.showPrice && <span style={{ ...one, fontSize: pt(8.5, 4.5, 22), fontWeight: 700, flexShrink: 0 }}>{usd(item.price)}</span>}
      </div>
      {co}
      <div style={{ height: `${h * (opts.showCompany ? 0.38 : 0.46)}in` }}><BarcodeSvg value={item.sku} className="block h-full w-full" /></div>
      <div style={{ ...one, fontSize: pt(6.5, 4, 16), fontFamily: "monospace", textAlign: "center", letterSpacing: "0.04em" }}>{item.sku}</div>
    </div>
  );
}

function QrBox({ size, value }: { size: number; value: string }) {
  return <div style={{ width: `${size}in`, height: `${size}in`, flexShrink: 0, order: -1 }}><QrSvg value={value} className="h-full w-full" /></div>;
}
