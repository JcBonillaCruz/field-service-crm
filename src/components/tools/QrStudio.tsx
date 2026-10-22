"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { BODY, EYE_FRAME, EYE_INNER, FRAMES, QrOptions, buildQrSvg } from "@/lib/qr-design";

type Kind = "url" | "phone" | "sms" | "whatsapp" | "review" | "email" | "vcard" | "wifi" | "text";
const KINDS: { id: Kind; label: string; icon: string; tone: string }[] = [
  { id: "url", label: "Website", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18", tone: "from-[#e0f2fe] to-[#bae6fd] text-[#0369a1]" },
  { id: "phone", label: "Call", icon: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z", tone: "from-[#dcfce7] to-[#bbf7d0] text-[#15803d]" },
  { id: "sms", label: "Text", icon: "M4 5h16v11H9l-5 4zM8 9.5h8M8 12.5h5", tone: "from-[#ede9fe] to-[#ddd6fe] text-[#6d28d9]" },
  { id: "whatsapp", label: "WhatsApp", icon: "M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3zM9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 1c-1.2-.5-2.5-1.8-3-3l1-1-1-2z", tone: "from-[#dcfce7] to-[#86efac] text-[#15803d]" },
  { id: "review", label: "Google review", icon: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z", tone: "from-[#fef9c3] to-[#fde68a] text-[#b45309]" },
  { id: "email", label: "Email", icon: "M3 6h18v12H3zM3 7l9 6 9-6", tone: "from-[#ffe4e6] to-[#fecdd3] text-[#be123c]" },
  { id: "vcard", label: "Contact card", icon: "M4 5h16v14H4zM9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 16a3 3 0 0 1 6 0M14 9h4M14 13h4", tone: "from-[#e0e7ff] to-[#c7d2fe] text-[#4338ca]" },
  { id: "wifi", label: "Wi‑Fi", icon: "M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01", tone: "from-[#cffafe] to-[#a5f3fc] text-[#0e7490]" },
  { id: "text", label: "Text note", icon: "M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h4", tone: "from-[#f1f5f9] to-[#e2e8f0] text-[#475569]" },
];
type Sec = "content" | "body" | "eyeFrame" | "eyeInner" | "colors" | "logo" | "frame" | "advanced";
const SECTIONS: { id: Sec; label: string; icon: string }[] = [
  { id: "content", label: "Content", icon: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" },
  { id: "body", label: "Body shape", icon: "M4 4h4v4H4zM10 4h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM10 10h4v4h-4z" },
  { id: "eyeFrame", label: "Eye frame", icon: "M3 3h8v8H3zM5 5v4h4V5zM13 3h8v8h-8zM3 13h8v8H3z" },
  { id: "eyeInner", label: "Eye center", icon: "M8 8h8v8H8z" },
  { id: "colors", label: "Colors", icon: "M12 21a9 9 0 1 1 0-18c5 0 9 3.6 9 8 0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1.5 3.3A1.6 1.6 0 0 1 12 21zM7.5 11h.01M10 7.5h.01M14.5 7.5h.01" },
  { id: "logo", label: "Logo", icon: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01" },
  { id: "frame", label: "Frame & text", icon: "M3 3h18v18H3zM3 16h18M8 19h8" },
  { id: "advanced", label: "Advanced", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 15H3.5a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V4.5a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.1a2 2 0 1 1 0 4z" },
];
const PALETTES: [string, string, string, string][] = [
  ["Brilla", "#1a2744", "#e8713a", "#1a2744"], ["BrightPro", "#0f766e", "#0b1f3a", "#0f766e"], ["Classic", "#111827", "#111827", "#111827"],
  ["Ocean", "#0369a1", "#0ea5e9", "#0c4a6e"], ["Sunset", "#be123c", "#f59e0b", "#9f1239"], ["Forest", "#166534", "#65a30d", "#14532d"], ["Royal", "#4c1d95", "#a855f7", "#3b0764"],
];
const digits = (s: string) => s.replace(/\D/g, "");
const intl = (s: string) => { const d = digits(s); return d.length === 10 ? `1${d}` : d; };
const esc = (s: string) => s.replace(/[\\;,:"]/g, (m) => `\\${m}`);
async function toDataUrl(src: string): Promise<string | null> {
  try { const b = await (await fetch(src)).blob(); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(String(f.result)); f.readAsDataURL(b); }); } catch { return null; }
}
const field = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[15px] placeholder:text-slate-400 focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15";
const Lbl = ({ children }: { children: React.ReactNode }) => <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{children}</span>;

function ShapeGrid({ value, opts, kind, onPick }: { value: string; opts: Record<string, { label: string; d: string }>; kind: "body" | "frame" | "inner"; onPick: (k: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-2 sm:grid-cols-6">
      {Object.entries(opts).map(([k, v]) => (
        <button key={k} type="button" title={v.label} aria-label={v.label} onClick={() => onPick(k)}
          className={`flex aspect-square items-center justify-center rounded-xl border-2 bg-white transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-90 ${value === k ? "border-[#0f766e] bg-[#f3fbf8] shadow-sm" : "border-slate-200 hover:border-[#14a39a]"}`}>
          {kind === "body" ? (
            <svg viewBox="-0.15 -0.15 1.3 1.3" className="h-6 w-6 text-[#0b1f3a]"><path d={v.d} fill="currentColor" /></svg>
          ) : kind === "frame" ? (
            <svg viewBox="-0.5 -0.5 8 8" className="h-7 w-7 text-[#0b1f3a]"><path d={v.d} fill="currentColor" fillRule="evenodd" /><rect x="2" y="2" width="3" height="3" fill="currentColor" opacity=".25" /></svg>
          ) : (
            <svg viewBox="-0.4 -0.4 3.8 3.8" className="h-6 w-6 text-[#0b1f3a]"><path d={v.d} fill="currentColor" /></svg>
          )}
        </button>
      ))}
    </div>
  );
}
function ColorField({ label, value, on }: { label: string; value: string; on: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-200 shadow-inner" style={{ background: value }}>
        <input type="color" value={value} onChange={(e) => on(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </label>
      <input value={value} onChange={(e) => on(e.target.value)} className={`${field} !w-28 !py-1.5 font-mono text-[13px]`} />
    </div>
  );
}
function Slider({ label, value, min, max, step, fmt, on }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; on: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between"><Lbl>{label}</Lbl><span className="text-[13px] font-semibold tabular-nums text-[#0f766e]">{fmt(value)}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => on(Number(e.target.value))} className="w-full accent-[#0f766e]" />
    </div>
  );
}

export default function QrStudio({ company, logoUrl, phone, website }: { company: string; logoUrl: string | null; phone: string; website: string }) {
  const [kind, setKind] = useState<Kind>("url");
  const [f, setF] = useState<Record<string, string>>({
    url: website ? (website.startsWith("http") ? website : `https://${website}`) : "https://", phone, msg: "Hi! I'd like a quote.", email: "",
    subject: "Service request", first: "", last: "", org: company, title: "", address: "", ssid: "", pass: "", review: "", text: "",
  });
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const [o, setO] = useState<Omit<QrOptions, "text" | "logo">>({
    ec: "H", margin: 4, body: "rounded", eyeFrame: "rounded", eyeInner: "rounded", fg: "#1a2744", bg: "#ffffff", eyeFrameColor: "#e8713a", eyeInnerColor: "#1a2744",
    transparent: false, gradient: "none", fg2: "#0f766e", gradientAngle: 45, logoSize: 0.22, logoPad: 1, logoRadius: 0.2, logoBg: true,
    frame: "bottom", frameText: "Scan me", frameColor: "#1a2744", frameTextColor: "#ffffff", radius: 0.06,
  });
  const up = (p: Partial<typeof o>) => setO((x) => ({ ...x, ...p }));
  const [logoMode, setLogoMode] = useState<"company" | "upload" | "none">(logoUrl ? "company" : "none");
  const [logoData, setLogoData] = useState<string | null>(null);
  const [upload, setUpload] = useState<string | null>(null);
  const [size, setSize] = useState(2000);
  const [sec, setSec] = useState<Sec>("content");
  const [open, setOpen] = useState<Sec | null>("content");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { if (logoUrl) toDataUrl(logoUrl).then(setLogoData); }, [logoUrl]);
  const logo = logoMode === "company" ? logoData : logoMode === "upload" ? upload : null;

  const text = useMemo(() => {
    switch (kind) {
      case "url": return f.url;
      case "phone": return `tel:+${intl(f.phone)}`;
      case "sms": return `SMSTO:+${intl(f.phone)}:${f.msg}`;
      case "whatsapp": return `https://wa.me/${intl(f.phone)}?text=${encodeURIComponent(f.msg)}`;
      case "review": return f.review || "https://g.page/r/";
      case "email": return `mailto:${f.email}?subject=${encodeURIComponent(f.subject)}`;
      case "wifi": return `WIFI:T:WPA;S:${esc(f.ssid)};P:${esc(f.pass)};;`;
      case "vcard": return ["BEGIN:VCARD", "VERSION:3.0", `N:${f.last};${f.first}`, `FN:${`${f.first} ${f.last}`.trim() || company}`, f.org && `ORG:${f.org}`, f.title && `TITLE:${f.title}`,
        f.phone && `TEL;TYPE=WORK,VOICE:+${intl(f.phone)}`, f.email && `EMAIL:${f.email}`, f.url && f.url !== "https://" && `URL:${f.url}`, f.address && `ADR;TYPE=WORK:;;${f.address}`, "END:VCARD"].filter(Boolean).join("\n");
      default: return f.text || " ";
    }
  }, [kind, f, company]);
  const svg = useMemo(() => { try { return buildQrSvg({ ...o, text, logo }); } catch { return ""; } }, [o, text, logo]);
  const src = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : "";

  // ---------- Descargas ----------
  const slug = (company || "qr").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const save = (blob: Blob, name: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); };
  const raster = (type: "image/png" | "image/jpeg") => new Promise<Blob | null>((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = size; c.height = Math.round((size * img.height) / img.width);
      const ctx = c.getContext("2d")!;
      if (type === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(res, type, 0.95);
    };
    img.src = src;
  });
  const dl = {
    svg: () => save(new Blob([svg], { type: "image/svg+xml" }), `${slug}-qr.svg`),
    png: async () => { const b = await raster("image/png"); if (b) save(b, `${slug}-qr-${size}.png`); },
    jpg: async () => { const b = await raster("image/jpeg"); if (b) save(b, `${slug}-qr-${size}.jpg`); },
    pdf: async () => {
      const b = await raster("image/png"); if (!b) return;
      const { PDFDocument } = await import("pdf-lib");
      const pdf = await PDFDocument.create(); const png = await pdf.embedPng(new Uint8Array(await b.arrayBuffer()));
      const w = 288, h = (w * png.height) / png.width; // 4 pulgadas de ancho
      const page = pdf.addPage([w + 72, h + 72]); page.drawImage(png, { x: 36, y: 36, width: w, height: h });
      const bytes = await pdf.save(); save(new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" }), `${slug}-qr.pdf`);
    },
  };
  const sizeLabel = size >= 4000 ? "4K (4000 px)" : `${size} × ${size}`;

  // ---------- Contenido de cada sección ----------
  const sections: Record<Sec, React.ReactNode> = {
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map((k) => (
            <button key={k.id} type="button" onClick={() => setKind(k.id)}
              className={`group flex flex-col items-center gap-1.5 rounded-2xl border-2 px-1 py-3 text-[12px] transition-all active:scale-95 ${kind === k.id ? "border-[#0f766e] bg-[#f3fbf8] font-semibold text-[#0b3f3b] shadow-sm" : "border-slate-100 bg-white text-slate-600 hover:border-[#bfe7de]"}`}>
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-[-6deg] ${k.tone}`}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={k.icon} /></svg>
              </span>{k.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {kind === "url" && <label className="sm:col-span-2"><Lbl>Website link</Lbl><input value={f.url} onChange={(e) => set("url", e.target.value)} className={field} /></label>}
          {kind === "vcard" && <><label><Lbl>First name</Lbl><input value={f.first} onChange={(e) => set("first", e.target.value)} placeholder="Juan" className={field} /></label>
            <label><Lbl>Last name</Lbl><input value={f.last} onChange={(e) => set("last", e.target.value)} placeholder="Perez" className={field} /></label>
            <label><Lbl>Company</Lbl><input value={f.org} onChange={(e) => set("org", e.target.value)} className={field} /></label>
            <label><Lbl>Job title</Lbl><input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Owner" className={field} /></label></>}
          {["phone", "sms", "whatsapp", "vcard"].includes(kind) && <label><Lbl>Phone</Lbl><input type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(214) 555-0123" className={field} /></label>}
          {["email", "vcard"].includes(kind) && <label><Lbl>Email</Lbl><input value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="office@company.com" className={field} /></label>}
          {kind === "vcard" && <><label><Lbl>Website</Lbl><input value={f.url} onChange={(e) => set("url", e.target.value)} className={field} /></label>
            <label className="sm:col-span-2"><Lbl>Address</Lbl><input value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, City" className={field} /></label></>}
          {["sms", "whatsapp"].includes(kind) && <label className="sm:col-span-2"><Lbl>Pre-written message</Lbl><input value={f.msg} onChange={(e) => set("msg", e.target.value)} className={field} /></label>}
          {kind === "email" && <label><Lbl>Subject</Lbl><input value={f.subject} onChange={(e) => set("subject", e.target.value)} className={field} /></label>}
          {kind === "review" && <label className="sm:col-span-2"><Lbl>Google review link</Lbl><input value={f.review} onChange={(e) => set("review", e.target.value)} placeholder="https://g.page/r/…/review" className={field} />
            <span className="mt-1 block text-[12px] text-slate-500">Google Business Profile → Ask for reviews → copy the link.</span></label>}
          {kind === "wifi" && <><label><Lbl>Network name</Lbl><input value={f.ssid} onChange={(e) => set("ssid", e.target.value)} className={field} /></label>
            <label><Lbl>Password</Lbl><input value={f.pass} onChange={(e) => set("pass", e.target.value)} className={field} /></label></>}
          {kind === "text" && <label className="sm:col-span-2"><Lbl>Text</Lbl><textarea rows={3} value={f.text} onChange={(e) => set("text", e.target.value)} className={field} /></label>}
        </div>
      </div>
    ),
    body: <ShapeGrid value={o.body} opts={BODY} kind="body" onPick={(k) => up({ body: k })} />,
    eyeFrame: <ShapeGrid value={o.eyeFrame} opts={EYE_FRAME} kind="frame" onPick={(k) => up({ eyeFrame: k })} />,
    eyeInner: <ShapeGrid value={o.eyeInner} opts={EYE_INNER} kind="inner" onPick={(k) => up({ eyeInner: k })} />,
    colors: (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {PALETTES.map(([n, a, b, c]) => (
            <button key={n} type="button" onClick={() => up({ fg: a, eyeFrameColor: b, eyeInnerColor: c, frameColor: a })}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-slate-600 transition-all hover:border-[#14a39a] active:scale-95">
              <span className="h-3 w-3 rounded-full" style={{ background: a }} /><span className="h-3 w-3 rounded-full" style={{ background: b }} />{n}
            </button>
          ))}
        </div>
        <ColorField label="Modules" value={o.fg} on={(v) => up({ fg: v })} />
        <ColorField label="Background" value={o.bg} on={(v) => up({ bg: v })} />
        <ColorField label="Eye frame" value={o.eyeFrameColor} on={(v) => up({ eyeFrameColor: v })} />
        <ColorField label="Eye center" value={o.eyeInnerColor} on={(v) => up({ eyeInnerColor: v })} />
        <div>
          <Lbl>Gradient on modules</Lbl>
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-sm">
            {(["none", "linear", "radial"] as const).map((g) => <button key={g} type="button" onClick={() => up({ gradient: g })} className={`rounded-md px-3 py-1.5 capitalize transition-all ${o.gradient === g ? "bg-white font-semibold text-[#0b1f3a] shadow-sm" : "text-slate-500"}`}>{g}</button>)}
          </div>
        </div>
        {o.gradient !== "none" && <ColorField label="Gradient to" value={o.fg2} on={(v) => up({ fg2: v })} />}
        {o.gradient === "linear" && <Slider label="Angle" value={o.gradientAngle} min={0} max={360} step={5} fmt={(v) => `${v}°`} on={(v) => up({ gradientAngle: v })} />}
        <label className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-slate-600"><input type="checkbox" checked={o.transparent} onChange={(e) => up({ transparent: e.target.checked })} className="h-4 w-4 accent-[#0f766e]" />Transparent background (SVG/PNG)</label>
      </div>
    ),
    logo: (
      <div className="space-y-4">
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-sm">
          {([...(logoUrl ? [["company", "Company logo"]] : []), ["upload", "Upload"], ["none", "No logo"]] as [typeof logoMode, string][]).map(([v, l]) => (
            <button key={v} type="button" onClick={() => { setLogoMode(v); if (v === "upload" && !upload) file.current?.click(); }} className={`rounded-md px-3 py-1.5 transition-all ${logoMode === v ? "bg-white font-semibold text-[#0b1f3a] shadow-sm" : "text-slate-500"}`}>{l}</button>
          ))}
        </div>
        <input ref={file} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => {
          const x = e.target.files?.[0]; e.target.value = ""; if (!x) return;
          const r = new FileReader(); r.onload = () => { setUpload(String(r.result)); setLogoMode("upload"); }; r.readAsDataURL(x);
        }} />
        <button type="button" onClick={() => file.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-4 text-sm text-slate-500 transition-colors hover:border-[#14a39a] hover:text-[#0f766e]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {upload ? <img src={upload} alt="" className="h-8 w-8 rounded object-contain" /> : null}{upload ? "Change uploaded logo" : "Click to upload a logo"}
        </button>
        {logo && <>
          <Slider label="Size" value={o.logoSize} min={0.12} max={0.32} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} on={(v) => up({ logoSize: v })} />
          <Slider label="Padding" value={o.logoPad} min={0} max={3} step={1} fmt={(v) => `${v * 8}px`} on={(v) => up({ logoPad: v })} />
          <Slider label="Rounded corners" value={o.logoRadius} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} on={(v) => up({ logoRadius: v })} />
          <label className="flex items-center gap-2 text-[13px] text-slate-600"><input type="checkbox" checked={o.logoBg} onChange={(e) => up({ logoBg: e.target.checked })} className="h-4 w-4 accent-[#0f766e]" />White plate behind the logo</label>
          {o.logoSize > 0.27 && <p className="rounded-lg bg-[#fff7ed] px-3 py-2 text-[12px] text-[#9a3412]">Big logos can make the code harder to scan. Test it with your phone.</p>}
        </>}
      </div>
    ),
    frame: (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(FRAMES).map(([k, v]) => (
            <button key={k} type="button" onClick={() => up({ frame: k })}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 bg-white px-1 py-2 text-[11px] transition-all active:scale-95 ${o.frame === k ? "border-[#0f766e] bg-[#f3fbf8] font-semibold text-[#0b3f3b]" : "border-slate-200 text-slate-600 hover:border-[#14a39a]"}`}>
              <FrameIcon k={k} />{v.label}
            </button>
          ))}
        </div>
        {o.frame !== "none" && <>
          <label className="block"><Lbl>Text</Lbl><input value={o.frameText} onChange={(e) => up({ frameText: e.target.value.slice(0, 22) })} className={field} /></label>
          <div className="flex flex-wrap gap-1.5">{["Scan me", "Call us", "Get a quote", "Leave a review", "Pay here", "Book service", "Visit our site"].map((t) => (
            <button key={t} type="button" onClick={() => up({ frameText: t })} className={`rounded-full px-2.5 py-1 text-[12px] transition-colors ${o.frameText === t ? "bg-[#0f766e] text-white" : "bg-slate-100 text-slate-600 hover:bg-[#e9f7f4]"}`}>{t}</button>
          ))}</div>
          <ColorField label="Frame" value={o.frameColor} on={(v) => up({ frameColor: v })} />
          <ColorField label="Frame text" value={o.frameTextColor} on={(v) => up({ frameTextColor: v })} />
        </>}
        {o.frame === "none" && <Slider label="Rounded image corners" value={o.radius} min={0} max={0.3} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} on={(v) => up({ radius: v })} />}
      </div>
    ),
    advanced: (
      <div className="space-y-4">
        <div><Lbl>Error correction</Lbl>
          <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-0.5 text-sm">
            {([["L", "7%"], ["M", "15%"], ["Q", "25%"], ["H", "30%"]] as const).map(([v, l]) => <button key={v} type="button" onClick={() => up({ ec: v })} className={`rounded-md py-1.5 transition-all ${o.ec === v ? "bg-white font-semibold text-[#0b1f3a] shadow-sm" : "text-slate-500"}`}>{v} · {l}</button>)}
          </div>
          <p className="mt-1 text-[12px] text-slate-500">With a logo, BrightPro uses at least Q so the code still scans.</p>
        </div>
        <Slider label="Quiet zone (margin)" value={o.margin} min={1} max={8} step={1} fmt={(v) => `${v}`} on={(v) => up({ margin: v })} />
        <Slider label="Download quality" value={size} min={500} max={4000} step={100} fmt={() => sizeLabel} on={setSize} />
      </div>
    ),
  };

  const preview = (
    <div className="mx-auto w-full max-w-[340px] rounded-2xl bg-[repeating-conic-gradient(#f1f5f9_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img key={o.body + o.eyeFrame + o.eyeInner + o.frame} src={src} alt="QR code preview" className="w-full drop-shadow-sm animate-[bp-fade_0.25s_ease-out]" />}
    </div>
  );
  const dlButtons = (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quality</span><span className="text-[13px] font-semibold text-[#0f766e]">{sizeLabel}</span></div>
        <input type="range" min={500} max={4000} step={100} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full accent-[#0f766e]" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {([["SVG", dl.svg, "bg-[#0f766e] text-white"], ["PNG", dl.png, "bg-[#2563eb] text-white"], ["JPG", dl.jpg, "bg-[#0b1f3a] text-white"], ["PDF", dl.pdf, "border border-slate-200 bg-white text-slate-700"]] as const).map(([l, fn, c]) => (
          <button key={l} type="button" onClick={fn} className={`flex items-center justify-center gap-1 rounded-lg py-2.5 text-sm font-semibold transition-transform hover:-translate-y-0.5 active:scale-95 ${c}`}>
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3v10m0 0-3.5-3.5M10 13l3.5-3.5M4 16h12" strokeLinecap="round" strokeLinejoin="round" /></svg>{l}
          </button>
        ))}
      </div>
      <p className="break-all rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">{text.length > 120 ? text.slice(0, 120) + "…" : text}</p>
    </div>
  );
  const SecIcon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f4f6f8]">
      {/* ---------- Computadora: menú · diseño · vista en vivo ---------- */}
      <div className="hidden min-h-[calc(100vh-4rem)] lg:grid lg:grid-cols-[230px_minmax(0,1fr)_minmax(360px,440px)]">
        <nav className="border-r border-slate-200 bg-white p-3">
          <p className="px-3 pb-3 pt-2 text-lg font-semibold text-[#0b1f3a]">QR Code Studio</p>
          {SECTIONS.map((s) => (
            <button key={s.id} type="button" onClick={() => setSec(s.id)}
              className={`group mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] transition-all ${sec === s.id ? "bg-[#e3f4ef] font-semibold text-[#0b3f3b]" : "text-slate-600 hover:bg-slate-50"}`}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition-transform group-hover:scale-110 ${sec === s.id ? "bg-white text-[#0f766e] shadow-sm" : "bg-slate-100 text-slate-500"}`}><SecIcon d={s.icon} /></span>{s.label}
            </button>
          ))}
        </nav>
        <div className="overflow-y-auto p-6">
          <h2 className="mb-1 text-xl font-semibold text-[#0b1f3a]">{SECTIONS.find((s) => s.id === sec)?.label}</h2>
          <p className="mb-5 text-[13px] text-slate-500">Changes show live on the right.</p>
          <div key={sec} className="max-w-xl animate-[bp-fade_0.2s_ease-out] rounded-2xl border border-slate-200 bg-white p-5">{sections[sec]}</div>
        </div>
        <div className="border-l border-slate-200 bg-white p-6">
          <div className="sticky top-20 space-y-4">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">Live preview</p>
            {preview}{dlButtons}
          </div>
        </div>
      </div>

      {/* ---------- Celular: el código arriba (fijo) y las secciones abajo, una abierta a la vez ---------- */}
      <div className="lg:hidden">
        <div className="sticky top-16 z-20 border-b border-slate-200 bg-white/95 px-4 pb-3 pt-3 backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[17px] font-semibold text-[#0b1f3a]">QR Code Studio</p>
            <Menu>
              <MenuButton aria-label="Download" className="flex h-10 items-center gap-1.5 rounded-xl bg-[#0f766e] px-3 text-sm font-semibold text-white active:scale-95">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3v10m0 0-3.5-3.5M10 13l3.5-3.5M4 16h12" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><circle cx="4.5" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="15.5" cy="10" r="1.5" /></svg>
              </MenuButton>
              <MenuItems anchor="bottom end" transition className="z-[90] mt-1 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_16px_44px_rgba(15,40,60,0.18)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0 focus:outline-none">
                <div className="px-2 pb-2 pt-1">
                  <div className="flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quality</span><span className="text-[12px] font-semibold text-[#0f766e]">{sizeLabel}</span></div>
                  <div className="mt-1 grid grid-cols-4 gap-1">{[1000, 2000, 3000, 4000].map((v) => <button key={v} type="button" onClick={(e) => { e.preventDefault(); setSize(v); }} className={`rounded-md py-1 text-[12px] ${size === v ? "bg-[#0f766e] font-semibold text-white" : "bg-slate-100 text-slate-600"}`}>{v === 4000 ? "4K" : `${v / 1000}K`}</button>)}</div>
                </div>
                {([["PNG", "Best for web & phone", dl.png], ["JPG", "Smaller file, white background", dl.jpg], ["SVG", "Vector for vans & big signs", dl.svg], ["PDF", "Ready to print", dl.pdf]] as const).map(([l, sub, fn]) => (
                  <MenuItem key={l}><button type="button" onClick={fn} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left data-[focus]:bg-[#e9f7f4]">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef8f5] text-[12px] font-bold text-[#0f766e]">{l}</span>
                    <span><span className="block text-[14px] font-medium text-[#0b1f3a]">Download {l}</span><span className="text-[12px] text-slate-500">{sub}</span></span>
                  </button></MenuItem>
                ))}
              </MenuItems>
            </Menu>
          </div>
          <div className="mx-auto w-[min(62vw,260px)]">{preview}</div>
        </div>
        <div className="space-y-2.5 px-3 py-3 pb-10">
          {SECTIONS.map((s) => (
            <div key={s.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${open === s.id ? "bg-[#e3f4ef] text-[#0f766e]" : "bg-slate-100 text-slate-500"}`}><SecIcon d={s.icon} /></span>
                <span className="flex-1 text-[15px] font-semibold text-[#0b1f3a]">{s.label}</span>
                <svg viewBox="0 0 20 20" className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${open === s.id ? "rotate-180" : ""}`} fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
              </button>
              {open === s.id && <div className="border-t border-slate-100 px-4 py-4 animate-[bp-fade_0.2s_ease-out]">{sections[s.id]}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Dibujito de cada marco
function FrameIcon({ k }: { k: string }) {
  const q = <rect x="9" y="7" width="14" height="14" rx="1.5" fill="currentColor" opacity=".35" />;
  return (
    <svg viewBox="0 0 32 34" className="h-9 w-9 text-[#0b1f3a]">
      {k === "none" && <rect x="7" y="7" width="18" height="18" rx="2" fill="currentColor" opacity=".35" />}
      {k === "bottom" && <><rect x="5" y="3" width="22" height="28" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />{q}<rect x="5" y="24" width="22" height="7" rx="2" fill="currentColor" /></>}
      {k === "top" && <><rect x="5" y="3" width="22" height="28" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" /><rect x="5" y="3" width="22" height="7" rx="2" fill="currentColor" /><rect x="9" y="13" width="14" height="14" rx="1.5" fill="currentColor" opacity=".35" /></>}
      {k === "outline" && <><rect x="5" y="3" width="22" height="22" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />{q}<rect x="9" y="28" width="14" height="3" rx="1.5" fill="currentColor" /></>}
      {k === "pill" && <>{q}<rect x="7" y="26" width="18" height="6" rx="3" fill="currentColor" /></>}
      {k === "bubble" && <><rect x="5" y="2" width="22" height="7" rx="2.5" fill="currentColor" /><path d="M14 9l2 3 2-3z" fill="currentColor" /><rect x="9" y="14" width="14" height="14" rx="1.5" fill="currentColor" opacity=".35" /></>}
      {k === "ticket" && <><rect x="5" y="3" width="22" height="28" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 2" />{q}<rect x="9" y="26" width="14" height="2.5" rx="1" fill="currentColor" /></>}
      {k === "brackets" && <><path d="M5 9V4h5M22 4h5v5M5 21v5h5M22 26h5v-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />{q}<rect x="9" y="29" width="14" height="2.5" rx="1" fill="currentColor" /></>}
    </svg>
  );
}
