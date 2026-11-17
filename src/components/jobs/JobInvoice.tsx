"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { askConfirm } from "@/lib/confirm";
import { inputClass } from "@/components/customers/ui";
import { jobError, usd } from "@/lib/jobs";

// =====================================================================
// Paso 5.6 · Factura en borrador desde el trabajo + servicios del catálogo
//   · El técnico agrega servicios y crea el borrador; la oficina lo revisa y lo envía.
//   · Los precios solo llegan si "Technicians can see prices" está encendido (lo decide la base).
// =====================================================================
export type InvoiceState = {
  prices_visible: boolean; can_open: boolean; line_count: number; lines_total: number | null;
  started: boolean; cancelled: boolean; has_customer: boolean; pending: number;
  invoice: { id: string; number: string; status: string; is_draft: boolean; total: number | null; created_by_name: string | null; created_at: string } | null;
};
type Service = { id: string; name: string; unit: string | null; description: string | null; price: number | null };

// Ícono ilustrado (mismo estilo que los de formularios y archivos)
export function InvoiceArt({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#e3f6f1" />
      <g className="origin-center transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-95">
        <path d="M14 10h20v28l-3.3-2.2L27.3 38 24 35.8 20.7 38l-3.4-2.2L14 38z" fill="#fff" stroke="#0f766e" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M18.5 17h11M18.5 22h11M18.5 27h5" stroke="#9fd8cb" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="31" cy="29" r="5.6" fill="#e8713a" />
        <path d="M31 25.6v6.8M32.9 27.3c-.4-.6-1.1-.9-1.9-.9-1 0-1.8.5-1.8 1.3 0 1.9 3.9.9 3.9 2.8 0 .8-.9 1.3-2 1.3-.9 0-1.7-.4-2.1-1.1" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
export function ServiceArt({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#e9f1ff" />
      <g className="origin-center transition-transform duration-200 ease-out group-hover:rotate-[-10deg] group-hover:scale-110 group-active:scale-95">
        <path d="M30.5 12.5a7 7 0 0 0-8.8 8.8L12 31v5h5l9.7-9.7a7 7 0 0 0 8.8-8.8l-4.3 4.3-4-4z" fill="#fff" stroke="#2563eb" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="35" cy="34" r="6" fill="#14a39a" />
        <path d="M35 31v6M32 34h6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/40 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-[bp-sheet_0.22s_ease-out] sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[18px] font-semibold text-[#0b1f3a]">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-all hover:rotate-90 hover:bg-red-50 hover:text-red-600">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Agregar un servicio del catálogo al trabajo (las piezas de inventario se escanean de la van, no van aquí)
export function AddServiceSheet({ companyId, jobId, onClose, onDone }: { companyId: string; jobId: string; onClose: () => void; onDone: (msg: string) => void }) {
  const [list, setList] = useState<Service[] | null>(null);
  const [prices, setPrices] = useState(false);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Service | null>(null);
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    createClient().rpc("tech_services", { p_company: companyId }).then(({ data, error }) => {
      if (error) { setErr(jobError(error)); setList([]); return; }
      const d = data as { prices_visible: boolean; items: Service[] };
      setPrices(Boolean(d?.prices_visible)); setList(d?.items ?? []);
    });
  }, [companyId]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (list ?? []).filter((s) => !t || `${s.name} ${s.description ?? ""}`.toLowerCase().includes(t)).slice(0, 80);
  }, [list, q]);
  async function add() {
    if (!pick) return;
    const n = Number(qty);
    if (!n || n <= 0) return setErr("Enter how many.");
    setBusy(true); setErr("");
    const { error } = await createClient().rpc("tech_add_line", { p_job: jobId, p_item: pick.id, p_qty: n, p_note: note.trim() || null });
    setBusy(false);
    if (error) return setErr(error.hint || jobError(error));
    onDone(`Added ${n} × ${pick.name}`);
  }
  return (
    <Sheet title={pick ? "How many?" : "Add a service"} onClose={onClose}>
      {pick ? (
        <>
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <ServiceArt size={40} />
            <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold text-[#0b1f3a]">{pick.name}</span>
              {prices && pick.price != null && <span className="text-[12.5px] text-slate-500">{usd(pick.price)}{pick.unit ? ` / ${pick.unit}` : ""}</span>}</span>
          </div>
          <div className="mt-4 flex items-center justify-center gap-4">
            <button type="button" onClick={() => setQty(String(Math.max(1, (Number(qty) || 1) - 1)))} aria-label="Less" className="h-11 w-11 rounded-full border border-slate-200 text-[20px] text-slate-600 active:bg-slate-50">−</button>
            <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))} aria-label="Quantity" className="w-24 rounded-xl border border-slate-200 py-2 text-center text-[22px] font-semibold text-[#0b1f3a] focus:border-[#0f766e] focus:outline-none" />
            <button type="button" onClick={() => setQty(String((Number(qty) || 0) + 1))} aria-label="More" className="h-11 w-11 rounded-full border border-slate-200 text-[20px] text-slate-600 active:bg-slate-50">+</button>
          </div>
          {prices && pick.price != null && <p className="mt-2 text-center text-[13.5px] text-slate-500">Total <b className="text-[#0b1f3a]">{usd((Number(qty) || 0) * pick.price)}</b></p>}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the invoice (optional)" className={`${inputClass} mt-4`} />
          {err && <p className="mt-3 text-[13.5px] text-red-600">{err}</p>}
          <button type="button" onClick={add} disabled={busy} className="mt-4 w-full rounded-xl bg-[#0f766e] py-3 text-[15px] font-semibold text-white disabled:opacity-60">{busy ? "Adding..." : "Add to this job"}</button>
          <button type="button" onClick={() => { setPick(null); setErr(""); }} className="mt-2 w-full py-2 text-[14px] font-medium text-slate-500">Choose another service</button>
        </>
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search services" aria-label="Search services" className={inputClass} />
          {err && <p className="mt-2 text-[13.5px] text-red-600">{err}</p>}
          <div className="mt-3 max-h-[52dvh] divide-y divide-slate-100 overflow-y-auto">
            {list === null && <p className="py-6 text-center text-[14px] text-slate-400">Loading services…</p>}
            {list && shown.length === 0 && <p className="py-6 text-center text-[14px] text-slate-500">{list.length ? "No services match." : "There are no services in the catalog yet. The office adds them in Finances → Items."}</p>}
            {shown.map((s) => (
              <button key={s.id} type="button" onClick={() => { setPick(s); setQty("1"); setNote(""); setErr(""); }} className="group flex w-full items-center gap-3 py-2.5 text-left active:bg-slate-50">
                <ServiceArt size={34} />
                <span className="min-w-0 flex-1"><span className="block truncate text-[15px] text-[#0b1f3a]">{s.name}</span>
                  {s.description && <span className="block truncate text-[12px] text-slate-500">{s.description}</span>}</span>
                {prices && s.price != null && <span className="shrink-0 text-[13.5px] font-semibold text-slate-600">{usd(s.price)}</span>}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-slate-400">Parts from your van are added with “Use a part”.</p>
        </>
      )}
    </Sheet>
  );
}

const PILL: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600", sent: "bg-[#e9f1ff] text-[#1d4ed8]", viewed: "bg-[#e9f1ff] text-[#1d4ed8]", partial: "bg-[#fff7e6] text-[#b45309]",
  paid: "bg-[#eaf8ee] text-[#15803d]", void: "bg-slate-100 text-slate-500", overdue: "bg-[#fff1f2] text-[#be123c]",
};
const pillLabel = (s: string) => (s === "draft" ? "Draft" : s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()));

// Tarjeta de la factura dentro del trabajo.
//   variant "tech": pantalla del técnico (teléfono) · "office": aviso compacto en la ficha de oficina
export default function JobInvoice({ jobId, variant = "tech", visitId = null, refreshKey = 0, readOnly = false, onToast, onChanged }: {
  jobId: string; variant?: "tech" | "office"; visitId?: string | null; refreshKey?: number; readOnly?: boolean;
  onToast?: (m: string, err?: boolean) => void; onChanged?: () => void;
}) {
  const [s, setS] = useState<InvoiceState | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await createClient().rpc("job_invoice_state", { p_job: jobId });
    if (error) { setErr(jobError(error)); return; }
    setS(data as InvoiceState); setErr("");
  }, [jobId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  async function make() {
    if (!s) return;
    const creating = !s.invoice;
    if (creating && !(await askConfirm({
      title: "Create the draft invoice?",
      message: variant === "tech" ? "It copies the services and parts of this job. The office reviews it and sends it to the customer." : "It copies the services and materials of this job. You can edit it before sending.",
      confirmLabel: "Create draft", tone: "green",
    }))) return;
    setBusy(true); setErr("");
    const { data, error } = await createClient().rpc("job_invoice_make", { p_job: jobId });
    setBusy(false);
    if (error) { const m = error.hint || jobError(error); setErr(m); onToast?.(m, true); return; }
    const d = data as InvoiceState & { created: boolean; added: number };
    setS(d);
    // Aviso a la oficina (campana + push): hay una factura lista para revisar y enviar
    if (variant === "tech" && visitId && (d.created || d.added > 0)) {
      fetch("/api/jobs/tech-event", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitId, action: d.created ? "invoice" : "invoice_update" }) }).catch(() => null);
    }
    onToast?.(d.created ? `Draft invoice ${d.invoice?.number ?? ""} created. The office was notified.` : d.added > 0 ? `Draft invoice ${d.invoice?.number ?? ""} updated` : "The draft invoice is already up to date");
    onChanged?.();
  }

  if (!s) {
    if (variant === "office") return err ? <p className="mt-2 text-[12.5px] text-slate-400">{err}</p> : null;
    return err ? <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13.5px] text-slate-500">{err}</div> : null;
  }
  const inv = s.invoice;

  // ---------- Oficina: solo avisa cuando hay cosas del trabajo que no están en la factura ----------
  if (variant === "office") {
    if (!inv || s.pending === 0 || readOnly) return null;
    return (
      <div className="mt-3 rounded-xl border border-[#fde3b4] bg-[#fffaf0] px-3 py-2.5">
        <p className="text-[13px] text-[#92400e]"><b>{s.pending} item{s.pending === 1 ? "" : "s"}</b> of this job {s.pending === 1 ? "isn't" : "aren't"} on invoice {inv.number} yet.</p>
        {inv.is_draft
          ? <button type="button" onClick={make} disabled={busy} className="mt-2 rounded-lg bg-[#0f766e] px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-60">{busy ? "Updating..." : "Add to the draft invoice"}</button>
          : <p className="mt-1 text-[12.5px] text-[#92400e]">The invoice was already sent — add {s.pending === 1 ? "it" : "them"} on the invoice if you want to charge {s.pending === 1 ? "it" : "them"}.</p>}
        {err && <p className="mt-1.5 text-[12.5px] text-red-600">{err}</p>}
      </div>
    );
  }

  // ---------- Técnico ----------
  if (s.cancelled) return null;
  const why = !s.has_customer ? "This job has no customer yet. Ask the office to add it." : s.line_count === 0 ? "Add a service or use a part first." : !s.started && !s.can_open ? "Start the job to create the invoice." : "";
  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="group flex items-center gap-3">
        <InvoiceArt size={38} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-[#0b1f3a]">{inv ? `Invoice ${inv.number}` : "Invoice"}</p>
          {inv ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-slate-500">
              <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${PILL[inv.status] ?? PILL.draft}`}>{pillLabel(inv.status)}</span>
              {inv.is_draft ? "Waiting for the office to review and send" : "Sent by the office"}
            </p>
          ) : <p className="text-[12.5px] text-slate-500">When the work is done, create the draft. The office reviews it and sends it.</p>}
        </div>
        {s.prices_visible && (inv?.total ?? s.lines_total) != null && s.line_count > 0 && (
          <span className="shrink-0 text-right"><span className="block text-[11px] text-slate-400">{inv ? "Total" : "So far"}</span>
            <span className="text-[15px] font-semibold tabular-nums text-[#0b1f3a]">{usd(Number(inv?.total ?? s.lines_total))}</span></span>
        )}
      </div>

      {inv && s.pending > 0 && (
        <p className="mt-2.5 rounded-xl bg-[#fffaf0] px-3 py-2 text-[13px] text-[#92400e]">
          {s.pending} new item{s.pending === 1 ? "" : "s"} {s.pending === 1 ? "isn't" : "aren't"} on the invoice yet.{!inv.is_draft && " It was already sent — tell the office in the job chat."}
        </p>
      )}
      {err && <p className="mt-2 text-[13px] text-red-600">{err}</p>}

      {!readOnly && (
        <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
          {inv && s.can_open && <Link prefetch={false} href={`/dashboard/invoices/${inv.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-[#0f766e] active:bg-slate-50">Open invoice</Link>}
          {!inv && (why
            ? <p className="mr-auto text-[12.5px] text-slate-400">{why}</p>
            : <button type="button" onClick={make} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-[#0f766e] px-3 py-1.5 text-[13.5px] font-semibold text-white active:scale-95 disabled:opacity-60">
                {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}Create draft invoice</button>)}
          {inv && inv.is_draft && s.pending > 0 && (
            <button type="button" onClick={make} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-[#0f766e] px-3 py-1.5 text-[13.5px] font-semibold text-white active:scale-95 disabled:opacity-60">
              {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}Update draft</button>
          )}
        </div>
      )}
    </div>
  );
}
