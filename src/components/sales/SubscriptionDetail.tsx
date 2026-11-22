"use client";

import { confirmDelete, askConfirm } from "@/lib/confirm";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db, invoiceFromSubscription, logActivity } from "@/lib/sales-client";
import { Activity, Comment, SalesDoc, SalesLine, SalesPrefs, Subscription, addressLines, balanceOf, invoiceStatus, subStatus } from "@/lib/sales";
import { useTranslations } from "next-intl";
import { useSalesTx } from "@/i18n/useSalesTx";
import { CloseButton } from "@/components/catalog/DetailBits";
import { useSwipe } from "@/components/ui/useSwipe";
import BottomSheet from "@/components/customers/BottomSheet";
import { sheetAction } from "@/components/ui/sheet";
import PrefsPanel from "@/components/sales/PrefsPanel";
import { CommentsPanel } from "@/components/sales/DocModals";
import { ActivityList, Divider, I, Ico, StatusPill, ToolButton, ToolItem, ToolMenu, Toast } from "@/components/sales/SalesBits";

export default function SubscriptionDetail({ data, prefs, actor }: {
  data: { sub: Subscription; lines: SalesLine[]; activity: Activity[]; invoices: SalesDoc[]; comments: Comment[] }; prefs: SalesPrefs; actor: string;
}) {
  const t = useTranslations("subDetail");
  const tc = useTranslations("common");
  const sx = useSalesTx();
  const { money, fmtD } = sx;
  const FREQ_LABEL = sx.freq;
  const router = useRouter();
  const { sub, lines, invoices } = data;
  const s = subStatus(sub);
  const base = "/dashboard/subscriptions";
  const [tab, setTabRaw] = useState(0);
  const [dir, setDir] = useState<"l" | "r">("l");
  const setTab = (i: number) => { setDir(i > tab ? "l" : "r"); setTabRaw(i); };
  const swipe = useSwipe(() => tab > 0 && setTab(tab - 1), () => tab < 2 && setTab(tab + 1));
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [sheet, setSheet] = useState(false);
  const [panel, setPanel] = useState<null | "comments" | "prefs">(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  const active = s.key === "live" || s.key === "future";
  const owed = invoices.filter((i) => !["draft", "void"].includes(i.status)).reduce((t, i) => t + balanceOf(i), 0);

  async function update(patch: Record<string, unknown>, message: string) {
    setBusy(true);
    const { error } = await db().from("subscriptions").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", sub.id);
    if (!error) await logActivity(sub.company_id, "subscription", sub.id, message, actor);
    setBusy(false);
    if (error) return flash(t("eChange"));
    router.refresh(); flash(sx.act(message) + ".");
  }
  async function createInvoice() {
    if (!active) return flash(t("resumeFirst"));
    setBusy(true);
    const id = await invoiceFromSubscription(sub, lines, actor);
    setBusy(false);
    if (!id) return flash(t("eInvoice"));
    router.push(`/dashboard/invoices/${id}`); router.refresh();
  }
  async function remove() {
    if (!(await confirmDelete({ title: t("delQ", { n: sub.number }), message: t("delMsg"), download: { filename: sub.number, data: sub } }))) return;
    const { error } = await db().from("subscriptions").delete().eq("id", sub.id);
    if (error) return flash(t("eDel"));
    router.replace(base); router.refresh();
  }
  const cancel = async () => (await askConfirm({ title: t("cancelQ", { n: sub.number }), message: t("cancelMsg"), confirmLabel: t("cancelOk"), cancelLabel: t("keep"), tone: "danger" })) && update({ status: "cancelled", cancelled_at: new Date().toISOString() }, "Subscription cancelled");

  const more: ToolItem[] = [
    { label: s.key === "paused" ? t("resume") : t("pause"), icon: s.key === "paused" ? I.play : I.pause, onClick: () => update({ status: s.key === "paused" ? "live" : "paused" }, s.key === "paused" ? "Subscription resumed" : "Subscription paused"), hidden: !["live", "future", "paused"].includes(s.key) },
    { label: t("reactivate"), icon: I.play, onClick: () => update({ status: "live", cancelled_at: null }, "Subscription reactivated"), hidden: s.key !== "cancelled" },
    { label: t("cancelSub"), icon: I.stop, onClick: cancel, hidden: !["live", "future", "paused"].includes(s.key) },
    { label: t("clone"), icon: I.clone, href: `${base}/new?clone=${sub.id}`, divider: true },
    { label: tc("delete"), icon: I.trash, onClick: remove, danger: true },
    { label: t("prefs"), icon: I.prefs, onClick: () => setPanel("prefs"), divider: true },
  ];

  const tabs = [t("tabOverview"), `${t("tabInvoices")}${invoices.length ? ` (${invoices.length})` : ""}`, t("tabActivity")];
  const card = (label: string, value: string, tone = "") => (
    <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 text-lg font-semibold ${tone || "text-[#0b1f3a]"}`}>{value}</p></div>
  );

  return (
    <div className="flex min-h-full flex-col bg-[#f7f9fa]">
      {/* Celular */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3 lg:hidden">
        <Link prefetch={false} href={base} aria-label={t("back")} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-slate-100">
          <svg viewBox="0 0 20 20" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 15 7 10l5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-[#0b1f3a]">{sub.number}</h1>
        <button type="button" onClick={() => setSheet(true)} aria-label={t("actions")} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-slate-100">
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><circle cx="10" cy="4.5" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="10" cy="15.5" r="1.6" /></svg>
        </button>
      </div>

      {/* Computadora */}
      <div className="hidden items-center justify-between gap-3 bg-white px-5 pb-3 pt-4 sm:px-7 lg:flex">
        <div className="flex min-w-0 items-center gap-3"><h1 className="truncate text-[22px] font-semibold tracking-tight text-[#0b1f3a]">{sub.number}</h1><StatusPill s={s} /></div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPanel("comments")} aria-label={t("comments")} className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:text-[#0f766e]">
            <Ico d={I.comment} className="h-[18px] w-[18px]" />
            {data.comments.length > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0f766e] px-1 text-[10px] font-semibold text-white">{data.comments.length}</span>}
          </button>
          <CloseButton href={base} red />
        </div>
      </div>
      <div className="hidden flex-wrap items-center gap-0.5 border-y border-slate-200 bg-white px-4 py-1.5 sm:px-6 lg:flex">
        <ToolButton icon={I.edit} label={tc("edit")} href={`${base}/${sub.id}/edit`} />
        <Divider />
        <ToolButton icon={I.invoice} label={t("createInvoice")} onClick={createInvoice} disabled={busy || !active} />
        <Divider />
        {["live", "future", "paused"].includes(s.key) && <><ToolButton icon={s.key === "paused" ? I.play : I.pause} label={s.key === "paused" ? t("resume") : t("pause")} onClick={more[0].onClick} disabled={busy} /><Divider /></>}
        <ToolMenu dots items={more.slice(1)} />
      </div>

      <div className="flex-1 space-y-4 p-3 sm:p-5">
        <div className="rounded-2xl bg-white p-4 lg:hidden">
          <StatusPill s={s} />
          <p className="mt-2 text-[28px] font-semibold tabular-nums text-[#0b1f3a]">{money(sub.total)}</p>
          <p className="text-sm text-slate-500">{FREQ_LABEL(sub.bill_every, sub.bill_unit)}</p>
          <p className="mt-1 text-[15px] text-slate-700">{sub.customer_name}</p>
          <button type="button" onClick={createInvoice} disabled={busy || !active} className="mt-4 w-full rounded-xl bg-[#0f766e] py-3 text-[15px] font-semibold text-white disabled:opacity-50">{t("createNow")}</button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div role="tablist" className="flex gap-6 overflow-x-auto border-b border-slate-200 px-5 [scrollbar-width:none] sm:px-7 [&::-webkit-scrollbar]:hidden">
            {tabs.map((tb, i) => (
              <button key={tb} type="button" onClick={() => setTab(i)} className={`relative shrink-0 py-3.5 text-[15px] ${tab === i ? "font-semibold text-[#0f766e]" : "text-slate-600 hover:text-[#0b1f3a]"}`}>
                {tb}<span className={`absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-[#0f766e] transition-transform duration-200 ${tab === i ? "scale-x-100" : "scale-x-0"}`} />
              </button>
            ))}
          </div>

          <div {...swipe} key={tab} className={`lg:animate-none ${dir === "l" ? "animate-[bp-in-left_0.25s_ease-out]" : "animate-[bp-in-right_0.25s_ease-out]"}`}>
          {tab === 0 && (
            <div className="space-y-6 p-5 sm:p-7">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {card(t("perCycle"), money(sub.total))}
                {card(t("nextBilling"), sub.next_billing_date ? fmtD(sub.next_billing_date) : "—", sub.next_billing_date && sub.next_billing_date <= new Date().toISOString().slice(0, 10) && active ? "text-[#ea580c]" : "")}
                {card(t("created"), sub.expires_after ? t("nOf", { n: sub.invoices_generated, max: sub.expires_after }) : String(sub.invoices_generated))}
                {card(t("unpaid"), money(owed), owed > 0 ? "text-[#c2410c]" : "")}
              </div>
              {active && sub.next_billing_date && sub.next_billing_date <= new Date().toISOString().slice(0, 10) && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#fde2c7] bg-[#fff7ef] px-4 py-3 text-[14px]">
                  <span className="text-[#9a3412]">{t("dueToday", { date: fmtD(sub.next_billing_date) })}</span>
                  <button type="button" onClick={createInvoice} disabled={busy} className="ml-auto rounded-lg bg-[#0f766e] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0c5f59]">{t("createInvoice")}</button>
                </div>
              )}
              <div className="grid gap-5 lg:grid-cols-2">
                <dl className="space-y-2 text-[14px]">
                  {[[t("customer"), sub.customer_name], [t("profile"), sub.profile_name], [t("freq"), FREQ_LABEL(sub.bill_every, sub.bill_unit)], [t("start"), fmtD(sub.start_date)],
                    [t("expires"), sub.expires_after ? t("afterN", { n: sub.expires_after }) : t("never")], [t("payTerms"), sx.term(sub.payment_terms)], [t("salesperson"), sub.salesperson ?? ""],
                    [t("discount"), sub.discount_mode === "none" ? t("none") : `${sub.discount_mode === "item" ? t("itemLevel") : t("onTotal", { x: sub.discount_type === "percent" ? `${+sub.discount_value}%` : money(sub.discount_value) })} · ${sub.discount_apply === "every" ? t("everyRenewal") : sub.discount_apply === "one_time" ? t("firstOnly") : t("firstN", { n: sub.discount_cycles ?? 0 })}`],
                    ["E-mail To", sub.emails.join(", ")]].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-3"><dt className="text-slate-500">{k}</dt><dd className="text-[#0b1f3a]">{v}</dd></div>
                  ))}
                </dl>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4"><p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("billingAddr")}</p>{addressLines(sub.billing_address).map((l, i) => <p key={i} className="text-[14px] text-slate-700">{l}</p>)}</div>
                  <div className="rounded-xl border border-slate-200 p-4"><p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("jobSite")}</p>{sub.site_address ? addressLines(sub.site_address).map((l, i) => <p key={i} className="text-[14px] text-slate-700">{l}</p>) : <p className="text-sm text-slate-400">{t("sameBilling")}</p>}</div>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[520px] text-sm">
                  <thead><tr className="bg-[#fafbfc] text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500"><th className="px-4 py-2.5">{t("item")}</th><th className="px-4 py-2.5 text-right">{t("qty")}</th><th className="px-4 py-2.5 text-right">{t("price")}</th><th className="px-4 py-2.5 text-right">{t("amount")}</th></tr></thead>
                  <tbody>{lines.map((l, i) => (
                    <tr key={l.id ?? i} className="border-t border-slate-100 align-top"><td className="px-4 py-3"><p className="font-medium text-[#0b1f3a]">{l.name}</p>{l.description && <p className="whitespace-pre-line text-[13px] text-slate-500">{l.description}</p>}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{+l.quantity}</td><td className="px-4 py-3 text-right tabular-nums">{money(l.rate)}</td><td className="px-4 py-3 text-right tabular-nums">{money(l.amount)}</td></tr>
                  ))}</tbody>
                  <tfoot><tr className="border-t border-slate-200 font-semibold text-[#0b1f3a]"><td className="px-4 py-3" colSpan={3}>{t("totalCycle")}</td><td className="px-4 py-3 text-right tabular-nums">{money(sub.total)}</td></tr></tfoot>
                </table>
              </div>
            </div>
          )}
          {tab === 1 && (
            <div className="p-5 sm:p-7">
              {invoices.length === 0 ? (
                <div className="py-10 text-center"><p className="text-[15px] text-slate-500">{t("noInvoices")}</p>
                  {active && <button type="button" onClick={createInvoice} disabled={busy} className="mt-4 rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59]">{t("createFirst")}</button>}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500"><th className="py-2.5">{t("date")}</th><th>{t("invoiceNo")}</th><th>{t("status")}</th><th className="text-right">{t("amount")}</th><th className="text-right">{t("balance")}</th></tr></thead>
                  <tbody>{invoices.map((r) => (
                    <tr key={r.id} className="cursor-pointer border-b border-slate-100 hover:bg-[#f0faf7]" onClick={() => router.push(`/dashboard/invoices/${r.id}`)}>
                      <td className="py-3">{fmtD(r.doc_date)}</td><td className="font-medium text-[#0f766e]">{r.number}</td><td><StatusPill s={invoiceStatus(r)} small /></td>
                      <td className="text-right tabular-nums">{money(r.total)}</td><td className="text-right tabular-nums">{money(balanceOf(r))}</td></tr>))}</tbody>
                </table>
              )}
            </div>
          )}
          {tab === 2 && (
            <div className="p-5 sm:p-7">
              <ActivityList rows={data.activity.length ? data.activity : [{ id: "c", message: "Subscription created", detail: null, actor_name: sub.created_by_name, created_at: sub.created_at }]} />
            </div>
          )}
          </div>
        </div>
      </div>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title={sub.number}>
        <ul className="space-y-0.5">
          {[{ label: tc("edit"), icon: I.edit, href: `${base}/${sub.id}/edit` } as ToolItem, { label: t("createInvoice"), icon: I.invoice, onClick: createInvoice, hidden: !active }, { label: t("comments"), icon: I.comment, onClick: () => setPanel("comments") }, ...more]
            .filter((a) => !a.hidden).map((a) => (
              <li key={a.label}>
                {a.href ? <Link prefetch={false} href={a.href} className={`${sheetAction} text-slate-700`}>{a.icon && <Ico d={a.icon} className="h-5 w-5 text-[#0f766e]" />}{a.label}</Link> : (
                  <button type="button" onClick={() => { setSheet(false); a.onClick?.(); }} className={`${sheetAction} ${a.danger ? "text-red-600" : "text-slate-700"}`}>
                    {a.icon && <Ico d={a.icon} className={`h-5 w-5 ${a.danger ? "" : "text-[#0f766e]"}`} />}{a.label}
                  </button>
                )}
              </li>
            ))}
        </ul>
      </BottomSheet>
      <CommentsPanel open={panel === "comments"} onClose={() => setPanel(null)} entity="subscription" entityId={sub.id} companyId={sub.company_id} comments={data.comments} actor={actor} />
      <PrefsPanel open={panel === "prefs"} onClose={() => setPanel(null)} module="subscriptions" companyId={sub.company_id} prefs={prefs} />
      <Toast text={toast} />
    </div>
  );
}
