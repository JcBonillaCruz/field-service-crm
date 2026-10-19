"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CompanyBadge from "@/components/CompanyBadge";
import { CompanySummary, ROLE_LABEL } from "@/lib/types";

export default function CompanySwitcher({
  companies, currentId, userId, onSwitch, onNewCompany,
}: {
  companies: CompanySummary[];
  currentId: string | null;
  userId: string;
  onSwitch: (id: string) => void;
  onNewCompany: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirm, setConfirm] = useState<{ id: string; name: string; kind: "delete" | "leave" } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const current = companies.find((c) => c.id === currentId) ?? null;

  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setMenuFor(null); } }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function reset() { setMenuFor(null); setRenameId(null); setConfirm(null); setConfirmText(""); setError(""); }

  async function saveRename(id: string) {
    const name = renameValue.trim();
    if (!name) return;
    setBusy(true); setError("");
    const { error } = await createClient().from("companies").update({ name }).eq("id", id);
    setBusy(false);
    if (error) return setError("Couldn't rename. Try again.");
    setRenameId(null); setMenuFor(null);
    router.refresh();
  }

  async function doConfirm() {
    if (!confirm) return;
    if (confirmText.trim() !== confirm.name) return setError("The name doesn't match.");
    setBusy(true); setError("");
    const supabase = createClient();
    const { error } = confirm.kind === "delete"
      ? await supabase.from("companies").delete().eq("id", confirm.id)
      : await supabase.from("company_members").delete().eq("company_id", confirm.id).eq("user_id", userId);
    setBusy(false);
    if (error) return setError(confirm.kind === "delete" ? "Couldn't delete. Try again." : "Couldn't leave. Try again.");
    reset();
    router.refresh();
  }

  if (companies.length === 0) return null;

  return (
    <div ref={ref} className="relative min-w-0 max-w-full sm:max-w-[260px]">
      <button type="button" onClick={() => { setOpen(!open); reset(); }} aria-expanded={open}
        className="flex w-full min-w-0 items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 text-sm hover:bg-slate-100">
        {current && <CompanyBadge id={current.id} name={current.name} index={companies.indexOf(current)} size={28} />}
        <span className="min-w-0 flex-1 truncate text-left font-medium text-slate-800">{current?.name}</span>
        <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,40,60,0.16)]">
          {/* Encabezado */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3">
            <p className="font-semibold text-[#0b1f3a]">Organizations</p>
            <button type="button" onClick={() => { setOpen(false); reset(); }} aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all duration-200 hover:rotate-90 hover:bg-red-50 hover:text-red-600">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
            </button>
          </div>

          <ul className="max-h-[26rem] divide-y divide-slate-100 overflow-y-auto">
            {companies.map((c, i) => {
              const isCurrent = c.id === currentId;
              const isOwner = c.role === "owner";
              return (
                <li key={c.id} className={isCurrent ? "bg-[#f6fbfa]" : ""}>
                  {renameId === c.id ? (
                    <div className="px-4 py-3">
                      <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#0f766e] focus:bg-white focus:outline-none" />
                      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
                      <div className="mt-2 flex gap-2">
                        <button type="button" disabled={busy} onClick={() => saveRename(c.id)} className="rounded-lg bg-[#0f766e] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#0c5f58] disabled:opacity-60">Save</button>
                        <button type="button" onClick={() => { setRenameId(null); setError(""); }} className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                      </div>
                    </div>
                  ) : confirm?.id === c.id ? (
                    <div className="px-4 py-3">
                      <p className="text-sm font-medium text-[#0b1f3a]">{confirm.kind === "delete" ? "Delete this organization?" : "Leave this organization?"}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {confirm.kind === "delete"
                          ? "This permanently removes the organization and all its customers and data."
                          : "You'll lose access to this organization."}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">Type <span className="font-semibold text-slate-700">{c.name}</span> to confirm:</p>
                      <input autoFocus value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-red-400 focus:bg-white focus:outline-none" />
                      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
                      <div className="mt-2 flex gap-2">
                        <button type="button" disabled={busy} onClick={doConfirm} className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">{confirm.kind === "delete" ? "Delete" : "Leave"}</button>
                        <button type="button" onClick={() => { setConfirm(null); setConfirmText(""); setError(""); }} className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button type="button" onClick={() => { onSwitch(c.id); setOpen(false); }} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <CompanyBadge id={c.id} name={c.name} index={i} size={36} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-slate-800">{c.name}</span>
                            {isCurrent && <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#0f766e]" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>}
                          </span>
                          <span className="block truncate text-xs text-slate-500">ID {c.id.slice(0, 8)} · {ROLE_LABEL[c.role]}{isOwner ? " (admin)" : ""}</span>
                        </span>
                      </button>
                      <div className="relative">
                        <button type="button" aria-label="Manage organization" onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><circle cx="10" cy="4.5" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="10" cy="15.5" r="1.6" /></svg>
                        </button>
                        {menuFor === c.id && (
                          <div className="absolute right-0 top-9 z-10 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_12px_40px_rgba(15,40,60,0.16)]">
                            <button type="button" onClick={() => { onSwitch(c.id); setOpen(false); }} className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-[#f0faf7]">Open</button>
                            {(c.role === "owner" || c.role === "manager") && (
                              <button type="button" onClick={() => { setRenameId(c.id); setRenameValue(c.name); setMenuFor(null); }} className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-[#f0faf7]">Rename</button>
                            )}
                            {isOwner ? (
                              <button type="button" onClick={() => { setConfirm({ id: c.id, name: c.name, kind: "delete" }); setMenuFor(null); }} className="block w-full border-t border-slate-100 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">Delete organization</button>
                            ) : (
                              <button type="button" onClick={() => { setConfirm({ id: c.id, name: c.name, kind: "leave" }); setMenuFor(null); }} className="block w-full border-t border-slate-100 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">Leave organization</button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <button type="button" onClick={() => { setOpen(false); onNewCompany(); }}
            className="flex w-full items-center gap-2 border-t border-slate-100 px-5 py-3 text-sm font-semibold text-[#0f766e] hover:bg-slate-50">
            <span className="text-lg leading-none">+</span> New organization
          </button>
        </div>
      )}
    </div>
  );
}
