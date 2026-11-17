"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { TECH_COLORS } from "@/lib/jobs";
import { compressPhoto, fileId } from "@/lib/photo-compress";

// =====================================================================
// Chat del trabajo (Paso 5.3k). Un chat por trabajo: oficina, manager, dueño y los
// colaboradores asignados. Sirve para el código de la puerta, "el cliente pide que lo
// esperes media hora", etc. Botón flotante + panel (en celular ocupa toda la pantalla).
// Los mensajes llegan al instante y avisan por la campana y push a los demás.
// =====================================================================
type Msg = { id: string; user_id: string; body: string; created_at: string; name: string; avatar_url: string | null; role: string | null; pending?: boolean; photo_path?: string | null };
const PHOTO_ONLY = "📷 Photo";
const ROLE: Record<string, string> = { owner: "Owner", manager: "Manager", office: "Office", technician: "Technician" };
const initialsOf = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
const colorOf = (id: string) => TECH_COLORS[Array.from(id).reduce((a, c) => a + c.charCodeAt(0), 0) % TECH_COLORS.length];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
function dayLabel(d: Date) {
  const now = new Date(), y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return "Today";
  if (dayKey(d) === dayKey(y)) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
const timeOf = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

// placement: "bar" = botón compacto dentro de la barra de abajo del trabajo (teléfono del colaborador);
//            "float" = burbuja flotante en computadora y una barrita abajo en el celular (nunca encima del contenido).
export default function JobChat({ jobId, title, companyId, placement = "float", showLabel = false }: {
  jobId: string; title: string; raised?: boolean; companyId?: string; placement?: "float" | "bar"; showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [lastRead, setLastRead] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState<"sql" | "denied" | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState("");
  // Paso 5.4: fotos en el chat (comprimidas en el teléfono antes de subir)
  const [photos, setPhotos] = useState<Record<string, string>>({}); // id del mensaje → enlace de la foto
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const signedIds = useRef<Set<string>>(new Set());
  const openRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  openRef.current = open;

  const markRead = useCallback(() => {
    setLastRead(new Date().toISOString());
    createClient().rpc("job_chat_read", { p_job: jobId }).then(() => undefined, () => undefined);
  }, [jobId]);

  const load = useCallback(async () => {
    const { data, error } = await createClient().rpc("job_chat_list", { p_job: jobId });
    if (error) {
      setProblem(/NOT_ALLOWED/.test(error.message ?? "") ? "denied" : "sql");
      setReady(true);
      return;
    }
    const d = data as { me: string; last_read: string | null; messages: Msg[] };
    setProblem(null);
    setMe(d.me);
    setMsgs(d.messages ?? []);
    if (openRef.current) markRead(); else setLastRead(d.last_read);
    setReady(true);
    // Fotos del chat: se leen aparte (si falta el SQL del Paso 5.4 simplemente no hay fotos)
    const sb = createClient();
    const { data: rows } = await sb.from("job_messages").select("id, photo_path").eq("job_id", jobId).not("photo_path", "is", null);
    const fresh = ((rows ?? []) as { id: string; photo_path: string }[]).filter((r) => !signedIds.current.has(r.id));
    if (fresh.length) {
      fresh.forEach((r) => signedIds.current.add(r.id));
      const { data: s } = await sb.storage.from("job-photos").createSignedUrls(fresh.map((r) => r.photo_path), 3600);
      const byPath: Record<string, string> = {};
      ((s ?? []) as { path: string | null; signedUrl: string }[]).forEach((x) => { if (x.path && x.signedUrl) byPath[x.path] = x.signedUrl; });
      setPhotos((p) => { const n = { ...p }; fresh.forEach((r) => { if (byPath[r.photo_path]) n[r.id] = byPath[r.photo_path]; }); return n; });
    }
  }, [jobId, markRead]);

  // Carga inicial · se abre solo si el enlace trae ?chat=1 (al tocar el aviso)
  useEffect(() => {
    load();
    if (new URLSearchParams(window.location.search).get("chat") === "1") setOpen(true);
  }, [load]);

  // Tiempo real: el mensaje aparece al instante
  useEffect(() => {
    const sb = createClient();
    let t: ReturnType<typeof setTimeout>;
    const again = () => { clearTimeout(t); t = setTimeout(load, 250); };
    const ch = sb.channel(`job-chat-${jobId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "job_messages", filter: `job_id=eq.${jobId}` }, again)
      .subscribe();
    const onShow = () => { if (document.visibilityState === "visible") again(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { clearTimeout(t); sb.removeChannel(ch); document.removeEventListener("visibilitychange", onShow); };
  }, [jobId, load]);

  const unread = useMemo(() => (open || !me ? 0 : msgs.filter((m) => m.user_id !== me && (!lastRead || m.created_at > lastRead)).length), [msgs, me, lastRead, open]);

  // Al abrir: marcar leído, bajar al último mensaje y enfocar el cuadro de texto (solo en computadora)
  useEffect(() => {
    if (!open) return;
    if (ready && !problem) markRead();
    const t = setTimeout(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      if (window.innerWidth >= 1024) inputRef.current?.focus();
    }, 60);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => { clearTimeout(t); window.removeEventListener("keydown", esc); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready]);
  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, open]);

  async function send() {
    const body = text.trim();
    if (!body || sending || !me) return;
    setSending(true); setFailed("");
    const temp: Msg = { id: `tmp-${Date.now()}`, user_id: me, body, created_at: new Date().toISOString(), name: "You", avatar_url: null, role: null, pending: true };
    setMsgs((m) => [...m, temp]);
    setText("");
    const { data: id, error } = await createClient().rpc("job_chat_send", { p_job: jobId, p_body: body });
    setSending(false);
    if (error || !id) {
      setMsgs((m) => m.filter((x) => x.id !== temp.id));
      setText(body);
      setFailed("The message couldn't be sent. Check your connection and try again.");
      return;
    }
    load();
    // Aviso (campana + push) a los demás del trabajo
    fetch("/api/jobs/chat-notify", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: id }) }).catch(() => undefined);
  }

  async function sendPhoto(list: FileList | null) {
    const f = list?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!f || !companyId || photoBusy) return;
    setPhotoBusy(true); setFailed("");
    try {
      const c = await compressPhoto(f);
      const sb = createClient();
      const path = `${companyId}/${jobId}/chat/${fileId()}.${c.ext}`;
      const up = await sb.storage.from("job-photos").upload(path, c.blob, { contentType: c.mime, cacheControl: "31536000", upsert: false });
      if (up.error) throw new Error("upload");
      const caption = text.trim();
      const { data: id, error } = await sb.rpc("job_chat_send_photo", { p_job: jobId, p_path: path, p_body: caption || null });
      if (error || !id) { await sb.storage.from("job-photos").remove([path]); throw new Error(/does not exist|Could not find/.test(error?.message ?? "") ? "sql" : "send"); }
      setText("");
      await load();
      fetch("/api/jobs/chat-notify", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: id }) }).catch(() => undefined);
    } catch (e) {
      setFailed(e instanceof Error && e.message === "sql" ? "Photos in the chat need paso-5.4b-files.sql in Supabase." : "The photo couldn't be sent. Check your connection and try again.");
    }
    setPhotoBusy(false);
  }

  return (
    <>
      {/* Botón del chat con el contador de mensajes sin leer */}
      {(() => {
        const label = unread ? `Job chat, ${unread} new message${unread === 1 ? "" : "s"}` : "Job chat";
        const icon = (cls: string) => (
          <span className="relative flex">
            <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" /><path d="M8 10h8M8 13h5" />
            </svg>
            {unread > 0 && (
              <span className="absolute -right-2.5 -top-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#e11d48] px-1 text-[10.5px] font-bold text-white ring-2 ring-white animate-[bp-pop-in_0.25s_ease-out]">{unread > 9 ? "9+" : unread}</span>
            )}
          </span>
        );
        const compact = (withLabel: boolean) => (
          <button type="button" onClick={() => setOpen(true)} aria-label={label}
            className={`group flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#bfe5dd] bg-[#e9f7f4] text-[13.5px] font-semibold text-[#0f766e] transition-all duration-150 hover:border-[#14a39a] hover:bg-[#d9f1ec] active:scale-95 ${withLabel ? "px-3.5" : "w-10"}`}>
            {icon("h-5 w-5 transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110")}{withLabel && "Chat"}
          </button>
        );
        if (placement === "bar") return compact(showLabel);
        return (
          <>
            {/* Celular: barrita fija abajo (no tapa nada) + espacio para que el contenido no quede debajo */}
            <div className="h-14 lg:hidden" aria-hidden="true" />
            {!open && (
              <div className="fixed inset-x-0 bottom-0 z-30 flex justify-end border-t border-slate-200 bg-white/95 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">{compact(true)}</div>
            )}
            {/* Computadora: burbuja flotante */}
            {!open && (
              <button type="button" onClick={() => setOpen(true)} aria-label={label}
                className="group fixed bottom-6 right-8 z-40 hidden h-12 items-center gap-2 rounded-full bg-[#0f766e] pl-4 pr-5 text-[14.5px] font-semibold text-white shadow-[0_10px_28px_rgba(15,118,110,0.38)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#0c5f59] hover:shadow-[0_14px_32px_rgba(15,118,110,0.45)] active:scale-95 lg:flex">
                {icon("h-5 w-5 transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110")}Chat
              </button>
            )}
          </>
        );
      })()}

      {/* El panel se dibuja directo en la página (portal): así ocupa TODA la pantalla del celular aunque el botón viva dentro de la barra de abajo */}
      {open && createPortal(
        <div role="dialog" aria-label="Job chat"
          className="fixed inset-0 z-[97] flex flex-col bg-white animate-[bp-sheet-up_0.22s_ease-out] lg:inset-auto lg:bottom-6 lg:right-8 lg:h-[min(36rem,calc(100dvh-7rem))] lg:w-[24rem] lg:overflow-hidden lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-[0_24px_60px_rgba(15,40,60,0.28)]">
          {/* Encabezado */}
          <div className="flex items-center gap-3 border-b border-slate-100 bg-[#f7fbfa] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9f7f4] text-[#0f766e]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" /><path d="M8 10h8M8 13h5" /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-semibold leading-tight tracking-tight text-[#0b1f3a]">Job chat</p>
              <p className="truncate text-[12.5px] text-slate-500">{title}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-all duration-200 hover:rotate-90 hover:bg-red-50 hover:text-red-600">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg>
            </button>
          </div>

          {/* Mensajes */}
          <div ref={listRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain bg-[#f8fafb] px-4 py-4">
            {!ready ? (
              <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className={`h-12 w-2/3 animate-pulse rounded-2xl bg-slate-100 ${i === 1 ? "ml-auto" : ""}`} />)}</div>
            ) : problem ? (
              <div className="px-4 py-10 text-center">
                <p className="text-[15px] font-semibold text-[#0b1f3a]">{problem === "denied" ? "This chat is only for people on this job" : "The chat isn't set up yet"}</p>
                <p className="mt-1 text-[13px] text-slate-500">{problem === "denied" ? "Ask the office to add you to the job to see its messages." : "Run the file paso-5.3k-job-chat.sql in Supabase and reload this page."}</p>
              </div>
            ) : msgs.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e9f7f4] text-[#0f766e]">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" /><path d="M8 10h8M8 13h5" /></svg>
                </span>
                <p className="mt-3 text-[15px] font-semibold text-[#0b1f3a]">No messages yet</p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-500">Write the gate code, a change of plans or anything the team needs to know for this job.</p>
              </div>
            ) : (
              msgs.map((m, i) => {
                const mine = m.user_id === me, d = new Date(m.created_at), prev = msgs[i - 1];
                const newDay = !prev || dayKey(new Date(prev.created_at)) !== dayKey(d);
                const head = newDay || !prev || prev.user_id !== m.user_id || d.getTime() - new Date(prev.created_at).getTime() > 5 * 60000;
                return (
                  <div key={m.id}>
                    {newDay && <p className="py-3 text-center text-[11.5px] font-semibold text-slate-400"><span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">{dayLabel(d)}</span></p>}
                    <div className={`flex items-end gap-2 ${mine ? "justify-end" : ""} ${head ? "mt-3" : "mt-1"}`}>
                      {!mine && (head
                        ? <span className="mb-[1.35rem] flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[12px] font-semibold text-white" style={{ background: colorOf(m.user_id) }}>
                            {m.avatar_url ? <img src={m.avatar_url} alt="" className="h-full w-full object-cover" /> : initialsOf(m.name)}</span>
                        : <span className="w-8 shrink-0" />)}
                      <div className={`max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                        {head && !mine && <p className="mb-1 px-1 text-[12px] font-semibold text-[#0b1f3a]">{m.name}{m.role && ROLE[m.role] ? <span className="font-normal text-slate-400"> · {ROLE[m.role]}</span> : null}</p>}
                        <div className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[14.5px] leading-snug ${mine ? "rounded-br-md bg-[#0f766e] text-white" : "rounded-bl-md bg-white text-[#0b1f3a] ring-1 ring-slate-200"} ${m.pending ? "opacity-60" : ""}`}>
                          {photos[m.id] && (
                            <a href={photos[m.id]} target="_blank" rel="noreferrer" className="-mx-2 -mt-0.5 mb-1 block overflow-hidden rounded-xl">
                              <img src={photos[m.id]} alt="Photo sent in the chat" loading="lazy" className="max-h-64 w-full min-w-[9rem] object-cover transition-opacity duration-150 hover:opacity-90" />
                            </a>
                          )}
                          {photos[m.id] && m.body === PHOTO_ONLY ? null : m.body}
                        </div>
                        <p className="mt-1 px-1 text-[11px] text-slate-400">{m.pending ? "Sending…" : timeOf(d)}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Escribir */}
          {!problem && (
            <div className="border-t border-slate-100 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
              {failed && <p role="alert" className="mb-2 rounded-lg bg-[#fff1f2] px-3 py-2 text-[12.5px] font-medium text-[#be123c]">{failed}</p>}
              <div className="flex items-end gap-2">
                {companyId && (
                  <>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => sendPhoto(e.target.files)} />
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={photoBusy || !ready} aria-label="Send a photo"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-[#0f766e] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#14a39a] hover:bg-[#e9f7f4] active:scale-95 disabled:translate-y-0 disabled:opacity-50">
                      {photoBusy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0f766e] border-t-transparent" />
                        : <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></svg>}
                    </button>
                  </>
                )}
                <textarea ref={inputRef} value={text} rows={1} maxLength={2000} placeholder="Write a message…" aria-label="Message"
                  onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.innerWidth >= 1024) { e.preventDefault(); send(); } }}
                  className="max-h-[120px] min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-200 bg-[#f8fafb] px-4 py-2.5 text-[15px] text-slate-800 placeholder:text-slate-400 focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15" />
                <button type="button" onClick={send} disabled={!text.trim() || sending || !ready} aria-label="Send message"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#0c5f59] hover:shadow-md active:scale-95 disabled:translate-y-0 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12 20 4.5 15.5 20l-3.2-6.3z" /><path d="m12.3 13.7 4-4.5" /></svg>
                </button>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
