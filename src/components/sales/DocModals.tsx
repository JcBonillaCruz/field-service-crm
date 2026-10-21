"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { db, logActivity, randomToken } from "@/lib/sales-client";
import { Comment, PAYMENT_MODES, SalesDoc, SalesFile, balanceOf, fmtD, fmtDT, money, round2, today } from "@/lib/sales";
import { inputClass } from "@/components/customers/ui";
import DatePicker from "@/components/ui/DatePicker";
import SelectMenu from "@/components/ui/SelectMenu";
import { I, Ico, Modal, SlideOver, btnGhost, btnPrimary } from "@/components/sales/SalesBits";

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
        <span key={e} className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-sm ${/^\S+@\S+\.\S+$/.test(e) ? "bg-[#e9f7f4] text-[#0b1f3a]" : "bg-red-50 text-red-600"}`}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-semibold uppercase text-[#0f766e]">{e[0]}</span>{e}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== e))} aria-label={`Remove ${e}`} className="text-slate-400 hover:text-red-600">×</button>
        </span>
      ))}
      <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={value.length ? "" : placeholder}
        onKeyDown={(e) => { if (["Enter", ",", " ", "Tab"].includes(e.key) && draft.trim()) { e.preventDefault(); add(draft); } if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1)); }}
        onBlur={() => draft.trim() && add(draft)} className="min-w-[10rem] flex-1 bg-transparent px-1 py-1 text-[15px] focus:outline-none" />
    </div>
  );
}

export function SendEmailModal({ open, onClose, doc, companyName, actor, reminder = false, files = [] }: {
  open: boolean; onClose: () => void; doc: SalesDoc; companyName: string; actor: string; reminder?: boolean; files?: SalesFile[];
}) {
  const router = useRouter();
  const noun = doc.kind === "quote" ? "Quote" : "Invoice";
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachPdf, setAttachPdf] = useState(true);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fallback, setFallback] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!open) return;
    setTo(doc.emails); setCc([]); setBcc([]); setShowCc(false); setError(""); setFallback(false); setAttachPdf(true); setFileIds([]);
    setSubject(reminder ? `Payment reminder for Invoice - ${doc.number}` : `${noun} from ${companyName} (${noun}#: ${doc.number})`);
    const amount = money(doc.kind === "invoice" ? balanceOf(doc) : doc.total);
    setBody(reminder
      ? `Dear ${doc.customer_name},\n\nThis is a friendly reminder that invoice ${doc.number} for ${amount} was due on ${fmtD(doc.due_date)}.\n\nYou can view, print or download the invoice from the link below.\n{link}\n\nThank you,\n${actor || companyName}\n${companyName}`
      : doc.kind === "quote"
        ? `Dear ${doc.customer_name},\n\nThank you for contacting us. Your quote ${doc.number} for **${amount}** is ready.\n\nYou can view, accept and sign the quote from the link below.\n{link}\n\nWe look forward to working with you.\n\nRegards,\n${actor || companyName}\n${companyName}`
        : `Dear ${doc.customer_name},\n\nIt was a pleasure doing business with you. Your invoice ${doc.number} for **${amount}** is due on ${fmtD(doc.due_date)}.\n\nYou can view, print or download the invoice from the link below.\n{link}\n\nRegards,\n${actor || companyName}\n${companyName}`);
  }, [open, doc, companyName, actor, reminder, noun]);

  function wrap(mark: string) {
    const el = ref.current; if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const sel = body.slice(a, b) || "text";
    setBody(body.slice(0, a) + mark + sel + mark + body.slice(b));
  }
  async function send() {
    if (!to.length) return setError("Add at least one email address.");
    if ([...to, ...cc, ...bcc].some((e) => !/^\S+@\S+\.\S+$/.test(e))) return setError("One of the email addresses isn't valid.");
    setBusy(true); setError(""); setFallback(false);
    const res = await fetch("/api/sales/send", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: doc.id, to, cc, bcc, subject, body, attachPdf, fileIds, reminder }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(j.error || "The email couldn't be sent."); if (j.code === "not_configured") setFallback(true); return; }
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
    <Modal open={open} onClose={onClose} title={reminder ? "Send Payment Reminder" : `Email To ${doc.customer_name}`} width="max-w-3xl"
      footer={<>
        <button type="button" onClick={send} disabled={busy} className={btnPrimary}>{busy ? "Sending..." : "Send"}</button>
        <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
        {fallback && <button type="button" onClick={openMailApp} className="text-sm font-medium text-[#2563eb] hover:underline">Open in my email app instead</button>}
      </>}>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-[15px]">
          <span className="text-slate-500">From</span><span className="truncate text-slate-700">{companyName} <span className="text-slate-400">· replies go to you</span></span>
        </div>
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-3 border-b border-slate-100 px-4 py-2">
          <span className="pt-3 text-[15px] text-slate-500">Send To</span>
          <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><Chips value={to} onChange={setTo} placeholder="name@example.com" /></div>
            {!showCc && <button type="button" onClick={() => setShowCc(true)} className="shrink-0 pt-3 text-sm text-[#2563eb] hover:underline">Cc / Bcc</button>}</div>
        </div>
        {showCc && <>
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-3 border-b border-slate-100 px-4 py-2"><span className="pt-3 text-[15px] text-slate-500">Cc</span><Chips value={cc} onChange={setCc} /></div>
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-3 border-b border-slate-100 px-4 py-2"><span className="pt-3 text-[15px] text-slate-500">Bcc</span><Chips value={bcc} onChange={setBcc} /></div>
        </>}
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 border-b border-slate-100 px-4 py-1.5">
          <span className="text-[15px] text-slate-500">Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-transparent py-1.5 text-[15px] text-slate-800 focus:outline-none" />
        </div>
        <div className="flex gap-1 border-b border-slate-100 bg-[#fafbfc] px-3 py-1.5">
          {([["**", "B", "font-bold"], ["*", "I", "italic"], ["__", "U", "underline"]] as const).map(([m, l, c]) => (
            <button key={l} type="button" onClick={() => wrap(m)} className={`h-8 w-8 rounded-md text-sm text-slate-600 hover:bg-white hover:text-[#0f766e] ${c}`}>{l}</button>
          ))}
          <span className="ml-auto self-center text-[12px] text-slate-400">{"{link}"} becomes a &quot;View {noun}&quot; button</span>
        </div>
        <textarea ref={ref} rows={11} value={body} onChange={(e) => setBody(e.target.value)} className="w-full resize-y px-4 py-3 text-[15px] leading-relaxed text-slate-800 focus:outline-none" />
      </div>
      <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl bg-[#eef6ff] px-4 py-3 text-[15px] text-slate-700">
        <input type="checkbox" checked={attachPdf} onChange={(e) => setAttachPdf(e.target.checked)} className="h-4 w-4 accent-[#2563eb]" />
        Attach {noun} PDF
        <span className="ml-auto flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"><Ico d={I.pdf} className="h-4 w-4 text-red-500" />{doc.number}</span>
      </label>
      {files.length > 0 && (
        <div className="mt-2 rounded-xl border border-dashed border-slate-200 px-4 py-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-[#2563eb]"><Ico d={I.clip} className="h-4 w-4" />Attachments</p>
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
export function ShareModal({ open, onClose, doc, actor }: { open: boolean; onClose: () => void; doc: SalesDoc; actor: string }) {
  const router = useRouter();
  const [token, setToken] = useState(doc.share_token);
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
    if (!window.confirm("Disable this link? Anyone who has it won't be able to open it anymore.")) return;
    await db().from("sales_docs").update({ share_token: null }).eq("id", doc.id);
    setToken(null); router.refresh();
  }
  async function copy() {
    if (!token) return;
    try { await navigator.clipboard.writeText(shareUrl(token)); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* sin permiso */ }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Share ${noun} Link`}>
      <div className="space-y-4">
        <p className="text-[15px] text-slate-600">Anyone with the link can view, print and download this {noun.toLowerCase()}. They can't see anything else in your account.</p>
        <div>
          <Label>Link Expiration Date</Label>
          <div className="max-w-[220px]"><DatePicker value={expires} onChange={setExpires} minDate={today()} placeholder="Never expires" /></div>
        </div>
        {token ? (
          <>
            <div className="flex items-stretch overflow-hidden rounded-lg border border-slate-200">
              <input readOnly value={shareUrl(token)} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:outline-none" />
              <button type="button" onClick={copy} className="shrink-0 border-l border-slate-200 bg-white px-4 text-sm font-medium text-[#0f766e] hover:bg-[#e9f7f4]">{copied ? "Copied!" : "Copy Link"}</button>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={generate} disabled={busy} className={btnGhost}>Update expiration</button>
              <a href={shareUrl(token)} target="_blank" rel="noreferrer" className={btnGhost}>Open link</a>
              <button type="button" onClick={disable} className="text-sm font-medium text-red-600 hover:underline">Disable link</button>
            </div>
          </>
        ) : (
          <button type="button" onClick={generate} disabled={busy} className={btnPrimary}>{busy ? "Generating..." : "Generate Link"}</button>
        )}
      </div>
    </Modal>
  );
}

// ---------- Registrar pago / cancelar saldo ----------
export function PaymentModal({ open, onClose, doc, actor, mode, onDone }: {
  open: boolean; onClose: () => void; doc: SalesDoc; actor: string; mode: "payment" | "write_off"; onDone: () => void;
}) {
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
    if (!a || a <= 0) return setError("Enter the amount.");
    if (a > bal + 0.001) return setError(`The amount can't be more than the balance due (${money(bal)}).`);
    setBusy(true); setError("");
    const { error: e } = await db().from("sales_payments").insert({
      company_id: doc.company_id, invoice_id: doc.id, kind: mode, amount: a, paid_on: date, mode: mode === "payment" ? pm : null,
      reference: ref.trim() || null, notes: notes.trim() || null, created_by_name: actor,
    });
    if (e) { setBusy(false); return setError("It couldn't be saved. Did you run the SQL for Paso 3.30?"); }
    const { refreshInvoicePaid } = await import("@/lib/sales-client");
    await refreshInvoicePaid(doc);
    await logActivity(doc.company_id, "invoice", doc.id, mode === "payment" ? `Payment of ${money(a)} recorded (${pm})` : `${money(a)} written off`, actor, notes.trim() || undefined);
    setBusy(false); onDone(); onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={mode === "payment" ? `Payment for ${doc.number}` : `Write Off ${doc.number}`}
      footer={<>
        <button type="button" onClick={save} disabled={busy} className={btnPrimary}>{busy ? "Saving..." : mode === "payment" ? "Record Payment" : "Write Off"}</button>
        <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </>}>
      <div className="space-y-4">
        <p className="rounded-lg bg-[#f6fbfa] px-4 py-3 text-sm text-slate-600">Balance due: <b className="text-[#0b1f3a]">{money(bal)}</b> · {doc.customer_name}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label req>{mode === "payment" ? "Amount Received" : "Amount to Write Off"}</Label>
            <div className="flex"><span className="flex items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-100 px-3 text-sm text-slate-600">USD</span>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className={`${inputClass} rounded-l-none`} /></div>
          </div>
          <div><Label req>{mode === "payment" ? "Payment Date" : "Date"}</Label><DatePicker value={date} onChange={setDate} /></div>
          {mode === "payment" && <div><Label>Payment Mode</Label><SelectMenu value={pm} options={PAYMENT_MODES.map((m) => ({ value: m, label: m }))} onChange={setPm} ariaLabel="Payment mode" /></div>}
          {mode === "payment" && <div><Label>Reference#</Label><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Check # or transaction ID" className={inputClass} /></div>}
        </div>
        <div><Label>{mode === "payment" ? "Notes" : "Reason"}</Label><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} /></div>
      </div>
    </Modal>
  );
}

// ---------- Fecha esperada de pago ----------
export function ExpectedDateModal({ open, onClose, doc, actor }: { open: boolean; onClose: () => void; doc: SalesDoc; actor: string }) {
  const router = useRouter();
  const [date, setDate] = useState(doc.expected_payment_date ?? "");
  useEffect(() => { if (open) setDate(doc.expected_payment_date ?? ""); }, [open, doc]);
  async function save() {
    await db().from("sales_docs").update({ expected_payment_date: date || null }).eq("id", doc.id);
    await logActivity(doc.company_id, "invoice", doc.id, date ? `Expected payment date set to ${fmtD(date)}` : "Expected payment date removed", actor);
    router.refresh(); onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title="Expected Payment Date"
      footer={<><button type="button" onClick={save} className={btnPrimary}>Save</button><button type="button" onClick={onClose} className={btnGhost}>Cancel</button></>}>
      <p className="mb-3 text-[15px] text-slate-600">When does the customer plan to pay {doc.number}? It shows on the invoice so your team can follow up.</p>
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
    <SlideOver open={open} onClose={onClose} title="Comments">
      <div className="p-5">
        <div className="overflow-hidden rounded-xl border border-slate-200 focus-within:border-[#0f766e]">
          <div className="flex gap-1 border-b border-slate-100 bg-[#fafbfc] px-2 py-1.5">
            {([["**", "B", "font-bold"], ["*", "I", "italic"], ["__", "U", "underline"]] as const).map(([m, l, c]) => (
              <button key={l} type="button" onClick={() => wrap(m)} className={`h-8 w-8 rounded-md text-sm text-slate-600 hover:bg-white hover:text-[#0f766e] ${c}`}>{l}</button>
            ))}
          </div>
          <textarea ref={ref} rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment for your team" className="w-full resize-none px-3 py-2.5 text-[15px] focus:outline-none" />
          <div className="border-t border-slate-100 px-3 py-2">
            <button type="button" onClick={add} disabled={busy || !text.trim()} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-[#14a39a] hover:text-[#0f766e] disabled:opacity-50">Add Comment</button>
          </div>
        </div>
        <p className="mt-6 text-[12px] font-semibold uppercase tracking-wide text-slate-500">All Comments</p>
        <div className="mt-2 border-t border-slate-100">
          {comments.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No comments yet.</p> : comments.map((c) => (
            <div key={c.id} className="group/c border-b border-slate-100 py-3">
              <div className="flex items-center justify-between gap-2 text-[13px] text-slate-500">
                <span><b className="font-medium text-[#0b1f3a]">{c.author_name || "A team member"}</b> · {fmtDT(c.created_at)}</span>
                <button type="button" onClick={() => remove(c.id)} className="text-xs text-red-500 opacity-0 transition-opacity hover:underline group-hover/c:opacity-100">Delete</button>
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
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setError("");
    const arr = Array.from(list);
    if (files.length + arr.length > 5) return setError("You can upload a maximum of 5 files.");
    if (arr.some((f) => f.size > 10 * 1024 * 1024)) return setError("Each file must be 10 MB or smaller.");
    setBusy(true);
    const supabase = db();
    for (const f of arr) {
      const path = `${companyId}/${entityId}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error: e } = await supabase.storage.from("sales-attachments").upload(path, f);
      if (e) { setError("A file couldn't be uploaded. Did you run the SQL for Paso 3.30?"); continue; }
      await supabase.from("sales_files").insert({ company_id: companyId, entity, entity_id: entityId, name: f.name, path, size: f.size, mime: f.type });
    }
    setBusy(false); router.refresh();
  }
  async function open(f: SalesFile) {
    const { data } = await db().storage.from("sales-attachments").createSignedUrl(f.path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }
  async function remove(f: SalesFile) {
    if (!window.confirm(`Remove "${f.name}"?`)) return;
    const supabase = db();
    await supabase.storage.from("sales-attachments").remove([f.path]);
    await supabase.from("sales_files").delete().eq("id", f.id);
    router.refresh();
  }
  return (
    <Popover className="relative">
      <PopoverButton aria-label="Attachments" title="Attachments"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:text-[#0f766e] data-[open]:border-[#14a39a] data-[open]:text-[#0f766e] focus:outline-none">
        <Ico d={I.clip} className="h-[18px] w-[18px]" />
        {files.length > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0f766e] px-1 text-[10px] font-semibold text-white">{files.length}</span>}
      </PopoverButton>
      <PopoverPanel anchor="bottom end" transition className="z-[80] mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,40,60,0.16)] transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0">
        <p className="border-b border-slate-100 px-4 py-3 font-semibold text-[#0b1f3a]">Attachments</p>
        {files.length === 0 ? <p className="px-4 py-4 text-center text-sm text-slate-500">No Files Attached</p> : (
          <ul className="max-h-60 overflow-y-auto py-1">
            {files.map((f) => (
              <li key={f.id} className="group/f flex items-center gap-2 px-4 py-2 hover:bg-[#f6fbfa]">
                <button type="button" onClick={() => open(f)} className="min-w-0 flex-1 truncate text-left text-sm text-[#0f766e] hover:underline">{f.name}</button>
                <span className="shrink-0 text-xs text-slate-400">{f.size ? `${Math.max(1, Math.round(f.size / 1024))} KB` : ""}</span>
                <button type="button" onClick={() => remove(f)} aria-label="Remove" className="text-slate-400 opacity-0 hover:text-red-600 group-hover/f:opacity-100"><Ico d={I.trash} /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="p-3">
          <input ref={input} type="file" multiple className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
          <button type="button" onClick={() => input.current?.click()} disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-3 text-sm font-medium text-[#2563eb] hover:border-[#2563eb] hover:bg-[#f5f9ff]">
            <Ico d={I.download} className="h-4 w-4 rotate-180" />{busy ? "Uploading..." : "Upload your Files"}
          </button>
          <p className="mt-2 text-[11px] text-slate-400">You can upload a maximum of 5 files, 10MB each</p>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      </PopoverPanel>
    </Popover>
  );
}
