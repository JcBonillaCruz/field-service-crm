"use client";

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

// =====================================================================
// Paso 6.12g · Visor de PDF de BrightPro
//   Computadora: vista previa + Imprimir · Descargar · Abrir en pestaña
//   Celular: Ver PDF · Descargar · Imprimir / Compartir (hoja del sistema → Imprimir)
// =====================================================================
const L = {
  es: { print: "Imprimir", printShare: "Imprimir / Compartir", download: "Descargar PDF", view: "Ver PDF", open: "Abrir en otra pestaña", close: "Cerrar", ready: "Tu PDF está listo", hint: "Ábrelo, descárgalo o mándalo a imprimir desde aquí.", pages: (n: number) => `${n} ${n === 1 ? "página" : "páginas"}` },
  en: { print: "Print", printShare: "Print / Share", download: "Download PDF", view: "View PDF", open: "Open in new tab", close: "Close", ready: "Your PDF is ready", hint: "Open it, download it or send it to print from here.", pages: (n: number) => `${n} ${n === 1 ? "page" : "pages"}` },
};

export function showPdf(bytes: Uint8Array, fileName: string) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const close = () => { root.unmount(); host.remove(); };
  root.render(<PdfViewer bytes={bytes} fileName={fileName.replace(/[\\/:*?"<>|]+/g, "-")} onClose={close} />);
}

function PdfViewer({ bytes, fileName, onClose }: { bytes: Uint8Array; fileName: string; onClose: () => void }) {
  const t = L[(document.documentElement.lang || "en").startsWith("es") ? "es" : "en"];
  const [url, setUrl] = useState("");
  const [mobile, setMobile] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const pages = (new TextDecoder("latin1").decode(bytes).match(/\/Type\s*\/Page[^s]/g) ?? []).length || 1;
  const file = () => new File([bytes as BlobPart], fileName, { type: "application/pdf" });

  useEffect(() => {
    const u = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    setUrl(u);
    setMobile(window.matchMedia("(max-width: 767px), (pointer: coarse)").matches);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = ""; setTimeout(() => URL.revokeObjectURL(u), 1000); };
  }, [bytes, onClose]);

  const download = () => { const a = document.createElement("a"); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); };
  const view = () => { if (!window.open(url, "_blank")) download(); };
  async function print() {
    if (mobile) { // En el celular: hoja de compartir del sistema (iPhone trae "Imprimir"; Android, tus apps de impresión)
      const f = file();
      if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f], title: fileName }); return; } catch (e) { if ((e as Error).name === "AbortError") return; } }
      return view();
    }
    try { frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); } catch { view(); }
  }

  const btn = "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-[14.5px] font-semibold transition-all hover:-translate-y-0.5";
  const Print = () => <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7z" /><circle cx="17.5" cy="12" r=".6" fill="currentColor" /></svg>;
  const Down = () => <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" /></svg>;
  const Eye = () => <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></svg>;
  const X = () => <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-300 group-hover/x:rotate-90" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/55 backdrop-blur-[2px] sm:items-stretch sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {mobile ? (
        <div className="w-full rounded-t-3xl bg-white px-5 pb-7 pt-5 shadow-2xl animate-[bp-pop-in_0.2s_ease-out]">
          <div className="flex items-start gap-3">
            <DocArt />
            <div className="min-w-0 flex-1"><p className="text-[17px] font-semibold text-[#0b1f3a]">{t.ready}</p><p className="truncate text-[13px] text-slate-500">{fileName} · {t.pages(pages)}</p></div>
            <button type="button" onClick={onClose} aria-label={t.close} className="group/x -mr-1 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600"><X /></button>
          </div>
          <p className="mt-2 text-[13px] text-slate-500">{t.hint}</p>
          <div className="mt-4 grid gap-2.5">
            <button type="button" onClick={print} className={`${btn} h-12 bg-[#0f766e] text-white hover:bg-[#0c5f59]`}><Print />{t.printShare}</button>
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={download} className={`${btn} border border-slate-200 bg-white text-slate-700`}><Down />{t.download.split(" ")[0]}</button>
              <button type="button" onClick={view} className={`${btn} border border-slate-200 bg-white text-slate-700`}><Eye />{t.view}</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex w-full max-w-[1100px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-[bp-pop-in_0.2s_ease-out]">
          <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-3">
            <DocArt small />
            <div className="min-w-0 flex-1"><p className="truncate text-[15.5px] font-semibold text-[#0b1f3a]">{fileName}</p><p className="text-[12.5px] text-slate-500">{t.pages(pages)}</p></div>
            <button type="button" onClick={print} className={`${btn} h-10 bg-[#0f766e] text-white hover:bg-[#0c5f59]`}><Print />{t.print}</button>
            <button type="button" onClick={download} className={`${btn} h-10 border border-slate-200 bg-white text-slate-700 hover:border-[#14a39a] hover:text-[#0f766e]`}><Down />{t.download}</button>
            <button type="button" onClick={view} aria-label={t.open} className={`${btn} h-10 w-10 shrink-0 !px-0 border border-slate-200 bg-white text-slate-600 hover:border-[#14a39a] hover:text-[#0f766e]`}>
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
            </button>
            <button type="button" onClick={onClose} aria-label={t.close} className="group/x flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600"><X /></button>
          </div>
          {url && <iframe ref={frame} title={fileName} src={`${url}#view=FitH`} className="min-h-0 w-full flex-1 bg-slate-100" />}
        </div>
      )}
    </div>
  );
}

function DocArt({ small = false }: { small?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={`${small ? "h-10 w-10" : "h-12 w-12"} shrink-0`} aria-hidden="true">
      <defs><linearGradient id="pvA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2bb3a4" /><stop offset="1" stopColor="#0f766e" /></linearGradient></defs>
      <circle cx="24" cy="24" r="22" fill="#e9f7f4" />
      <path d="M14 8h14l8 8v22a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" fill="#fff" stroke="#cbd5e1" />
      <path d="M28 8v6a2 2 0 0 0 2 2h6" fill="#e2e8f0" />
      <rect x="12" y="14" width="18" height="5" rx="1.5" fill="url(#pvA)" />
      <rect x="16" y="23" width="16" height="2" rx="1" fill="#cbd5e1" /><rect x="16" y="27.5" width="16" height="2" rx="1" fill="#cbd5e1" />
      <rect x="16" y="32" width="10" height="2" rx="1" fill="#fecaca" /><circle cx="30" cy="33" r="1.6" fill="#e11d48" />
      <rect x="30" y="30" width="12" height="12" rx="3.5" fill="#e8713a" /><path d="M36 33v5M33.8 36 36 38.2 38.2 36" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
