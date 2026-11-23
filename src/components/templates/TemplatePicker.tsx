"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { inputClass } from "@/components/customers/ui";
import { Modal, btnGhost, btnPrimary } from "@/components/sales/SalesBits";
import { useSalesTx } from "@/i18n/useSalesTx";
import { TPL_COLS, TplCheck, TplLine, WorkTemplate, forJob, forQuote, tplError, tplOf, tplTotal } from "@/lib/templates";

// =====================================================================
// Paso 6.10 · Elegir una plantilla dentro de New Quote / New Job, y guardar una cotización como plantilla
// =====================================================================

// Ícono ilustrado (mismo estilo que los de la app): hoja con líneas y una estrellita
export function TemplateArt({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#e9f7f4" />
      <g className="origin-center transition-transform duration-200 ease-out group-hover:-rotate-6 group-hover:scale-110">
        <rect x="13" y="10" width="20" height="27" rx="3" fill="#fff" stroke="#0f766e" strokeWidth="1.6" />
        <path d="M17.5 17h11M17.5 22h11M17.5 27h6" stroke="#9fd8cb" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="32.5" cy="32" r="6.2" fill="#e8713a" />
        <path d="m32.5 28.9.95 1.95 2.15.3-1.55 1.5.37 2.13-1.92-1-1.92 1 .37-2.13-1.55-1.5 2.15-.3z" fill="#fff" />
      </g>
    </svg>
  );
}

// Carga las plantillas activas (sin el SQL 6.10: lista vacía y needsSql = true)
export function useTemplates(use: "quote" | "job") {
  const [list, setList] = useState<WorkTemplate[] | null>(null);
  const [needsSql, setNeedsSql] = useState(false);
  useEffect(() => {
    let alive = true;
    createClient().from("work_templates").select(TPL_COLS).eq("is_active", true).order("position").order("name").limit(500).then(({ data, error }) => {
      if (!alive) return;
      if (error) { setNeedsSql(tplError(error) === "sql"); setList([]); return; }
      setList(((data ?? []) as Record<string, unknown>[]).map(tplOf).filter(use === "quote" ? forQuote : forJob));
    });
    return () => { alive = false; };
  }, [use]);
  return { list, needsSql };
}

// Botón "Use a template" (se ve como enlace con el ícono)
export function TemplateButton({ onClick, count }: { onClick: () => void; count?: number }) {
  const t = useTranslations("templates");
  return (
    <button type="button" onClick={onClick}
      className="group inline-flex items-center gap-2 rounded-lg border border-[#0f766e]/25 bg-[#f3fbf8] px-3 py-1.5 text-[14px] font-semibold text-[#0f766e] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#0f766e] hover:shadow-[0_6px_14px_rgba(15,118,110,0.12)]">
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] transition-transform duration-200 group-hover:rotate-[-8deg]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6M9 16h3" /></svg>
      {t("use")}{count ? <span className="rounded-full bg-white px-1.5 text-[11px] text-[#0f766e] ring-1 ring-[#0f766e]/20">{count}</span> : null}
    </button>
  );
}

export function TemplatePickerModal({ open, onClose, use, list, needsSql, onPick, manageHref }: {
  open: boolean; onClose: () => void; use: "quote" | "job"; list: WorkTemplate[] | null; needsSql: boolean; onPick: (t: WorkTemplate) => void; manageHref: string;
}) {
  const t = useTranslations("templates");
  const sx = useSalesTx();
  const [q, setQ] = useState("");
  useEffect(() => { if (open) setQ(""); }, [open]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (list ?? []).filter((x) => !term || `${x.name} ${x.description ?? ""} ${x.title ?? ""}`.toLowerCase().includes(term));
  }, [list, q]);
  return (
    <Modal open={open} onClose={onClose} title={use === "quote" ? t("pickQuote") : t("pickJob")} width="max-w-xl"
      footer={<><Link prefetch={false} href={manageHref} className="text-[14px] font-medium text-[#0f766e] hover:underline">{t("manage")}</Link><button type="button" onClick={onClose} className={`${btnGhost} ml-auto`}>{t("close")}</button></>}>
      {needsSql ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-800">{t("needsSql")}</p>
      ) : list === null ? (
        <p className="py-8 text-center text-[14px] text-slate-500">{t("loading")}</p>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center">
          <TemplateArt size={56} />
          <p className="mt-3 text-[15px] font-semibold text-[#0b1f3a]">{t("emptyTitle")}</p>
          <p className="mt-1 max-w-sm text-[14px] text-slate-500">{t("emptyPick")}</p>
          <Link prefetch={false} href={`${manageHref}/new`} className={`${btnPrimary} mt-4`}>{t("create")}</Link>
        </div>
      ) : (
        <>
          {list.length > 6 && <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className={`${inputClass} mb-3`} />}
          <ul className="max-h-[55vh] space-y-2 overflow-y-auto">
            {shown.map((x) => {
              const total = tplTotal(x);
              return (
                <li key={x.id}>
                  <button type="button" onClick={() => { onPick(x); onClose(); }}
                    className="group flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-[#14a39a] hover:shadow-[0_8px_20px_rgba(15,40,60,0.08)]">
                    <TemplateArt size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-[#0b1f3a] group-hover:text-[#0f766e]">{x.name}</span>
                      <span className="block truncate text-[13px] text-slate-500">
                        {[x.lines.length ? t("nLines", { n: x.lines.length }) : "", x.checklist.length ? t("nTasks", { n: x.checklist.length }) : "", x.duration_min ? t("mins", { n: x.duration_min }) : "", x.deposit_type && x.deposit_value ? t("depShort", { v: x.deposit_type === "percent" ? `${+x.deposit_value}%` : sx.money(x.deposit_value) }) : ""].filter(Boolean).join(" · ") || x.description || t("noDetails")}
                      </span>
                    </span>
                    {total > 0 && <span className="shrink-0 text-[14px] font-semibold tabular-nums text-[#0b1f3a]">{sx.money(total)}</span>}
                  </button>
                </li>
              );
            })}
            {shown.length === 0 && <li className="py-6 text-center text-[14px] text-slate-500">{t("noMatch")}</li>}
          </ul>
        </>
      )}
    </Modal>
  );
}

// "Save as template" desde la cotización (líneas, notas, términos, asunto y depósito)
export function SaveTemplateModal({ open, onClose, companyId, actor, data, onSaved }: {
  open: boolean; onClose: () => void; companyId: string; actor: string; onSaved: (name: string) => void;
  data: { lines: TplLine[]; subject: string | null; notes: string | null; terms: string | null; deposit_type: "percent" | "flat" | null; deposit_value: number; checklist?: TplCheck[] };
}) {
  const t = useTranslations("templates");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setName(""); setError(""); } }, [open]);
  async function save() {
    if (!name.trim()) return setError(t("eName"));
    if (!data.lines.length) return setError(t("eNoLines"));
    setBusy(true); setError("");
    const { error: e } = await createClient().from("work_templates").insert({
      company_id: companyId, name: name.trim(), use_in: "both", lines: data.lines, subject: data.subject, notes: data.notes, terms: data.terms,
      deposit_type: data.deposit_type, deposit_value: data.deposit_value, checklist: data.checklist ?? [], created_by_name: actor,
    });
    setBusy(false);
    if (e) { const k = tplError(e); return setError(k === "dup" ? t("eDup") : k === "sql" ? t("needsSql") : k === "perm" ? t("ePerm") : t("eSave")); }
    onSaved(name.trim()); onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title={t("saveAs")}
      footer={<><button type="button" onClick={save} disabled={busy} className={btnPrimary}>{busy ? tc("saving") : tc("save")}</button><button type="button" onClick={onClose} className={btnGhost}>{tc("cancel")}</button>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}</>}>
      <p className="mb-4 text-[14px] text-slate-600">{t("saveAsIntro", { n: data.lines.length })}</p>
      <label className="mb-1 block text-[13px] text-slate-500" htmlFor="tpl-save-name">{t("name")}</label>
      <input id="tpl-save-name" autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder={t("namePh")} className={inputClass}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} />
    </Modal>
  );
}
