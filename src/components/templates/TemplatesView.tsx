"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { Toast } from "@/components/sales/SalesBits";
import { useSalesTx } from "@/i18n/useSalesTx";
import { WorkTemplate, tplTotal } from "@/lib/templates";
import { TemplateArt } from "@/components/templates/TemplatePicker";

// =====================================================================
// Paso 6.10 · Lista de plantillas (Settings → Templates y Jobs → Templates: la misma pantalla)
// =====================================================================
const FILTERS = ["all", "quote", "job"] as const;

export default function TemplatesView({ base, list, needsSql, typeNames }: { base: string; list: WorkTemplate[]; needsSql: boolean; typeNames: Record<string, string> }) {
  const t = useTranslations("templates");
  const tc = useTranslations("common");
  const sx = useSalesTx();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [f, setF] = useState<(typeof FILTERS)[number]>("all");
  const [toast, setToast] = useState("");
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2400); };
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return list.filter((x) => (f === "all" || x.use_in === "both" || x.use_in === f) && (!term || `${x.name} ${x.description ?? ""} ${x.title ?? ""}`.toLowerCase().includes(term)));
  }, [list, q, f]);

  async function remove(x: WorkTemplate) {
    if (!(await confirmDelete({ title: t("delQ", { name: x.name }), message: t("delMsg"), download: { filename: `template-${x.name}`, data: x } }))) return;
    const { error } = await createClient().from("work_templates").delete().eq("id", x.id);
    if (error) return say(t("eDel"));
    say(t("deleted", { name: x.name })); router.refresh();
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f4f6f8] px-4 pb-24 pt-5 lg:px-8 lg:pb-10 lg:pt-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0b1f3a] lg:text-2xl">{t("title")}</h1>
          <p className="mt-0.5 max-w-2xl text-[13.5px] text-slate-500 lg:text-sm">{t("subtitle")}</p>
        </div>
        <Link prefetch={false} href={`${base}/new`}
          className="group/n hidden h-10 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-[15px] font-semibold text-white shadow-sm shadow-[#0f766e]/30 transition-colors hover:bg-[#0c5f59] sm:inline-flex">
          <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-200 group-hover/n:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>{t("new")}
        </Link>
      </div>

      {needsSql && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{t("needsSql")}</p>}

      {list.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-0 flex-1 basis-60">
            <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[15px] placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
          </div>
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 text-[14px]">
            {FILTERS.map((k) => (
              <button key={k} type="button" onClick={() => setF(k)} aria-pressed={f === k}
                className={`rounded-lg px-3 py-1.5 transition-colors ${f === k ? "bg-[#e9f7f4] font-semibold text-[#0b5e57]" : "text-slate-600 hover:text-[#0b1f3a]"}`}>{t(`f.${k}`)}</button>
            ))}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <TemplateArt size={64} />
          <h2 className="mt-4 text-lg font-semibold text-[#0b1f3a]">{t("emptyTitle")}</h2>
          <p className="mt-1.5 max-w-md text-[14.5px] text-slate-500">{t("emptyText")}</p>
          <Link prefetch={false} href={`${base}/new`} className="mt-6 rounded-lg bg-[#0f766e] px-4 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#0c5f59]">{t("create")}</Link>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((x) => {
            const total = tplTotal(x);
            return (
              <div key={x.id} className={`group relative rounded-2xl border bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#14a39a] hover:shadow-[0_12px_28px_rgba(15,40,60,0.08)] ${x.is_active ? "border-slate-200" : "border-dashed border-slate-300 opacity-70"}`}>
                <Link prefetch={false} href={`${base}/${x.id}`} className="absolute inset-0 rounded-2xl" aria-label={x.name} />
                <div className="flex items-start gap-3">
                  <TemplateArt size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-semibold text-[#0b1f3a] group-hover:text-[#0f766e]">{x.name}</p>
                    <p className="truncate text-[13px] text-slate-500">{x.description || (x.job_type_id && typeNames[x.job_type_id]) || t(`u.${x.use_in}`)}</p>
                  </div>
                  {/* Atajos: editar y borrar sin abrir */}
                  <div className="relative z-10 flex shrink-0 gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                    <Link prefetch={false} href={`${base}/${x.id}`} aria-label={tc("edit")} title={tc("edit")} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-[#e9f7f4] hover:text-[#0f766e]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>
                    </Link>
                    <button type="button" onClick={() => remove(x)} aria-label={tc("delete")} title={tc("delete")} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-[#e9f7f4] px-2 py-0.5 text-[11.5px] font-semibold text-[#0f766e]">{t(`u.${x.use_in}`)}</span>
                  {x.lines.length > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] font-medium text-slate-600">{t("nLines", { n: x.lines.length })}</span>}
                  {x.checklist.length > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] font-medium text-slate-600">{t("nTasks", { n: x.checklist.length })}</span>}
                  {x.duration_min ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] font-medium text-slate-600">{t("mins", { n: x.duration_min })}</span> : null}
                  {x.deposit_type && x.deposit_value > 0 && <span className="rounded-full bg-[#fff4ec] px-2 py-0.5 text-[11.5px] font-semibold text-[#c2410c]">{t("depShort", { v: x.deposit_type === "percent" ? `${+x.deposit_value}%` : sx.money(x.deposit_value) })}</span>}
                  {!x.is_active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] font-medium text-slate-500">{t("inactive")}</span>}
                </div>
                <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-3">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{t("price")}</span>
                  <span className="text-[16px] font-semibold tabular-nums text-[#0b1f3a]">{total > 0 ? sx.money(total) : "—"}</span>
                </div>
              </div>
            );
          })}
          {shown.length === 0 && <p className="col-span-full py-10 text-center text-sm text-slate-500">{t("noMatch")}</p>}
        </div>
      )}

      <Link prefetch={false} href={`${base}/new`} aria-label={t("new")}
        className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#0f766e] text-white shadow-lg shadow-[#0f766e]/30 active:scale-95 sm:hidden">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
      </Link>
      <Toast text={toast} />
    </div>
  );
}
