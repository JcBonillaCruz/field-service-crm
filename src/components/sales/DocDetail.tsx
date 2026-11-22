"use client";

import { confirmDelete, askConfirm } from "@/lib/confirm";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { convertQuote, db, logActivity, refreshInvoicePaid } from "@/lib/sales-client";
import {
  Activity, Comment, Payment, SalesDoc, SalesFile, SalesLine, SalesPrefs, addressLines, balanceOf, docStatus, invoiceStatus, money as moneyEn, quoteStatus,
} from "@/lib/sales";
import { useTranslations } from "next-intl";
import { useSalesTx } from "@/i18n/useSalesTx";
import DocPaper from "@/components/sales/DocPaper";
import { CloseButton } from "@/components/catalog/DetailBits";
import { useSwipe } from "@/components/ui/useSwipe";
import BottomSheet from "@/components/customers/BottomSheet";
import { sheetAction } from "@/components/ui/sheet";
import PrefsPanel from "@/components/sales/PrefsPanel";
import {
  AttachmentsButton, CommentsPanel, ExpectedDateModal, PaymentModal, SendEmailModal, ShareModal,
} from "@/components/sales/DocModals";
import { ActivityList, Divider, I, Ico, StatusPill, ToolButton, ToolItem, ToolMenu, Toast } from "@/components/sales/SalesBits";
import { CustomizeMenu } from "@/components/sales/TemplateModals";
import { jobError } from "@/lib/jobs";

// Ícono de "trabajo" (calendario con palomita) para Convert to Job — Paso 5.6
const JOB_ICON = "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4";

export type DocData = {
  doc: SalesDoc; lines: SalesLine[]; activity: Activity[]; comments: Comment[]; files: SalesFile[]; payments: Payment[];
  related: SalesDoc[]; prefs: SalesPrefs; companyName: string;
};

export default function DocDetail({ data, actor }: { data: DocData; actor: string }) {
  const t = useTranslations("docDetail");
  const tc = useTranslations("common");
  const sx = useSalesTx();
  const { money, fmtD, fmtDT } = sx;
  const router = useRouter();
  const { doc, lines, prefs, companyName } = data;
  const isQuote = doc.kind === "quote";
  const noun = isQuote ? "Quote" : "Invoice";
  const base = isQuote ? "/dashboard/quotes" : "/dashboard/invoices";
  const status = docStatus(doc);
  const bal = balanceOf(doc);
  const tabs = isQuote ? [t("tabQuote"), `${t("tabInvoices")}${data.related.length ? ` (${data.related.length})` : ""}`, t("tabActivity")] : [t("tabInvoice"), `${t("tabPayments")}${data.payments.length ? ` (${data.payments.length})` : ""}`, t("tabActivity")];
  const [tab, setTabRaw] = useState(0);
  const [dir, setDir] = useState<"l" | "r">("l");
  const setTab = (i: number) => { setDir(i > tab ? "l" : "r"); setTabRaw(i); };
  const swipe = useSwipe(() => tab > 0 && setTab(tab - 1), () => tab < 2 && setTab(tab + 1));
  const [view, setView] = useState<"details" | "pdf">("pdf");
  const [modal, setModal] = useState<null | "email" | "reminder" | "share" | "payment" | "write_off" | "expected" | "comments" | "prefs">(null);
  const [mActions, setMActions] = useState(false);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  const close = () => setModal(null);
  // Cotización aceptada (según preferencia) o factura pagada / anulada: ya no se edita
  const paidOff = !isQuote && Number(doc.total) > 0 && bal <= 0;
  const locked = (isQuote && ["accepted", "invoiced"].includes(doc.status) && !prefs.quote_settings.allow_edit_accepted)
    || (!isQuote && (paidOff || doc.status === "void" || doc.status === "written_off"));
  const lockReason = isQuote ? t("lockQuote") : doc.status === "void" ? t("lockVoid") : t("lockPaid");
  const [payOpen, setPayOpen] = useState(false);
  const editHref = `${base}/${doc.id}/edit`;
  const sp = useSearchParams();
  // "Save and Send" llega aquí con ?send=1 y abre el correo
  useEffect(() => {
    if (sp.get("send") === "1") { setModal("email"); router.replace(`${base}/${doc.id}`, { scroll: false }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setStatus(next: string, message: string) {
    setBusy(true);
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: next, updated_at: now };
    if (next === "sent" && !doc.sent_at) patch.sent_at = now;
    if (next === "accepted") patch.accepted_at = now;
    if (next === "declined") patch.declined_at = now;
    if (next === "void") patch.voided_at = now;
    const { error } = await db().from("sales_docs").update(patch).eq("id", doc.id);
    if (error) { setBusy(false); return flash(t("eStatus")); }
    await logActivity(doc.company_id, doc.kind, doc.id, message, actor);
    // Preferencia: convertir automáticamente al aceptar
    if (next === "accepted" && prefs.quote_settings.auto_convert && prefs.quote_settings.auto_convert !== "none") {
      const id = await convertQuote({ ...doc, status: "accepted" }, lines, prefs.quote_settings, actor, prefs.quote_settings.auto_convert === "send");
      setBusy(false);
      if (id) { router.push(`/dashboard/invoices/${id}`); router.refresh(); return; }
    }
    setBusy(false);
    router.refresh();
    flash(sx.act(message) + ".");
  }
  async function convert() {
    setBusy(true);
    const id = await convertQuote(doc, lines, prefs.quote_settings, actor);
    setBusy(false);
    if (!id) return flash(t("eInvoice"));
    router.push(`/dashboard/invoices/${id}/edit`);
    router.refresh();
  }
  // ---------- Paso 5.6: cotización aceptada → trabajo (Jobs) con un clic ----------
  const [job, setJob] = useState<{ id: string; number: string } | null>(null);
  useEffect(() => {
    if (!isQuote) return;
    let alive = true;
    db().from("jobs").select("id, number").eq("quote_id", doc.id).is("cancelled_at", null).limit(1)
      .then(({ data: rows }) => { if (alive) setJob(((rows ?? [])[0] as { id: string; number: string } | undefined) ?? null); }, () => undefined);
    return () => { alive = false; };
  }, [isQuote, doc.id]);
  const jobReady = isQuote && ["accepted", "invoiced"].includes(doc.status);
  async function toJob() {
    if (job) { router.push(`/dashboard/jobs/${job.id}`); return; }
    if (!jobReady) return flash(t("eJobReady"));
    setBusy(true);
    const { data: id, error } = await db().rpc("job_from_quote", { p_quote: doc.id });
    if (error || !id) { setBusy(false); return flash(error?.hint || jobError(error) || t("eJob")); }
    const { data: made } = await db().from("jobs").select("number").eq("id", id as string).maybeSingle();
    await logActivity(doc.company_id, "quote", doc.id, `Job ${(made?.number as string) ?? ""} created from this quote`.replace("  ", " "), actor);
    setBusy(false);
    // Abre el trabajo para elegir tipo, fecha y colaboradores
    router.push(`/dashboard/jobs/${id}/edit`);
    router.refresh();
  }
  const jobLabel = job ? t("openJob", { n: job.number }) : t("toJob");

  async function remove() {
    if (!(await confirmDelete({ title: t("delQ", { kind: doc.kind, n: doc.number }),
      download: { filename: doc.number, data: async () => ({ ...doc, lines: (await db().from("sales_lines").select("*").eq("doc_id", doc.id)).data, payments: (await db().from("sales_payments").select("*").eq("invoice_id", doc.id)).data }) } }))) return;
    const { error } = await db().from("sales_docs").delete().eq("id", doc.id);
    if (error) return flash(t("eDel", { kind: doc.kind }));
    await db().from("sales_activity").delete().eq("entity_id", doc.id);
    router.replace(base); router.refresh();
  }
  async function voidInvoice() {
    if (!(await askConfirm({ title: t("voidQ", { n: doc.number }), message: t("voidMsg"), confirmLabel: t("voidOk"), tone: "danger" }))) return;
    await setStatus("void", "Invoice marked as void");
  }
  async function toggleReminders() {
    await db().from("sales_docs").update({ reminders_stopped: !doc.reminders_stopped }).eq("id", doc.id);
    await logActivity(doc.company_id, "invoice", doc.id, doc.reminders_stopped ? "Payment reminders enabled" : "Payment reminders stopped", actor);
    router.refresh();
  }
  async function deletePayment(p: Payment) {
    if (!(await confirmDelete({ title: t("delPay", { what: p.kind === "payment" ? "payment" : "writeoff", amount: money(p.amount) }), download: { filename: `${doc.number}-${p.kind}`, data: p } }))) return;
    await db().from("sales_payments").delete().eq("id", p.id);
    await refreshInvoicePaid(doc);
    await logActivity(doc.company_id, "invoice", doc.id, `${p.kind === "payment" ? "Payment" : "Write-off"} of ${moneyEn(p.amount)} deleted`, actor);
    router.refresh();
  }
  const openPrint = (v?: string) => window.open(`/print/${doc.id}?auto=1${v ? `&v=${v}` : ""}`, "_blank");
  // PDF real (se descarga) o abrirlo en otra pestaña
  const downloadPdf = (v?: string) => { window.location.href = `/api/sales/pdf/${doc.id}${v ? `?v=${v}` : ""}`; };
  const viewPdf = (v?: string) => window.open(`/api/sales/pdf/${doc.id}?inline=1${v ? `&v=${v}` : ""}`, "_blank");

  // ---------- Menús (los mismos que Zoho) ----------
  const mailItems: ToolItem[] = [{ label: t("sendEmail"), icon: I.mail, onClick: () => setModal("email") }];
  const pdfItems: ToolItem[] = [
    { label: t("downloadPdf"), icon: I.download, onClick: () => downloadPdf() },
    { label: t("openPdf"), icon: I.pdf, onClick: () => viewPdf() },
    { label: t("print"), icon: I.print, onClick: () => openPrint() },
    { label: t("delivery"), icon: I.truck, onClick: () => downloadPdf("delivery"), hidden: isQuote, divider: true },
    { label: t("packing"), icon: I.box, onClick: () => downloadPdf("packing"), hidden: isQuote },
  ];
  const reminderItems: ToolItem[] = [
    { label: t("reminderNow"), icon: I.send, onClick: () => setModal("reminder") },
    { label: doc.reminders_stopped ? t("enableRem") : t("stopRem"), icon: I.stop, onClick: toggleReminders },
    { label: t("expected"), icon: I.calendar, onClick: () => setModal("expected") },
  ];
  const paymentItems: ToolItem[] = [
    { label: t("recordPayment"), icon: I.money, onClick: () => setModal("payment") },
    { label: t("writeOff"), icon: I.void, onClick: () => setModal("write_off") },
  ];
  const moreItems: ToolItem[] = isQuote ? [
    { label: t("markSent"), icon: I.send, onClick: () => setStatus("sent", "Quote marked as sent"), hidden: doc.status !== "draft" },
    { label: t("markAccepted"), icon: I.check, onClick: () => setStatus("accepted", "Quote marked as accepted"), hidden: !["draft", "sent", "viewed", "declined"].includes(doc.status) },
    { label: t("markDeclined"), icon: I.x, onClick: () => setStatus("declined", "Quote marked as declined"), hidden: !["draft", "sent", "viewed", "accepted"].includes(doc.status) },
    { label: t("createProject"), icon: I.project, soon: true, divider: true },
    { label: t("clone"), icon: I.clone, href: `${base}/new?clone=${doc.id}` },
    { label: tc("delete"), icon: I.trash, onClick: remove, danger: true },
    { label: t("quotePrefs"), icon: I.prefs, onClick: () => setModal("prefs"), divider: true },
  ] : [
    { label: t("markSent"), icon: I.send, onClick: () => setStatus("sent", "Invoice marked as sent"), hidden: doc.status !== "draft" },
    { label: t("clone"), icon: I.clone, href: `${base}/new?clone=${doc.id}` },
    { label: t("void"), icon: I.void, onClick: voidInvoice, hidden: doc.status === "void" || Number(doc.amount_paid) > 0 },
    { label: tc("delete"), icon: I.trash, onClick: remove, danger: true },
    { label: t("invoicePrefs"), icon: I.prefs, onClick: () => setModal("prefs"), divider: true },
  ];
  const canConvert = isQuote && !["invoiced", "declined"].includes(doc.status);
  const canPay = !isQuote && doc.status !== "void" && bal > 0;

  // ---------- Pestañas ----------
  const details = (
    <div className="space-y-6 p-5 sm:p-7">
      <dl className="grid gap-x-10 gap-y-3 text-[14px] sm:grid-cols-2">
        {[
          [t("customer"), doc.customer_name], [t("status"), sx.status(status)], [isQuote ? t("quoteDate") : t("invoiceDate"), fmtD(doc.doc_date)],
          isQuote ? [t("expiry"), fmtD(doc.expiry_date)] : [t("dueDate"), fmtD(doc.due_date)], !isQuote ? [t("terms"), sx.term(doc.payment_terms)] : ["", ""],
          [t("reference"), doc.reference ?? ""], !isQuote ? [t("order"), doc.order_number ?? ""] : ["", ""], [t("salesperson"), doc.salesperson ?? ""],
          [t("subject"), doc.subject ?? ""], !isQuote && doc.expected_payment_date ? [t("expectedPay"), fmtD(doc.expected_payment_date)] : ["", ""],
          [t("createdBy"), doc.created_by_name ?? ""], [t("created"), fmtDT(doc.created_at)],
        ].filter(([k, v]) => k && v).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3"><dt className="text-slate-500">{k}</dt><dd className="text-[#0b1f3a]">{v}</dd></div>
        ))}
      </dl>
      {doc.signed_name && doc.signed_at && (
        <div className="flex flex-wrap items-center gap-5 rounded-xl border border-[#cde8e0] bg-[#f3fbf8] p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {doc.signature_data && <img src={doc.signature_data} alt={t("signature")} className="h-16 max-w-[220px] rounded-lg bg-white object-contain p-1" />}
          <div><p className="text-[12px] font-semibold uppercase tracking-wide text-[#0f766e]">{t("signed")}</p><p className="text-[15px] text-[#0b1f3a]">{doc.signed_name}</p><p className="text-[13px] text-slate-500">{fmtDT(doc.signed_at)}</p></div>
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4"><p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("billingAddr")}</p>{addressLines(doc.billing_address).map((l, i) => <p key={i} className="text-[14px] text-slate-700">{l}</p>)}{!doc.billing_address && <p className="text-sm text-slate-400">{t("noAddr")}</p>}</div>
        <div className="rounded-xl border border-slate-200 p-4"><p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("jobSite")}</p>{addressLines(doc.site_address).map((l, i) => <p key={i} className="text-[14px] text-slate-700">{l}</p>)}{!doc.site_address && <p className="text-sm text-slate-400">{t("sameBilling")}</p>}</div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[520px] text-sm">
          <thead><tr className="bg-[#fafbfc] text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500"><th className="px-4 py-2.5">{t("item")}</th><th className="px-4 py-2.5 text-right">{t("qty")}</th><th className="px-4 py-2.5 text-right">{t("rate")}</th><th className="px-4 py-2.5 text-right">{t("amount")}</th></tr></thead>
          <tbody>{lines.map((l, i) => (
            <tr key={l.id ?? i} className="border-t border-slate-100 align-top"><td className="px-4 py-3"><p className="font-medium text-[#0b1f3a]">{l.name}</p>{l.description && <p className="whitespace-pre-line text-[13px] text-slate-500">{l.description}</p>}</td>
              <td className="px-4 py-3 text-right tabular-nums">{+l.quantity}</td><td className="px-4 py-3 text-right tabular-nums">{money(l.rate)}</td><td className="px-4 py-3 text-right tabular-nums">{money(l.amount)}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <div className="ml-auto max-w-xs space-y-1.5 text-[14px]">
        <p className="flex justify-between"><span className="text-slate-500">{t("subtotal")}</span><span className="tabular-nums">{money(doc.subtotal)}</span></p>
        <p className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-[#0b1f3a]"><span>{t("total")}</span><span className="tabular-nums">{money(doc.total)}</span></p>
        {!isQuote && <p className="flex justify-between font-semibold text-[#0b1f3a]"><span>{t("balance")}</span><span className="tabular-nums">{money(bal)}</span></p>}
      </div>
    </div>
  );

  const relatedTab = isQuote ? (
    <div className="p-5 sm:p-7">
      {data.related.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-[15px] text-slate-500">{t("noInvoices")}</p>
          {canConvert && <button type="button" onClick={convert} disabled={busy} className="mt-4 rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59]">{t("toInvoice")}</button>}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500"><th className="py-2.5">{t("date")}</th><th>{t("invoiceNo")}</th><th>{t("status")}</th><th className="text-right">{t("amount")}</th><th className="text-right">{t("balance")}</th></tr></thead>
          <tbody>{data.related.map((r) => { const s = invoiceStatus(r); return (
            <tr key={r.id} className="cursor-pointer border-b border-slate-100 hover:bg-[#f0faf7]" onClick={() => router.push(`/dashboard/invoices/${r.id}`)}>
              <td className="py-3">{fmtD(r.doc_date)}</td><td className="font-medium text-[#0f766e]">{r.number}</td><td><StatusPill s={s} small /></td>
              <td className="text-right tabular-nums">{money(r.total)}</td><td className="text-right tabular-nums">{money(balanceOf(r))}</td></tr>); })}</tbody>
        </table>
      )}
    </div>
  ) : (
    <div className="p-5 sm:p-7">
      {doc.quote_id && data.related[0] && (
        <p className="mb-4 text-sm text-slate-600">{t.rich("fromQuote", { n: data.related[0].number, st: sx.status(quoteStatus(data.related[0])), a: (c) => <Link prefetch={false} href={`/dashboard/quotes/${data.related[0].id}`} className="font-medium text-[#0f766e] hover:underline">{c}</Link> })}</p>
      )}
      {data.payments.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-[15px] text-slate-500">{t("noPayments")}</p>
          {canPay && <button type="button" onClick={() => setModal("payment")} className="mt-4 rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59]">{t("recordPayment")}</button>}
        </div>
      ) : (
        <PaymentsTable payments={data.payments} onDelete={deletePayment} />
      )}
    </div>
  );

  const activityTab = (
    <div className="px-5 py-2 sm:px-7">
      <ActivityList rows={data.activity.length ? data.activity : [{ id: "c", message: `${noun} created for ${moneyEn(doc.total)}`, detail: null, actor_name: doc.created_by_name, created_at: doc.created_at }]} />
    </div>
  );

  // Siguiente paso sugerido (como el banner "What's next?" de Zoho)
  const nextStep = doc.status === "draft" ? (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#cde8e0] bg-[#f3fbf8] px-4 py-3 text-[14px]">
      <span className="text-[13px] font-semibold uppercase tracking-wide text-[#0f766e]">{t("next")}</span>
      <span className="text-slate-600">{t("nextDraft", { kind: doc.kind })}</span>
      <span className="ml-auto flex gap-2">
        <button type="button" onClick={() => setModal("email")} className="rounded-lg bg-[#0f766e] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0c5f59]">{t("sendX", { kind: doc.kind })}</button>
        <button type="button" onClick={() => setStatus("sent", `${noun} marked as sent`)} disabled={busy} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">{t("markSent")}</button>
      </span>
    </div>
  ) : isQuote && doc.status === "accepted" ? (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#cde8e0] bg-[#f3fbf8] px-4 py-3 text-[14px]">
      <span className="text-[13px] font-semibold uppercase tracking-wide text-[#0f766e]">{t("next")}</span>
      <span className="text-slate-600">{doc.signed_name ? t("signedBy", { name: doc.signed_name }) : t("acceptedPlain")} {job ? t("jobExists", { n: job.number }) : t("scheduleOr")}</span>
      <span className="ml-auto flex flex-wrap gap-2">
        <button type="button" onClick={toJob} disabled={busy} className="rounded-lg border border-[#0f766e] bg-white px-3 py-1.5 text-sm font-semibold text-[#0f766e] hover:bg-[#f3fbf8] disabled:opacity-60">{jobLabel}</button>
        <button type="button" onClick={convert} disabled={busy} className="rounded-lg bg-[#0f766e] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0c5f59] disabled:opacity-60">{t("toInvoice")}</button>
      </span>
    </div>
  ) : canPay && doc.status !== "draft" ? (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#cde8e0] bg-[#f3fbf8] px-4 py-3 text-[14px]">
      <span className="text-[13px] font-semibold uppercase tracking-wide text-[#0f766e]">{t("next")}</span>
      <span className="text-slate-600">{doc.due_date ? t("nextPayDate", { amount: money(bal), date: fmtD(doc.due_date) }) : t("nextPay", { amount: money(bal) })}</span>
      <button type="button" onClick={() => setModal("payment")} className="ml-auto rounded-lg bg-[#0f766e] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0c5f59]">{t("recordPayment")}</button>
    </div>
  ) : null;

  const mobileActions: ToolItem[] = [
    { label: tc("edit"), icon: I.edit, href: locked ? undefined : editHref, hidden: locked },
    { label: t("sendEmail"), icon: I.mail, onClick: () => setModal("email") },
    { label: t("shareM"), icon: I.share, onClick: () => setModal("share") },
    { label: t("downloadPdf"), icon: I.download, onClick: () => downloadPdf() },
    { label: t("openPdf"), icon: I.pdf, onClick: () => viewPdf() },
    ...(isQuote ? [{ label: t("toInvoice"), icon: I.convert, onClick: convert, hidden: !canConvert }, { label: jobLabel, icon: JOB_ICON, onClick: toJob, hidden: !job && !jobReady }] : [
      { label: t("recordPayment"), icon: I.money, onClick: () => setModal("payment"), hidden: !canPay },
      { label: t("sendReminder"), icon: I.bell, onClick: () => setModal("reminder"), hidden: !canPay },
    ]),
    ...moreItems.filter((m) => !m.soon),
  ];

  return (
    <div className="flex min-h-full flex-col bg-[#f7f9fa]">
      {/* ====== Celular ====== */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3 lg:hidden">
        <Link prefetch={false} href={base} aria-label={t("back")} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-slate-100">
          <svg viewBox="0 0 20 20" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 15 7 10l5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-[#0b1f3a]">{doc.number}</h1>
        <button type="button" onClick={() => setModal("comments")} aria-label={t("comments")} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-slate-100"><Ico d={I.comment} className="h-5 w-5" /></button>
        <button type="button" onClick={() => setMActions(true)} aria-label={t("actions")} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-slate-100">
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><circle cx="10" cy="4.5" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="10" cy="15.5" r="1.6" /></svg>
        </button>
      </div>
      <div className="bg-white px-4 pb-4 pt-4 lg:hidden">
        <StatusPill s={status} />
        <p className="mt-2 text-[28px] font-semibold tabular-nums text-[#0b1f3a]">{money(isQuote ? doc.total : bal)}</p>
        {!isQuote && bal !== Number(doc.total) && <p className="text-sm text-slate-500">{t("of", { amount: money(doc.total) })}</p>}
        <p className="mt-1 text-[15px] text-slate-700">{doc.customer_name}</p>
        <p className="text-[13px] text-slate-500">{fmtD(doc.doc_date)}{isQuote ? (doc.expiry_date ? ` · ${t("expires", { date: fmtD(doc.expiry_date) })}` : "") : doc.due_date ? ` · ${t("due", { date: fmtD(doc.due_date) })}` : ""}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button type="button" onClick={() => setModal("email")} className="flex flex-col items-center gap-1 rounded-xl bg-[#f3fbf8] py-2.5 text-[12px] font-medium text-[#0f766e]"><Ico d={I.mail} className="h-5 w-5" />{t("send")}</button>
          <button type="button" onClick={() => setModal("share")} className="flex flex-col items-center gap-1 rounded-xl bg-[#f3fbf8] py-2.5 text-[12px] font-medium text-[#0f766e]"><Ico d={I.share} className="h-5 w-5" />{t("share")}</button>
          {isQuote ? (
            <button type="button" onClick={convert} disabled={!canConvert || busy} className="flex flex-col items-center gap-1 rounded-xl bg-[#f3fbf8] py-2.5 text-[12px] font-medium text-[#0f766e] disabled:opacity-40"><Ico d={I.convert} className="h-5 w-5" />{t("invoiceBtn")}</button>
          ) : (
            <button type="button" onClick={() => setModal("payment")} disabled={!canPay} className="flex flex-col items-center gap-1 rounded-xl bg-[#f3fbf8] py-2.5 text-[12px] font-medium text-[#0f766e] disabled:opacity-40"><Ico d={I.money} className="h-5 w-5" />{t("paymentBtn")}</button>
          )}
        </div>
      </div>

      {/* ====== Computadora: número + clip, comentarios, X ====== */}
      <div className="hidden items-center justify-between gap-3 bg-white px-5 pb-3 pt-4 sm:px-7 lg:flex">
        <h1 className="truncate text-[22px] font-semibold tracking-tight text-[#0b1f3a]">{doc.number}</h1>
        <div className="flex items-center gap-2">
          <AttachmentsButton entity={doc.kind} entityId={doc.id} companyId={doc.company_id} files={data.files} />
          <button type="button" onClick={() => setModal("comments")} aria-label={t("comments")} title={t("comments")}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:text-[#0f766e]">
            <Ico d={I.comment} className="h-[18px] w-[18px]" />
            {data.comments.length > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0f766e] px-1 text-[10px] font-semibold text-white">{data.comments.length}</span>}
          </button>
          <CloseButton href={base} red />
        </div>
      </div>
      <div className="hidden flex-wrap items-center gap-0.5 border-y border-slate-200 bg-white px-4 py-1.5 sm:px-6 lg:flex">
        {locked ? <span title={lockReason}><ToolButton icon={I.edit} label={tc("edit")} disabled /></span> : <ToolButton icon={I.edit} label={tc("edit")} href={editHref} />}
        <Divider />
        <ToolMenu icon={I.mail} label={isQuote ? t("mails") : t("send")} items={mailItems} />
        <Divider />
        <ToolButton icon={I.share} label={t("share")} onClick={() => setModal("share")} />
        <Divider />
        {!isQuote && <><ToolMenu icon={I.bell} label={t("reminders")} items={reminderItems} /><Divider /></>}
        <ToolMenu icon={I.pdf} label={t("pdfPrint")} items={pdfItems} />
        <Divider />
        {isQuote ? (
          <>
            <ToolButton icon={I.convert} label={t("toInvoice")} onClick={convert} disabled={!canConvert || busy} />
            <Divider />
            <span title={job || jobReady ? undefined : t("acceptFirst")}><ToolButton icon={JOB_ICON} label={jobLabel} onClick={toJob} disabled={busy || (!job && !jobReady)} /></span>
          </>
        ) : (
          <ToolMenu icon={I.money} label={t("recordPayment")} items={paymentItems.map((p) => ({ ...p, soon: false, onClick: canPay ? p.onClick : () => flash(doc.status === "void" ? t("isVoid") : t("isPaid")) }))} />
        )}
        <Divider />
        <ToolMenu dots items={moreItems} />
      </div>

      <div className="flex-1 p-3 sm:p-5">
        <div className="hidden lg:block">{nextStep}</div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pr-4">
            <div role="tablist" className="flex gap-6 overflow-x-auto px-5 [scrollbar-width:none] sm:px-7 [&::-webkit-scrollbar]:hidden">
              {tabs.map((tb, i) => (
                <button key={tb} type="button" role="tab" aria-selected={tab === i} onClick={() => setTab(i)}
                  className={`relative shrink-0 py-3.5 text-[15px] transition-colors ${tab === i ? "font-semibold text-[#0f766e]" : "text-slate-600 hover:text-[#0b1f3a]"}`}>
                  {tb}<span className={`absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-[#0f766e] transition-transform duration-200 ${tab === i ? "scale-x-100" : "scale-x-0"}`} />
                </button>
              ))}
            </div>
            {tab === 0 && (
              <div className="hidden shrink-0 rounded-lg bg-slate-100 p-0.5 text-[13px] sm:flex">
                {(["details", "pdf"] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setView(v)}
                    className={`rounded-md px-3 py-1 transition-all ${view === v ? "bg-white font-semibold text-[#0b1f3a] shadow-sm" : "text-slate-500 hover:text-[#0b1f3a]"}`}>{v === "pdf" ? "PDF" : t("details")}</button>
                ))}
              </div>
            )}
          </div>
          <div {...swipe} key={tab} className={`lg:animate-none ${dir === "l" ? "animate-[bp-in-left_0.25s_ease-out]" : "animate-[bp-in-right_0.25s_ease-out]"}`}>
          {tab === 0 && (
            <div className="flex justify-center border-b border-slate-100 py-2.5 sm:hidden">
              <div className="flex rounded-lg bg-slate-100 p-0.5 text-[13px]">
                {(["details", "pdf"] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setView(v)}
                    className={`rounded-md px-5 py-1.5 transition-all ${view === v ? "bg-white font-semibold text-[#0b1f3a] shadow-sm" : "text-slate-500"}`}>{v === "pdf" ? "PDF" : t("details")}</button>
                ))}
              </div>
            </div>
          )}
          {tab === 0 ? (view === "pdf" ? (
            <div className="bg-[#f4f6f8] px-2 py-5 sm:px-8 sm:py-7">
              {!isQuote && data.payments.length > 0 && (
                <div className="mx-auto mb-5 max-w-[740px] overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <button type="button" onClick={() => setPayOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                    <span className="flex items-center gap-2 text-[14px] font-semibold text-[#0b1f3a]">{t("paymentsReceived")}<span className="rounded-full bg-[#e8f0ff] px-2 py-0.5 text-[11px] text-[#2563eb]">{data.payments.length}</span></span>
                    <svg viewBox="0 0 20 20" className={`h-4 w-4 text-slate-500 transition-transform ${payOpen ? "rotate-90" : ""}`} fill="currentColor"><path d="M7 5l6 5-6 5z" /></svg>
                  </button>
                  {payOpen && <div className="border-t border-slate-100 px-2 pb-2 animate-[bp-fade_0.2s_ease-out]"><PaymentsTable payments={data.payments} onDelete={deletePayment} /></div>}
                </div>
              )}
              {/* El menú Customize sale solo al pasar el mouse sobre el documento (como Zoho) */}
              <div className="group/paper relative mx-auto max-w-[740px]">
                <div className="absolute right-0 top-0 z-20 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover/paper:opacity-100 has-[[data-open]]:opacity-100 [@media(hover:none)]:opacity-100">
                  <CustomizeMenu companyId={doc.company_id} pdf={prefs.pdf_settings} whiteLabel={prefs.white_label} onLogo={() => setModal("prefs")} kind={doc.kind}
                    back={`${base}/${doc.id}`} preview={{ doc, lines, prefs, companyName }} />
                </div>
                <DocPaper doc={doc} lines={lines} prefs={prefs} companyName={companyName} status={status} compact />
              </div>
            </div>
          ) : details) : tab === 1 ? relatedTab : activityTab}
          </div>
        </div>
      </div>

      <BottomSheet open={mActions} onClose={() => setMActions(false)} title={doc.number}>
        <ul className="space-y-0.5">
          {mobileActions.filter((a) => !a.hidden).map((a) => (
            <li key={a.label}>
              {a.href ? (
                <Link prefetch={false} href={a.href} className={`${sheetAction} text-slate-700`}>{a.icon && <Ico d={a.icon} className="h-5 w-5 text-[#0f766e]" />}{a.label}</Link>
              ) : (
                <button type="button" onClick={() => { setMActions(false); a.onClick?.(); }}
                  className={`${sheetAction} ${a.danger ? "text-red-600" : "text-slate-700"}`}>
                  {a.icon && <Ico d={a.icon} className={`h-5 w-5 ${a.danger ? "" : "text-[#0f766e]"}`} />}{a.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </BottomSheet>

      <SendEmailModal open={modal === "email" || modal === "reminder"} reminder={modal === "reminder"} onClose={close} doc={doc} companyName={companyName} actor={actor} files={data.files} whiteLabel={prefs.white_label} />
      <ShareModal open={modal === "share"} onClose={close} doc={doc} actor={actor} companyName={companyName} />
      {!isQuote && <PaymentModal open={modal === "payment" || modal === "write_off"} mode={modal === "write_off" ? "write_off" : "payment"} onClose={close} doc={doc} actor={actor} onDone={() => { router.refresh(); flash(t("saved")); }} />}
      {!isQuote && <ExpectedDateModal open={modal === "expected"} onClose={close} doc={doc} actor={actor} />}
      <CommentsPanel open={modal === "comments"} onClose={close} entity={doc.kind} entityId={doc.id} companyId={doc.company_id} comments={data.comments} actor={actor} />
      <PrefsPanel open={modal === "prefs"} onClose={close} module={isQuote ? "quotes" : "invoices"} companyId={doc.company_id} prefs={prefs} />
      <Toast text={toast} />
    </div>
  );
}

// Pagos: tabla en computadora, renglones en el celular
function PaymentsTable({ payments, onDelete }: { payments: Payment[]; onDelete: (p: Payment) => void }) {
  const t = useTranslations("docDetail");
  const tc = useTranslations("common");
  const { money, fmtD, pay } = useSalesTx();
  const ordered = [...payments].sort((a, b) => a.paid_on.localeCompare(b.paid_on) || a.created_at.localeCompare(b.created_at));
  const num = new Map(ordered.map((p, i) => [p.id, i + 1]));
  return (
    <>
      <table className="hidden w-full text-sm sm:table">
        <thead><tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <th className="px-2 py-2.5">{t("date")}</th><th>{t("payNo")}</th><th>{t("reference")}</th><th>{t("status")}</th><th>{t("payMode")}</th><th className="text-right">{t("amount")}</th><th /></tr></thead>
        <tbody>{payments.map((p) => (
          <tr key={p.id} className="group/p border-b border-slate-100 last:border-0">
            <td className="px-2 py-3">{fmtD(p.paid_on)}</td><td className="text-[#2563eb]">{num.get(p.id)}</td><td>{p.reference ?? "—"}</td>
            <td className={p.kind === "payment" ? "text-[#16a34a]" : "text-slate-500"}>{p.kind === "payment" ? t("paid") : t("writtenOff")}</td><td>{p.mode ? pay(p.mode) : "—"}</td>
            <td className="text-right font-medium tabular-nums">{money(p.amount)}</td>
            <td className="w-10 text-right"><button type="button" onClick={() => onDelete(p)} aria-label={tc("delete")} className="text-slate-400 opacity-0 hover:text-red-600 group-hover/p:opacity-100"><Ico d={I.trash} /></button></td>
          </tr>))}</tbody>
      </table>
      <ul className="divide-y divide-slate-100 sm:hidden">
        {payments.map((p) => (
          <li key={p.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0 space-y-0.5 text-[14px]">
              <p className="font-medium text-[#0b1f3a]">{fmtD(p.paid_on)} <span className="font-normal text-slate-400">· #{num.get(p.id)}</span></p>
              <p className="text-slate-600">{p.kind === "payment" ? t("paymentBtn") : t("writeOff")}{p.mode ? ` · ${pay(p.mode)}` : ""}</p>
              {p.reference && <p className="text-[13px] text-slate-500">{t("ref", { r: p.reference })}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-semibold tabular-nums text-[#0b1f3a]">{money(p.amount)}</p>
              <button type="button" onClick={() => onDelete(p)} className="mt-1 text-[12px] text-red-500">{tc("delete")}</button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
