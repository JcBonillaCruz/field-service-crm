"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Botones del enlace público: imprimir y (si lo permites) aceptar o rechazar la cotización
export default function ShareActions({ token, canRespond }: { token: string; canRespond: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function respond(accept: boolean) {
    if (!accept && !window.confirm("Decline this quote?")) return;
    setBusy(true);
    const { data } = await createClient().rpc("public_quote_respond", { tok: token, accept });
    setBusy(false);
    setMsg(data === "accepted" ? "Thank you! The quote was accepted." : data === "declined" ? "The quote was declined." : "This quote can't be changed anymore.");
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {canRespond && !msg && (
        <>
          <button type="button" disabled={busy} onClick={() => respond(true)} className="rounded-lg bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-60">Accept</button>
          <button type="button" disabled={busy} onClick={() => respond(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">Decline</button>
        </>
      )}
      {msg && <span className="text-sm font-medium text-[#0f766e]">{msg}</span>}
      <button type="button" onClick={() => window.print()} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Print / Download PDF</button>
    </div>
  );
}
