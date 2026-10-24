"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { downloadJson } from "@/lib/confirm";
import CompanyBadge from "@/components/CompanyBadge";
import CompanyEditModal from "@/components/CompanyEditModal";
import { CompanySummary, ROLE_LABEL } from "@/lib/types";

// Copia de respaldo de una organización (clientes, ventas, catálogo y dinero) antes de borrarla
async function companyBackup(id: string) {
  const s = createClient();
  const pick = async (t: string) => (await s.from(t).select("*").eq("company_id", id).limit(20000)).data ?? [];
  const [company, customers, sales_docs, subscriptions, items, coupons, expenses, other_income] = await Promise.all([
    s.from("companies").select("*").eq("id", id).maybeSingle().then((r) => r.data),
    pick("customers"), pick("sales_docs"), pick("subscriptions"), pick("items"), pick("coupons"), pick("expenses"), pick("other_income"),
  ]);
  return { company, customers, sales_docs, subscriptions, items, coupons, expenses, other_income, exported_at: new Date().toISOString() };
}

// Botón de ícono con su propia animación al pasar el mouse
function IconBtn({ label, onClick, tone, children }: { label: string; onClick: () => void; tone: "teal" | "slate" | "red"; children: React.ReactNode }) {
  const t = tone === "red" ? "text-[#e11d48] hover:bg-[#fff1f2] hover:border-[#fecdd3]" : tone === "teal" ? "text-[#0f766e] hover:bg-[#e9f7f4] hover:border-[#bfe7de]" : "text-slate-600 hover:bg-slate-50 hover:border-slate-300";
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={label} title={label}
      className={`group/ib flex h-9 w-9 items-center justify-center rounded-xl border border-transparent transition-all duration-200 hover:-translate-y-0.5 active:scale-90 ${t}`}>
      {children}
    </button>
  );
}

export default function OrganizationList({ companies, currentId, userId, onOpen, compact = false }: {
  companies: CompanySummary[]; currentId: string | null; userId: string; onOpen: (id: string) => void; compact?: boolean;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<{ id: string; name: string; kind: "delete" | "leave" } | null>(null);
  const [text, setText] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function reset() { setConfirm(null); setText(""); setAgree(false); setSaved(false); setError(""); }
  async function backup(id: string, name: string) { setBusy(true); try { downloadJson(name, await companyBackup(id)); setSaved(true); } finally { setBusy(false); } }
  async function doConfirm() {
    if (!confirm) return;
    if (text.trim() !== confirm.name) return setError("The name doesn't match.");
    setBusy(true); setError("");
    const s = createClient();
    const { error } = confirm.kind === "delete"
      ? await s.from("companies").delete().eq("id", confirm.id)
      : await s.from("company_members").delete().eq("company_id", confirm.id).eq("user_id", userId);
    setBusy(false);
    if (error) return setError(confirm.kind === "delete" ? "Couldn't delete. Try again." : "Couldn't leave. Try again.");
    reset(); router.refresh();
  }

  return (
    <>
      <ul className="space-y-1">
        {companies.length === 0 && <li className="px-3 text-sm text-slate-500">No organizations yet.</li>}
        {companies.map((c, i) => {
          const isCurrent = c.id === currentId;
          const canEdit = c.role === "owner" || c.role === "manager";
          if (confirm?.id === c.id) return (
            <li key={c.id} className="rounded-2xl border border-[#fecdd3] bg-[#fff7f7] px-4 py-3.5 animate-[bp-fade_0.2s_ease-out]">
              <p className="text-[14px] font-semibold text-[#0b1f3a]">{confirm.kind === "delete" ? `Delete ${c.name}?` : `Leave ${c.name}?`}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
                {confirm.kind === "delete" ? "This permanently deletes the organization with all its customers, quotes, invoices and money records. It can't be recovered. People with access to it keep their own accounts." : "You'll lose access to this organization."}
              </p>
              {confirm.kind === "delete" && (
                <button type="button" disabled={busy} onClick={() => backup(c.id, c.name)}
                  className="mt-3 flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-[13px] font-semibold text-[#0f766e] hover:bg-[#f3fbf8] disabled:opacity-60">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3v10m0 0-3.5-3.5M10 13l3.5-3.5M4 16h12" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {saved ? "Backup downloaded ✓" : busy ? "Preparing backup…" : "Download a backup first (optional)"}
                </button>
              )}
              <p className="mt-3 text-[12px] text-slate-500">Type <b className="text-slate-700">{c.name}</b> to confirm:</p>
              <input autoFocus value={text} onChange={(e) => setText(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none" />
              <label className="mt-2 flex items-start gap-2 text-[12px] text-slate-600"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 accent-[#e11d48]" />I understand this is permanent and under my responsibility.</label>
              {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={busy || !agree} onClick={doConfirm} className="rounded-lg bg-[#e11d48] px-4 py-2 text-sm font-semibold text-white hover:bg-[#be123c] disabled:opacity-40">{confirm.kind === "delete" ? "Delete forever" : "Leave"}</button>
                <button type="button" onClick={reset} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              </div>
            </li>
          );
          return (
            <li key={c.id}
              className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors duration-150 hover:bg-[#e3f5f0] ${isCurrent ? "bg-[#f0faf7]" : ""}`}>
              <button type="button" onClick={() => onOpen(c.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <CompanyBadge id={c.id} name={c.name} index={i} size={compact ? 34 : 40} logoUrl={c.logoUrl} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-slate-800">{c.name}</span>
                    {isCurrent && <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#0f766e]" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>}
                  </span>
                  <span className="block truncate text-xs text-slate-500">{compact ? (c.industry ?? "Business") : `ID ${c.id.slice(0, 8)}`} · {ROLE_LABEL[c.role]}</span>
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-0.5">
                <IconBtn label="Open" tone="slate" onClick={() => onOpen(c.id)}>
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] transition-transform duration-300 group-hover/ib:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M3.5 12h11M10.5 8l4 4-4 4" /></svg>
                </IconBtn>
                {canEdit && (
                  <IconBtn label="Edit" tone="teal" onClick={() => setEditId(c.id)}>
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] origin-bottom-left group-hover/ib:animate-[bp-wiggle_0.6s_ease-in-out]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4" /></svg>
                  </IconBtn>
                )}
                {c.role === "owner" ? (
                  <IconBtn label="Delete" tone="red" onClick={() => { reset(); setConfirm({ id: c.id, name: c.name, kind: "delete" }); }}>
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path className="origin-[18px_6px] transition-transform duration-300 group-hover/ib:-rotate-[18deg] group-hover/ib:-translate-y-0.5" d="M4 6.5h16M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7" />
                      <path d="M6 6.5l.9 12.4c.1 1 .9 1.6 1.8 1.6h6.6c.9 0 1.7-.7 1.8-1.6L18 6.5M10 10.5v6M14 10.5v6" />
                    </svg>
                  </IconBtn>
                ) : (
                  <IconBtn label="Leave" tone="red" onClick={() => { reset(); setConfirm({ id: c.id, name: c.name, kind: "leave" }); }}>
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M20.5 12h-11M16.5 8l4 4-4 4" /></svg>
                  </IconBtn>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <CompanyEditModal companyId={editId} open={Boolean(editId)} onClose={() => setEditId(null)} />
    </>
  );
}

// Botón "Nueva organización": solo el círculo naranja de la marca + texto
export function NewOrgButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-[#fff4ec]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e8713a] text-white shadow-[0_6px_16px_rgba(232,113,58,0.35)] transition-transform duration-300 group-hover:rotate-90 group-active:scale-90">
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-[#0b1f3a]">New organization</span>
        <span className="block text-[12px] text-slate-500">Add another business with its own customers and invoices</span>
      </span>
    </button>
  );
}
