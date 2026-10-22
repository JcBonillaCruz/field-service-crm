"use client";

import { useRef } from "react";

// Tres botones grandes: cámara (toma la foto ahí mismo), galería de fotos y documentos (PDF, etc.)
export default function UploadChoices({ onFiles, disabled, compact = false }: { onFiles: (files: FileList | null) => void; disabled?: boolean; compact?: boolean }) {
  const cam = useRef<HTMLInputElement>(null), pics = useRef<HTMLInputElement>(null), docs = useRef<HTMLInputElement>(null);
  const pick = (r: React.RefObject<HTMLInputElement>) => r.current?.click();
  const tiles: [string, string, string, React.RefObject<HTMLInputElement>, string][] = [
    ["Take photo", "Opens the camera", "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", cam, "bg-[#eef8f5] text-[#0f766e]"],
    ["Photos", "From your gallery", "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01", pics, "bg-[#eef6ff] text-[#2563eb]"],
    ["Document", "PDF or other file", "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4", docs, "bg-[#fff4ec] text-[#ea580c]"],
  ];
  const change = (e: React.ChangeEvent<HTMLInputElement>) => { onFiles(e.target.files); e.target.value = ""; };
  return (
    <div className={`grid grid-cols-3 ${compact ? "gap-2" : "gap-3"}`}>
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={change} />
      <input ref={pics} type="file" accept="image/*" multiple className="hidden" onChange={change} />
      <input ref={docs} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*" multiple className="hidden" onChange={change} />
      {tiles.map(([label, sub, d, ref, tone]) => (
        <button key={label} type="button" disabled={disabled} onClick={() => pick(ref)}
          className={`group flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 bg-white text-center transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:shadow-md active:scale-95 disabled:opacity-50 ${compact ? "px-1 py-2.5" : "px-2 py-4"}`}>
          <span className={`flex items-center justify-center rounded-2xl transition-transform group-hover:scale-110 ${tone} ${compact ? "h-10 w-10" : "h-12 w-12"}`}>
            <svg viewBox="0 0 24 24" className={compact ? "h-5 w-5" : "h-6 w-6"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
          </span>
          <span className="text-[13px] font-semibold text-[#0b1f3a]">{label}</span>
          {!compact && <span className="text-[11px] text-slate-500">{sub}</span>}
        </button>
      ))}
    </div>
  );
}
