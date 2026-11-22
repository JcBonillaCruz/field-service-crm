"use client";

import PdfViewer from "@/components/ui/PdfViewer";
import { ServiceReport, jobOfInvoice, loadServiceReport, serviceReportAttachment } from "@/lib/service-report";
import { confirmDelete, askConfirm } from "@/lib/confirm";
import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UploadChoices from "@/components/ui/UploadChoices";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { db, logActivity, randomToken } from "@/lib/sales-client";
import { Comment, PAYMENT_MODES, SalesDoc, SalesFile, balanceOf, fmtD, fmtDT, money, round2, today } from "@/lib/sales";
import { inputClass } from "@/components/customers/ui";
import DatePicker from "@/components/ui/DatePicker";
import SelectMenu from "@/components/ui/SelectMenu";
import { I, Ico, Modal, SlideOver, btnGhost, btnPrimary } from "@/components/sales/SalesBits";
import { useTranslations } from "next-intl";
import { useSalesTx } from "@/i18n/useSalesTx";
import { DocLang, docDate, docEmailBody, docEmailSubject, docTextMessage } from "@/lib/doc-lang";

const Label = ({ children, req }: { children: React.ReactNode; req?: boolean }) => (
  <label className={`mb-1.5 block text-sm font-medium ${req ? "text-red-600" : "text-slate-700"}`}>{children}{req && "*"}</label>
);

export async function ensureShareToken(doc: SalesDoc): Promise<string | null> {
  if (doc.share_token) return doc.share_token;
  const token = randomToken();
  const { error } = await db().from("sales_docs").update({ share_token: token }).eq("id", doc.id);
  return error ? null : token;
}
export const shareUrl = (token: string) => `${window.location.origin}/share/${token}`;

// ---------- Enviar por correo (de verdad, con el PDF adjunto) ----------
function Chips({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const list = raw.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
    if (list.length) onChange(Array.from(new Set([...value, ...list])));
    setDraft("");
  };
  return (
    <div className="flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 focus-within:border-[#0f766e] focus-within:bg-white">
      {value.map((e) => (
        <span key={e} className={`flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm ${/^\S+@\S+\.\S+$/.test(e) ? "bg-[#e9f7f4] text-[#0b1f3a]" : "bg-red-50 text-red-600"}`}>
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold uppercase text-[#0f766e]">{e[0]}</span><span className="min-w-0 truncate">{e}</span>
          <button type="button" onClick={() => onChange(value.filter((x) => x !== e))} aria-label={`× ${e}`} className="text-slate-400 hover:text-red-600">×</button>
        </span>
      ))}
      <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={value.length ? "" : placeholder}
        onKeyDown={(e) => { if (["Enter", ",", " ", "Tab"].includes(e.key) && draft.trim()) { e.preventDefault(); add(draft); } if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1)); }}
        onBlur={() => draft.trim() && add(draft)} className="min-w-[6rem] flex-1 bg-transparent px-1 py-1 text-[15px] focus:outline-none" />
    </div>
  );
}

// ---------- Correos / teléfonos guardados del cliente (para elegir a dónde mandarlo) ----------
export type Contact = { value: string; label: string | null; is_primary: boolean };
// Etiquetas que dicen "este correo es para…": se eligen solas al enviar
const WANTS: Record<"quote" | "invoice", RegExp> = { quote: /quote|estimate|cotiz|presupuesto/i, invoice: /invoice|billing|bill|factura|pago|payment|account/i };
export function pickFor(kind: "quote" | "invoice", list: Contact[]) {
  const hit = list.filter((c) => c.label && WANTS[kind].test(c.label));
  return hit.length ? hit.map((c) => c.value) : null;
}
function ContactPills({ title, list, selected, onToggle, kind, multi = true }: { title: string; list: Contact[]; selected: string[]; onToggle: (v: string) => void; kind?: "quote" | "invoice"; multi?: boolean }) {
  const t = useTranslations("docModals");
  if (list.length < 1) return null;
  return (
    <div className="mt-2 animate-[bp-fade_0.25s_ease-out]">
      <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {list.map((c) => {
          const on = selected.includes(c.value);
          const rec = kind && c.label && WANTS[kind].test(c.label);
          return (
            <button key={c.value} type="button" onClick={() => onToggle(c.value)} aria-pressed={on}
              className={`group flex max-w-full items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-left text-[13px] transition-all duration-150 active:scale-95 ${on ? "border-[#0f766e] bg-[#e9f7f4] text-[#0b1f3a] shadow-[0_2px_8px_rgba(15,118,110,0.15)]" : "border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-[#14a39a] hover:shadow-sm"}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${on ? "bg-[#0f766e] text-white" : "bg-slate-100 text-slate-400 group-hover:bg-[#e9f7f4] group-hover:text-[#0f766e]"}`}>
                {on
                  ? <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>
                  : (multi
                    ? <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M10 5v10M5 10h10" /></svg>
                    : <span className="h-2.5 w-2.5 rounded-full border-2 border-current" />)}
              </span>
              <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${rec ? "bg-[#fff3e8] text-[#c2410c]" : "bg-slate-100 text-slate-500"}`}>{c.label || (c.is_primary ? t("main") : t("other"))}</span>
              <span className="min-w-0 truncate">{c.value}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SendEmailModal({ open, onClose, doc, companyName, actor, reminder = false, files = [], whiteLabel = false, lang: custLang = "en" }: {
  open: boolean; onClose: () => void; doc: SalesDoc; companyName: string; actor: string; reminder?: boolean; files?: SalesFile[]; whiteLabel?: boolean;
  lang?: DocLang; // Paso 6.2d: idioma del cliente; el correo, el PDF y el enlace salen en este idioma
}) {
  const t = useTranslations("docModals");
  const tc = useTranslations("common");
  const sx = useSalesTx();
  const router = useRouter();
  const noun = doc.kind === "quote" ? "Quote" : "Invoice";
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachPdf, setAttachPdf] = useState(true);
  const [lang, setLang] = useState<DocLang>(custLang);
  useEffect(() => { if (open) setLang(custLang); }, [open, custLang]);
  // Paso 5.13: reporte de servicio (solo facturas que salieron de un trabajo). Opcional en cada envío.
  const [job, setJob] = useState<{ id: string; number: string } | null>(null);
  const [withReport, setWithReport] = useState(false);
  const [report, setReport] = useState<ServiceReport | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    setJob(null); setWithReport(false); setReport(null); setPreview(false);
    if (!open || doc.kind !== "invoice" || reminder) return;
    void lang; // el reporte se vuelve a armar si cambia el idioma
    let alive = true;
    jobOfInvoice(doc.id).then((j) => { if (alive) setJob(j); }, () => undefined);
    return () => { alive = false; };
  }, [open, doc.id, doc.kind, reminder, lang]);
  async function getReport(): Promise<ServiceReport | null> {
    if (report) return report;
    if (!job) return null;
    setReportBusy(true);
    const r = await loadServiceReport(job.id, companyName, lang);
    setReportBusy(false);
    if ("error" in r) { setError(r.error); return null; }
    setReport(r); return r;
  }
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fallback, setFallback] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [book, setBook] = useState<Contact[]>([]);
  // Todos los correos guardados del cliente; si uno dice "Invoices"/"Billing" o "Quotes", se elige solo
  useEffect(() => {
    if (!open || !doc.customer_id) { setBook([]); return; }
    let alive = true;
    db().from("customer_emails").select("email, label, is_primary").eq("customer_id", doc.customer_id).order("position").then(({ data }) => {
      if (!alive) return;
      const list: Contact[] = Array.from(new Map(((data ?? []) as { email: string; label: string | null; is_primary: boolean }[])
        .filter((x) => x.email).map((x) => [x.email.toLowerCase(), { value: x.email.toLowerCase(), label: x.label, is_primary: x.is_primary }])).values());
      setBook(list);
      const auto = pickFor(doc.kind, list);
      if (auto) setTo(auto);
    });
    return () => { alive = false; };
  }, [open, doc.customer_id, doc.kind]);
  useEffect(() => {
    if (!open) return;
    setTo(doc.emails); setCc([]); setBcc([]); setShowCc(false); setError(""); setFallback(false); setAttachPdf(true); setFileIds([]);
  }, [open, doc]);
  // Asunto y texto en el idioma del cliente (Paso 6.2d). Como Zoho: "Quote - QT-001126 is awaiting your approval - Sent Using BrightPro"
  useEffect(() => {
    if (!open) return;
    const v = { kind: doc.kind, number: doc.number, customer: doc.customer_name, amount: money(doc.kind === "invoice" ? balanceOf(doc) : doc.total), due: docDate(doc.due_date, lang), actor, company: companyName, whiteLabel, reminder };
    setSubject(docEmailSubject(lang, v));
    setBody(docEmailBody(lang, v));
  }, [open, doc, companyName, actor, reminder, whiteLabel, lang]);

  function wrap(mark: string) {
    const el = ref.current; if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const sel = body.slice(a, b) || "text";
    setBody(body.slice(0, a) + mark + sel + mark + body.slice(b));
  }
  async function send() {
    if (!to.length) return setError(t("eTo"));
    if ([...to, ...cc, ...bcc].some((e) => !/^\S+@\S+\.\S+$/.test(e))) return setError(t("eEmail"));
    setBusy(true); setError(""); setFallback(false);
    let extra: { filename: string; content: string }[] | undefined;
    if (withReport && job) {
      const r = await getReport();
      if (!r) { setBusy(false); return setError(t("eReport")); }
      try { extra = [await serviceReportAttachment(r)]; } catch { setBusy(false); return setError(t("eReport")); }
    }
    const res = await fetch("/api/sales/send", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: doc.id, to, cc, bcc, subject, body, attachPdf, fileIds, reminder, extra, lang }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(j.error || t("eSend")); if (j.code === "not_configured") setFallback(true); return; }
    router.refresh(); onClose();
  }
  async function openMailApp() {
    const token = await ensureShareToken(doc);
    if (!token) return;
    const text = body.replace(/\{link\}/g, shareUrl(token)).replace(/\*\*|__|\*/g, "");
    window.location.href = `mailto:${to.join(",")}?${new URLSearchParams({ ...(cc.length ? { cc: cc.join(",") } : {}), subject, body: text }).toString().replace(/\+/g, "%20")}`;
    await db().from("sales_docs").update({ emails: to, sent_at: doc.sent_at ?? new Date().toISOString(), ...(doc.status === "draft" ? { status: "sent" } : {}) }).eq("id", doc.id);
    await logActivity(doc.company_id, doc.kind, doc.id, `${noun} sent from the email app to ${to.join(", ")}`, actor);
    router.refresh(); onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={reminder ? t("reminderTitle") : t("emailTo", { name: doc.customer_name })} width="max-w-3xl"
      footer={<>
        <button type="button" onClick={send} disabled={busy} className={btnPrimary}>{busy ? t("sending") : t("send")}</button>
        <button type="button" onClick={onClose} className={btnGhost}>{tc("cancel")}</button>
        {fallback && <button type="button" onClick={openMailApp} className="text-sm font-medium text-[#2563eb] hover:underline">{t("mailApp")}</button>}
      </>}>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="grid grid-cols-1 gap-1 border-b border-slate-100 px-4 py-2.5 text-[15px] sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center sm:gap-3">
          <span className="text-slate-500">{t("from")}</span><span className="truncate text-slate-700">{companyName} <span className="text-slate-400">{t("replies")}</span></span>
        </div>
        <div className="grid grid-cols-1 gap-1 border-b border-slate-100 px-4 py-2.5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-start sm:gap-3">
          <span className="text-[13px] font-medium text-slate-500 sm:pt-3 sm:text-[15px] sm:font-normal">{t("sendTo")}</span>
          <div className="min-w-0">
            <Chips value={to} onChange={setTo} placeholder="name@example.com" />
            <ContactPills title={t("emailsOf", { name: doc.customer_name })} list={book} selected={to} kind={doc.kind}
              onToggle={(v) => setTo((t) => (t.includes(v) ? t.filter((x) => x !== v) : [...t, v]))} />
            {!showCc && <button type="button" onClick={() => setShowCc(true)} className="mt-1.5 text-[13px] font-medium text-[#0f766e] hover:underline">{t("addCc")}</button>}
          </div>
        </div>
        {showCc && <>
          <div className="grid grid-cols-1 gap-1 border-b border-slate-100 px-4 py-2.5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-start sm:gap-3"><span className="text-[13px] font-medium text-slate-500 sm:pt-3 sm:text-[15px] sm:font-normal">Cc <span className="font-normal text-slate-400">{t("copy")}</span></span><Chips value={cc} onChange={setCc} placeholder={t("copyPh")} /></div>
          <div className="grid grid-cols-1 gap-1 border-b border-slate-100 px-4 py-2.5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-start sm:gap-3"><span className="text-[13px] font-medium text-slate-500 sm:pt-3 sm:text-[15px] sm:font-normal">Bcc <span className="font-normal text-slate-400">{t("hidden")}</span></span><Chips value={bcc} onChange={setBcc} placeholder={t("hiddenPh")} /></div>
        </>}
        <div className="grid grid-cols-1 gap-1 border-b border-slate-100 px-4 py-2 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center sm:gap-3">
          <span className="text-[13px] font-medium text-slate-500 sm:text-[15px] sm:font-normal">{t("language")}</span>
          <div className="flex flex-wrap items-center gap-2 py-0.5">
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="radiogroup" aria-label={t("language")}>
              {(["en", "es"] as const).map((l) => (
                <button key={l} type="button" role="radio" aria-checked={lang === l} onClick={() => setLang(l)}
                  className={`rounded-md px-3 py-1 text-[13.5px] font-medium transition-colors ${lang === l ? "bg-white text-[#0b1f3a] shadow-sm" : "text-slate-500 hover:text-[#0b1f3a]"}`}>
                  {l === "en" ? "English" : "Español"}
                </button>
              ))}
            </div>
            <span className="text-[12.5px] text-slate-400">{lang === custLang ? t("custLang") : t("notCustLang")}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-1 border-b border-slate-100 px-4 py-2 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center sm:gap-3">
          <span className="text-[13px] font-medium text-slate-500 sm:text-[15px] sm:font-normal">{t("subject")}</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-transparent py-1.5 text-[15px] text-slate-800 focus:outline-none" />
        </div>
        <div className="flex gap-1 border-b border-slate-100 bg-[#fafbfc] px-3 py-1.5">
          {([["**", "B", "font-bold"], ["*", "I", "italic"], ["__", "U", "underline"]] as const).map(([m, l, c]) => (
            <button key={l} type="button" onClick={() => wrap(m)} className={`h-8 w-8 rounded-md text-sm text-slate-600 hover:bg-white hover:text-[#0f766e] ${c}`}>{l}</button>
          ))}
          <span className="ml-auto hidden self-center text-[12px] text-slate-400 sm:block">{t("linkHint", { kind: doc.kind, link: "{link}" })}</span>
        </div>
        <textarea ref={ref} rows={11} value={body} onChange={(e) => setBody(e.target.value)} className="w-full resize-y px-4 py-3 text-[15px] leading-relaxed text-slate-800 focus:outline-none" />
      </div>
      <label className="mt-3 flex cursor-pointer flex-wrap items-center gap-3 rounded-xl bg-[#eef6ff] px-4 py-3 text-[15px] text-slate-700">
        <input type="checkbox" checked={attachPdf} onChange={(e) => setAttachPdf(e.target.checked)} className="h-4 w-4 accent-[#2563eb]" />
        {t("attachPdf", { kind: doc.kind })}
        <span className="ml-auto flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"><Ico d={I.pdf} className="h-4 w-4 text-red-500" />{doc.number}</span>
      </label>
      {job && (
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl bg-[#e9f7f4] px-4 py-3 text-[15px] text-slate-700">
          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
            <input type="checkbox" checked={withReport} onChange={(e) => { setWithReport(e.target.checked); if (e.target.checked) getReport(); }} className="mt-1 h-4 w-4 accent-[#0f766e]" />
            <span className="min-w-0">{t("report")}
              <span className="block text-[12.5px] text-slate-500">{reportBusy ? t("reportBusy") : report && withReport
                ? `${t("reportReady", { form: report.hasForm ? "yes" : "no", n: report.photos, job: job.number })}${report.photosLeftOut ? ` ${t("reportLeft", { n: report.photosLeftOut })}` : ""} ${t("reportNoPrices")}`
                : t("reportHint", { job: job.number })}</span>
            </span>
          </label>
          <button type="button" disabled={reportBusy} onClick={async () => { if (await getReport()) setPreview(true); }} className="rounded-lg border border-[#0f766e]/30 bg-white px-3 py-1.5 text-sm font-semibold text-[#0f766e] hover:border-[#0f766e] disabled:opacity-50">{t("preview")}</button>
        </div>
      )}
      {preview && report && <PdfViewer doc={report.doc} onClose={() => setPreview(false)} />}
      {files.length > 0 && (
        <div className="mt-2 rounded-xl border border-dashed border-slate-200 px-4 py-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-[#2563eb]"><Ico d={I.clip} className="h-4 w-4" />{t("attachments")}</p>
          {files.map((f) => (
            <label key={f.id} className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-slate-700">
              <input type="checkbox" checked={fileIds.includes(f.id)} onChange={() => setFileIds((l) => (l.includes(f.id) ? l.filter((x) => x !== f.id) : [...l, f.id]))} className="h-4 w-4 accent-[#2563eb]" />{f.name}
            </label>
          ))}
        </div>
      )}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
    </Modal>
  );
}

// ---------- Compartir enlace público ----------
export function ShareModal({ open, onClose, doc, actor, companyName = "", lang = "en" }: { open: boolean; onClose: () => void; doc: SalesDoc; actor: string; companyName?: string; lang?: DocLang }) {
  const t = useTranslations("docModals");
  const tc = useTranslations("common");
  const sx = useSalesTx();
  const router = useRouter();
  const [token, setToken] = useState(doc.share_token);
  const [phone, setPhone] = useState("");
  const [phones, setPhones] = useState<Contact[]>([]);
  // Teléfonos del cliente para mandarlo por mensaje o WhatsApp (se elige el principal; puedes cambiarlo con un toque)
  useEffect(() => {
    if (!open || !doc.customer_id) { setPhones([]); return; }
    db().from("customer_phones").select("number, label, is_primary").eq("customer_id", doc.customer_id).order("position").then(({ data }) => {
      const list = ((data ?? []) as { number: string; label: string | null; is_primary: boolean }[]).filter((x) => x.number).map((x) => ({ value: x.number, label: x.label, is_primary: x.is_primary }));
      setPhones(list);
      const main = list.find((x) => x.is_primary) ?? list[0];
      if (main) setPhone(main.value);
    });
  }, [open, doc.customer_id]);
  async function sendBy(channel: "sms" | "whatsapp" | "native") {
    let t = token;
    if (!t) { t = randomToken(); await db().from("sales_docs").update({ share_token: t }).eq("id", doc.id); setToken(t); }
    const amount = money(doc.kind === "invoice" ? balanceOf(doc) : doc.total);
    // Paso 6.2d: el texto sale en el idioma del cliente
    const text = docTextMessage(lang, { kind: doc.kind, number: doc.number, customer: doc.customer_name, amount, company: companyName, url: shareUrl(t) });
    const digits = phone.replace(/\D/g, "");
    const intl = digits.length === 10 ? `1${digits}` : digits;
    if (channel === "native" && navigator.share) { try { await navigator.share({ title: `${noun} ${doc.number}`, text }); } catch { return; } }
    else if (channel === "whatsapp") window.open(`https://wa.me/${intl}?text=${encodeURIComponent(text)}`, "_blank");
    else window.location.href = `sms:${digits ? `+${intl}` : ""}${/iPhone|iPad|Mac/.test(navigator.userAgent) ? "&" : "?"}body=${encodeURIComponent(text)}`;
    const how = channel === "whatsapp" ? "WhatsApp" : channel === "sms" ? "text message" : "the phone's share menu";
    await db().from("sales_docs").update({ ...(doc.status === "draft" ? { status: "sent", sent_at: new Date().toISOString() } : {}) }).eq("id", doc.id);
    await logActivity(doc.company_id, doc.kind, doc.id, `${noun} shared by ${how}${digits ? ` to ${phone}` : ""}`, actor);
    router.refresh();
  }
  const [expires, setExpires] = useState(doc.share_expires_on ?? "");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setToken(doc.share_token); setExpires(doc.share_expires_on ?? ""); setCopied(false); } }, [open, doc]);
  const noun = doc.kind === "quote" ? "Quote" : "Invoice";

  async function generate() {
    setBusy(true);
    const t = token ?? randomToken();
    await db().from("sales_docs").update({ share_token: t, share_expires_on: expires || null }).eq("id", doc.id);
    await logActivity(doc.company_id, doc.kind, doc.id, `${noun} link shared`, actor);
    setToken(t); setBusy(false); router.refresh();
  }
  async function disable() {
    if (!(await askConfirm({ title: t("disableQ"), message: t("disableMsg"), confirmLabel: t("disable"), tone: "danger" }))) return;
    await db().from("sales_docs").update({ share_token: null }).eq("id", doc.id);
    setToken(null); router.refresh();
  }
  async function copy() {
    if (!token) return;
    try { await navigator.clipboard.writeText(shareUrl(token)); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* sin permiso */ }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("shareTitle", { kind: doc.kind })}>
      <div className="space-y-4">
        {/* Por mensaje de texto o WhatsApp */}
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="mb-2 text-sm font-semibold text-[#0b1f3a]">{t("byText")}</p>
          <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("phonePh")} className={inputClass} />
          {phones.length > 1 && <ContactPills title={t("phonesOf", { name: doc.customer_name })} list={phones} selected={[phone]} multi={false} onToggle={setPhone} />}
          {/* Solo íconos (profesionales, con animación al pasar el mouse) */}
          <div className="mt-4 flex items-center justify-center gap-5">
            <button type="button" onClick={() => sendBy("sms")} aria-label={t("bySms")} title={t("sms")}
              className="group/sh relative flex h-14 w-14 items-center justify-center rounded-full bg-[#0f766e] text-white shadow-[0_6px_16px_rgba(15,118,110,0.3)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_26px_rgba(15,118,110,0.4)] active:scale-90">
              <span className="absolute inset-0 rounded-full ring-2 ring-[#0f766e]/40 opacity-0 group-hover/sh:animate-[bp-share-ring_1.2s_ease-out_infinite]" />
              <svg viewBox="0 0 24 24" className="h-7 w-7 transition-transform duration-300 group-hover/sh:-rotate-6 group-hover/sh:scale-110" fill="none" aria-hidden="true">
                <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.4c-.5.4-1.3 0-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z" fill="currentColor" />
                <circle cx="8.5" cy="10" r="1.15" fill="#0f766e" className="group-hover/sh:animate-[bp-dot_1s_ease-in-out_infinite]" />
                <circle cx="12" cy="10" r="1.15" fill="#0f766e" className="group-hover/sh:animate-[bp-dot_1s_ease-in-out_0.15s_infinite]" />
                <circle cx="15.5" cy="10" r="1.15" fill="#0f766e" className="group-hover/sh:animate-[bp-dot_1s_ease-in-out_0.3s_infinite]" />
              </svg>
            </button>
            <button type="button" onClick={() => sendBy("whatsapp")} aria-label={t("byWa")} title="WhatsApp"
              className="group/sh relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-[0_6px_16px_rgba(37,211,102,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_26px_rgba(37,211,102,0.45)] active:scale-90">
              <span className="absolute inset-0 rounded-full ring-2 ring-[#25d366]/45 opacity-0 group-hover/sh:animate-[bp-share-ring_1.2s_ease-out_infinite]" />
              <svg viewBox="0 0 24 24" className="h-7 w-7 transition-transform duration-300 group-hover/sh:rotate-[8deg] group-hover/sh:scale-110" aria-hidden="true">
                <path d="M12 2.4a9.6 9.6 0 0 0-8.3 14.4L2.4 21.6l4.9-1.3A9.6 9.6 0 1 0 12 2.4z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
                <path className="origin-center group-hover/sh:animate-[bp-ring_0.9s_ease-in-out]" d="M8.7 7.3c.3-.3.8-.3 1 .1l1.1 1.6c.2.3.2.7-.1 1l-.6.6c.5 1.2 1.5 2.2 2.7 2.8l.6-.6c.3-.3.7-.3 1-.1l1.6 1.1c.4.2.4.7.1 1l-.6.7c-.6.6-1.5.8-2.3.5-2.4-.9-4.2-2.7-5.1-5.1-.3-.8-.1-1.7.5-2.3z" fill="currentColor" />
              </svg>
            </button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button type="button" onClick={() => sendBy("native")} aria-label={t("otherApps")} title={t("moreApps")}
                className="group/sh relative flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#14a39a] hover:text-[#0f766e] hover:shadow-[0_10px_22px_rgba(15,40,60,0.12)] active:scale-90">
                <svg viewBox="0 0 24 24" className="h-6 w-6 transition-transform duration-300 group-hover/sh:-translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12.5v6A2 2 0 0 0 7 20.5h10a2 2 0 0 0 2-2v-6" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <p className="text-[15px] text-slate-600">{t("anyone", { kind: doc.kind })}</p>
        <div>
          <Label>{t("linkExp")}</Label>
          <div className="max-w-[220px]"><DatePicker value={expires} onChange={setExpires} minDate={today()} placeholder={t("never")} /></div>
        </div>
        {token ? (
          <>
            <div className="flex items-stretch overflow-hidden rounded-lg border border-slate-200">
              <input readOnly value={shareUrl(token)} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:outline-none" />
              <button type="button" onClick={copy} className="shrink-0 border-l border-slate-200 bg-white px-4 text-sm font-medium text-[#0f766e] hover:bg-[#e9f7f4]">{copied ? t("copied") : t("copyLink")}</button>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={generate} disabled={busy} className={btnGhost}>{t("updateExp")}</button>
              <a href={shareUrl(token)} target="_blank" rel="noreferrer" className={btnGhost}>{t("openLink")}</a>
              <button type="button" onClick={disable} className="text-sm font-medium text-red-600 hover:underline">{t("disable")}</button>
            </div>
          </>
        ) : (
          <button type="button" onClick={generate} disabled={busy} className={btnPrimary}>{busy ? t("generating") : t("generate")}</button>
        )}
      </div>
    </Modal>
  );
}

// ---------- Registrar pago / cancelar saldo ----------
export function PaymentModal({ open, onClose, doc, actor, mode, onDone }: {
  open: boolean; onClose: () => void; doc: SalesDoc; actor: string; mode: "payment" | "write_off"; onDone: () => void;
}) {
  const t = useTranslations("docModals");
  const tc = useTranslations("common");
  const sx = useSalesTx();
  const bal = balanceOf(doc);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [pm, setPm] = useState("Cash");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setAmount(bal.toFixed(2)); setDate(today()); setRef(""); setNotes(""); setError(""); } }, [open, bal]);

  async function save() {
    const a = round2(Number(amount.replace(/[^0-9.]/g, "")));
    if (!a || a <= 0) return setError(t("eAmount"));
    if (a > bal + 0.001) return setError(t("eTooMuch", { amount: sx.money(bal) }));
    setBusy(true); setError("");
    const { error: e } = await db().from("sales_payments").insert({
      company_id: doc.company_id, invoice_id: doc.id, kind: mode, amount: a, paid_on: date, mode: mode === "payment" ? pm : null,
      reference: ref.trim() || null, notes: notes.trim() || null, created_by_name: actor,
    });
    if (e) { setBusy(false); return setError(t("eSave")); }
    const { refreshInvoicePaid } = await import("@/lib/sales-client");
    await refreshInvoicePaid(doc);
    await logActivity(doc.company_id, "invoice", doc.id, mode === "payment" ? `Payment of ${money(a)} recorded (${pm})` : `${money(a)} written off`, actor, notes.trim() || undefined);
    setBusy(false); onDone(); onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={mode === "payment" ? t("payFor", { n: doc.number }) : t("writeOffN", { n: doc.number })}
      footer={<>
        <button type="button" onClick={save} disabled={busy} className={btnPrimary}>{busy ? tc("saving") : mode === "payment" ? t("record") : t("writeOff")}</button>
        <button type="button" onClick={onClose} className={btnGhost}>{tc("cancel")}</button>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </>}>
      <div className="space-y-4">
        <p className="rounded-lg bg-[#f6fbfa] px-4 py-3 text-sm text-slate-600">{t.rich("balanceDue", { amount: sx.money(bal), b: (c) => <b className="text-[#0b1f3a]">{c}</b> })} · {doc.customer_name}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label req>{mode === "payment" ? t("received") : t("toWriteOff")}</Label>
            <div className="flex"><span className="flex items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-100 px-3 text-sm text-slate-600">USD</span>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className={`${inputClass} rounded-l-none`} /></div>
          </div>
          <div><Label req>{mode === "payment" ? t("payDate") : t("date")}</Label><DatePicker value={date} onChange={setDate} /></div>
          {mode === "payment" && <div><Label>{t("payMode")}</Label><SelectMenu value={pm} options={PAYMENT_MODES.map((m) => ({ value: m, label: sx.pay(m) }))} onChange={setPm} ariaLabel={t("payMode")} /></div>}
          {mode === "payment" && <div><Label>{t("reference")}</Label><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={t("refPh")} className={inputClass} /></div>}
        </div>
        <div><Label>{mode === "payment" ? t("notes") : t("reason")}</Label><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} /></div>
      </div>
    </Modal>
  );
}

// ---------- Fecha esperada de pago ----------
export function ExpectedDateModal({ open, onClose, doc, actor }: { open: boolean; onClose: () => void; doc: SalesDoc; actor: string }) {
  const t = useTranslations("docModals");
  const tc = useTranslations("common");
  const sx = useSalesTx();
  const router = useRouter();
  const [date, setDate] = useState(doc.expected_payment_date ?? "");
  useEffect(() => { if (open) setDate(doc.expected_payment_date ?? ""); }, [open, doc]);
  async function save() {
    await db().from("sales_docs").update({ expected_payment_date: date || null }).eq("id", doc.id);
    await logActivity(doc.company_id, "invoice", doc.id, date ? `Expected payment date set to ${fmtD(date)}` : "Expected payment date removed", actor);
    router.refresh(); onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title={t("expected")}
      footer={<><button type="button" onClick={save} className={btnPrimary}>{tc("save")}</button><button type="button" onClick={onClose} className={btnGhost}>{tc("cancel")}</button></>}>
      <p className="mb-3 text-[15px] text-slate-600">{t("expectedText", { n: doc.number })}</p>
      <div className="max-w-[240px]"><DatePicker value={date} onChange={setDate} /></div>
    </Modal>
  );
}

// ---------- Comentarios (negrita, cursiva, subrayado) ----------
function rich(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <b key={i}>{p.slice(2, -2)}</b>;
    if (/^__[^_]+__$/.test(p)) return <u key={i}>{p.slice(2, -2)}</u>;
    if (/^\*[^*]+\*$/.test(p)) return <i key={i}>{p.slice(1, -1)}</i>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}
export function CommentsPanel({ open, onClose, entity, entityId, companyId, comments, actor }: {
  open: boolean; onClose: () => void; entity: string; entityId: string; companyId: string; comments: Comment[]; actor: string;
}) {
  const t = useTranslations("docModals");
  const tc = useTranslations("common");
  const sx = useSalesTx();
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  function wrap(mark: string) {
    const el = ref.current; if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const sel = text.slice(a, b) || "text";
    setText(text.slice(0, a) + mark + sel + mark + text.slice(b));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + mark.length, a + mark.length + sel.length); });
  }
  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    await db().from("sales_comments").insert({ company_id: companyId, entity, entity_id: entityId, body: text.trim(), author_name: actor });
    setText(""); setBusy(false); router.refresh();
  }
  async function remove(id: string) {
    await db().from("sales_comments").delete().eq("id", id);
    router.refresh();
  }
  return (
    <SlideOver open={open} onClose={onClose} title={t("comments")}>
      <div className="p-5">
        <div className="overflow-hidden rounded-xl border border-slate-200 focus-within:border-[#0f766e]">
          <div className="flex gap-1 border-b border-slate-100 bg-[#fafbfc] px-2 py-1.5">
            {([["**", "B", "font-bold"], ["*", "I", "italic"], ["__", "U", "underline"]] as const).map(([m, l, c]) => (
              <button key={l} type="button" onClick={() => wrap(m)} className={`h-8 w-8 rounded-md text-sm text-slate-600 hover:bg-white hover:text-[#0f766e] ${c}`}>{l}</button>
            ))}
          </div>
          <textarea ref={ref} rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("commentPh")} className="w-full resize-none px-3 py-2.5 text-[15px] focus:outline-none" />
          <div className="border-t border-slate-100 px-3 py-2">
            <button type="button" onClick={add} disabled={busy || !text.trim()} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-[#14a39a] hover:text-[#0f766e] disabled:opacity-50">{t("addComment")}</button>
          </div>
        </div>
        <p className="mt-6 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("allComments")}</p>
        <div className="mt-2 border-t border-slate-100">
          {comments.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">{t("noComments")}</p> : comments.map((c) => (
            <div key={c.id} className="group/c border-b border-slate-100 py-3">
              <div className="flex items-center justify-between gap-2 text-[13px] text-slate-500">
                <span><b className="font-medium text-[#0b1f3a]">{c.author_name || t("someone")}</b> · {sx.fmtDT(c.created_at)}</span>
                <button type="button" onClick={() => remove(c.id)} className="text-xs text-red-500 opacity-0 transition-opacity hover:underline group-hover/c:opacity-100">{tc("delete")}</button>
              </div>
              <p className="mt-1 whitespace-pre-line text-[15px] text-slate-700">{rich(c.body)}</p>
            </div>
          ))}
        </div>
      </div>
    </SlideOver>
  );
}

// ---------- Archivos adjuntos (máx. 5, 10 MB cada uno) ----------
export function AttachmentsButton({ entity, entityId, companyId, files }: { entity: string; entityId: string; companyId: string; files: SalesFile[] }) {
  const t = useTranslations("docModals");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setError("");
    const arr = Array.from(list);
    const max = entity === "invoice" ? 15 : 5;
    if (files.length + arr.length > max) return setError(t("eMaxFiles", { max }));
    if (arr.some((f) => f.size > 10 * 1024 * 1024)) return setError(t("eFileSize"));
    setBusy(true);
    const supabase = db();
    for (const f of arr) {
      const path = `${companyId}/${entityId}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error: e } = await supabase.storage.from("sales-attachments").upload(path, f);
      if (e) { setError(t("eUpload")); continue; }
      await supabase.from("sales_files").insert({ company_id: companyId, entity, entity_id: entityId, name: f.name, path, size: f.size, mime: f.type });
    }
    setBusy(false); router.refresh();
  }
  async function open(f: SalesFile) {
    const { data } = await db().storage.from("sales-attachments").createSignedUrl(f.path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }
  async function remove(f: SalesFile) {
    if (!(await confirmDelete({ title: t("removeQ", { name: f.name }), message: t("removeMsg"), confirmLabel: t("remove") }))) return;
    const supabase = db();
    await supabase.storage.from("sales-attachments").remove([f.path]);
    await supabase.from("sales_files").delete().eq("id", f.id);
    router.refresh();
  }
  return (
    <Popover className="relative">
      <PopoverButton aria-label={t("attachments")} title={t("attachments")}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:text-[#0f766e] data-[open]:border-[#14a39a] data-[open]:text-[#0f766e] focus:outline-none">
        <Ico d={I.clip} className="h-[18px] w-[18px]" />
        {files.length > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0f766e] px-1 text-[10px] font-semibold text-white">{files.length}</span>}
      </PopoverButton>
      <PopoverPanel anchor="bottom end" transition className="z-[80] mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0">
        <p className="border-b border-slate-100 px-4 py-3 font-semibold text-[#0b1f3a]">{t("attachments")}</p>
        {files.length === 0 ? <p className="px-4 py-4 text-center text-sm text-slate-500">{t("noFiles")}</p> : (
          <ul className="max-h-60 overflow-y-auto py-1">
            {files.map((f) => (
              <li key={f.id} className="group/f flex items-center gap-2 px-4 py-2 hover:bg-[#f6fbfa]">
                <button type="button" onClick={() => open(f)} className="min-w-0 flex-1 truncate text-left text-sm text-[#0f766e] hover:underline">{f.name}</button>
                <span className="shrink-0 text-xs text-slate-400">{f.size ? `${Math.max(1, Math.round(f.size / 1024))} KB` : ""}</span>
                <button type="button" onClick={() => remove(f)} aria-label={t("remove")} className="text-slate-400 opacity-0 hover:text-red-600 group-hover/f:opacity-100"><Ico d={I.trash} /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="p-3">
          <UploadChoices compact disabled={busy} onFiles={upload} />
          {busy && <p className="mt-2 text-center text-[12px] font-medium text-[#0f766e]">{t("uploading")}</p>}
          <p className="mt-2 text-[11px] text-slate-400">{entity === "invoice" ? t("filesInvoice") : t("filesQuote")}</p>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      </PopoverPanel>
    </Popover>
  );
}
