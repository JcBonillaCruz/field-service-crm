"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DeleteAsk, downloadJson, onDeleteAsk } from "@/lib/confirm";

type Pending = DeleteAsk & { resolve: (ok: boolean) => void };

// Ventana de advertencia para borrar (una sola para toda la app, siempre por encima de todo)
export default function ConfirmHost() {
  const [ask, setAsk] = useState<Pending | null>(null);
  const [agree, setAgree] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    onDeleteAsk((p) => { setAsk(p); setAgree(false); setSaved(false); });
    return () => onDeleteAsk(null);
  }, []);
  useEffect(() => {
    if (!ask) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") done(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask]);

  function done(ok: boolean) { ask?.resolve(ok); setAsk(null); }
  async function backup() {
    if (!ask?.download) return;
    setDownloading(true);
    try {
      const d = ask.download.data;
      const data = typeof d === "function" ? await (d as () => Promise<unknown>)() : d;
      downloadJson(ask.download.filename, data); setSaved(true);
    } catch { /* sin conexión */ } finally { setDownloading(false); }
  }

  if (!ask || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Cancel" onClick={() => done(false)} className="absolute inset-0 bg-slate-900/45 animate-[bp-fade_0.2s_ease-out]" />
      <div role="alertdialog" aria-modal="true" className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl animate-[bp-sheet-up_0.25s_ease-out] sm:rounded-3xl">
        <div className="flex items-start gap-4">
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff1f2] text-[#e11d48]">
            <span className="absolute inset-0 rounded-2xl ring-2 ring-[#fda4af] animate-[bp-share-ring_1.6s_ease-out_infinite]" />
            <svg viewBox="0 0 24 24" className="relative h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path className="origin-[12px_6px] animate-[bp-lid_1.6s_ease-in-out_infinite]" d="M4 6.5h16M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7" />
              <path d="M6 6.5l.9 12.4c.1 1 .9 1.6 1.8 1.6h6.6c.9 0 1.7-.7 1.8-1.6L18 6.5M10 10.5v6M14 10.5v6" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#0b1f3a]">{ask.title}</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-slate-600">{ask.message ?? "Once it's deleted, this information can't be recovered."}</p>
          </div>
        </div>

        {ask.download && (
          <button type="button" onClick={backup} disabled={downloading}
            className="mt-5 flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-[#14a39a] hover:bg-[#f3fbf8] disabled:opacity-60">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e9f7f4] text-[#0f766e]">
              {saved
                ? <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>
                : <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3v10m0 0-3.5-3.5M10 13l3.5-3.5M4 16h12" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </span>
            <span><span className="block text-[14px] font-semibold text-[#0b1f3a]">{saved ? "Copy downloaded" : downloading ? "Preparing copy…" : "Download a copy first"}</span>
              <span className="block text-[12px] text-slate-500">Keep a backup file before deleting (optional)</span></span>
          </button>
        )}

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-[#fff7f7] px-4 py-3">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#e11d48]" />
          <span className="text-[13px] text-slate-700">I understand this is permanent and I&apos;m deleting it under my own responsibility.</span>
        </label>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => done(false)} className="rounded-xl border border-slate-200 py-3 text-[15px] font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" disabled={!agree} onClick={() => done(true)}
            className="rounded-xl bg-[#e11d48] py-3 text-[15px] font-semibold text-white shadow-[0_6px_16px_rgba(225,29,72,0.3)] transition-all hover:bg-[#be123c] active:scale-95 disabled:opacity-40 disabled:shadow-none">
            {ask.confirmLabel ?? "Delete"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
