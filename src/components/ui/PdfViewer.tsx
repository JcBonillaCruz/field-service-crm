"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PdfDoc, buildReportPdf } from "@/lib/report-pdf";

// Visor de PDF real (Paso 5.10d): el reporte se arma como PDF y se ve aquí mismo, con Print y Download.
// Computadora: el PDF dentro de la ventana. Celular: el navegador no muestra PDFs incrustados, así que se abre,
// se comparte o se descarga con un toque.
export default function PdfViewer({ doc, onClose }: { doc: PdfDoc; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);
  const embedded = useMemo(() => {
    if (typeof window === "undefined") return true;
    const nav = navigator as Navigator & { pdfViewerEnabled?: boolean };
    return nav.pdfViewerEnabled !== false && !window.matchMedia("(pointer: coarse) and (max-width: 1023px)").matches;
  }, []);

  useEffect(() => {
    let alive = true, made: string | null = null;
    buildReportPdf(doc).then((bytes) => {
      if (!alive) return;
      const f = new File([bytes as BlobPart], doc.fileName, { type: "application/pdf" });
      made = URL.createObjectURL(f);
      setFile(f); setUrl(made);
    }).catch(() => { if (alive) setError("The PDF couldn't be created. Try again."); });
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [doc]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  const download = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url; a.download = doc.fileName; document.body.appendChild(a); a.click(); a.remove();
  };
  const open = () => { if (url && !window.open(url, "_blank")) download(); };
  const print = () => {
    try { const w = frame.current?.contentWindow; if (!w) throw new Error("no frame"); w.focus(); w.print(); }
    catch { open(); } // si el navegador no deja imprimir desde aquí, se abre el PDF y se imprime desde ahí
  };
  const canShare = Boolean(file && typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] }));
  const share = async () => { try { if (file) await navigator.share({ files: [file], title: doc.title }); } catch { /* cerró el menú de compartir */ } };

  const btn = "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-semibold transition-colors disabled:opacity-50";
  const icon = (d: string) => <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
  const I = {
    print: "M6 7V3h8v4M6 14H4.5A1.5 1.5 0 0 1 3 12.5v-4A1.5 1.5 0 0 1 4.5 7h11A1.5 1.5 0 0 1 17 8.5v4a1.5 1.5 0 0 1-1.5 1.5H14M6 11.5h8V17H6z",
    down: "M10 3v9M6.5 8.5 10 12l3.5-3.5M4 15.5h12", open: "M11 4h5v5M16 4l-7 7M14 11.5V15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3.5",
    share: "M7.5 10.8 12.5 13.7M12.5 6.3 7.5 9.2M15 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM9 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM15 15a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
  };

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-[#0b1f3a]/60 animate-[bp-fade_0.18s_ease-out] lg:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={doc.title} className="mx-auto flex min-h-0 w-full max-w-[1000px] flex-1 flex-col overflow-hidden bg-white shadow-2xl lg:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5 lg:px-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ffe8ea] text-[10px] font-bold tracking-wide text-[#be123c]">PDF</span>
          <div className="mr-auto min-w-0">
            <p className="truncate text-[14.5px] font-semibold text-[#0b1f3a]">{doc.title}</p>
            <p className="truncate text-[12px] text-slate-500">{doc.fileName}</p>
          </div>
          {embedded && <>
            <button type="button" onClick={download} disabled={!url} className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`}>{icon(I.down)}<span className="hidden sm:inline">Download</span></button>
            <button type="button" onClick={print} disabled={!url} className={`${btn} bg-[#0f766e] text-white hover:bg-[#0b5f59]`}>{icon(I.print)}Print</button>
          </>}
          <button type="button" onClick={onClose} aria-label="Close" className="group flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-[#fff1f2] hover:text-[#e11d48]">
            <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg>
          </button>
        </div>

        <div className="relative min-h-0 flex-1 bg-[#eef1f4]">
          {error ? <p role="alert" className="px-5 py-16 text-center text-[14px] text-[#be123c]">{error}</p>
            : !url ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-16">
                <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#d7f1eb] border-t-[#0f766e]" />
                <p className="text-[13.5px] text-slate-500">Creating the PDF…</p>
              </div>
            ) : embedded ? (
              <iframe ref={frame} src={`${url}#toolbar=0&navpanes=0&view=FitH`} title={doc.title} className="h-full w-full border-0" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
                <span className="flex h-20 w-16 items-end justify-center rounded-lg border border-slate-200 bg-white pb-2 text-[12px] font-bold tracking-wide text-[#be123c] shadow-sm">PDF</span>
                <p className="mt-4 text-[16px] font-semibold text-[#0b1f3a]">Your PDF is ready</p>
                <p className="mt-1 max-w-xs text-[13.5px] text-slate-500">Open it to see it and print it from your phone, or share it by text, WhatsApp or email.</p>
                <div className="mt-5 flex w-full max-w-xs flex-col gap-2">
                  <button type="button" onClick={open} className={`${btn} h-11 justify-center bg-[#0f766e] text-[14px] text-white`}>{icon(I.open)}Open PDF</button>
                  {canShare && <button type="button" onClick={share} className={`${btn} h-11 justify-center border border-slate-200 bg-white text-[14px] text-slate-700`}>{icon(I.share)}Share</button>}
                  <button type="button" onClick={download} className={`${btn} h-11 justify-center border border-slate-200 bg-white text-[14px] text-slate-700`}>{icon(I.down)}Download</button>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
