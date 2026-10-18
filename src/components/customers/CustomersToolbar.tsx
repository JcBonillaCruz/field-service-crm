"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, MenuButton, MenuHeading, MenuItem, MenuItems, MenuSection, MenuSeparator } from "@headlessui/react";
import { ListParams, SORTS, VIEWS, listQueryString } from "@/lib/customer-list";
import { primaryButton } from "@/components/customers/ui";

const menuPanel =
  "z-50 mt-2 rounded-xl border border-slate-200 bg-white py-1.5 shadow-[0_12px_40px_rgba(15,40,60,0.14)] focus:outline-none " +
  "origin-top transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0";
const menuItem =
  "flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-slate-700 data-[focus]:bg-[#f0faf7] data-[focus]:text-[#0b1f3a]";
const heading = "px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400";

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function CustomersToolbar({
  params,
  total,
  canImport,
  canExport,
}: {
  params: ListParams;
  total: number;
  canImport: boolean;
  canExport: boolean;
}) {
  const router = useRouter();
  const view = VIEWS.find((v) => v.value === params.view) ?? VIEWS[0];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <Menu>
          <MenuButton className="group flex items-center gap-2 rounded-lg py-1 text-2xl font-semibold tracking-tight text-[#0b1f3a] focus:outline-none sm:text-3xl">
            {view.label}
            <svg viewBox="0 0 20 20" className="h-5 w-5 text-[#0f766e] transition-transform group-data-[open]:rotate-180" fill="currentColor" aria-hidden="true">
              <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
            </svg>
          </MenuButton>
          <MenuItems anchor="bottom start" transition className={`${menuPanel} w-56`}>
            {VIEWS.map((v) => (
              <MenuItem key={v.value}>
                <Link href={`/dashboard/customers${listQueryString({ ...params, view: v.value })}`} className={`${menuItem} justify-between`}>
                  {v.label}
                  {v.value === view.value && (
                    <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#0f766e]" fill="currentColor" aria-hidden="true">
                      <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" />
                    </svg>
                  )}
                </Link>
              </MenuItem>
            ))}
          </MenuItems>
        </Menu>
        <p className="mt-0.5 text-sm text-slate-500">{total} {total === 1 ? "customer" : "customers"}</p>
      </div>

      <div className="flex items-center gap-2">
        <Link href="/dashboard/customers/new" className={primaryButton}>+ New</Link>
        <Menu>
          <MenuButton aria-label="More actions"
            className="flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus:outline-none data-[open]:border-[#0f766e] data-[open]:text-[#0f766e]">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              <circle cx="4.5" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="15.5" cy="10" r="1.6" />
            </svg>
          </MenuButton>
          <MenuItems anchor="bottom end" transition className={`${menuPanel} w-64`}>
            <MenuSection>
              <MenuHeading className={heading}>Sort by</MenuHeading>
              {SORTS.map((s) => {
                const active = params.sort === s.value;
                const dir = active ? (params.dir === "asc" ? "desc" : "asc") : s.value === "created" ? "desc" : "asc";
                return (
                  <MenuItem key={s.value}>
                    <Link href={`/dashboard/customers${listQueryString({ ...params, sort: s.value, dir })}`}
                      className={`${menuItem} justify-between ${active ? "font-semibold text-[#0f766e]" : ""}`}>
                      {s.label}
                      {active && (
                        <svg viewBox="0 0 20 20" className={`h-4 w-4 ${params.dir === "desc" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-label={params.dir === "asc" ? "Ascending" : "Descending"}>
                          <path d="M10 15V5m0 0-4 4m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </Link>
                  </MenuItem>
                );
              })}
            </MenuSection>

            {(canImport || canExport) && <MenuSeparator className="my-1.5 h-px bg-slate-100" />}

            {canImport && (
              <MenuSection>
                <MenuHeading className={heading}>Import</MenuHeading>
                <MenuItem>
                  <Link href="/dashboard/customers/import" className={menuItem}>
                    <Icon d="M10 3v10m0 0-4-4m4 4 4-4M4 15v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1" />
                    Import customers
                  </Link>
                </MenuItem>
              </MenuSection>
            )}

            {canExport && (
              <MenuSection>
                <MenuHeading className={heading}>Export</MenuHeading>
                <MenuItem>
                  <a href="/dashboard/customers/export" download className={menuItem}>
                    <Icon d="M10 13V3m0 0L6 7m4-4 4 4M4 15v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1" />
                    Export all customers
                  </a>
                </MenuItem>
                <MenuItem>
                  <a href={`/dashboard/customers/export${listQueryString(params) ? listQueryString(params) + "&" : "?"}scope=view`} download className={menuItem}>
                    <Icon d="M3 5h14M6 10h8m-5 5h2" />
                    Export current view
                  </a>
                </MenuItem>
              </MenuSection>
            )}

            <MenuSeparator className="my-1.5 h-px bg-slate-100" />
            <MenuItem>
              <button type="button" onClick={() => router.refresh()} className={menuItem}>
                <Icon d="M16 10a6 6 0 1 1-1.8-4.3M16 4v3.5h-3.5" />
                Refresh list
              </button>
            </MenuItem>
          </MenuItems>
        </Menu>
      </div>
    </div>
  );
}
