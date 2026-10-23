"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import { CouponRow, Item, couponStatus, discountLabel, usd } from "@/lib/catalog";
import {
  BUILTIN_VIEWS, CatalogModule, DEFAULT_VIEW, FIELDS, MODULE_INFO, Row, SORTS, ViewDef, applyView, colWidthKey,
  defaultSort, displayValue, favKey, lastViewKey, shortViewName,
} from "@/lib/catalog-views";
import { downloadBlob, makeZip } from "@/lib/zip";
import CatalogActionsMenu, { ACTION_ICONS, ActionGroup } from "@/components/catalog/CatalogActionsMenu";
import ItemPrefsModal from "@/components/catalog/ItemPrefsModal";
import BarcodeScanner from "@/components/catalog/BarcodeScanner";
import ExportModal from "@/components/customers/ExportModal";
import { NoImage } from "@/components/catalog/DetailBits";
import BottomSheet from "@/components/customers/BottomSheet";
import MobileSortSheet from "@/components/customers/MobileSortSheet";
import { sheetItem } from "@/components/ui/sheet";

const STATUS_TONE: Record<string, string> = { active: "text-[#16a34a]", inactive: "text-slate-400", expired: "text-[#e11d48]", used: "text-[#d97706]" };
const Star = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform duration-200 hover:scale-125 ${on ? "fill-[#f59e0b] text-[#f59e0b]" : "fill-none text-slate-400"}`} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="m10 2.8 2.2 4.5 5 .7-3.6 3.5.8 5L10 14.2l-4.5 2.3.9-5L2.8 8l5-.7z" strokeLinejoin="round" />
  </svg>
);

export default function CatalogWorkspace({ module, rows, customViews, companyId, children }: {
  module: CatalogModule; rows: Row[]; customViews: ViewDef[]; companyId: string; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();
  const info = MODULE_INFO[module];
  const base = info.base;

  // --- hooks primero (antes de cualquier return) ---
  const [fallbackView, setFallbackView] = useState(DEFAULT_VIEW[module]);
  const [favs, setFavs] = useState<string[]>([]);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [mSheet, setMSheet] = useState<null | "filter" | "sort" | "more">(null);
  const [mSearch, setMSearch] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportScope, setExportScope] = useState<"all" | "view">("all");
  const onScan = useCallback((code: string) => {
    setScanOpen(false); setMSearch(true);
    const p = new URLSearchParams(window.location.search); p.set("q", code);
    router.replace(`${window.location.pathname}?${p.toString()}`, { scroll: false });
  }, [router]);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    try {
      const last = localStorage.getItem(lastViewKey(module, companyId));
      if (last) setFallbackView(last);
      setFavs(JSON.parse(localStorage.getItem(favKey(module, companyId)) || "[]"));
      setWidths(JSON.parse(localStorage.getItem(colWidthKey(module, companyId)) || "{}"));
    } catch { /* nada guardado */ }
  }, [module, companyId]);

  const allViews = useMemo(() => [...BUILTIN_VIEWS[module], ...customViews], [module, customViews]);
  const viewId = sp.get("view") || fallbackView;
  const view = allViews.find((v) => v.id === viewId) ?? BUILTIN_VIEWS[module][0];
  const sort = sp.get("sort") || defaultSort(module);
  const dir = (sp.get("dir") as "asc" | "desc") || (sp.get("sort") ? "asc" : "desc");
  const q = sp.get("q") || "";
  const list = useMemo(() => applyView(module, rows, view, q, sort, dir), [module, rows, view, q, sort, dir]);
  const columns = useMemo(() => view.columns.map((k) => FIELDS[module].find((f) => f.key === k)).filter(Boolean) as typeof FIELDS["items"], [view, module]);

  const flash = useCallback((t: string) => { setToast(t); setTimeout(() => setToast(""), 2600); }, []);

  const rest = pathname.slice(base.length);
  const seg = rest.split("/").filter(Boolean);
  const isForm = seg[0] === "new" || seg[0] === "import" || seg[0] === "views" || seg[1] === "edit";
  const selectedId = seg.length === 1 && !isForm ? seg[0] : null;
  if (isForm) return <>{children}</>;

  // --- acciones ---
  function setParams(patch: Record<string, string | null>) {
    const p = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => (v == null ? p.delete(k) : p.set(k, v)));
    const s = p.toString();
    router.replace(`${pathname}${s ? `?${s}` : ""}`, { scroll: false });
  }
  function switchView(id: string) {
    try { localStorage.setItem(lastViewKey(module, companyId), id); } catch { /* */ }
    setFallbackView(id); setChecked(new Set());
    setParams({ view: id });
  }
  function applySort(value: string) {
    const nextDir = value === sort ? (dir === "asc" ? "desc" : "asc") : value === "created" || value === "updated" ? "desc" : "asc";
    setParams({ sort: value, dir: nextDir });
  }
  async function toggleFav(v: ViewDef) {
    if (v.builtin) {
      const next = favs.includes(v.id) ? favs.filter((x) => x !== v.id) : [...favs, v.id];
      setFavs(next);
      try { localStorage.setItem(favKey(module, companyId), JSON.stringify(next)); } catch { /* */ }
      return;
    }
    await createClient().from("list_views").update({ is_favorite: !v.is_favorite }).eq("id", v.id);
    router.refresh();
  }
  const isFav = (v: ViewDef) => (v.builtin ? favs.includes(v.id) : Boolean(v.is_favorite));

  function resizeStart(key: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startW = widths[key] ?? FIELDS[module].find((f) => f.key === key)?.width ?? 150;
    const move = (ev: MouseEvent) => setWidths((w) => ({ ...w, [key]: Math.max(80, startW + ev.clientX - startX) }));
    const up = () => {
      document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      setWidths((w) => { try { localStorage.setItem(colWidthKey(module, companyId), JSON.stringify(w)); } catch { /* */ } return w; });
    };
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
  }

  const table = module === "items" ? "items" : "coupons";
  async function bulk(action: "active" | "inactive" | "delete") {
    const ids = Array.from(checked);
    if (!ids.length) return;
    if (action === "delete" && !window.confirm(`Delete ${ids.length} ${ids.length === 1 ? info.singular.toLowerCase() : info.plural.toLowerCase()}? This can't be undone.`)) return;
    setBusy(action);
    const db = createClient().from(table);
    const { error } = action === "delete" ? await db.delete().in("id", ids) : await db.update({ is_active: action === "active" }).in("id", ids);
    setBusy("");
    if (error) return flash(action === "delete" ? "Some records couldn't be deleted." : "The status couldn't be changed.");
    setChecked(new Set());
    if (action === "delete" && selectedId && ids.includes(selectedId)) router.push(base);
    router.refresh();
    flash(action === "delete" ? "Deleted." : `Marked as ${action}.`);
  }

  // --- exportar: siempre con el mismo pop-up de Customers ---
  function openExport(scope: "all" | "view") { setExportScope(scope); setExportOpen(true); }
  async function exportImages() {
    const withImg = (rows as Item[]).filter((it) => it.image_url);
    if (!withImg.length) return flash("None of your items has an image yet.");
    setBusy("images");
    const used = new Set<string>();
    const files: { name: string; data: Uint8Array }[] = [];
    for (const it of withImg) {
      try {
        const res = await fetch(it.image_url!);
        if (!res.ok) continue;
        const ext = (it.image_url!.split("?")[0].split(".").pop() || "png").slice(0, 4);
        let n = (it.name.replace(/[\\/:*?"<>|]+/g, "").trim() || "item").slice(0, 60);
        let i = 2; const stem = n;
        while (used.has(`${n}.${ext}`)) n = `${stem} (${i++})`;
        used.add(`${n}.${ext}`);
        files.push({ name: `${n}.${ext}`, data: new Uint8Array(await res.arrayBuffer()) });
      } catch { /* sigue con la siguiente */ }
    }
    setBusy("");
    if (!files.length) return flash("The images couldn't be downloaded.");
    downloadBlob("item-images.zip", makeZip(files));
  }
  function resetWidths() {
    setWidths({});
    try { localStorage.removeItem(colWidthKey(module, companyId)); } catch { /* */ }
    flash("Column widths were reset.");
  }

  const groups: ActionGroup[] = [
    { kind: "sub", label: "Sort by", icon: ACTION_ICONS.sort, items: SORTS[module].map((s) => ({ label: s.label, onClick: () => applySort(s.value), active: s.value === sort, dir })) },
    { kind: "divider" },
    { kind: "item", label: `Import ${info.plural}`, icon: ACTION_ICONS.import, onClick: () => router.push(`${base}/import`) },
    module === "items"
      ? { kind: "sub", label: "Export", icon: ACTION_ICONS.export, items: [
        { label: "Export Items", onClick: () => openExport("all") }, { label: "Export Current View", onClick: () => openExport("view") }, { label: "Export Item Images", onClick: exportImages },
      ] }
      : { kind: "sub", label: "Export", icon: ACTION_ICONS.export, items: [{ label: "Export Coupons", onClick: () => openExport("all") }, { label: "Export Current View", onClick: () => openExport("view") }] },
    { kind: "divider" },
    ...(module === "items" ? [{ kind: "item" as const, label: "Preferences", icon: ACTION_ICONS.prefs, onClick: () => setPrefsOpen(true) }] : []),
    { kind: "item", label: "Refresh List", icon: ACTION_ICONS.refresh, onClick: () => { router.refresh(); flash("List refreshed."); } },
    { kind: "item", label: "Reset Column Width", icon: ACTION_ICONS.reset, onClick: resetWidths },
  ];

  const customizeHref = view.builtin ? `${base}/views/new?from=${view.id}` : `${base}/views/${view.id}/edit`;
  const allChecked = list.length > 0 && list.every((r) => checked.has(r.id));
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(list.map((r) => r.id)));
  const toggleOne = (id: string) => setChecked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const viewMenu = (
    <Popover className="relative min-w-0">
      <PopoverButton className={`group flex min-w-0 items-center gap-2 rounded-lg font-semibold tracking-tight text-[#0b1f3a] focus:outline-none ${selectedId ? "text-lg" : "text-2xl"}`}>
        <span className="truncate">{view.name}</span>
        <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-[#0f766e] transition-transform duration-200 group-data-[open]:rotate-180" fill="currentColor" aria-hidden="true"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </PopoverButton>
      <PopoverPanel anchor="bottom start" transition
        className="z-[70] mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0">
        {({ close }) => {
          const line = (v: ViewDef) => {
            const on = v.id === view.id;
            return (
              <div key={v.id} className={`group/v flex items-center gap-1 rounded-lg pr-2 transition-colors ${on ? "bg-[#cdebe3] font-semibold text-[#0b3f3b]" : "text-slate-700 hover:bg-[#e3f4ef]"}`}>
                <button type="button" onClick={() => { switchView(v.id); close(); }} className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm">{shortViewName(module, v)}</button>
                {!v.builtin && (
                  <Link prefetch={false} href={`${base}/views/${v.id}/edit`} onClick={() => close()} aria-label="Edit view" className={`rounded p-1 opacity-0 transition-opacity group-hover/v:opacity-100 "text-slate-500 hover:text-[#0f766e]"`}>
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" strokeLinejoin="round" /></svg>
                  </Link>
                )}
                <button type="button" onClick={() => toggleFav(v)} aria-label={isFav(v) ? "Remove from favorites" : "Mark as favorite"} className={`rounded p-1 `}><Star on={isFav(v)} /></button>
              </div>
            );
          };
          const favList = allViews.filter(isFav);
          return (
            <>
              {favList.length > 0 && (<><p className="px-4 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Favorites</p>{favList.map(line)}<div className="my-1 border-t border-slate-100" /></>)}
              {BUILTIN_VIEWS[module].map(line)}
              {customViews.length > 0 && (<><div className="my-1 border-t border-slate-100" /><p className="px-4 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Custom views</p>{customViews.map(line)}</>)}
              <div className="mt-1 border-t border-slate-100 pt-1">
                <Link prefetch={false} href={`${base}/views/new`} onClick={() => close()} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#0f766e] transition-colors hover:bg-[#e3f4ef]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0f766e] text-white"><svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M10 5v10M5 10h10" /></svg></span>
                  New View
                </Link>
              </div>
            </>
          );
        }}
      </PopoverPanel>
    </Popover>
  );

  const plus = (
    <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-200 group-hover/n:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M10 4.5v11M4.5 10h11" /></svg>
  );

  const listPane = selectedId
    ? "hidden w-full shrink-0 flex-col border-r border-slate-200 bg-white lg:flex lg:w-[360px]"
    : "flex w-full min-w-0 flex-col bg-white";

  return (
    <div className="lg:flex lg:h-[calc(100vh-4rem)] lg:overflow-hidden">
      <div className={listPane}>
        {/* Encabezado */}
        {/* ====== Celular (como la app de Zoho): título, buscar, ordenar y filtro ====== */}
        <div className="shrink-0 border-b border-slate-100 bg-white px-4 pb-2 pt-5 lg:hidden">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f3a]">{info.plural}</h1>
            <div className="flex items-center gap-0.5">
              <button type="button" aria-label="Search" onClick={() => setMSearch((v) => !v)}
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${mSearch || q ? "bg-[#e9f7f4] text-[#0f766e]" : "text-slate-700 active:bg-slate-100"}`}>
                <svg viewBox="0 0 20 20" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
              </button>
              {module === "items" && (
                <button type="button" aria-label="Scan barcode" onClick={() => setScanOpen(true)} className="flex h-12 w-12 items-center justify-center rounded-xl text-slate-700 active:bg-slate-100">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M8 8v8M11 8v8M14 8v8M17 8v8" /></svg>
                </button>
              )}
              <button type="button" aria-label="Sort" onClick={() => setMSheet("sort")} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-slate-100">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 4v16m0 0-3-3m3 3 3-3M13 6h8M13 11h5M13 16h3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button type="button" aria-label="More" onClick={() => setMSheet("more")} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-slate-100">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><circle cx="4.5" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="15.5" cy="10" r="1.6" /></svg>
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button type="button" onClick={() => setMSheet("filter")} className="flex items-center gap-1.5 border-b-2 border-[#0f766e] pb-0.5 text-[15px] font-semibold text-[#0f766e]">
              {shortViewName(module, view)}
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
            </button>
            <span className="text-xs text-slate-500">{list.length} {list.length === 1 ? info.singular.toLowerCase() : info.plural.toLowerCase()}</span>
          </div>
          {(mSearch || q) && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 focus-within:border-[#0f766e] focus-within:bg-white">
              <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
              <input key={q} autoFocus defaultValue={q} placeholder={`Search ${info.plural.toLowerCase()}`} autoComplete="off"
                onChange={(e) => { const v = e.target.value; clearTimeout(searchTimer.current); searchTimer.current = setTimeout(() => setParams({ q: v.trim() || null }), 300); }}
                className="w-full bg-transparent py-2.5 text-[15px] focus:outline-none" />
            </div>
          )}
        </div>

        {/* ====== Computadora ====== */}
        <div className={`hidden shrink-0 items-center justify-between gap-3 border-b border-slate-200 lg:flex ${selectedId ? "px-4 py-3" : "px-5 py-4 sm:px-6"}`}>
          {viewMenu}
          <div className="flex shrink-0 items-center gap-2">
            {selectedId ? (
              <Link prefetch={false} href={`${base}/new`} aria-label={`New ${info.singular}`} className="group/n flex h-10 w-10 items-center justify-center rounded-lg bg-[#0f766e] text-white shadow-sm shadow-[#0f766e]/30 transition-colors hover:bg-[#0c5f59]">{plus}</Link>
            ) : (
              <Link prefetch={false} href={`${base}/new`} className="group/n hidden h-10 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-[15px] font-semibold text-white shadow-sm shadow-[#0f766e]/30 transition-colors hover:bg-[#0c5f59] sm:inline-flex">{plus}New</Link>
            )}
            <div className="hidden lg:block"><CatalogActionsMenu groups={groups} side={selectedId ? "right" : "left"} /></div>
          </div>
        </div>

        {/* Barra de acciones en grupo */}
        {checked.size > 0 && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#bfe7de] bg-[#e9f7f4] px-5 py-2 text-sm animate-[bp-fade_0.2s_ease-out]">
            <span className="font-medium text-[#0b1f3a]">{checked.size} selected</span>
            <button type="button" disabled={!!busy} onClick={() => bulk("active")} className="rounded-md border border-slate-200 bg-white px-3 py-1 hover:border-[#14a39a] hover:text-[#0f766e]">Mark as Active</button>
            <button type="button" disabled={!!busy} onClick={() => bulk("inactive")} className="rounded-md border border-slate-200 bg-white px-3 py-1 hover:border-[#14a39a] hover:text-[#0f766e]">Mark as Inactive</button>
            <button type="button" disabled={!!busy} onClick={() => bulk("delete")} className="rounded-md border border-red-200 bg-white px-3 py-1 text-red-600 hover:bg-red-50">Delete</button>
            <button type="button" onClick={() => setChecked(new Set())} className="ml-auto text-slate-500 hover:text-slate-800">Clear</button>
          </div>
        )}
        {busy === "images" && <div className="shrink-0 bg-[#eef6ff] px-5 py-2 text-sm text-slate-600">Preparing the images…</div>}

        <div className="min-h-0 flex-1 lg:overflow-auto">
          {list.length === 0 ? (
            <Empty module={module} filtered={rows.length > 0} base={base} />
          ) : selectedId ? (
            <ul className="divide-y divide-slate-100">
              {list.map((r) => <CompactRow key={r.id} module={module} r={r} active={r.id === selectedId} base={base} checked={checked.has(r.id)} onCheck={() => toggleOne(r.id)} />)}
            </ul>
          ) : (
            <>
              {/* Tabla (computadora) */}
              <table className="hidden w-max min-w-full table-fixed border-separate border-spacing-0 text-sm lg:table">
                <colgroup>
                  <col style={{ width: 44 }} /><col style={{ width: 44 }} />
                  {columns.map((c) => <col key={c.key} style={{ width: widths[c.key] ?? c.width }} />)}
                  <col />
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#fafbfc] text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="border-b border-slate-200 py-3 pl-4">
                      <Link prefetch={false} href={customizeHref} title="Customize columns" aria-label="Customize columns" className="group/c flex h-6 w-6 items-center justify-center rounded text-[#0f766e] transition-colors hover:bg-[#0f766e] hover:text-white">
                        <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-300 group-hover/c:rotate-90" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h9M15 6h2M3 14h3M9 14h8M13 4v4M7 12v4" /></svg>
                      </Link>
                    </th>
                    <th className="border-b border-slate-200 py-3"><input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" className="h-4 w-4 cursor-pointer rounded accent-[#0f766e]" /></th>
                    {columns.map((c) => (
                      <th key={c.key} className={`group/h relative select-none border-b border-slate-200 px-3 py-3 ${c.align === "right" ? "text-right" : ""}`}>
                        <button type="button" onClick={() => SORTS[module].some((s) => s.value === c.key) && applySort(c.key)}
                          className={`inline-flex max-w-full items-center gap-1 truncate uppercase ${SORTS[module].some((s) => s.value === c.key) ? "hover:text-[#0f766e]" : "cursor-default"}`}>
                          {c.label}
                          {sort === c.key && <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 text-[#0f766e] ${dir === "asc" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M10 4v12m0 0-4-4m4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </button>
                        <span onMouseDown={(e) => resizeStart(c.key, e)} className="absolute inset-y-2 right-0 w-2 cursor-col-resize border-r-2 border-transparent transition-colors group-hover/h:border-slate-300 hover:!border-[#14a39a]" />
                      </th>
                    ))}
                    <th className="border-b border-slate-200" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id} onClick={() => router.push(`${base}/${r.id}`)}
                      className={`cursor-pointer transition-colors ${checked.has(r.id) ? "bg-[#e9f7f4]" : "hover:bg-[#f0faf7]"}`}>
                      <td className="border-b border-slate-100 py-3 pl-4" />
                      <td className="border-b border-slate-100 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={checked.has(r.id)} onChange={() => toggleOne(r.id)} aria-label="Select" className="h-4 w-4 cursor-pointer rounded accent-[#0f766e]" />
                      </td>
                      {columns.map((c) => <Cell key={c.key} module={module} r={r} k={c.key} align={c.align} base={base} />)}
                      <td className="border-b border-slate-100" />
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Tarjetas (celular) */}
              <ul className="divide-y divide-slate-100 lg:hidden">
                {list.map((r) => <CompactRow key={r.id} module={module} r={r} active={false} base={base} />)}
              </ul>
              <p className="hidden px-6 py-4 text-xs text-slate-400 lg:block">{list.length} {list.length === 1 ? info.singular.toLowerCase() : info.plural.toLowerCase()}</p>
            </>
          )}
        </div>
      </div>

      <div className={selectedId ? "flex min-w-0 flex-1 flex-col bg-white" : "hidden"}>
        <div className="min-h-0 flex-1 lg:overflow-y-auto">{children}</div>
      </div>

      {!selectedId && (
        <Link prefetch={false} href={`${base}/new`} aria-label={`New ${info.singular}`}
          className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#0f766e] text-white shadow-lg shadow-[#0f766e]/30 transition-transform active:scale-95 lg:hidden">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
        </Link>
      )}

      <BottomSheet open={mSheet === "filter"} onClose={() => setMSheet(null)} title="Filter">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Default filters</p>
        <ul className="space-y-0.5">
          {allViews.map((v, i) => {
            const on = v.id === view.id;
            return (
              <li key={v.id}>
                {i === BUILTIN_VIEWS[module].length && <p className="mb-2 mt-4 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Custom views</p>}
                <button type="button" onClick={() => { switchView(v.id); setMSheet(null); }}
                  className={sheetItem(on)}>
                  {shortViewName(module, v)}
                  {on && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0f766e] text-white"><svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg></span>}
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
      {mSheet === "sort" && (
        <MobileSortSheet open onClose={() => setMSheet(null)} sort={sort} dir={dir} options={SORTS[module]}
          onApply={(value, d) => { setParams({ sort: value, dir: d }); setMSheet(null); }} />
      )}

      <BottomSheet open={mSheet === "more"} onClose={() => setMSheet(null)} title="More">
        <div className="space-y-1">
          <button type="button" onClick={() => { setMSheet(null); openExport("all"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] text-slate-700 transition-all hover:bg-[#f6fbfa] active:scale-[0.98] active:bg-[#e9f7f4]">
            <svg viewBox="0 0 20 20" className="h-5 w-5 text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M10 12V3m0 0L6.5 6.5M10 3l3.5 3.5M4 14v1.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V14" strokeLinecap="round" strokeLinejoin="round" /></svg>Export all {info.plural.toLowerCase()}
          </button>
          <button type="button" onClick={() => { setMSheet(null); openExport("view"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] text-slate-700 transition-all hover:bg-[#f6fbfa] active:scale-[0.98] active:bg-[#e9f7f4]">
            <svg viewBox="0 0 20 20" className="h-5 w-5 text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M10 12V3m0 0L6.5 6.5M10 3l3.5 3.5M4 14v1.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V14" strokeLinecap="round" strokeLinejoin="round" /></svg>Export this view ({list.length})
          </button>
          <button type="button" onClick={() => { setMSheet(null); router.push(`${base}/import`); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] text-slate-700 transition-all hover:bg-[#f6fbfa] active:scale-[0.98] active:bg-[#e9f7f4]">
            <svg viewBox="0 0 20 20" className="h-5 w-5 text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M10 3v9m0 0-3.5-3.5M10 12l3.5-3.5M4 14v1.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V14" strokeLinecap="round" strokeLinejoin="round" /></svg>Import {info.plural.toLowerCase()} (CSV)
          </button>
          <p className="px-3 pt-1 text-[13px] text-slate-500">CSV or Excel. Your data is always yours: download it any time.</p>
        </div>
      </BottomSheet>
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} initialModule={module === "items" ? "Items" : "Coupons"} defaultScope={exportScope}
        view={{ module: module === "items" ? "Items" : "Coupons", label: shortViewName(module, view), ids: list.map((r) => r.id), columns: view.columns }} />
      {module === "items" && <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onCode={onScan} />}
      {toast && <div role="status" className="fixed bottom-6 left-1/2 z-[95] -translate-x-1/2 rounded-xl bg-[#0b1f3a] px-4 py-2.5 text-sm text-white shadow-xl animate-[bp-fade_0.2s_ease-out]">{toast}</div>}
      {module === "items" && <ItemPrefsModal open={prefsOpen} companyId={companyId} onClose={() => setPrefsOpen(false)} />}
    </div>
  );
}

function Cell({ module, r, k, align, base }: { module: CatalogModule; r: Row; k: string; align?: "right"; base: string }) {
  const td = `truncate border-b border-slate-100 px-3 py-3 ${align === "right" ? "text-right tabular-nums" : ""}`;
  if (k === "name") {
    const it = r as Item;
    return (
      <td className={td}>
        <Link prefetch={false} href={`${base}/${r.id}`} onClick={(e) => e.stopPropagation()} className="flex min-w-0 items-center gap-3 font-medium text-[#0f766e] hover:underline">
          {module === "items" && (it.image_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={it.image_url} alt="" className="h-9 w-9 shrink-0 rounded-md border border-slate-200 object-cover" />
            : <NoImage />)}
          <span className="truncate">{(r as Item).name}</span>
        </Link>
      </td>
    );
  }
  if (module === "coupons" && k === "status") {
    const s = couponStatus(r as CouponRow);
    return <td className={`${td} font-medium ${STATUS_TONE[s.tone]}`}>{s.label}</td>;
  }
  if (module === "items" && k === "status") {
    const on = (r as Item).is_active;
    return <td className={`${td} font-medium ${on ? "text-[#16a34a]" : "text-slate-400"}`}>{on ? "Active" : "Inactive"}</td>;
  }
  const text = displayValue(module, r, k);
  return <td className={`${td} ${k === "rate" || k === "discount" ? "font-medium text-[#0b1f3a]" : "text-slate-600"}`} title={text}>{text || <span className="text-slate-300">—</span>}</td>;
}

function CompactRow({ module, r, active, base, checked, onCheck }: {
  module: CatalogModule; r: Row; active: boolean; base: string; checked?: boolean; onCheck?: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => { if (active) ref.current?.scrollIntoView({ block: "nearest" }); }, [active]);
  const isItem = module === "items";
  const it = r as Item; const c = r as CouponRow;
  const s = !isItem ? couponStatus(c) : null;
  return (
    <li ref={ref} className={`relative flex items-start gap-3 px-4 py-3 transition-colors ${active ? "bg-[#d7f1eb] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[#0f766e]" : "hover:bg-[#f0faf7]"}`}>
      {onCheck && <input type="checkbox" checked={checked} onChange={onCheck} aria-label="Select" className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded accent-[#0f766e]" />}
      <Link prefetch={false} href={`${base}/${r.id}`} className="flex min-w-0 flex-1 items-start justify-between gap-3">
        <span className="min-w-0">
          <span className={`block truncate font-medium ${active ? "text-[#0f766e]" : "text-[#0b1f3a]"}`}>{(r as Item).name}</span>
          {isItem ? (
            <span className="block truncate text-xs text-slate-500">{[it.sku, it.item_type === "goods" ? "Goods" : "Service", !it.is_active && "Inactive"].filter(Boolean).join(" · ")}</span>
          ) : (
            <>
              <span className="block text-xs text-slate-500">{c.code}</span>
              <span className={`block text-[11px] font-semibold uppercase tracking-wide ${STATUS_TONE[s!.tone]}`}>{s!.label}</span>
            </>
          )}
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-medium tabular-nums text-[#0b1f3a]">{isItem ? usd(it.selling_price) : discountLabel(c)}</span>
          {!isItem && <span className="block text-xs text-slate-500">{displayValue("coupons", c, "redemption")}</span>}
        </span>
      </Link>
    </li>
  );
}

function Empty({ module, filtered, base }: { module: CatalogModule; filtered: boolean; base: string }) {
  const isItem = module === "items";
  return (
    <div className="px-6 py-20 text-center">
      {filtered ? (
        <>
          <p className="text-lg font-semibold text-[#0b1f3a]">Nothing in this view</p>
          <p className="mx-auto mt-1 max-w-md text-[15px] text-slate-500">Try another view or clear the search.</p>
        </>
      ) : (
        <>
          <p className="text-lg font-semibold text-[#0b1f3a]">{isItem ? "Add your first item" : "Create your first coupon"}</p>
          <p className="mx-auto mt-1 max-w-md text-[15px] text-slate-500">
            {isItem ? "Save the products and services you sell, like a tune-up, a capacitor or an hour of labor, so quotes and invoices fill in by themselves." : "Give customers a discount code, like $25 off a tune-up or 10% off a maintenance plan."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link prefetch={false} href={`${base}/new`} className="rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59]">{isItem ? "New Item" : "New Coupon"}</Link>
            <Link prefetch={false} href={`${base}/import`} className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50">Import from CSV</Link>
          </div>
        </>
      )}
    </div>
  );
}
