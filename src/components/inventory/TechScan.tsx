"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BarcodeScanner from "@/components/catalog/BarcodeScanner";
import TechUse from "@/components/inventory/TechUse";
import { invError, qtyFmt } from "@/lib/inventory";

type Found = { found: true; item: { id: string; name: string; sku: string; unit: string | null; image_url: string | null }; stock: { location_id: string; name: string; kind: string; qty: number }[] };
type Missing = { found: false };

// Técnico: escanea la pieza que va a usar → se descuenta de SU van (y del total). Si no la trae, se lo dice.
export default function TechScan({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [res, setRes] = useState<Found | Missing | null>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");

  async function lookup(c: string) {
    setOpen(false); setBusy(true); setErr(""); setDone(""); setCode(c);
    const { data, error } = await createClient().rpc("inv_lookup", { p_company: companyId, p_code: c });
    setBusy(false);
    if (error) return setErr(invError(error));
    setRes(data as Found | Missing);
  }
  const van = res && res.found ? res.stock.find((s) => s.kind === "van") ?? null : null;

  return (
    <div className="mx-auto max-w-xl px-4 pb-24 pt-5 lg:pt-8">
      <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a]">Scan</h1>
      <p className="text-[13.5px] text-slate-500">Scan the part you&apos;re about to use. It comes out of your van.</p>
      <button type="button" onClick={() => setOpen(true)} disabled={busy}
        className="relative mt-6 flex w-full flex-col items-center overflow-hidden rounded-3xl bg-[radial-gradient(120%_140%_at_50%_120%,#2bb3a4_0%,#1a8f84_45%,#0f766e_100%)] px-6 py-10 text-white shadow-[0_18px_40px_rgba(15,118,110,0.28)] active:scale-[0.99] disabled:opacity-70">
        <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30">
          <svg viewBox="0 0 24 24" className="h-11 w-11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 8v8M10 8v8M13 8v8M16.5 8v8" /></svg>
        </span>
        <span className="mt-4 text-lg font-semibold">{busy ? "Looking up..." : res ? "Scan another part" : "Scan a part"}</span>
      </button>
      {err && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
      {done && <p role="status" className="mt-4 rounded-xl bg-[#e7f6f1] px-4 py-3 text-[15px] font-medium text-[#0f766e]">✓ {done}</p>}

      {res && !done && (res.found ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center gap-4 p-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-[#f4f7fa]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {res.item.image_url ? <img src={res.item.image_url} alt="" className="h-full w-full object-cover" /> : <span className="text-slate-300">—</span>}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[17px] font-semibold text-[#0b1f3a]">{res.item.name}</p>
              <p className="truncate font-mono text-[12.5px] text-slate-400">{res.item.sku}</p>
              <p className="mt-0.5 text-[14px] text-slate-600">{van ? <>In your van: <b className="tabular-nums">{qtyFmt(Number(van.qty))}</b> {res.item.unit ?? ""}</> : "You don't have a van assigned."}</p>
            </div>
          </div>
          <div className="border-t border-slate-100 p-4">
            {van && Number(van.qty) > 0 ? (
              <TechUse companyId={companyId} itemId={res.item.id} itemName={res.item.name} unit={res.item.unit} vanId={van.location_id} available={Number(van.qty)} onDone={setDone} />
            ) : (
              <p className="rounded-xl bg-[#fff7e6] px-4 py-3 text-[14.5px] text-[#7a3d06]">{van ? "You have 0 of this part in your van. Ask the office to restock it before using one." : "Ask the office to assign you a van."}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <p className="text-[13px] font-medium uppercase tracking-wide text-slate-400">Not in inventory</p>
          <p className="mt-0.5 break-all font-mono text-[17px] font-semibold text-[#0b1f3a]">{code}</p>
          <p className="mt-2 text-[14.5px] text-slate-500">This code isn&apos;t registered yet. Ask the office to add the product.</p>
        </div>
      ))}
      <Link prefetch={false} href="/dashboard/inventory/van" className="mt-6 block text-center text-[14.5px] font-medium text-[#0f766e] hover:underline">See everything in my van</Link>
      <BarcodeScanner open={open} everywhere onClose={() => setOpen(false)} onCode={lookup} />
    </div>
  );
}
