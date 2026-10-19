"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import Avatar from "@/components/Avatar";
import CustomersActionsMenu from "@/components/customers/CustomersActionsMenu";
import SearchBox from "@/components/customers/SearchBox";
import ExportModal from "@/components/customers/ExportModal";
import { cityLine } from "@/lib/customers";
import { ListRow, VIEWS, filterSortCustomers, readListParams } from "@/lib/customer-list";

const dash = <span className="text-slate-300">—</span>;
const COLS = "md:grid-cols-[2fr_1.6fr_2fr_1.3fr_1.4fr]";

export default function CustomersWorkspace({
  customers,
  canImport,
  canExport,
  children,
}: {
  customers: ListRow[];
  canImport: boolean;
  canExport: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();
  const [exportOpen, setExportOpen] = useState(false);

  // IMPORTANTE: todos los hooks (incluido useMemo) van antes de cualquier return,
  // o React se rompe al cambiar entre la lista y el formulario.
  const m = pathname.match(/^\/dashboard\/customers\/([^/]+)$/);
  const selectedId = m && m[1] !== "new" && m[1] !== "import" && m[1] !== "edit" ? m[1] : null;

  const params = readListParams(Object.fromEntries(sp.entries()));
  const list = useMemo(() => filterSortCustomers(customers, params), [customers, params]);

  // Las pantallas de formulario ocupan todo (no llevan lista al lado)
  const isForm = pathname.endsWith("/new") || pathname.endsWith("/import") || pathname.endsWith("/edit");
  if (isForm) return <>{children}</>;
  const view = VIEWS.find((v) => v.value === params.view) ?? VIEWS[0];
  const filtered = Boolean(params.q) || params.view !== "all";


  function switchView(value: string) {
    const q = new URLSearchParams(sp.toString());
    if (value === "all") q.delete("view"); else q.set("view", value);
    const s = q.toString();
    router.replace(`${pathname}${s ? `?${s}` : ""}`, { scroll: false });
  }

  const listPane = selectedId
    ? "hidden w-full shrink-0 flex-col border-r border-slate-200 bg-white lg:flex lg:w-[340px]"
    : "flex w-full flex-col";
  const detailPane = selectedId ? "flex min-w-0 flex-1 flex-col bg-[#f4f6f8]" : "hidden";

  return (
    <div className="lg:flex lg:h-[calc(100vh-4rem)] lg:overflow-hidden">
      {/* ---------- LISTA ---------- */}
      <div className={listPane}>
        <div className={`shrink-0 border-b border-slate-100 ${selectedId ? "px-4 pt-4 pb-3" : "px-5 pt-6 pb-4 sm:px-8"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Menu>
                <MenuButton className={`group flex items-center gap-2 font-semibold tracking-tight text-[#0b1f3a] focus:outline-none ${selectedId ? "text-lg" : "text-2xl sm:text-3xl"}`}>
                  <span className="truncate">{view.label}</span>
                  <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-[#0f766e] transition-transform group-data-[open]:rotate-180" fill="currentColor" aria-hidden="true">
                    <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
                  </svg>
                </MenuButton>
                <MenuItems anchor="bottom start" transition
                  className="z-50 mt-1 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-[0_12px_40px_rgba(15,40,60,0.14)] transition duration-150 ease-out focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0">
                  {VIEWS.map((v) => (
                    <MenuItem key={v.value}>
                      <button type="button" onClick={() => switchView(v.value)}
                        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-slate-700 data-[focus]:bg-[#f0faf7] data-[focus]:text-[#0b1f3a]">
                        {v.label}
                        {v.value === view.value && (
                          <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#0f766e]" fill="currentColor" aria-hidden="true">
                            <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" />
                          </svg>
                        )}
                      </button>
                    </MenuItem>
                  ))}
                </MenuItems>
              </Menu>
              {!selectedId && <p className="mt-0.5 text-sm text-slate-500">{list.length} {list.length === 1 ? "customer" : "customers"}</p>}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {selectedId ? (
                <Link href="/dashboard/customers/new" aria-label="New customer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0f766e] text-white hover:bg-[#0c5f58]">
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 4v12M4 10h12" strokeLinecap="round" /></svg>
                </Link>
              ) : (
                <Link href="/dashboard/customers/new"
                  className="rounded-lg bg-[#0f766e] px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f58]">+ New</Link>
              )}
              <CustomersActionsMenu params={params} basePath={pathname} canImport={canImport} canExport={canExport} onExport={() => setExportOpen(true)} submenuSide={selectedId ? "right" : "left"} />
            </div>
          </div>

          <div className="mt-4">
            <SearchBox initial={params.q} />
          </div>
        </div>

        {/* filas */}
        <div className="min-h-0 flex-1 lg:overflow-y-auto">
          {list.length === 0 ? (
            <EmptyState filtered={filtered} />
          ) : selectedId ? (
            <ul className="divide-y divide-slate-100">
              {list.map((c) => <CompactRow key={c.id} c={c} active={c.id === selectedId} />)}
            </ul>
          ) : (
            <div className="px-5 pb-10 sm:px-8">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className={`hidden gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid ${COLS}`}>
                  <span>Name</span><span>Company name</span><span>Email</span><span>Phone</span><span>Location</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {list.map((c) => <WideRow key={c.id} c={c} />)}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------- FICHA ---------- */}
      <div className={detailPane}>
        <div className="min-h-0 flex-1 lg:overflow-y-auto">{children}</div>
      </div>

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}

function subtitle(c: ListRow) {
  const person = [c.first_name, c.last_name].filter(Boolean).join(" ");
  if (c.customer_type === "commercial") return c.company_name || person || "Commercial";
  return "Residential";
}

function CompactRow({ c, active }: { c: ListRow; active: boolean }) {
  return (
    <li className="group relative">
      <Link href={`/dashboard/customers/${c.id}`}
        className={`flex items-center gap-3 px-4 py-3 transition-colors ${active ? "bg-[#e9f7f4]" : "hover:bg-[#f6fbfa]"}`}>
        <Avatar name={c.display_name} url={null} seed={c.id} size={38} />
        <span className="min-w-0 flex-1 pr-8">
          <span className={`block truncate font-medium ${active ? "text-[#0f766e]" : "text-[#0b1f3a]"}`}>{c.display_name}</span>
          <span className="block truncate text-xs text-slate-500">{subtitle(c)}</span>
        </span>
      </Link>
      <QuickEdit id={c.id} name={c.display_name} className="right-2" />
    </li>
  );
}

function WideRow({ c }: { c: ListRow }) {
  const primary = c.customer_addresses.find((a) => a.is_primary) ?? c.customer_addresses[0];
  const more = c.customer_addresses.length - 1;
  const person = [c.first_name, c.last_name].filter(Boolean).join(" ");
  return (
    <li className="group relative">
      <Link href={`/dashboard/customers/${c.id}`}
        className={`grid gap-1 px-5 py-4 transition-colors hover:bg-[#f6fbfa] md:items-center md:gap-4 ${COLS}`}>
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={c.display_name} url={null} seed={c.id} size={36} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-[#0f766e]">{c.customer_type === "commercial" && person ? person : c.display_name}</span>
            <span className="block text-xs text-slate-500">{c.customer_type === "commercial" ? "Commercial" : "Residential"}</span>
          </span>
        </span>
        <span className="truncate pl-12 text-sm text-slate-700 md:pl-0">{c.company_name || <span className="hidden md:inline">{dash}</span>}</span>
        <span className="truncate pl-12 text-sm text-slate-600 md:pl-0">{c.email || <span className="hidden md:inline">{dash}</span>}</span>
        <span className="pl-12 text-sm text-slate-600 md:pl-0">{c.phone || <span className="hidden md:inline">{dash}</span>}</span>
        <span className="pl-12 text-sm text-slate-600 md:pl-0">
          {primary ? cityLine({ city: primary.city, state: primary.state, zip: null, country: primary.country }) : <span className="hidden md:inline">{dash}</span>}
          {more > 0 && <span className="ml-1 text-xs text-slate-400">+{more}</span>}
        </span>
      </Link>
      <QuickEdit id={c.id} name={c.display_name} className="right-4" />
    </li>
  );
}

// Lápiz de edición rápida que aparece al pasar el mouse por la fila
function QuickEdit({ id, name, className }: { id: string; name: string; className: string }) {
  return (
    <Link href={`/dashboard/customers/${id}/edit`} aria-label={`Edit ${name}`} title="Edit"
      className={`group/edit absolute top-1/2 hidden h-9 w-9 -translate-y-1/2 scale-90 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 opacity-0 shadow-sm transition-all duration-200 ease-out hover:scale-110 hover:border-[#14a39a] hover:bg-[#e9f7f4] hover:text-[#0f766e] hover:shadow-md focus-visible:opacity-100 group-hover:scale-100 group-hover:opacity-100 md:flex ${className}`}>
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] transition-transform duration-200 group-hover/edit:-rotate-12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="px-5 pb-10 sm:px-8">
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
        {filtered ? (
          <>
            <p className="font-semibold text-[#0b1f3a]">No customers found</p>
            <p className="mt-1 text-sm text-slate-500">Try a different search or view.</p>
          </>
        ) : (
          <>
            <p className="font-semibold text-[#0b1f3a]">No customers yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Add your first customer, or bring all of them at once from a CSV file.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/dashboard/customers/new" className="rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f58]">+ New customer</Link>
              <Link href="/dashboard/customers/import" className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50">Import from CSV</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
