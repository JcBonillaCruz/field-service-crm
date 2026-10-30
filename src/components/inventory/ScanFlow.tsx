"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { bustCache } from "@/lib/cache-client";
import BarcodeScanner from "@/components/catalog/BarcodeScanner";
import SelectMenu from "@/components/ui/SelectMenu";
import { InvLocation, invError, qtyFmt, usd } from "@/lib/inventory";

type Found = {
  found: true;
  item: { id: string; name: string; sku: string; unit: string | null; image_url: string | null; selling_price: number; cost_price: number | null };
  stock: { location_id: string; name: string; kind: string; qty: number; min_qty: number }[];
};
type Missing = { found: false; catalog_item: { id: string; name: string; item_type: string } | null };
type Result = { code: string; data: Found | Missing };

// Escanear: código nuevo → crear producto (ese código es su SKU) · código conocido → sumar o descontar al momento
export default function ScanFlow({ companyId, locations, needsSql }: { companyId: string; locations: InvLocation[]; needsSql: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<{ code: string; name: string | null }[]>([]);

  async function lookup(code: string) {
    setOpen(false); setBusy(true); setError("");
    const { data, error: rpcErr } = await createClient().rpc("inv_lookup", { p_company: companyId, p_code: code });
    setBusy(false);
    if (rpcErr) return setError(invError(rpcErr));
    const r = { code, data: data as Found | Missing };
    setResult(r);
    setHistory((h) => [{ code, name: r.data.found ? r.data.item.name : null }, ...h.filter((x) => x.code !== code)].slice(0, 6));
  }

  async function trackExisting(id: string) {
    setBusy(true);
    const { error: upErr } = await createClient().from("items").update({ track_inventory: true, item_type: "goods", sku: result?.code, updated_at: new Date().toISOString() }).eq("id", id);
    setBusy(false);
    if (upErr) return setError(invError(upErr));
    await bustCache("catalog");
    router.push(`/dashboard/inventory?item=${id}&edit=1`);
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-24 pt-5 lg:pt-8">
      <div className="flex items-center gap-3">
        <Link prefetch={false} href="/dashboard/inventory" aria-label="Back to inventory"
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800">
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><path d="M12.7 4.3a1 1 0 0 1 0 1.4L8.4 10l4.3 4.3a1 1 0 1 1-1.4 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0z" /></svg>
        </Link>
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a]">Scan</h1>
          <p className="text-[13.5px] text-slate-500">Point the camera at the barcode on the box.</p>
        </div>
      </div>

      {needsSql && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Run <b>paso-4.1-inventory.sql</b> in Supabase first.</p>}

      {/* Botón grande para escanear */}
      <button type="button" onClick={() => { setError(""); setOpen(true); }} disabled={busy}
        className="group relative mt-6 flex w-full flex-col items-center overflow-hidden rounded-3xl bg-[radial-gradient(120%_140%_at_50%_120%,#2bb3a4_0%,#1a8f84_45%,#0f766e_100%)] px-6 py-10 text-white shadow-[0_18px_40px_rgba(15,118,110,0.28)] transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_48px_rgba(15,118,110,0.34)] active:scale-[0.99] disabled:opacity-70">
        <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 animate-[bp-float_7s_ease-in-out_infinite]" />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30 transition-transform duration-300 group-hover:scale-105">
          <svg viewBox="0 0 24 24" className="h-11 w-11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 8v8M10 8v8M13 8v8M16.5 8v8" /></svg>
          <span className="absolute inset-x-2 top-1/2 h-0.5 bg-[#ffd8c2] shadow-[0_0_10px_#ffd8c2] animate-pulse" />
        </span>
        <span className="relative mt-4 text-lg font-semibold">{busy ? "Looking up..." : result ? "Scan another" : "Scan a barcode"}</span>
        <span className="relative mt-1 text-[13.5px] text-white/80">Works on iPhone and Android</span>
      </button>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {result && (result.data.found
        ? <FoundCard key={result.code} companyId={companyId} data={result.data} locations={locations} onChanged={() => lookup(result.code)} />
        : (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 text-center animate-[bp-pop-in_0.3s_ease-out]">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff4ec] text-[#e8713a]">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9zM12 8v5M12 16h.01" /></svg>
            </span>
            <p className="mt-3 text-[13px] font-medium uppercase tracking-wide text-slate-400">New barcode</p>
            <p className="mt-0.5 break-all font-mono text-[17px] font-semibold text-[#0b1f3a]">{result.code}</p>
            {result.data.catalog_item ? (
              <>
                <p className="mt-2 text-[14.5px] text-slate-500">&ldquo;{result.data.catalog_item.name}&rdquo; already uses this code in Finances, but it doesn&apos;t track inventory yet.</p>
                <button type="button" disabled={busy} onClick={() => trackExisting((result.data as Missing).catalog_item!.id)}
                  className="mt-4 w-full rounded-xl bg-[#0f766e] py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-60">Track inventory for this item</button>
              </>
            ) : (
              <>
                <p className="mt-2 text-[14.5px] text-slate-500">This code isn&apos;t in your inventory yet. Create the product and this code becomes its SKU.</p>
                <Link prefetch={false} href={`/dashboard/inventory?new=1&sku=${encodeURIComponent(result.code)}`}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f766e] py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#0c5f59]">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>
                  Create product
                </Link>
              </>
            )}
          </div>
        ))}

      {history.length > 1 && (
        <div className="mt-6">
          <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Recent scans</p>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {history.slice(1).map((h) => (
              <li key={h.code}>
                <button type="button" onClick={() => lookup(h.code)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f6fbfa]">
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-medium text-slate-800">{h.name ?? "Not in inventory"}</span>
                    <span className="block truncate font-mono text-[12px] text-slate-400">{h.code}</span>
                  </span>
                  <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-300" fill="currentColor"><path d="M7.3 4.3a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4-1.4L11.6 10 7.3 5.7a1 1 0 0 1 0-1.4z" /></svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <BarcodeScanner open={open} everywhere onClose={() => setOpen(false)} onCode={lookup} />
    </div>
  );
}

function FoundCard({ companyId, data, locations, onChanged }: { companyId: string; data: Found; locations: InvLocation[]; onChanged: () => void }) {
  const def = locations.find((l) => l.is_default) ?? locations[0];
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [qty, setQty] = useState("1");
  const [loc, setLoc] = useState(def?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const it = data.item;
  const total = data.stock.reduce((s, r) => s + Number(r.qty), 0);
  const at = (id: string) => Number(data.stock.find((s) => s.location_id === id)?.qty ?? 0);
  const n = Number(qty);

  async function apply() {
    if (!n || n <= 0) return setMsg({ ok: false, text: "Enter a quantity." });
    if (mode === "remove" && n > at(loc)) return setMsg({ ok: false, text: `Only ${qtyFmt(at(loc))} in this location.` });
    setBusy(true);
    const { error } = await createClient().rpc("inv_move", mode === "add"
      ? { p_company: companyId, p_item: it.id, p_kind: "receive", p_qty: n, p_from: null, p_to: loc, p_reason: "Received (scan)" }
      : { p_company: companyId, p_item: it.id, p_kind: "adjust", p_qty: n, p_from: loc, p_to: null, p_reason: "Removed (scan)" });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: invError(error) });
    if (navigator.vibrate) navigator.vibrate(40);
    setMsg({ ok: true, text: `${mode === "add" ? "Added" : "Removed"} ${qtyFmt(n)} ${it.unit ?? ""}` });
    setQty("1");
    onChanged();
  }

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white animate-[bp-pop-in_0.3s_ease-out]">
      <div className="flex items-center gap-4 p-4">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-[#f4f7fa] to-[#e9f7f4]">
          {it.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.image_url} alt="" className="h-full w-full object-cover" />
          ) : <svg viewBox="0 0 24 24" className="h-8 w-8 text-[#9fc9c0]" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9" /></svg>}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#0f766e]">In your inventory</p>
          <p className="truncate text-[17px] font-semibold text-[#0b1f3a]">{it.name}</p>
          <p className="truncate font-mono text-[12.5px] text-slate-400">{it.sku}</p>
          <p className="mt-0.5 text-[13px] text-slate-500">{usd(it.selling_price)} · <b className="tabular-nums text-[#0b1f3a]">{qtyFmt(total)}</b> {it.unit ?? ""} on hand</p>
        </div>
      </div>
      <ul className="border-y border-slate-100 bg-[#fafbfc] px-4 py-2">
        {data.stock.map((s) => (
          <li key={s.location_id} className="flex items-center justify-between py-1.5 text-[14px]">
            <span className="text-slate-600">{s.name}</span>
            <span className={`font-semibold tabular-nums ${Number(s.qty) <= 0 ? "text-[#be123c]" : Number(s.min_qty) > 0 && Number(s.qty) <= Number(s.min_qty) ? "text-[#b45309]" : "text-[#0b1f3a]"}`}>{qtyFmt(Number(s.qty))}</span>
          </li>
        ))}
      </ul>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {(["add", "remove"] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); setMsg(null); }}
              className={`rounded-lg py-2 text-[14.5px] font-medium transition-all ${mode === m ? `bg-white shadow-sm ${m === "add" ? "text-[#0f766e]" : "text-[#be123c]"}` : "text-slate-500"}`}>
              {m === "add" ? "Add stock" : "Remove stock"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setQty(String(Math.max(1, (n || 1) - 1)))} className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 text-xl text-slate-600 active:scale-95">−</button>
          <input value={qty} inputMode="decimal" aria-label="Quantity" onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ""))}
            className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 text-center text-xl font-semibold tabular-nums focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
          <button type="button" onClick={() => setQty(String((n || 0) + 1))} className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 text-xl text-slate-600 active:scale-95">+</button>
        </div>
        {locations.length > 1 && <SelectMenu ariaLabel="Location" value={loc} onChange={setLoc} options={locations.map((l) => ({ value: l.id, label: `${l.name} · ${qtyFmt(at(l.id))}` }))} />}
        {msg && <p role="status" className={`rounded-lg px-3 py-2 text-[14px] ${msg.ok ? "bg-[#e7f6f1] text-[#0f766e]" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={apply}
            className={`flex-1 rounded-xl py-3 text-[15px] font-semibold text-white transition-colors disabled:opacity-60 ${mode === "add" ? "bg-[#0f766e] hover:bg-[#0c5f59]" : "bg-[#be123c] hover:bg-[#9f1239]"}`}>
            {busy ? "Saving..." : mode === "add" ? "Add to stock" : "Remove from stock"}
          </button>
          <Link prefetch={false} href={`/dashboard/inventory?item=${it.id}`} className="flex items-center rounded-xl border border-slate-200 px-4 text-[15px] font-medium text-slate-700 hover:bg-slate-50">Details</Link>
        </div>
      </div>
    </div>
  );
}
