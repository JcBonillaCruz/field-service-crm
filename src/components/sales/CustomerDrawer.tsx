"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/sales-client";
import { SalesDoc, addressLines, balanceOf, docStatus, fmtD, money } from "@/lib/sales";
import BottomSheet from "@/components/customers/BottomSheet";
import { Initials } from "@/components/sales/CustomerSelect";
import { StatusPill, XButton } from "@/components/sales/SalesBits";

type Info = {
  customer: { id: string; display_name: string; company_name: string | null; customer_type: string; payment_terms: string | null; currency: string | null; email: string | null } | null;
  addresses: { id: string; label: string | null; street: string; unit: string | null; city: string; state: string | null; zip: string | null; country: string | null; is_primary: boolean }[];
  emails: { email: string; is_primary: boolean }[];
  phones: { number: string; label: string }[];
  docs: SalesDoc[];
};
type Section = "unpaid" | "address" | "details" | "contacts";

const I = {
  pin: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-3.3 3.6-6 8-6s8 2.7 8 6",
  bill: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z",
  ext: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
};
const Svg = ({ d, cls = "h-[18px] w-[18px]" }: { d: string; cls?: string }) => (
  <svg viewBox="0 0 24 24" className={`shrink-0 ${cls}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

// Sección desplegable (como Zoho en el celular)
function Fold({ icon, title, count, open, onToggle, children }: { icon: string; title: string; count?: number; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-[#f3fbf8]">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef8f5] text-[#0f766e]"><Svg d={icon} /></span>
        <span className="flex-1 text-[15px] font-semibold text-[#0b1f3a]">{title}{count != null && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">{count}</span>}</span>
        <svg viewBox="0 0 20 20" className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </button>
      {open && <div className="border-t border-slate-100 px-4 py-3 animate-[bp-fade_0.2s_ease-out]">{children}</div>}
    </div>
  );
}

export default function CustomerDrawer({ customerId }: { customerId: string | null }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"details" | "activity">("details");
  const [folds, setFolds] = useState<Record<Section, boolean>>({ unpaid: true, address: false, details: true, contacts: false });
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const on = () => setMobile(mq.matches); on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

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
        s.from("sales_docs").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(100),
      ]);
      if (alive) setInfo({ customer: customer as Info["customer"], addresses: (addresses ?? []) as Info["addresses"], emails: emails ?? [], phones: phones ?? [], docs: (docs ?? []) as SalesDoc[] });
    })();
    return () => { alive = false; };
  }, [customerId]);

  if (!customerId || !info?.customer) return null;
  const c = info.customer;
  const invoices = info.docs.filter((d) => d.kind === "invoice" && !["draft", "void"].includes(d.status));
  const unpaid = invoices.filter((d) => balanceOf(d) > 0 && d.status !== "written_off");
  const owed = unpaid.reduce((s, d) => s + balanceOf(d), 0);
  const paid = invoices.reduce((s, d) => s + Number(d.amount_paid), 0);
  const quotes = info.docs.filter((d) => d.kind === "quote").length;
  const emails = info.emails.length ? info.emails.map((e) => e.email) : c.email ? [c.email] : [];
  const show = (sec: Section) => { setFolds((f) => ({ ...f, [sec]: true })); setTab("details"); setOpen(true); };
  const toggle = (sec: Section) => setFolds((f) => ({ ...f, [sec]: !f[sec] }));

  const metrics = (
    <div className="grid grid-cols-2 gap-2.5">
      {([
        ["Outstanding", money(owed), "bg-[#fff7ec] text-[#b45309]", unpaid.length ? `${unpaid.length} unpaid` : "All paid"],
        ["Paid to date", money(paid), "bg-[#eef8f5] text-[#0f766e]", `${invoices.length} ${invoices.length === 1 ? "invoice" : "invoices"}`],
      ] as const).map(([l, v, tone, sub]) => (
        <div key={l} className={`rounded-2xl px-4 py-3 ${tone.split(" ")[0]}`}>
          <p className={`text-[12px] font-medium ${tone.split(" ")[1]}`}>{l}</p>
          <p className="mt-0.5 text-[20px] font-semibold tabular-nums text-[#0b1f3a]">{v}</p>
          <p className="text-[11px] text-slate-500">{sub}</p>
        </div>
      ))}
    </div>
  );
  const unpaidList = unpaid.length === 0 ? <p className="py-2 text-sm text-slate-500">No unpaid invoices.</p> : (
    <ul className="-mx-1 divide-y divide-slate-100">
      {unpaid.map((d) => (
        <li key={d.id}>
          <Link href={`/dashboard/invoices/${d.id}`} className="flex items-center justify-between gap-3 rounded-lg px-1 py-2.5 hover:bg-[#f6fbfa]">
            <span><span className="block text-[14px] font-medium text-[#0f766e]">{d.number}</span><span className="text-xs text-slate-500">Due {fmtD(d.due_date)}</span></span>
            <span className="text-right"><span className="block text-[14px] font-semibold tabular-nums">{money(balanceOf(d))}</span><StatusPill s={docStatus(d)} small /></span>
          </Link>
        </li>
      ))}
    </ul>
  );
  const addressList = info.addresses.length === 0 ? <p className="py-2 text-sm text-slate-500">No addresses yet.</p> : (
    <div className="space-y-3">
      {info.addresses.map((a) => (
        <div key={a.id} className="text-[14px]">
          <p className="text-[12px] font-semibold text-[#0f766e]">{a.is_primary ? "Billing address" : a.label || "Job site"}</p>
          {addressLines(a).map((l, i) => <p key={i} className="text-slate-700">{l}</p>)}
        </div>
      ))}
    </div>
  );
  const detailRows = (
    <dl className="space-y-2 text-[14px]">
      {[["Customer Type", c.customer_type === "commercial" ? "Business" : "Residential"], ["Company", c.company_name ?? ""], ["Currency", c.currency || "USD"],
        ["Payment Terms", c.payment_terms || "Due on Receipt"], ["Quotes", String(quotes)], ["Invoices", String(invoices.length)]].filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="text-right text-[#0b1f3a]">{v}</dd></div>
      ))}
    </dl>
  );
  const contactRows = (
    <div className="space-y-2 text-[14px]">
      {emails.map((e) => <p key={e} className="flex items-center gap-2 text-slate-700"><Svg d={I.mail} cls="h-4 w-4 text-slate-400" />{e}</p>)}
      {info.phones.map((p, i) => <p key={i} className="flex items-center gap-2 text-slate-700"><Svg d={I.phone} cls="h-4 w-4 text-slate-400" />{p.number} <span className="text-xs text-slate-400">{p.label}</span></p>)}
      {!emails.length && !info.phones.length && <p className="text-slate-500">No contact details yet.</p>}
    </div>
  );
  const folds$ = (
    <div className="space-y-2.5">
      <Fold icon={I.bill} title="Unpaid Invoices" count={unpaid.length} open={folds.unpaid} onToggle={() => toggle("unpaid")}>{unpaidList}</Fold>
      <Fold icon={I.pin} title="Address" count={info.addresses.length} open={folds.address} onToggle={() => toggle("address")}>{addressList}</Fold>
      <Fold icon={I.grid} title="Other Details" open={folds.details} onToggle={() => toggle("details")}>{detailRows}</Fold>
      <Fold icon={I.user} title="Contact Details" open={folds.contacts} onToggle={() => toggle("contacts")}>{contactRows}</Fold>
    </div>
  );
  const activity = info.docs.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No quotes or invoices yet.</p> : (
    <ul className="divide-y divide-slate-100">
      {info.docs.slice(0, 25).map((d) => (
        <li key={d.id}>
          <Link href={`/dashboard/${d.kind === "quote" ? "quotes" : "invoices"}/${d.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-[#f6fbfa]">
            <span><span className="block text-[14px] text-[#0b1f3a]">{d.kind === "quote" ? "Quote" : "Invoice"} <b className="font-medium text-[#0f766e]">{d.number}</b></span><span className="text-xs text-slate-500">{fmtD(d.doc_date)}</span></span>
            <span className="text-right"><span className="block tabular-nums">{money(d.total)}</span><StatusPill s={docStatus(d)} small /></span>
          </Link>
        </li>
      ))}
    </ul>
  );

  // Un solo enlace (solo celular): abre toda la información del cliente
  const links = (
    <button type="button" onClick={() => show("unpaid")} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#eef8f5] px-3 py-1.5 text-[13px] font-medium text-[#0f766e] active:scale-[0.98]">
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="7" r="3" /><path d="M4 17a6 6 0 0 1 12 0" strokeLinecap="round" /></svg>
      Customer Details{unpaid.length ? <span className="rounded-full bg-[#fff1f2] px-1.5 text-[11px] font-semibold text-[#e11d48]">{unpaid.length} unpaid</span> : null}
    </button>
  );

  // ---------- Celular: hoja de abajo con secciones desplegables ----------
  if (mobile) {
    return (
      <>
        {links}
        <BottomSheet open={open} onClose={() => setOpen(false)} title={c.display_name}>
          <div className="space-y-3 pb-2">
            {metrics}
            {folds$}
            <Link href={`/dashboard/customers/${c.id}`} className="block pt-1 text-center text-sm font-medium text-[#0f766e]">Open customer record →</Link>
          </div>
        </BottomSheet>
      </>
    );
  }

  // ---------- Computadora: pestañita + panel suave a la derecha ----------
  const W = "min(440px, 100vw)";
  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{ right: open ? W : "0px" }}
        className="group fixed top-[8.5rem] z-[61] flex max-w-[17rem] items-center gap-3 rounded-l-xl bg-[#0b1f3a] py-2.5 pl-4 pr-3 text-left text-white shadow-[-6px_6px_20px_rgba(11,31,58,0.25)] transition-[right] duration-300 ease-out hover:bg-[#13294b]">
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold">{c.display_name}</span>
          <span className="flex items-center gap-1 text-[12px] text-white/75">{unpaid.length} Unpaid {unpaid.length === 1 ? "Invoice" : "Invoices"}</span>
        </span>
        <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : "group-hover:translate-x-0.5"}`} fill="currentColor"><path d="M7.3 5.3a1 1 0 0 1 1.4 0l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 0 1-1.4-1.4L10.6 10 7.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
      </button>
      <aside style={{ width: W, transform: open ? "translateX(0)" : "translateX(100%)" }}
        className="fixed bottom-0 right-0 top-16 z-[60] flex flex-col border-l border-slate-200 bg-[#fbfcfc] shadow-[-12px_0_40px_rgba(15,40,60,0.10)] transition-transform duration-300 ease-out">
        <div className="flex items-start gap-3 border-b border-slate-100 bg-white px-5 py-4">
          <Initials name={c.display_name} seed={c.id} size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Customer</p>
            <Link href={`/dashboard/customers/${c.id}`} className="flex items-center gap-1.5 text-[17px] font-semibold text-[#0b1f3a] hover:text-[#0f766e]">
              <span className="truncate">{c.display_name}</span><Svg d={I.ext} cls="h-4 w-4 text-[#0f766e]" />
            </Link>
            {emails[0] && <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-slate-500"><Svg d={I.mail} cls="h-3.5 w-3.5" />{emails[0]}</p>}
          </div>
          <XButton onClick={() => setOpen(false)} />
        </div>
        <div className="flex gap-6 border-b border-slate-100 bg-white px-5">
          {(["details", "activity"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`relative py-3 text-[14px] ${tab === k ? "font-semibold text-[#0f766e]" : "text-slate-500 hover:text-[#0b1f3a]"}`}>
              {k === "details" ? "Details" : "Activity Log"}<span className={`absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-[#0f766e] transition-transform ${tab === k ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {tab === "details" ? <>{metrics}{folds$}</> : <div className="rounded-2xl border border-slate-200 bg-white px-4">{activity}</div>}
        </div>
      </aside>
    </>
  );
}
