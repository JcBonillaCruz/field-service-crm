"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { FIELD_LABELS, HistoryRow, Item, usd } from "@/lib/catalog";
import { CloseButton, HistoryTable, ICONS, MenuAction, MoreMenu, PencilButton, Tabs, Timeline } from "@/components/catalog/DetailBits";
import BottomSheet from "@/components/customers/BottomSheet";
import MobileSortSheet from "@/components/customers/MobileSortSheet";
import { sheetItem } from "@/components/ui/sheet";

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

  const actions = [
    { label: "Clone Item", href: `/dashboard/items/new?clone=${item.id}`, icon: ICONS.clone },
    { label: item.is_active ? "Mark as Inactive" : "Mark as Active", onClick: busy ? undefined : toggleActive, icon: item.is_active ? ICONS.off : ICONS.on },
    { label: "Delete", onClick: remove, danger: true, icon: ICONS.trash },
  ];

  return (
    <>
    <ItemMobile item={item} history={history} companyId={companyId} actions={actions} msg={msg} />
    <div className="hidden min-h-full flex-col bg-white lg:flex">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 pb-1 pt-4 sm:px-7">
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-semibold tracking-tight text-[#0b1f3a]">{item.name}</h1>
          {!item.is_active && <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">Inactive</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PencilButton href={`/dashboard/items/${item.id}/edit`} label="Edit item" />
          <MoreMenu actions={actions} />
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
    </>
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

// Foto del item: se puede subir o quitar aquí mismo (escritorio y celular)
function useItemImage(item: Item, companyId: string) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
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
  const input = <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />;
  return { fileRef, uploading, err, save, upload, input };
}

function ImageBox({ item, companyId }: { item: Item; companyId: string }) {
  const { fileRef, uploading, err, save, upload, input } = useItemImage(item, companyId);
  const [drag, setDrag] = useState(false);

  return (
    <div className="shrink-0">
      {input}
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

/* ====================================================================
   CELULAR (como la app de Zoho): encabezado con precio + foto,
   pestañas DETAILS / TRANSACTIONS / HISTORY que se deslizan con el dedo
   ==================================================================== */
const M_TABS = ["Details", "Transactions", "History"];
const Q_STATUSES = ["All", "Draft", "Sent", "Client Viewed", "Accepted", "Invoiced", "Declined", "Expired"];
const I_STATUSES = ["All", "Draft", "Sent", "Viewed", "Partially Paid", "Paid", "Overdue", "Void"];

function ItemMobile({ item, history, companyId, actions, msg }: { item: Item; history: HistoryRow[]; companyId: string; actions: MenuAction[]; msg: string }) {
  const img = useItemImage(item, companyId);
  const scroller = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const go = (i: number) => { const el = scroller.current; if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" }); setIdx(i); };
  const onScroll = () => { const el = scroller.current; if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth)); };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-[#f4f6f8] lg:hidden">
      {img.input}
      <div className="bg-[#e7f5f1] px-4 pb-5 pt-3">
        <div className="flex items-center justify-end gap-2">
          <PencilButton href={`/dashboard/items/${item.id}/edit`} label="Edit item" />
          <MoreMenu actions={actions} />
          <CloseButton href="/dashboard/items" />
        </div>
        <h1 className="mt-2 text-[22px] font-semibold leading-tight text-[#0b1f3a]">{item.name}</h1>
        {!item.is_active && <span className="mt-1 inline-flex rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-500">Inactive</span>}
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Selling Price</p>
            <p className="text-[26px] font-semibold tabular-nums text-[#0b1f3a]">{usd(item.selling_price)}</p>
          </div>
          <button type="button" onClick={() => img.fileRef.current?.click()}
            className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white bg-white text-center text-[15px] font-medium text-slate-600 shadow-sm active:scale-95">
            {item.image_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
              : <span className="px-2">{img.uploading ? "Uploading..." : "+ Add Image"}</span>}
          </button>
        </div>
        {(img.err || msg) && <p role="alert" className="mt-2 text-sm text-red-600">{img.err || msg}</p>}
      </div>

      <div className="sticky top-16 z-10 grid grid-cols-3 border-b border-slate-200 bg-white shadow-sm">
        {M_TABS.map((t, i) => (
          <button key={t} type="button" onClick={() => go(i)}
            className={`relative py-3.5 text-[13px] font-semibold uppercase tracking-wide transition-colors ${idx === i ? "text-[#0f766e]" : "text-slate-600"}`}>
            {t}
            <span className={`absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-[#0f766e] transition-transform duration-200 ${idx === i ? "scale-x-100" : "scale-x-0"}`} />
          </button>
        ))}
      </div>

      <div ref={scroller} onScroll={onScroll}
        className="flex flex-1 snap-x snap-mandatory items-start overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="w-full shrink-0 snap-start space-y-3 p-3"><MDetails item={item} /></div>
        <div className="w-full shrink-0 snap-start p-3"><MTransactions /></div>
        <div className="w-full shrink-0 snap-start p-3">
          <div className="rounded-xl bg-white px-4 py-5 shadow-[0_1px_2px_rgba(15,40,60,0.06)]">
            <Timeline rows={(history.length ? history : [{ id: "c", action: "created", actor_name: null, changes: null, created_at: item.created_at }]).map((h) => ({
              id: h.id, title: `${h.action} by`, who: h.actor_name, when: h.created_at,
              note: h.changes?.length ? h.changes.map((c) => FIELD_LABELS[c] ?? c).join(", ") : undefined,
            }))} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,40,60,0.06)]">
      <h2 className="mb-3 flex items-center gap-3 text-[17px] font-semibold text-[#0b1f3a]">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#14a39a] via-[#0f8f7f] to-[#0f766e] text-white shadow-md shadow-[#0f766e]/25">
          <span className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-white/20" aria-hidden="true" />
          <svg viewBox="0 0 24 24" className="relative h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg>
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
const MInfo = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="py-2"><p className="text-sm text-slate-500">{label}</p><p className="mt-0.5 text-[16px] text-[#0b1f3a]">{children}</p></div>
);

function MDetails({ item }: { item: Item }) {
  const [desc, setDesc] = useState(false);
  return (
    <>
      <Card title="Sales Information" icon="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01M13.6 10.3c-.3-.6-1-.9-1.8-.9-1 0-1.8.5-1.8 1.3s.8 1.1 1.8 1.3 1.8.6 1.8 1.4-.8 1.3-1.8 1.3c-.9 0-1.6-.4-1.9-1M11.8 8.4v7.4">
        <MInfo label="Selling Price">{usd(item.selling_price)}</MInfo>
        <MInfo label="Sales Account">{item.account}</MInfo>
        {item.description && (
          <>
            <button type="button" onClick={() => setDesc((v) => !v)} className="mt-1 text-[15px] font-medium text-[#0f9f6e]">{desc ? "Hide description" : "Show description"}</button>
            {desc && <p className="mt-2 whitespace-pre-line rounded-lg bg-[#f6fbfa] px-3 py-2 text-[15px] text-slate-700 animate-[bp-fade_0.2s_ease-out]">{item.description}</p>}
          </>
        )}
      </Card>
      <Card title="Sales Summary" icon="M3 20h18M6 16v-4M10 16V9M14 16v-6M18 16V6M5 9l4-4 4 3 6-5">
        <div className="grid grid-cols-2 gap-2">
          {[["Quotes", "0"], ["Invoices", "0"], ["Units Sold", "0"], ["Total Sold", usd(0)]].map(([l, v]) => (
            <div key={l} className="rounded-lg bg-[#f6fbfa] px-3 py-2.5">
              <p className="text-xs text-slate-500">{l}</p><p className="text-lg font-semibold tabular-nums text-[#0b1f3a]">{v}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card title="More Information" icon="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.5h.01">
        <MInfo label="Item Type">Sales Items</MInfo>
        <MInfo label="Type">{item.item_type === "goods" ? "Goods" : "Service"}</MInfo>
        {item.unit && <MInfo label="Unit">{item.unit}</MInfo>}
        {item.sku && <MInfo label="SKU">{item.sku}</MInfo>}
        <MInfo label="Created Source">{item.source === "import" ? "Import" : "User"}</MInfo>
        <MInfo label="Status">{item.is_active ? "Active" : "Inactive"}</MInfo>
      </Card>
    </>
  );
}

function MTransactions() {
  const [kind, setKind] = useState<"Quotes" | "Invoices">("Quotes");
  const [sheet, setSheet] = useState<null | "kind" | "filter" | "sort">(null);
  const [status, setStatus] = useState("All");
  const [draft, setDraft] = useState("All");
  const [sort, setSort] = useState({ value: "date", dir: "desc" as "asc" | "desc" });
  useEffect(() => { if (sheet === "filter") setDraft(status); }, [sheet, status]);
  const statuses = kind === "Quotes" ? Q_STATUSES : I_STATUSES;
  const square = "flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 active:bg-slate-50";
  return (
    <div>
      <div className="flex items-start justify-between gap-3 px-1 pb-3">
        <div>
          <button type="button" onClick={() => setSheet("kind")} className="flex items-center gap-1.5 text-[20px] font-semibold text-[#0b1f3a]">
            {kind}
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><path d="M5.5 8h9L10 13z" /></svg>
          </button>
          <p className="text-sm font-medium text-[#2563eb]">Total Count: 0{status !== "All" && <span className="ml-1 text-slate-500">· {status}</span>}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" aria-label="Filter" onClick={() => setSheet("filter")} className={`${square} ${status !== "All" ? "border-[#0f766e] text-[#0f766e]" : ""}`}>
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M3 4h14l-5.5 6.5V16l-3-1.5v-4z" /></svg>
          </button>
          <button type="button" aria-label="Sort" onClick={() => setSheet("sort")} className={square}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4v16m0 0-3-3m3 3 3-3M13 6h8M13 11h5M13 16h3" /></svg>
          </button>
        </div>
      </div>
      <div className="rounded-xl bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(15,40,60,0.06)]">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e9f7f4] text-[#0f766e]">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5zM13.5 3v5.5H19M9 13h6M9 17h4" /></svg>
        </span>
        <p className="mt-4 font-semibold text-[#0b1f3a]">No {kind.toLowerCase()} yet</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">When you add this item to a {kind === "Quotes" ? "quote" : "invoice"}, you&apos;ll see the customer, number, date, amount and status here.</p>
      </div>

      <BottomSheet open={sheet === "kind"} onClose={() => setSheet(null)} title="Show">
        <ul className="space-y-0.5">
          {(["Quotes", "Invoices"] as const).map((k) => (
            <li key={k}><button type="button" onClick={() => { setKind(k); setStatus("All"); setSheet(null); }}
              className={sheetItem(kind === k)}>
              {k}{kind === k && <CheckDot />}
            </button></li>
          ))}
        </ul>
      </BottomSheet>
      <BottomSheet open={sheet === "filter"} onClose={() => setSheet(null)} title="Filter"
        footer={<button type="button" onClick={() => { setStatus(draft); setSheet(null); }} className="w-full rounded-full bg-[#0f9f6e] py-3 text-[16px] font-semibold text-white active:bg-[#0c8a5f]">Filter</button>}>
        <ul className="-mx-4">
          {statuses.map((st) => (
            <li key={st}><button type="button" onClick={() => setDraft(st)}
              className={`flex w-full items-center justify-between px-6 py-4 text-left text-[16px] ${draft === st ? "bg-slate-100 font-medium text-[#0b1f3a]" : "text-slate-700"}`}>
              {st}{draft === st && <CheckDot dark />}
            </button></li>
          ))}
        </ul>
      </BottomSheet>
      {sheet === "sort" && (
        <MobileSortSheet open onClose={() => setSheet(null)} sort={sort.value} dir={sort.dir}
          options={[{ value: "date", label: "Date" }, { value: "number", label: kind === "Quotes" ? "Quote Number" : "Invoice Number" }]}
          onApply={(value, dir) => { setSort({ value, dir }); setSheet(null); }} />
      )}
    </div>
  );
}

const CheckDot = ({ dark = false }: { dark?: boolean }) => (
  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-white ${dark ? "bg-[#1f2937]" : "bg-[#0f766e]"}`}>
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>
  </span>
);
