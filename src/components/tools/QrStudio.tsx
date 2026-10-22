"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { inputClass } from "@/components/customers/ui";

type Kind = "url" | "phone" | "sms" | "whatsapp" | "email" | "review" | "wifi" | "vcard" | "text";
const KINDS: { id: Kind; label: string; icon: string }[] = [
  { id: "url", label: "Website", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" },
  { id: "phone", label: "Call", icon: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" },
  { id: "sms", label: "Text", icon: "M4 5h16v11H9l-5 4z" },
  { id: "whatsapp", label: "WhatsApp", icon: "M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z" },
  { id: "review", label: "Google review", icon: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" },
  { id: "email", label: "Email", icon: "M3 6h18v12H3zM3 7l9 6 9-6" },
  { id: "vcard", label: "Contact card", icon: "M4 5h16v14H4zM9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 16a3 3 0 0 1 6 0M14 9h4M14 13h4" },
  { id: "wifi", label: "Wi‑Fi", icon: "M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01" },
  { id: "text", label: "Text note", icon: "M5 5h14M5 10h14M5 15h9" },
];
type Dots = "square" | "rounded" | "dots" | "classy";
type Eyes = "square" | "rounded" | "circle";

const digits = (s: string) => s.replace(/\D/g, "");
const intl = (s: string) => { const d = digits(s); return d.length === 10 ? `1${d}` : d; };
const esc = (s: string) => s.replace(/[\\;,:"]/g, (m) => `\\${m}`);
const xml = (s: string) => s.replace(/[<>&"]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[m]!));

async function toDataUrl(src: string): Promise<string | null> {
  try { const b = await (await fetch(src)).blob(); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(String(f.result)); f.readAsDataURL(b); }); } catch { return null; }
}

// Arma el SVG del código con figuras, ojos, colores, logo y marco
export function buildSvg(text: string, o: {
  dots: Dots; eyes: Eyes; fg: string; fg2: string; gradient: boolean; eye: string; bg: string; logo: string | null; logoPct: number; frame: boolean; frameText: string; frameColor: string;
}) {
  const qr = QRCode.create(text || " ", { errorCorrectionLevel: o.logo ? "H" : "M" });
  const n = qr.modules.size; const m = 4; // margen en módulos
  const S = n + m * 2; const unit = 10; const W = S * unit;
  const frameH = o.frame ? unit * 7 : 0;
  const isEye = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const logoMods = o.logo ? Math.floor(n * o.logoPct) | 1 : 0;
  const lo = Math.floor((n - logoMods) / 2), hi = lo + logoMods;
  const inLogo = (r: number, c: number) => o.logo && r >= lo - 1 && r <= hi && c >= lo - 1 && c <= hi;
  const fill = o.gradient ? "url(#qrg)" : o.fg;
  let body = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!qr.modules.get(r, c) || isEye(r, c) || inLogo(r, c)) continue;
    const x = (c + m) * unit, y = (r + m) * unit;
    if (o.dots === "dots") body += `<circle cx="${x + unit / 2}" cy="${y + unit / 2}" r="${unit * 0.43}"/>`;
    else if (o.dots === "rounded") body += `<rect x="${x + 0.5}" y="${y + 0.5}" width="${unit - 1}" height="${unit - 1}" rx="${unit * 0.32}"/>`;
    else if (o.dots === "classy") body += `<path d="M${x} ${y + unit}V${y + unit * 0.4}Q${x} ${y} ${x + unit * 0.6} ${y}H${x + unit}V${y + unit * 0.6}Q${x + unit} ${y + unit} ${x + unit * 0.4} ${y + unit}Z"/>`;
    else body += `<rect x="${x}" y="${y}" width="${unit + 0.3}" height="${unit + 0.3}"/>`;
  }
  const eye = (r0: number, c0: number) => {
    const x = (c0 + m) * unit, y = (r0 + m) * unit, s = 7 * unit, t = unit;
    const rr = o.eyes === "circle" ? s / 2 : o.eyes === "rounded" ? unit * 2 : 0;
    const ir = o.eyes === "circle" ? (3 * unit) / 2 : o.eyes === "rounded" ? unit : 0;
    return `<rect x="${x + t / 2}" y="${y + t / 2}" width="${s - t}" height="${s - t}" rx="${Math.max(0, rr - t / 2)}" fill="none" stroke="${o.eye}" stroke-width="${t}"/>`
      + `<rect x="${x + 2 * t}" y="${y + 2 * t}" width="${3 * t}" height="${3 * t}" rx="${ir}" fill="${o.eye}"/>`;
  };
  const eyes = eye(0, 0) + eye(0, n - 7) + eye(n - 7, 0);
  let logo = "";
  if (o.logo) {
    const lx = (lo + m) * unit, ls = logoMods * unit;
    logo = `<rect x="${lx - unit * 0.5}" y="${lx - unit * 0.5}" width="${ls + unit}" height="${ls + unit}" rx="${unit * 1.4}" fill="${o.bg}"/>`
      + `<image href="${o.logo}" x="${lx + unit * 0.3}" y="${lx + unit * 0.3}" width="${ls - unit * 0.6}" height="${ls - unit * 0.6}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  const frame = o.frame ? `<rect x="${unit}" y="${unit}" width="${W - 2 * unit}" height="${W - 2 * unit + frameH}" rx="${unit * 2.5}" fill="none" stroke="${o.frameColor}" stroke-width="${unit * 0.9}"/>`
    + `<rect x="${unit}" y="${W - unit * 0.5}" width="${W - 2 * unit}" height="${frameH}" rx="${unit * 2.5}" fill="${o.frameColor}"/>`
    + `<text x="${W / 2}" y="${W + frameH / 2 + unit * 0.6}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${unit * 2.6}" fill="#ffffff" letter-spacing="${unit * 0.15}">${xml(o.frameText.toUpperCase())}</text>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W + frameH + (o.frame ? unit : 0)}" width="${W}" height="${W + frameH + (o.frame ? unit : 0)}">`
    + `<defs><linearGradient id="qrg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${o.fg}"/><stop offset="1" stop-color="${o.fg2}"/></linearGradient></defs>`
    + `<rect width="100%" height="100%" rx="${o.frame ? unit * 2.5 : 0}" fill="${o.bg}"/>${frame}<g fill="${fill}">${body}</g>${eyes}${logo}</svg>`;
}

export default function QrStudio({ company, logoUrl, phone, website }: { company: string; logoUrl: string | null; phone: string; website: string }) {
  const [kind, setKind] = useState<Kind>("url");
  const [f, setF] = useState<Record<string, string>>({ url: website ? (website.startsWith("http") ? website : `https://${website}`) : "https://", phone, msg: "Hi! I'd like a quote.", email: "", subject: "Service request", name: company, ssid: "", pass: "", review: "", text: "" });
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const [dots, setDots] = useState<Dots>("rounded");
  const [eyes, setEyes] = useState<Eyes>("rounded");
  const [fg, setFg] = useState("#1a2744"); const [fg2, setFg2] = useState("#0f766e"); const [gradient, setGradient] = useState(false);
  const [eye, setEye] = useState("#e8713a"); const [bg, setBg] = useState("#ffffff");
  const [logoMode, setLogoMode] = useState<"company" | "upload" | "none">(logoUrl ? "company" : "none");
  const [logoData, setLogoData] = useState<string | null>(null);
  const [upload, setUpload] = useState<string | null>(null);
  const [logoPct, setLogoPct] = useState(0.22);
  const [frame, setFrame] = useState(true); const [frameText, setFrameText] = useState("Scan me"); const [frameColor, setFrameColor] = useState("#1a2744");
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
      case "vcard": return ["BEGIN:VCARD", "VERSION:3.0", `N:;${f.name}`, `FN:${f.name}`, `ORG:${company}`, f.phone && `TEL;TYPE=WORK,VOICE:+${intl(f.phone)}`, f.email && `EMAIL:${f.email}`, f.url && f.url !== "https://" && `URL:${f.url}`, "END:VCARD"].filter(Boolean).join("\n");
      default: return f.text;
    }
  }, [kind, f, company]);
  const svg = useMemo(() => {
    try { return buildSvg(text, { dots, eyes, fg, fg2, gradient, eye, bg, logo, logoPct, frame, frameText, frameColor }); } catch { return ""; }
  }, [text, dots, eyes, fg, fg2, gradient, eye, bg, logo, logoPct, frame, frameText, frameColor]);

  const slug = (company || "qr").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  function downloadSvg() {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })); a.download = `${slug}-qr.svg`; a.click();
  }
  function downloadPng(px: number) {
    const img = new Image();
    img.onload = () => {
      const ratio = img.height / img.width;
      const c = document.createElement("canvas"); c.width = px; c.height = Math.round(px * ratio);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `${slug}-qr-${px}.png`; a.click(); }, "image/png");
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  const Seg = <T extends string>({ value, opts, on }: { value: T; opts: [T, string][]; on: (v: T) => void }) => (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-0.5 text-sm">
      {opts.map(([v, l]) => <button key={v} type="button" onClick={() => on(v)} className={`rounded-md px-3 py-1.5 transition-all ${value === v ? "bg-white font-semibold text-[#0b1f3a] shadow-sm" : "text-slate-500 hover:text-[#0b1f3a]"}`}>{l}</button>)}
    </div>
  );
  const Color = ({ label, value, on }: { label: string; value: string; on: (v: string) => void }) => (
    <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-600">
      <input type="color" value={value} onChange={(e) => on(e.target.value)} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />{label}
    </label>
  );
  const L = ({ children }: { children: React.ReactNode }) => <span className="mb-1.5 block text-sm font-medium text-slate-700">{children}</span>;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f6f8f9] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-[1150px]">
        <h1 className="text-2xl font-semibold text-[#0b1f3a]">QR Code Studio</h1>
        <p className="text-[15px] text-slate-500">Branded QR codes for vans, yard signs, stickers, flyers and invoices.</p>
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="mb-3 text-[15px] font-semibold text-[#0b1f3a]">1 · What should it open?</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {KINDS.map((k) => (
                  <button key={k.id} type="button" onClick={() => setKind(k.id)}
                    className={`group flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[12px] transition-all active:scale-95 ${kind === k.id ? "border-[#0f766e] bg-[#f3fbf8] font-semibold text-[#0b3f3b]" : "border-slate-200 text-slate-600 hover:border-[#14a39a]"}`}>
                    <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#0f766e] transition-transform group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={k.icon} /></svg>{k.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(kind === "url") && <label className="sm:col-span-2"><L>Website link</L><input value={f.url} onChange={(e) => set("url", e.target.value)} className={inputClass} /></label>}
                {["phone", "sms", "whatsapp", "vcard"].includes(kind) && <label><L>Phone number</L><input type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(214) 555-0123" className={inputClass} /></label>}
                {["sms", "whatsapp"].includes(kind) && <label className="sm:col-span-2"><L>Pre-written message</L><input value={f.msg} onChange={(e) => set("msg", e.target.value)} className={inputClass} /></label>}
                {kind === "review" && <label className="sm:col-span-2"><L>Your Google review link</L><input value={f.review} onChange={(e) => set("review", e.target.value)} placeholder="https://g.page/r/…/review" className={inputClass} />
                  <span className="mt-1 block text-[12px] text-slate-500">Google Business Profile → Ask for reviews → copy the link.</span></label>}
                {["email", "vcard"].includes(kind) && <label><L>Email</L><input value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="office@company.com" className={inputClass} /></label>}
                {kind === "email" && <label><L>Subject</L><input value={f.subject} onChange={(e) => set("subject", e.target.value)} className={inputClass} /></label>}
                {kind === "vcard" && <><label><L>Name on the card</L><input value={f.name} onChange={(e) => set("name", e.target.value)} className={inputClass} /></label>
                  <label><L>Website</L><input value={f.url} onChange={(e) => set("url", e.target.value)} className={inputClass} /></label></>}
                {kind === "wifi" && <><label><L>Network name</L><input value={f.ssid} onChange={(e) => set("ssid", e.target.value)} className={inputClass} /></label>
                  <label><L>Password</L><input value={f.pass} onChange={(e) => set("pass", e.target.value)} className={inputClass} /></label></>}
                {kind === "text" && <label className="sm:col-span-2"><L>Text</L><textarea rows={3} value={f.text} onChange={(e) => set("text", e.target.value)} className={inputClass} /></label>}
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-[15px] font-semibold text-[#0b1f3a]">2 · Design</p>
              <div><L>Dots</L><Seg value={dots} on={setDots} opts={[["square", "Square"], ["rounded", "Rounded"], ["dots", "Dots"], ["classy", "Classy"]]} /></div>
              <div><L>Corners</L><Seg value={eyes} on={setEyes} opts={[["square", "Square"], ["rounded", "Rounded"], ["circle", "Circle"]]} /></div>
              <div>
                <L>Colors</L>
                <div className="flex flex-wrap gap-2">
                  <Color label="Dots" value={fg} on={setFg} />
                  {gradient && <Color label="Gradient to" value={fg2} on={setFg2} />}
                  <Color label="Corners" value={eye} on={setEye} />
                  <Color label="Background" value={bg} on={setBg} />
                  <label className="flex items-center gap-2 px-1 text-[13px] text-slate-600"><input type="checkbox" checked={gradient} onChange={(e) => setGradient(e.target.checked)} className="h-4 w-4 accent-[#0f766e]" />Gradient</label>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[["Brilla", "#1a2744", "#e8713a"], ["BrightPro", "#0f766e", "#0b1f3a"], ["Classic", "#111827", "#111827"], ["Ocean", "#0369a1", "#0ea5e9"], ["Sunset", "#be123c", "#f59e0b"]].map(([n, a, b]) => (
                    <button key={n} type="button" onClick={() => { setFg(a); setEye(b); setFrameColor(a); }} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-[12px] text-slate-600 hover:border-[#14a39a]">
                      <span className="h-3 w-3 rounded-full" style={{ background: a }} /><span className="h-3 w-3 rounded-full" style={{ background: b }} />{n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <L>Logo in the middle</L>
                <Seg value={logoMode} on={(v) => { setLogoMode(v); if (v === "upload" && !upload) file.current?.click(); }} opts={[...(logoUrl ? [["company", "Company logo"] as ["company", string]] : []), ["upload", "Upload"], ["none", "No logo"]]} />
                <input ref={file} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={(e) => {
                  const x = e.target.files?.[0]; e.target.value = ""; if (!x) return;
                  const r = new FileReader(); r.onload = () => { setUpload(String(r.result)); setLogoMode("upload"); }; r.readAsDataURL(x);
                }} />
                {logo && <div className="mt-3"><div className="mb-1 flex justify-between text-[13px] text-slate-600"><span>Logo size</span><span className="font-semibold text-[#0f766e]">{Math.round(logoPct * 100)}%</span></div>
                  <input type="range" min={0.12} max={0.3} step={0.01} value={logoPct} onChange={(e) => setLogoPct(Number(e.target.value))} className="w-full accent-[#0f766e]" /></div>}
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={frame} onChange={(e) => setFrame(e.target.checked)} className="h-4 w-4 accent-[#0f766e]" />Frame with text (great for stickers)</label>
                {frame && <div className="mt-2 flex flex-wrap gap-2"><input value={frameText} onChange={(e) => setFrameText(e.target.value.slice(0, 22))} placeholder="Scan me" className={`${inputClass} !w-auto flex-1`} /><Color label="Frame" value={frameColor} on={setFrameColor} /></div>}
                {frame && <div className="mt-2 flex flex-wrap gap-1.5">{["Scan me", "Call us", "Get a quote", "Leave a review", "Pay here", "Book service"].map((t) => <button key={t} type="button" onClick={() => setFrameText(t)} className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] text-slate-600 hover:bg-[#e9f7f4]">{t}</button>)}</div>}
              </div>
            </div>
          </div>

          <div className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="mb-3 text-[15px] font-semibold text-[#0b1f3a]">3 · Preview & download</p>
              <div className="mx-auto max-w-[320px] rounded-2xl bg-[repeating-conic-gradient(#f1f5f9_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {svg && <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt="QR code preview" className="w-full drop-shadow-sm" />}
              </div>
              <p className="mt-3 break-all rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-500">{text.length > 140 ? text.slice(0, 140) + "…" : text}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => downloadPng(1024)} className="rounded-lg bg-[#0f766e] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#0c5f59] active:scale-95">PNG (web)</button>
                <button type="button" onClick={() => downloadPng(3000)} className="rounded-lg bg-[#0b1f3a] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#13294b] active:scale-95">PNG (print)</button>
                <button type="button" onClick={downloadSvg} className="col-span-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-95">SVG (vector, for vans & large signs)</button>
              </div>
              <p className="mt-3 text-[12px] text-slate-500">Tip: test the code with your phone camera before printing. Keep strong contrast between dots and background.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
