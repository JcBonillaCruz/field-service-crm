"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, btnGhost, btnPrimary } from "@/components/sales/SalesBits";

// Panel para firmar con el dedo o el mouse
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    c.width = r.width * dpr; c.height = r.height * dpr;
    const ctx = c.getContext("2d")!; ctx.scale(dpr, dpr); ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#0b1f3a";
  }, []);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  return (
    <div>
      <canvas ref={ref} className="h-40 w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-white"
        onPointerDown={(e) => { drawing.current = true; ref.current!.setPointerCapture(e.pointerId); const [x, y] = pos(e); const ctx = ref.current!.getContext("2d")!; ctx.beginPath(); ctx.moveTo(x, y); }}
        onPointerMove={(e) => { if (!drawing.current) return; const [x, y] = pos(e); const ctx = ref.current!.getContext("2d")!; ctx.lineTo(x, y); ctx.stroke(); dirty.current = true; }}
        onPointerUp={() => { drawing.current = false; if (dirty.current) onChange(ref.current!.toDataURL("image/png")); }} />
      <div className="mt-1 flex items-center justify-between text-[12px] text-slate-400">
        <span>Sign above with your finger or mouse</span>
        <button type="button" className="font-medium text-[#2563eb]" onClick={() => { const c = ref.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); dirty.current = false; onChange(null); }}>Clear</button>
      </div>
    </div>
  );
}

// Botones del enlace público: PDF, imprimir y aceptar con firma o rechazar
export default function ShareActions({ token, canRespond, defaultName }: { token: string; canRespond: boolean; defaultName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [sign, setSign] = useState(false);
  const [name, setName] = useState(defaultName);
  const [sig, setSig] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  async function respond(accept: boolean) {
    if (!accept && !window.confirm("Decline this quote?")) return;
    if (accept) {
      if (name.trim().length < 2) return setError("Type your full name.");
      if (!sig) return setError("Please sign in the box.");
      if (!agree) return setError("Please confirm you accept the quote.");
    }
    setBusy(true); setError("");
    const res = await fetch("/api/share/respond", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, accept, sig: accept ? sig : null, signer: accept ? name.trim() : null }) });
    const data = (await res.json().catch(() => ({}))).result;
    setBusy(false);
    if (data === "signature_required") return setError("Please sign and type your name.");
    setSign(false);
    setMsg(data === "accepted" ? "Thank you! The quote was accepted and signed." : data === "declined" ? "The quote was declined." : "This quote can't be changed anymore.");
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {canRespond && !msg && (
        <>
          <button type="button" disabled={busy} onClick={() => setSign(true)} className="rounded-lg bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-60">Accept & Sign</button>
          <button type="button" disabled={busy} onClick={() => respond(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">Decline</button>
        </>
      )}
      {msg && <span className="text-sm font-medium text-[#0f766e]">{msg}</span>}
      <a href={`/share/${token}/pdf`} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Download PDF</a>
      <button type="button" onClick={() => window.print()} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Print</button>
      <Modal open={sign} onClose={() => setSign(false)} title="Accept & Sign"
        footer={<><button type="button" onClick={() => respond(true)} disabled={busy} className={btnPrimary}>{busy ? "Saving..." : "Accept & Sign"}</button><button type="button" onClick={() => setSign(false)} className={btnGhost}>Cancel</button></>}>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-[15px] focus:border-[#0f766e] focus:bg-white focus:outline-none" />
          </div>
          <SignaturePad onChange={setSig} />
          <label className="flex cursor-pointer items-start gap-2.5 text-[14px] text-slate-600">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-4 w-4 accent-[#16a34a]" />
            I accept this quote and agree that this electronic signature is as valid as my handwritten signature.
          </label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
