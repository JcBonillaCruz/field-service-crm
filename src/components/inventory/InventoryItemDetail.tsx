"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { bustCache } from "@/lib/cache-client";
import { confirmDelete } from "@/lib/confirm";
import { CloseButton, ICONS, MoreMenu, PencilButton, Tabs } from "@/components/catalog/DetailBits";
import { useSwipe } from "@/components/ui/useSwipe";
import { Toast } from "@/components/sales/SalesBits";
import QuickAdjust from "@/components/inventory/QuickAdjust";
import {
  InvCategory, InvItem, InvLocation, InvMovement, InvPhoto, InvStock, MOVE_LABEL, STATUS_META,
  invError, qtyFmt, statusOf, usd,
} from "@/lib/inventory";

const TABS = ["Overview", "History"];

// Ficha del producto (panel derecho de la vista dividida; en celular, pantalla completa)
export default function InventoryItemDetail({ companyId, item, stock, locations, categories, photos }: {
  companyId: string; item: InvItem; stock: InvStock[]; locations: InvLocation[]; categories: InvCategory[]; photos: InvPhoto[];
}) {
  const router = useRouter();
  const pics = photos;
  const rows = stock;
  const [tab, setTab] = useState("Overview");
  const ti = TABS.indexOf(tab);
  const swipe = useSwipe(() => ti > 0 && setTab(TABS[ti - 1]), () => ti < TABS.length - 1 && setTab(TABS[ti + 1]));
  const [main, setMain] = useState(0);
  const [moves, setMoves] = useState<InvMovement[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [editMin, setEditMin] = useState<string | null>(null);
  const [minVal, setMinVal] = useState("");
  const [msg, setMsg] = useState("");
  const [toast, setToast] = useState("");
  const [version, setVersion] = useState(0);
  const total = rows.reduce((s, r) => s + Number(r.qty), 0);
  const status = statusOf(rows);
  const meta = STATUS_META[status];
  const locName = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "—";
  const qtyAt = (id: string) => Number(rows.find((r) => r.location_id === id)?.qty ?? 0);
  const minAt = (id: string) => Number(rows.find((r) => r.location_id === id)?.min_qty ?? 0);
  useEffect(() => { if (main >= pics.length) setMain(0); }, [pics.length, main]);

  // Historial: se vuelve a leer cada vez que cambia el stock
  useEffect(() => {
    let alive = true;
    createClient().from("inventory_movements").select("id, item_id, kind, qty, from_location, to_location, reason, note, actor_name, created_at")
      .eq("item_id", item.id).order("created_at", { ascending: false }).limit(60)
      .then(({ data }) => { if (alive) setMoves((data ?? []) as InvMovement[]); });
    return () => { alive = false; };
  }, [item.id, version]);

  const onChanged = (text: string, ok: boolean) => {
    setToast(text); setTimeout(() => setToast(""), 2400);
    if (ok) { setVersion((v) => v + 1); router.refresh(); }
  };

  async function saveMin(loc: string) {
    const v = Number(minVal || 0);
    if (Number.isNaN(v) || v < 0) return setMsg("Enter a positive number.");
    const { error } = await createClient().rpc("inv_set_min", { p_company: companyId, p_item: item.id, p_location: loc, p_min: v });
    if (error) return setMsg(invError(error));
    setEditMin(null); setMsg("");
    onChanged("Low stock alert updated", true);
  }

  async function remove() {
    if (!(await confirmDelete({
      title: `Delete "${item.name}"?`,
      message: "The product, its stock in every location, its photos and its movement history will be deleted. This can't be undone.",
      download: { filename: item.name, data: { item, stock: rows, photos: pics, movements: moves } },
    }))) return;
    const supabase = createClient();
    const { error } = await supabase.from("items").delete().eq("id", item.id);
    if (error) return setMsg("It couldn't be deleted. It may be used in a quote or invoice — mark it inactive in Finances instead.");
    if (pics.length) await supabase.storage.from("item-images").remove(pics.map((p) => p.path));
    await bustCache("catalog");
    router.replace("/dashboard/inventory");
    router.refresh();
  }

  const kindIcon: Record<string, [string, string]> = {
    receive: ["M12 4v12M6 10l6 6 6-6M5 20h14", "bg-[#e7f6f1] text-[#0f766e]"],
    transfer: ["M4 8h13l-3-3M20 16H7l3 3", "bg-[#eef6ff] text-[#2563eb]"],
    use: ["M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z", "bg-[#fff4ec] text-[#ea580c]"],
    return: ["M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3", "bg-[#f1ebff] text-[#7c3aed]"],
    adjust: ["M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1M15 5v4M9 10v4M17 15v4", "bg-slate-100 text-slate-600"],
    count: ["M9 5h6M9 3h6v4H9zM6 5H5v16h14V5h-1M9 13l2 2 4-4", "bg-[#fff7e6] text-[#b45309]"],
  };
  const sign = (m: InvMovement) => (m.kind === "transfer" || m.kind === "return" ? "" : m.to_location ? "+" : "−");

  return (
    <div className="flex min-h-full flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 pb-2 pt-4 sm:px-7">
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-semibold tracking-tight text-[#0b1f3a] lg:text-[22px]">{item.name}</h1>
          <p className="truncate font-mono text-[12.5px] text-slate-400">{item.sku}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PencilButton href={`/dashboard/inventory/${item.id}/edit`} label="Edit item" />
          <MoreMenu dots actions={[
            { label: "Edit", href: `/dashboard/inventory/${item.id}/edit`, icon: "M13.5 3.5l3 3L7 16H4v-3z" },
            { label: "Delete", onClick: remove, danger: true, icon: ICONS.trash },
          ]} />
          <CloseButton href="/dashboard/inventory" />
        </div>
      </div>
      {msg && <p role="alert" className="mx-5 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-7">{msg}</p>}

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="flex-1 pb-10" {...swipe}>
        {tab === "Overview" ? (
          <div className="mx-auto max-w-[760px]">
      {/* Fotos */}
            <div className="border-b border-slate-100 bg-white px-5 pt-5">
              <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#f4f7fa] to-[#e9f7f4]">
                {pics[main] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={pics[main].id} src={pics[main].url} alt={item.name} className="h-full w-full object-contain " />
                ) : (
                  <svg viewBox="0 0 24 24" className="h-16 w-16 text-[#9fc9c0]" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9" /></svg>
                )}
              </div>
              {pics.length > 1 && (
                <div className="mt-3 flex gap-2">
                  {pics.map((p, i) => (
                    <button key={p.id} type="button" onClick={() => setMain(i)} aria-label={`Photo ${i + 1}`}
                      className={`h-14 w-14 overflow-hidden rounded-lg border-2 transition-all ${i === main ? "border-[#0f766e]" : "border-transparent opacity-70 hover:opacity-100"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 py-4">
                <button type="button" onClick={() => { navigator.clipboard?.writeText(item.sku ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
                  title="Copy SKU" className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-[13px] text-slate-600 transition-colors hover:bg-[#e9f7f4] hover:text-[#0f766e]">
                  {item.sku}
                  <span className="font-sans text-[11px] font-semibold">{copied ? "Copied" : "Copy"}</span>
                </button>
                {item.category_id && <span className="rounded-lg bg-[#eef6ff] px-2.5 py-1 text-[13px] text-[#2563eb]">{categories.find((c) => c.id === item.category_id)?.name}</span>}
                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ${meta.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}</span>
              </div>
            </div>

            {/* Números */}
            <div className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-4">
              {[["On hand", `${qtyFmt(total)} ${item.unit ?? ""}`], ["Value", usd(total * item.cost_price)], ["Unit cost", usd(item.cost_price)], ["Price", usd(item.selling_price)]].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[11.5px] font-medium uppercase tracking-wide text-slate-400">{k}</p>
                  <p className="mt-0.5 truncate text-[15px] font-semibold tabular-nums text-[#0b1f3a]">{v}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 px-5 pb-2">
              <p className="text-[15px] font-semibold text-[#0b1f3a]">Stock by location</p>
              <QuickAdjust companyId={companyId} item={item} locations={locations} rows={rows} onDone={onChanged} />
            </div>
            <ul className="mx-5 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {locations.map((l) => {
                const q = qtyAt(l.id), m = minAt(l.id), low = m > 0 && q <= m;
                return (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${l.kind === "van" ? "bg-[#fff4ec] text-[#ea580c]" : "bg-[#e9f7f4] text-[#0f766e]"}`}>
                      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d={l.kind === "van" ? "M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 7 19zM17 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z" : "M3 10.5 12 4l9 6.5V20H3zM8 20v-6h8v6M8 17h8"} />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-medium text-slate-800">{l.name}</p>
                      {editMin === l.id ? (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-[12.5px] text-slate-500">Alert at</span>
                          <input autoFocus value={minVal} inputMode="decimal" onChange={(e) => setMinVal(e.target.value.replace(/[^0-9.]/g, ""))}
                            onKeyDown={(e) => { if (e.key === "Enter") saveMin(l.id); if (e.key === "Escape") setEditMin(null); }}
                            className="h-7 w-16 rounded-md border border-slate-200 px-2 text-[13px] tabular-nums focus:border-[#0f766e] focus:outline-none" />
                          <button type="button" onClick={() => saveMin(l.id)} className="rounded-md bg-[#0f766e] px-2 py-1 text-[12px] font-semibold text-white hover:bg-[#0c5f59]">Save</button>
                          <button type="button" onClick={() => setEditMin(null)} className="px-1 text-[12px] text-slate-500 hover:text-slate-700">Cancel</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => { setEditMin(l.id); setMinVal(m ? String(m) : ""); }}
                          className="group/min mt-0.5 flex items-center gap-1 text-[12.5px] text-slate-500 hover:text-[#0f766e]">
                          {m > 0 ? `Low stock alert at ${qtyFmt(m)}` : "Set low stock alert"}
                          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 transition-transform group-hover/min:-rotate-12 group-hover/min:scale-110" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M13.5 3.5l3 3L7 16H4v-3z" /></svg>
                        </button>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[15px] font-semibold tabular-nums ${q <= 0 ? "bg-[#fff1f2] text-[#be123c]" : low ? "bg-[#fff7e6] text-[#b45309]" : "text-[#0b1f3a]"}`}>{qtyFmt(q)}</span>
                  </li>
                );
              })}
            </ul>
            {msg && <p role="alert" className="mx-5 mt-2 text-sm text-red-600">{msg}</p>}

            {item.description && (
              <div className="px-5 pt-5">
                <p className="text-[15px] font-semibold text-[#0b1f3a]">Description</p>
                <p className="mt-1 whitespace-pre-line text-[14.5px] text-slate-600">{item.description}</p>
              </div>
            )}

          </div>
        ) : (
          <div className="mx-auto max-w-[760px] px-5 pt-5 sm:px-7">
        {moves === null ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : moves.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No movements yet.</p>
        ) : (
          <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[17px] before:top-3 before:w-px before:bg-slate-200">
            {moves.map((m) => {
              const [d, tone] = kindIcon[m.kind] ?? kindIcon.adjust;
              return (
                <li key={m.id} className="relative flex gap-3 rounded-xl py-2 pr-2 transition-colors hover:bg-slate-50">
                  <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${tone}`}>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-slate-800">
                      <b className="font-semibold">{MOVE_LABEL[m.kind]}</b>{" "}
                      <span className="tabular-nums">{sign(m)}{qtyFmt(Number(m.qty))}</span>
                      <span className="text-slate-500"> · {m.kind === "transfer" || m.kind === "return" ? `${locName(m.from_location)} → ${locName(m.to_location)}` : locName(m.to_location ?? m.from_location)}</span>
                    </p>
                    <p className="truncate text-[12.5px] text-slate-500">
                      {[m.reason, m.actor_name && `by ${m.actor_name}`, new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
          </div>
        )}
      </div>
      <Toast text={toast} />
    </div>
  );
}
