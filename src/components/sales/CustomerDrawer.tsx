"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/sales-client";
import { SalesDoc, addressLines, balanceOf, docStatus, fmtD, money } from "@/lib/sales";
import Avatar from "@/components/Avatar";
import { StatusPill, XButton } from "@/components/sales/SalesBits";

type Info = {
  customer: { id: string; display_name: string; company_name: string | null; customer_type: string; payment_terms: string | null; currency: string | null; email: string | null } | null;
  addresses: { id: string; label: string | null; street: string; unit: string | null; city: string; state: string | null; zip: string | null; country: string | null; is_primary: boolean }[];
  emails: { email: string; is_primary: boolean }[];
  phones: { number: string; label: string }[];
  docs: SalesDoc[];
};

// Pestañita oscura a la derecha: "David's Remodeling LLC · 1 Unpaid Invoices ›" (como Zoho)
export default function CustomerDrawer({ customerId }: { customerId: string | null }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"details" | "unpaid" | "address" | "activity">("details");

  useEffect(() => {
    setInfo(null);
    if (!customerId) return;
    let alive = true;
    (async () => {
      const s = db();
      const [{ data: customer }, { data: addresses }, { data: emails }, { data: phones }, { data: docs }] = await Promise.all([
        s.from("customers").select("id, display_name, company_name, customer_type, payment_terms, currency, email").eq("id", customerId).maybeSingle(),
        s.from("customer_addresses").select("id, label, street, unit, city, state, zip, country, is_primary").eq("customer_id", customerId).order("is_primary", { ascending: false }),
        s.from("customer_emails").select("email, is_primary").eq("customer_id", customerId),
        s.from("customer_phones").select("number, label").eq("customer_id", customerId),
        s.from("sales_docs").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(50),
      ]);
      if (alive) setInfo({ customer: customer as Info["customer"], addresses: (addresses ?? []) as Info["addresses"], emails: emails ?? [], phones: phones ?? [], docs: (docs ?? []) as SalesDoc[] });
    })();
    return () => { alive = false; };
  }, [customerId]);

  if (!customerId || !info?.customer) return null;
  const c = info.customer;
  const unpaid = info.docs.filter((d) => d.kind === "invoice" && !["draft", "void"].includes(d.status) && balanceOf(d) > 0);
  const owed = unpaid.reduce((s, d) => s + balanceOf(d), 0);

  const W = "min(500px, 100vw)";
  return (
    <>
      {/* Pestañita pegada al panel: se desliza junto con él */}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        style={{ right: open ? W : "0px" }}
        className="group fixed top-[8.5rem] z-[61] hidden max-w-[17rem] items-center gap-3 rounded-l-xl bg-[#0b1f3a] py-2.5 pl-4 pr-3 text-left text-white shadow-[-6px_6px_20px_rgba(11,31,58,0.25)] transition-[right] duration-300 ease-out hover:bg-[#13294b] lg:flex">
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold">{c.display_name}</span>
          <span className="flex items-center gap-1 text-[12px] text-white/75">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M10 3 18 17H2z" strokeLinejoin="round" /><path d="M10 8v4M10 14.5v.01" strokeLinecap="round" /></svg>
            {unpaid.length} Unpaid {unpaid.length === 1 ? "Invoice" : "Invoices"}
          </span>
        </span>
        <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : "group-hover:translate-x-0.5"}`} fill="currentColor"><path d="M7.3 5.3a1 1 0 0 1 1.4 0l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 0 1-1.4-1.4L10.6 10 7.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
      </button>
      {/* Como Zoho: Unpaid Invoices | Address | Customer Details */}
      <div className="mt-2 flex flex-wrap items-center text-[13px] font-medium text-[#0f766e]">
        {([["unpaid", `Unpaid Invoices${unpaid.length ? ` (${unpaid.length})` : ""}`], ["address", "Address"], ["details", "Customer Details"]] as const).map(([k, l], i) => (
          <span key={k} className="flex items-center">
            {i > 0 && <span className="mx-2.5 h-4 w-px bg-slate-300" />}
            <button type="button" onClick={() => { setTab(k); setOpen(true); }} className="rounded px-0.5 transition-colors hover:text-[#0b1f3a] hover:underline">{l}</button>
          </span>
        ))}
      </div>

      {open && <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="fixed inset-0 top-16 z-[59] cursor-default bg-slate-900/10" />}
      <aside style={{ width: W, transform: open ? "translateX(0)" : "translateX(100%)" }}
        className="fixed bottom-0 right-0 top-16 z-[60] flex flex-col border-l border-slate-200 bg-white shadow-[-12px_0_40px_rgba(15,40,60,0.16)] transition-transform duration-300 ease-out">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-[#0b1f3a] px-5 py-4 text-white">
          <Avatar name={c.display_name} url={null} seed={c.id} size={42} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] uppercase tracking-wide text-white/60">Customer</p>
            <p className="truncate text-lg font-semibold">{c.display_name}</p>
          </div>
          <XButton onClick={() => setOpen(false)} className="!text-white/70 hover:!bg-white/10 hover:!text-white" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 p-5">
          <div className="rounded-xl bg-[#fff6e0] p-3"><p className="text-[12px] text-[#b45309]">Outstanding Receivables</p><p className="text-lg font-semibold text-[#0b1f3a]">{money(owed)}</p></div>
          <div className="rounded-xl bg-[#e9f7f4] p-3"><p className="text-[12px] text-[#0f766e]">Payment Terms</p><p className="text-lg font-semibold text-[#0b1f3a]">{c.payment_terms || "Due on Receipt"}</p></div>
        </div>
        <div className="flex gap-5 overflow-x-auto border-b border-slate-200 px-5 [scrollbar-width:none]">
          {([["details", "Details"], ["unpaid", `Unpaid (${unpaid.length})`], ["address", "Address"], ["activity", "Activity"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`relative py-3 text-[14px] ${tab === k ? "font-semibold text-[#0f766e]" : "text-slate-600 hover:text-[#0b1f3a]"}`}>
              {l}<span className={`absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-[#0f766e] transition-transform ${tab === k ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === "details" && (
            <div className="space-y-5 text-[14px]">
              <div className="space-y-1">
                {c.company_name && <p><span className="text-slate-500">Company · </span>{c.company_name}</p>}
                <p><span className="text-slate-500">Type · </span>{c.customer_type === "commercial" ? "Commercial" : "Residential"}</p>
                <p><span className="text-slate-500">Currency · </span>{c.currency || "USD"}</p>
                {(info.emails.length ? info.emails.map((e) => e.email) : c.email ? [c.email] : []).map((e) => <p key={e}><span className="text-slate-500">Email · </span>{e}</p>)}
                {info.phones.map((p, i) => <p key={i}><span className="text-slate-500">{p.label} · </span>{p.number}</p>)}
              </div>
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Addresses ({info.addresses.length})</p>
                <div className="space-y-2">
                  {info.addresses.map((a) => (
                    <div key={a.id} className="rounded-xl border border-slate-200 p-3">
                      <p className="mb-0.5 text-[12px] font-medium text-[#0f766e]">{a.is_primary ? "Billing address" : a.label || "Job site"}</p>
                      {addressLines(a).map((l, i) => <p key={i} className="text-slate-700">{l}</p>)}
                    </div>
                  ))}
                  {!info.addresses.length && <p className="text-slate-400">No addresses yet.</p>}
                </div>
              </div>
              <Link href={`/dashboard/customers/${c.id}`} className="inline-block text-sm font-medium text-[#0f766e] hover:underline">Open customer record →</Link>
            </div>
          )}
          {tab === "address" && (
            <div className="space-y-2">
              {info.addresses.map((a) => (
                <div key={a.id} className="rounded-xl border border-slate-200 p-3 text-[14px]">
                  <p className="mb-0.5 text-[12px] font-medium text-[#0f766e]">{a.is_primary ? "Billing address" : a.label || "Job site"}</p>
                  {addressLines(a).map((l, i) => <p key={i} className="text-slate-700">{l}</p>)}
                </div>
              ))}
              {!info.addresses.length && <p className="py-6 text-center text-sm text-slate-500">No addresses yet.</p>}
            </div>
          )}
          {tab === "unpaid" && (unpaid.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No unpaid invoices.</p> : (
            <ul className="divide-y divide-slate-100">
              {unpaid.map((d) => (
                <li key={d.id}>
                  <Link href={`/dashboard/invoices/${d.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-[#f6fbfa]">
                    <span><span className="block font-medium text-[#0f766e]">{d.number}</span><span className="text-xs text-slate-500">Due {fmtD(d.due_date)}</span></span>
                    <span className="text-right"><span className="block font-semibold tabular-nums">{money(balanceOf(d))}</span><StatusPill s={docStatus(d)} small /></span>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
          {tab === "activity" && (info.docs.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No quotes or invoices yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {info.docs.slice(0, 20).map((d) => (
                <li key={d.id}>
                  <Link href={`/dashboard/${d.kind === "quote" ? "quotes" : "invoices"}/${d.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-[#f6fbfa]">
                    <span><span className="block text-[14px] text-[#0b1f3a]">{d.kind === "quote" ? "Quote" : "Invoice"} <b className="font-medium text-[#0f766e]">{d.number}</b></span><span className="text-xs text-slate-500">{fmtD(d.doc_date)}</span></span>
                    <span className="text-right"><span className="block tabular-nums">{money(d.total)}</span><StatusPill s={docStatus(d)} small /></span>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
        </div>
      </aside>
    </>
  );
}
