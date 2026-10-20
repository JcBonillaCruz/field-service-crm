"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { FIELD_LABELS, HistoryRow, Item, usd } from "@/lib/catalog";
import { CloseButton, HistoryTable, ICONS, MoreMenu, PencilButton, Tabs } from "@/components/catalog/DetailBits";

const TABS = ["Overview", "Transactions", "History"];

export default function ItemDetailView({ item, history, companyId }: { item: Item; history: HistoryRow[]; companyId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState("Overview");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function toggleActive() {
    setBusy(true);
    const { error } = await createClient().from("items").update({ is_active: !item.is_active, updated_at: new Date().toISOString() }).eq("id", item.id);
    setBusy(false);
    if (error) return setMsg("The status couldn't be changed.");
    router.refresh();
  }
  async function remove() {
    if (!window.confirm(`Delete "${item.name}"? This can't be undone.`)) return;
    const { error } = await createClient().from("items").delete().eq("id", item.id);
    if (error) return setMsg("The item couldn't be deleted. It may be used in a quote or invoice.");
    router.push("/dashboard/items");
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 pb-1 pt-4 sm:px-7">
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-semibold tracking-tight text-[#0b1f3a]">{item.name}</h1>
          {!item.is_active && <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">Inactive</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PencilButton href={`/dashboard/items/${item.id}/edit`} label="Edit item" />
          <MoreMenu actions={[
            { label: "Clone Item", href: `/dashboard/items/new?clone=${item.id}`, icon: ICONS.clone },
            { label: item.is_active ? "Mark as Inactive" : "Mark as Active", onClick: busy ? undefined : toggleActive, icon: item.is_active ? ICONS.off : ICONS.on },
            { label: "Delete", onClick: remove, danger: true, icon: ICONS.trash },
          ]} />
          <CloseButton href="/dashboard/items" />
        </div>
      </div>
      {msg && <p role="alert" className="mx-5 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-7">{msg}</p>}

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="flex-1">
        {tab === "Overview" && <Overview item={item} companyId={companyId} />}
        {tab === "Transactions" && <Transactions />}
        {tab === "History" && (
          <div className="px-0 py-2 sm:px-2">
            <HistoryTable fallbackCreated={item.created_at}
              rows={history.map((h) => ({ ...h, changes: (h.changes ?? []).map((c) => FIELD_LABELS[c] ?? c) }))} />
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-4 py-1.5 text-[15px]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 text-[#0b1f3a]">{children}</dd>
    </div>
  );
}

function Overview({ item, companyId }: { item: Item; companyId: string }) {
  const [more, setMore] = useState(false);
  const long = (item.description ?? "").length > 160;
  const desc = item.description ? (more || !long ? item.description : `${item.description.slice(0, 160)}...`) : "";
  return (
    <div className="flex flex-col gap-8 px-5 py-6 sm:px-7 xl:flex-row">
      <div className="min-w-0 flex-1 xl:max-w-[640px]">
        <dl>
          <Field label="Item Type">{item.item_type === "goods" ? "Sales Items (Goods)" : "Sales Items (Service)"}</Field>
          {item.unit && <Field label="Unit">{item.unit}</Field>}
          {item.sku && <Field label="SKU">{item.sku}</Field>}
          <Field label="Created Source">{item.source === "import" ? "Import" : "User"}</Field>
        </dl>
        <h2 className="mb-2 mt-7 text-[17px] font-semibold text-[#0b1f3a]">Sales Information</h2>
        <dl>
          <Field label="Selling Price">{usd(item.selling_price)}</Field>
          <Field label="Sales Account">{item.account}</Field>
          <Field label="Description">
            {desc ? (
              <>
                <span className="whitespace-pre-line">{desc}</span>
                {long && (
                  <button type="button" onClick={() => setMore((v) => !v)} className="ml-1 inline-flex items-center gap-0.5 text-sm font-medium text-[#2563eb] hover:underline">
                    {more ? "Read Less" : "Read More"}
                    <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 transition-transform ${more ? "rotate-180" : ""}`} fill="currentColor" aria-hidden="true"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
                  </button>
                )}
              </>
            ) : <span className="text-slate-400">—</span>}
          </Field>
        </dl>
      </div>
      <ImageBox item={item} companyId={companyId} />
    </div>
  );
}

// Foto del item: se puede subir o quitar aquí mismo
function ImageBox({ item, companyId }: { item: Item; companyId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  async function save(url: string | null) {
    const { error } = await createClient().from("items").update({ image_url: url, updated_at: new Date().toISOString() }).eq("id", item.id);
    if (error) return setErr("The image couldn't be saved.");
    router.refresh();
  }
  async function upload(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setErr("Use a PNG, JPG or WEBP image.");
    if (file.size > 5 * 1024 * 1024) return setErr("The image must be 5 MB or smaller.");
    setUploading(true); setErr("");
    const supabase = createClient();
    const path = `${companyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.name.split(".").pop() || "png"}`;
    const { error } = await supabase.storage.from("item-images").upload(path, file);
    setUploading(false);
    if (error) return setErr("The image couldn't be uploaded.");
    await save(supabase.storage.from("item-images").getPublicUrl(path).data.publicUrl);
  }

  return (
    <div className="shrink-0">
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]); }}
        className={`group/img relative flex h-56 w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed bg-white text-center transition-colors sm:w-64 ${drag ? "border-[#14a39a] bg-[#f0faf7]" : "border-slate-300"}`}>
        {item.image_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image_url} alt={item.name} className="h-full w-full object-contain p-3" />
            <Menu>
              <MenuButton className="absolute right-2 top-2 rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-slate-600 opacity-0 shadow-sm transition-opacity group-hover/img:opacity-100 data-[open]:opacity-100">Options</MenuButton>
              <MenuItems anchor="bottom end" className="z-[80] mt-1 w-40 rounded-xl border border-slate-200 bg-white py-1 shadow-lg focus:outline-none">
                <MenuItem><button type="button" onClick={() => fileRef.current?.click()} className="w-full px-4 py-2 text-left text-sm text-slate-700 data-[focus]:bg-[#0f766e] data-[focus]:text-white">Change image</button></MenuItem>
                <MenuItem><button type="button" onClick={() => save(null)} className="w-full px-4 py-2 text-left text-sm text-red-600 data-[focus]:bg-red-50">Remove image</button></MenuItem>
              </MenuItems>
            </Menu>
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" className="h-10 w-10 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="15.5" cy="9.5" r="1.8" /><path d="m4 17 5-5 4 4 2.5-2.5L20 18" />
            </svg>
            <p className="mt-3 text-sm text-slate-500">{uploading ? "Uploading..." : "Drag image here or"}</p>
            {!uploading && <button type="button" onClick={() => fileRef.current?.click()} className="text-sm font-medium text-[#2563eb] hover:underline">Browse images</button>}
          </>
        )}
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}

// Transacciones: aquí aparecerán las cotizaciones y facturas que usen este item
const FILTERS = ["Quotes", "Invoices"];
const STATUSES = ["All", "Draft", "Sent", "Accepted", "Declined", "Invoiced"];
function Transactions() {
  const [filter, setFilter] = useState("Quotes");
  const [status, setStatus] = useState("All");
  const isQuotes = filter === "Quotes";
  return (
    <div className="px-5 py-5 sm:px-7">
      <div className="flex flex-wrap gap-2">
        <Pick label="Filter By" value={filter} options={FILTERS} onChange={setFilter} />
        <Pick label="Status" value={status} options={STATUSES} onChange={setStatus} />
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-[#fafbfc] text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">{isQuotes ? "Quote Number" : "Invoice Number"}</th>
              <th className="px-4 py-2.5">Customer Name</th><th className="px-4 py-2.5">Quantity Sold</th>
              <th className="px-4 py-2.5 text-right">Price</th><th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">
              There are no {isQuotes ? "quotes" : "invoices"} with this item yet.
              <span className="mt-1 block text-xs text-slate-400">When you add this item to a {isQuotes ? "quote" : "invoice"}, it will show up here with the customer, quantity and status.</span>
            </td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pick({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <Menu>
      <MenuButton className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#fafbfc] px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-white data-[open]:border-[#14a39a] data-[open]:bg-white">
        {label}: <span className="font-medium text-[#0b1f3a]">{value}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400" fill="currentColor" aria-hidden="true"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </MenuButton>
      <MenuItems anchor="bottom start" transition className="z-[80] mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-150 focus:outline-none data-[closed]:opacity-0">
        {options.map((o) => (
          <MenuItem key={o}>
            <button type="button" onClick={() => onChange(o)}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm data-[focus]:bg-[#0f766e] data-[focus]:text-white ${o === value ? "font-semibold text-[#0f766e]" : "text-slate-700"}`}>
              {o}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}
