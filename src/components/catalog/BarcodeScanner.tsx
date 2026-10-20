"use client";

import { useEffect, useRef, useState } from "react";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

// Escáner de código de barras con la cámara del celular.
// Si el navegador puede leer códigos (Android/Chrome), busca el item por SKU al detectarlo.
export default function BarcodeScanner({ open, onClose, onCode }: { open: boolean; onClose: () => void; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [canRead, setCanRead] = useState(true);
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    setError(""); setManual("");
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        if (video.current) { video.current.srcObject = stream; await video.current.play().catch(() => {}); }
        const BD = (window as unknown as { BarcodeDetector?: new (o?: object) => Detector }).BarcodeDetector;
        if (!BD) { setCanRead(false); return; }
        const detector = new BD({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] });
        timer = setInterval(async () => {
          if (!video.current || video.current.readyState < 2) return;
          try {
            const found = await detector.detect(video.current);
            if (found[0]?.rawValue) { if (navigator.vibrate) navigator.vibrate(80); onCode(found[0].rawValue); }
          } catch { /* sigue intentando */ }
        }, 350);
      } catch {
        setError("We couldn't open the camera. Allow camera access for this site in your browser settings.");
      }
    })();
    return () => { stopped = true; clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [open, onCode]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-black lg:hidden">
      <div className="flex items-center justify-between px-4 py-4 text-white">
        <p className="text-lg font-semibold">Scan barcode</p>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 active:bg-white/25">
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted className="h-full w-full object-cover" />
        {/* marco de escaneo */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-44 w-72 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
            {["left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl"].map((c) => (
              <span key={c} className={`absolute h-8 w-8 border-[#2dd4bf] ${c}`} />
            ))}
            <span className="absolute inset-x-4 top-1/2 h-0.5 bg-[#2dd4bf] shadow-[0_0_12px_#2dd4bf] animate-pulse" />
          </div>
        </div>
      </div>
      <div className="space-y-3 bg-black px-4 pb-8 pt-4 text-center text-sm text-white/80">
        {error ? <p className="text-red-300">{error}</p>
          : canRead ? <p>Point the camera at the barcode. The item is found by its SKU.</p>
            : <p>Automatic reading isn&apos;t available on this browser yet. Type the code below.</p>}
        <div className="flex gap-2">
          <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Or type the SKU / code" inputMode="text"
            className="min-w-0 flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-[15px] text-white placeholder:text-white/50 focus:border-[#2dd4bf] focus:outline-none" />
          <button type="button" disabled={!manual.trim()} onClick={() => onCode(manual.trim())} className="rounded-lg bg-[#0f9f6e] px-4 font-semibold text-white disabled:opacity-50">Search</button>
        </div>
      </div>
    </div>
  );
}
