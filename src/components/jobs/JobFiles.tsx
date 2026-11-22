"use client";

import { useTranslations } from "next-intl";
import { useFmt, useJobError } from "@/i18n/useFmt";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { compressPhoto, fileId, kb, uploadReason } from "@/lib/photo-compress";
import { removeJobFiles, signJobFiles, uploadJobFile } from "@/lib/job-storage";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { Check, Chevron, optionClass, panelClass } from "@/components/ui/SearchSelect";
import { CameraArt, GalleryArt, PdfArt, ReportArt } from "@/components/jobs/FileArt";

// Selector que SIEMPRE muestra el texto completo (en el teléfono los nombres de fase no se cortan)
function Pick({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const tf = useTranslations("files");
  const cur = options.find((o) => o.value === value);
  return (
    <Listbox value={value} onChange={onChange}>
      <ListboxButton aria-label={label}
        className="relative flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-9 text-left text-[14px] text-slate-800 focus:border-[#0f766e] focus:bg-white focus:outline-none data-[open]:border-[#0f766e] data-[open]:bg-white">
        <span className="shrink-0 text-[12px] font-semibold text-slate-400">{label}</span>
        <span className="min-w-0 flex-1 break-words font-medium text-[#0b1f3a]">{cur?.label ?? tf("select")}</span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400"><Chevron /></span>
      </ListboxButton>
      <ListboxOptions anchor="bottom start" transition className={`${panelClass} w-[var(--button-width)] focus:outline-none`}>
        {options.map((o) => (
          <ListboxOption key={o.value} value={o.value} className={`${optionClass} !py-2.5 text-[14.5px]`}>
            <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">{o.label}</span>
            <Check />
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}

// =====================================================================
// Fotos, reportes y documentos del trabajo (Paso 5.4) — misma pieza para el teléfono y la ficha de oficina.
//  · Las fotos se comprimen en el teléfono (~100 KB, WebP) antes de subirlas.
//  · Todo queda ordenado por fase, con su autor y su hora. Los demás pueden ver y comentar.
//  · Borrar: el autor lo suyo, el dueño cualquiera, manager/oficina solo escribiendo el motivo (queda en el historial).
// =====================================================================
type Phase = { id: string; name: string; status: string };
type FileRow = { id: string; path: string; kind: string; caption: string | null; phase_id: string | null; file_type: "image" | "pdf"; file_name: string | null; bytes: number | null; uploaded_by: string | null; uploaded_by_name: string | null; created_at: string };
type Report = { id: string; phase_id: string | null; body: string; author_id: string | null; author_name: string | null; created_at: string; updated_at: string | null };
type Comment = { id: string; target_type: "file" | "report"; target_id: string; body: string; author_id: string | null; author_name: string | null; created_at: string };
type Data = { me: string; role: string | null; company_id: string; phases: Phase[]; files: FileRow[]; reports: Report[]; comments: Comment[] };
type Target = { type: "file" | "report"; id: string; author: string | null; label: string; path?: string };

const BUCKET = "job-photos";
const MAX_PDF = 10 * 1024 * 1024;
const KINDS = [
  { value: "before", label: "Before" }, { value: "after", label: "After" }, { value: "issue", label: "Problem found" },
  { value: "serial", label: "Label / serial number" }, { value: "equipment", label: "Equipment" }, { value: "other", label: "Other" },
];
const I = ({ d, className = "h-5 w-5" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const CAM = "M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z";
const UP = "M12 16V4M7 9l5-5 5 5M4 20h16";
const PEN = "M4 20h4L19 9l-4-4L4 16zM14 6l4 4";
const DOC = "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6";
const TRASH = "M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7M10 11v5M14 11v5";

export default function JobFiles({ jobId, variant = "office", readOnly = false, onToast }: {
  jobId: string; variant?: "tech" | "office"; readOnly?: boolean; onToast?: (m: string, err?: boolean) => void;
}) {
  const tf = useTranslations("files");
  const tc = useTranslations("common");
  const fmt = useFmt();
  const jobErr = useJobError();
  const when = (iso: string) => fmt.dateTime(new Date(iso));
  const kl = (k: string) => (["before", "after", "issue", "serial", "equipment", "document", "other"].includes(k) ? tf(`short.${k}`) : tf("short.other"));
  const kinds = KINDS.map((k) => ({ value: k.value, label: tf(`kind.${k.value}`) }));
  const [d, setD] = useState<Data | null>(null);
  const [off, setOff] = useState(false); // falta el SQL o no tiene acceso: no se muestra nada
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [kind, setKind] = useState("other");
  const [phase, setPhase] = useState<string>("auto");
  const [work, setWork] = useState("");
  const [notice, setNotice] = useState<{ m: string; err?: boolean } | null>(null);
  const [view, setView] = useState<FileRow | null>(null);
  const [rep, setRep] = useState<{ id: string | null; body: string; phase: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Target | null>(null);
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [openC, setOpenC] = useState<string | null>(null);
  // Paso 5.8e: elegir varias fotos o archivos con un chequecito para borrarlos o cambiarles el tipo de una vez
  const [sel, setSel] = useState<Set<string> | null>(null);
  const [bulkDel, setBulkDel] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null); // nota de la foto abierta (null = no se está editando)
  // Paso 5.9a: menú de clic derecho sobre una foto o archivo (Open / Edit note / Select / Delete)
  const [menu, setMenu] = useState<{ x: number; y: number; f: FileRow } | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const upRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const signed = useRef<Set<string>>(new Set());
  const tech = variant === "tech";

  const say = useCallback((m: string, err = false) => {
    setNotice({ m, err }); onToast?.(m, err);
    setTimeout(() => setNotice((n) => (n?.m === m ? null : n)), err ? 7000 : 3000);
  }, [onToast]);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data, error } = await sb.rpc("job_files_list", { p_job: jobId });
    if (error || !data) { setOff(true); return; }
    const x = data as Data;
    setOff(false); setD(x);
    const need = x.files.map((f) => f.path).filter((p) => !signed.current.has(p));
    if (need.length) {
      need.forEach((p) => signed.current.add(p));
      const m = await signJobFiles(jobId, need);
      need.filter((p) => !m[p]).forEach((p) => signed.current.delete(p)); // lo que no se pudo abrir se intenta otra vez después
      setUrls((u) => ({ ...u, ...m }));
    }
  }, [jobId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const sb = createClient();
    let t: ReturnType<typeof setTimeout>;
    const again = () => { clearTimeout(t); t = setTimeout(load, 500); };
    const f = `job_id=eq.${jobId}`;
    const ch = sb.channel(`job-files-${jobId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_photos", filter: f }, again)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_reports", filter: f }, again)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_file_comments", filter: f }, again)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_phases", filter: f }, again)
      .subscribe();
    return () => { clearTimeout(t); sb.removeChannel(ch); };
  }, [jobId, load]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    window.addEventListener("scroll", close, true); window.addEventListener("resize", close); window.addEventListener("keydown", key);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); window.removeEventListener("keydown", key); };
  }, [menu]);

  // Fase sugerida: la que está en proceso (o bloqueada); si no hay, "General"
  const autoPhase = useMemo(() => d?.phases.find((p) => p.status === "in_progress" || p.status === "blocked")?.id ?? "", [d]);
  const phaseId = phase === "auto" ? autoPhase : phase;
  const phaseOpts = useMemo(() => [{ value: "", label: tf("generalNoPhase") }, ...(d?.phases ?? []).map((p) => ({ value: p.id, label: p.name }))], [d, tf]);
  const isManager = d?.role === "owner" || d?.role === "manager" || d?.role === "office";
  const canDelete = (author: string | null) => Boolean(d) && (author === d!.me || isManager);
  const needsReason = (author: string | null) => Boolean(d) && author !== d!.me && d!.role !== "owner";
  const commentsOf = (type: "file" | "report", id: string) => (d?.comments ?? []).filter((c) => c.target_type === type && c.target_id === id);

  // ---------- Subir fotos y PDF ----------
  async function addFiles(list: FileList | null) {
    if (!d || !list || !list.length || work) return;
    const files = Array.from(list).slice(0, 20);
    const sb = createClient();
    let ok = 0, big = 0; const bad: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setWork(files.length > 1 ? tf("uploadingOf", { n: i + 1, total: files.length }) : tf("uploading"));
      try {
        const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
        if (!isPdf && !f.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)) { bad.push(`${f.name}: ${tf("onlyPhotosPdf")}`); continue; }
        if (isPdf && f.size > MAX_PDF) { bad.push(`${f.name}: ${tf("pdfMax")}`); continue; }
        let body: Blob = f, ext = "pdf", mime = "application/pdf", w: number | null = null, h: number | null = null;
        if (!isPdf) {
          const c = await compressPhoto(f, { label: kind === "serial" || kind === "equipment" });
          body = c.blob; ext = c.ext; mime = c.mime; w = c.width; h = c.height;
          if (c.overTarget) big++;
        }
        const up = await uploadJobFile({ companyId: d.company_id, jobId, body, ext, mime });
        if ("error" in up) { bad.push(`${f.name}: ${up.error}`); continue; }
        const path = up.path;
        const { error } = await sb.rpc("job_file_add", {
          p_job: jobId, p_path: path, p_kind: kind, p_caption: null, p_phase: phaseId || null,
          p_file_type: isPdf ? "pdf" : "image", p_file_name: isPdf ? f.name : null, p_bytes: body.size, p_width: w, p_height: h,
        });
        if (error) { await removeJobFiles(jobId, [path]); bad.push(`${f.name}: ${jobErr(error)}`); continue; }
        ok++;
      } catch (e) { bad.push(`${f.name}: ${e instanceof Error ? e.message : tf("cantPrepare")}`); }
    }
    setWork("");
    if (camRef.current) camRef.current.value = "";
    if (upRef.current) upRef.current.value = "";
    if (pdfRef.current) pdfRef.current.value = "";
    await load();
    if (bad.length) say(bad.slice(0, 3).join(" · "), true);
    else if (big) say(tf("savedBig", { ok, big }));
    else if (ok) say(tf("savedN", { count: ok }));
  }

  // ---------- Reportes y comentarios ----------
  async function saveReport() {
    if (!rep || saving) return;
    if (!rep.body.trim()) return say(tf("writeReport"), true);
    setSaving(true);
    const { error } = await createClient().rpc("job_report_save", { p_job: jobId, p_body: rep.body, p_phase: rep.phase || null, p_id: rep.id });
    setSaving(false);
    if (error) return say(jobErr(error), true);
    setRep(null); say(tf("reportSaved")); load();
  }
  async function addComment(type: "file" | "report", id: string) {
    const key = `${type}-${id}`, body = (draft[key] ?? "").trim();
    if (!body) return;
    setDraft((x) => ({ ...x, [key]: "" }));
    const { error } = await createClient().rpc("job_comment_add", { p_job: jobId, p_target_type: type, p_target: id, p_body: body });
    if (error) { setDraft((x) => ({ ...x, [key]: body })); return say(jobErr(error), true); }
    load();
  }

  // ---------- Borrar (con aviso, motivo y registro) ----------
  async function doDelete(pick?: Target) {
    const t = pick ?? del;
    if (!t) return;
    const why = reason.trim();
    if (needsReason(t.author) && !why) return say(tf("whyDelete"), true);
    if (!(await confirmDelete({ title: tf(`delQ.${t.label}`), message: tf("delBody") }))) return;
    const sb = createClient();
    if (t.type === "file") {
      const { data: path, error } = await sb.rpc("job_file_delete", { p_id: t.id, p_reason: why || null });
      if (error) return say(jobErr(error), true);
      if (path) await removeJobFiles(jobId, [path as string]);
      setView(null);
    } else {
      const { error } = await sb.rpc("job_report_delete", { p_id: t.id, p_reason: why || null });
      if (error) return say(jobErr(error), true);
    }
    setDel(null); setReason(""); say(tf("deleted")); load();
  }

  // Papelera en la esquina de cada foto: borra sin abrirla. Si hay que escribir el motivo, sale un cuadro pequeño.
  const targetOf = (f: FileRow): Target => ({ type: "file", id: f.id, author: f.uploaded_by, label: f.file_type === "pdf" ? "document" : "photo", path: f.path });
  function quickDelete(f: FileRow) {
    const t = targetOf(f);
    setReason(""); setView(null);
    if (needsReason(f.uploaded_by)) setDel(t); else doDelete(t);
  }

  // ---------- Varias a la vez (Paso 5.8e) ----------
  const picked = d && sel ? d.files.filter((f) => sel.has(f.id)) : [];
  const bulkNeedsReason = picked.some((f) => needsReason(f.uploaded_by));
  const stopSelect = () => { setSel(null); setBulkDel(false); setReason(""); };
  const toggle = (id: string) => setSel((x) => { const n = new Set(x ?? []); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  async function deleteMany() {
    if (!picked.length || bulkBusy) return;
    const why = reason.trim();
    if (bulkNeedsReason && !why) return say(tf("whyDeleteMany"), true);
    if (!(await confirmDelete({ title: tf("delManyQ", { count: picked.length }), message: tf("delManyBody") }))) return;
    setBulkBusy(true);
    const sb = createClient(); const paths: string[] = []; let failed = "";
    for (const f of picked) {
      const { data: path, error } = await sb.rpc("job_file_delete", { p_id: f.id, p_reason: why || null });
      if (error) { failed = jobErr(error); continue; }
      if (path) paths.push(path as string);
    }
    await removeJobFiles(jobId, paths);
    setBulkBusy(false); stopSelect();
    say(failed ? tf("deletedSome", { n: paths.length, err: failed }) : tf("deletedN", { n: paths.length }), Boolean(failed));
    load();
  }
  async function editFiles(ids: string[], change: { kind?: string; caption?: string }) {
    const { error } = await createClient().rpc("job_files_edit", { p_ids: ids, p_kind: change.kind ?? null, p_caption: change.caption ?? null, p_set_caption: change.caption !== undefined });
    if (error) { say(/job_files_edit|does not exist|Could not find/i.test(error.message) ? tf("editSql") : jobErr(error), true); return false; }
    return true;
  }
  async function typeMany(kind: string) {
    const ids = picked.filter((f) => f.file_type === "image").map((f) => f.id);
    if (!ids.length) return say(tf("choosePhoto"), true);
    setBulkBusy(true);
    const ok = await editFiles(ids, { kind });
    setBulkBusy(false);
    if (ok) { stopSelect(); say(tf("typeChanged", { count: ids.length, kind: tf(`kind.${kind}`) })); load(); }
  }
  async function saveNote() {
    if (!view || note === null) return;
    const ok = await editFiles([view.id], { caption: note });
    if (ok) { setView({ ...view, caption: note.trim() || null }); setNote(null); say(tf("noteSaved")); load(); }
  }

  if (off || !d) return null;

  const groups = [...d.phases.map((p) => ({ id: p.id as string | null, name: p.name })), { id: null as string | null, name: d.phases.length ? tf("general") : "" }]
    .map((g) => ({ ...g, files: d.files.filter((f) => (f.phase_id ?? null) === g.id || (g.id === null && f.phase_id && !d.phases.some((p) => p.id === f.phase_id))), reports: d.reports.filter((r) => (r.phase_id ?? null) === g.id || (g.id === null && r.phase_id && !d.phases.some((p) => p.id === r.phase_id))) }))
    .filter((g) => g.files.length || g.reports.length);
  const empty = groups.length === 0;
  const box = tech ? "mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3" : "rounded-2xl border border-slate-200 bg-white p-5";
  const title = tech ? "text-[15px] font-semibold text-[#0b1f3a]" : "text-[16px] font-semibold text-[#0b1f3a]";
  const btn = "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-all duration-150 active:scale-95 disabled:opacity-50";
  const photos = d.files.filter((f) => f.file_type === "image").length;

  const commentBox = (type: "file" | "report", id: string) => {
    const key = `${type}-${id}`, list = commentsOf(type, id);
    return (
      <div className="mt-2">
        {list.map((c) => (
          <p key={c.id} className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
            <span className="font-semibold text-[#0b1f3a]">{c.author_name ?? tf("member")}</span> <span className="text-[11.5px] text-slate-400">{when(c.created_at)}</span><br />{c.body}
          </p>
        ))}
        <div className="mt-2 flex gap-2">
          <input value={draft[key] ?? ""} onChange={(e) => setDraft((x) => ({ ...x, [key]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addComment(type, id); } }}
            maxLength={1000} placeholder={tf("addComment")} aria-label={tf("addComment")} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-[#0b1f3a] outline-none focus:border-[#14a39a]" />
          <button type="button" onClick={() => addComment(type, id)} disabled={!(draft[key] ?? "").trim()} className="shrink-0 rounded-lg bg-[#0f766e] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:bg-slate-200 disabled:text-slate-400">{tc("send")}</button>
        </div>
      </div>
    );
  };
  const deletePanel = (t: Target) => (
    <div className="mt-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] p-3">
      <p className="text-[13px] font-semibold text-[#9f1239]">{tf(`delQ.${t.label}`)}</p>
      {needsReason(t.author) && (
        <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} placeholder={tf("whyPh")}
          className="mt-2 w-full resize-none rounded-lg border border-[#fecdd3] bg-white px-3 py-2 text-[14px] text-[#0b1f3a] outline-none focus:border-[#e11d48]" />
      )}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={() => { setDel(null); setReason(""); }} className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-slate-600 hover:bg-white">{tc("cancel")}</button>
        <button type="button" onClick={() => doDelete()} className="rounded-lg bg-[#e11d48] px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#be123c]">{tc("delete")}</button>
      </div>
    </div>
  );

  return (
    <section className={box}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={title}>{tf("title")}</h2>
        <span className="flex items-center gap-3">
          {!empty && <span className="text-[12.5px] text-slate-400">{tf("photosCount", { count: photos })} · {tf("reportsCount", { count: d.reports.length })}</span>}
          {d.files.some((f) => canDelete(f.uploaded_by)) && (
            <button type="button" onClick={() => (sel ? stopSelect() : setSel(new Set()))} className={`rounded-lg px-2.5 py-1 text-[13px] font-semibold transition-colors ${sel ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "text-[#0f766e] hover:bg-[#e9f7f4]"}`}>{sel ? tc("cancel") : tf("select")}</button>
          )}
        </span>
      </div>

      {/* Paso 5.8e: barra para varias fotos o archivos a la vez */}
      {sel && (
        <div className="mt-3 rounded-xl border border-[#b6dcd5] bg-[#f3fbf8] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-[13.5px] font-semibold text-[#0b1f3a]">{picked.length ? tf("selectedN", { n: picked.length }) : tf("tapWanted")}</p>
            <button type="button" onClick={() => { const all = d.files.filter((f) => canDelete(f.uploaded_by)).map((f) => f.id); setSel(new Set(picked.length === all.length ? [] : all)); }}
              className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-[#0f766e] hover:bg-white">{picked.length && picked.length === d.files.filter((f) => canDelete(f.uploaded_by)).length ? tf("clearAll") : tf("selectAll")}</button>
            <button type="button" disabled={!picked.length || bulkBusy} onClick={() => { setBulkDel(true); setReason(""); }}
              className="flex items-center gap-1.5 rounded-lg bg-[#e11d48] px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#be123c] disabled:opacity-40">
              <I d={TRASH} className="h-4 w-4" />{tc("delete")}</button>
          </div>
          {picked.some((f) => f.file_type === "image") && !bulkDel && (
            <div className="mt-2 max-w-xs"><Pick label={tf("changeType")} value="" options={[{ value: "", label: tf("choose") }, ...kinds]} onChange={(v) => { if (v) typeMany(v); }} /></div>
          )}
          {bulkDel && (
            <div className="mt-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] p-3">
              <p className="text-[13px] font-semibold text-[#9f1239]">{tf("delManyQ", { count: picked.length })}</p>
              {bulkNeedsReason && (
                <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} placeholder={tf("whyManyPh")}
                  className="mt-2 w-full resize-none rounded-lg border border-[#fecdd3] bg-white px-3 py-2 text-[14px] text-[#0b1f3a] outline-none focus:border-[#e11d48]" />
              )}
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { setBulkDel(false); setReason(""); }} className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-slate-600 hover:bg-white">{tc("cancel")}</button>
                <button type="button" onClick={deleteMany} disabled={bulkBusy} className="rounded-lg bg-[#e11d48] px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#be123c] disabled:opacity-60">{bulkBusy ? tf("deleting") : tc("delete")}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {!readOnly && (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Pick label={tf("type")} value={kind} options={kinds} onChange={setKind} />
            <Pick label={tf("phase")} value={phaseId} options={phaseOpts} onChange={setPhase} />
          </div>
          {/* Acciones: íconos redondos ilustrados (no botones) */}
          <div className="mt-3 flex items-start justify-around gap-1">
            {[
              { key: "cam", label: tf("camera"), art: <CameraArt size={tech ? 46 : 44} />, go: () => camRef.current?.click(), cls: tech ? "" : "lg:hidden" },
              { key: "gal", label: tf("gallery"), art: <GalleryArt size={tech ? 46 : 44} />, go: () => upRef.current?.click(), cls: "" },
              { key: "pdf", label: tf("pdfFile"), art: <PdfArt size={tech ? 46 : 44} />, go: () => pdfRef.current?.click(), cls: "" },
              { key: "rep", label: tf("report"), art: <ReportArt size={tech ? 46 : 44} />, go: () => setRep({ id: null, body: "", phase: phaseId }), cls: "" },
            ].map((a) => (
              <button key={a.key} type="button" onClick={a.go} disabled={Boolean(work)} aria-label={a.label}
                className={`group flex w-16 flex-col items-center gap-1 rounded-xl py-1 text-[11.5px] font-semibold text-slate-600 transition-colors duration-150 hover:text-[#0f766e] disabled:opacity-50 ${a.cls}`}>
                <span className="rounded-full transition-shadow duration-150 group-hover:shadow-[0_6px_14px_rgba(15,40,60,0.14)]">{a.art}</span>{a.label}
              </button>
            ))}
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => addFiles(e.target.files)} />
          {/* Solo imágenes: el teléfono abre la galería directo (sin el menú Cámara / Archivos) */}
          <input ref={upRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
          <input ref={pdfRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
          <p className="mt-1.5 text-center text-[11.5px] text-slate-400">{tf("lighter")}</p>
        </>
      )}
      {work && <p className="mt-2 flex items-center gap-2 rounded-lg bg-[#e9f7f4] px-3 py-2 text-[13px] font-medium text-[#0f766e]"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0f766e] border-t-transparent" />{work}</p>}
      {notice && !work && <p role="status" className={`mt-2 rounded-lg px-3 py-2 text-[13px] font-medium ${notice.err ? "bg-[#fff1f2] text-[#be123c]" : "bg-[#e9f7f4] text-[#0f766e]"}`}>{notice.m}</p>}

      {/* Escribir o editar un reporte */}
      {rep && (
        <div className="mt-3 rounded-xl border border-slate-200 p-3">
          <p className="text-[13.5px] font-semibold text-[#0b1f3a]">{rep.id ? tf("editReport") : tf("newReport")}</p>
          <textarea autoFocus value={rep.body} onChange={(e) => setRep({ ...rep, body: e.target.value })} rows={4} maxLength={6000} placeholder={tf("reportPh")}
            className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-[14.5px] text-[#0b1f3a] outline-none focus:border-[#14a39a]" />
          <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
            <div className="w-full sm:w-64"><Pick label={tf("phase")} value={rep.phase} options={phaseOpts} onChange={(v) => setRep({ ...rep, phase: v })} /></div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setRep(null)} className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-slate-500 hover:bg-slate-100">{tc("cancel")}</button>
              <button type="button" onClick={saveReport} disabled={saving} className="rounded-lg bg-[#0f766e] px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-60">{saving ? tc("saving") : tf("saveReport")}</button>
            </div>
          </div>
        </div>
      )}

      {empty && !rep && <p className="mt-3 text-[14px] text-slate-500">{readOnly ? tf("emptyRO") : tf("empty")}</p>}

      {groups.map((g) => (
        <div key={g.id ?? "general"} className="mt-4">
          {g.name && <p className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-wide text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-[#e8713a]" />{g.name}</p>}
          {g.reports.map((r) => {
            const n = commentsOf("report", r.id).length, k = `report-${r.id}`;
            return (
              <div key={r.id} className="mb-2 rounded-xl border border-slate-100 bg-[#fbfdfc] px-3.5 py-3">
                <p className="whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-[#0b1f3a]">{r.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-400">
                  <span><span className="font-semibold text-slate-600">{r.author_name ?? tf("member")}</span> · {when(r.created_at)}{r.updated_at ? ` · ${tf("edited")}` : ""}</span>
                  <button type="button" onClick={() => setOpenC(openC === k ? null : k)} className="font-semibold text-[#0f766e] hover:underline">{n ? tf("commentsN", { count: n }) : tf("comment")}</button>
                  {!readOnly && r.author_id === d.me && <button type="button" onClick={() => setRep({ id: r.id, body: r.body, phase: r.phase_id ?? "" })} className="font-semibold text-slate-500 hover:text-[#0f766e]">{tc("edit")}</button>}
                  {canDelete(r.author_id) && <button type="button" onClick={() => { setDel({ type: "report", id: r.id, author: r.author_id, label: "report" }); setReason(""); }} className="font-semibold text-slate-400 hover:text-[#e11d48]">{tc("delete")}</button>}
                </div>
                {del?.type === "report" && del.id === r.id && deletePanel(del)}
                {openC === k && commentBox("report", r.id)}
              </div>
            );
          })}
          {g.files.length > 0 && (
            <div className={`grid gap-2 ${tech ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-4 xl:grid-cols-6"}`}>
              {g.files.map((f) => {
                const n = commentsOf("file", f.id).length, mine = canDelete(f.uploaded_by);
                return (
                  <div key={f.id} onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, f }); }}
                    className={`group relative aspect-square overflow-hidden rounded-xl bg-slate-100 transition-shadow duration-150 hover:shadow-[0_8px_18px_rgba(15,40,60,0.14)] ${sel && !mine ? "opacity-35" : ""} ${sel?.has(f.id) ? "ring-[3px] ring-[#0f766e] ring-offset-2" : ""}`}>
                    {mine && (
                      <button type="button" aria-label={sel?.has(f.id) ? tf("unselect") : tf("select")} aria-pressed={Boolean(sel?.has(f.id))} title={tf("select")}
                        onClick={() => toggle(f.id)}
                        className={`absolute left-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-sm transition-all duration-100 hover:scale-110 ${sel?.has(f.id) ? "border-[#0f766e] bg-[#0f766e] text-white" : "border-white bg-black/30 text-transparent hover:text-white"}`}>
                        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>
                      </button>
                    )}
                    {mine && !sel && (
                      <button type="button" aria-label={tc("delete")} title={tc("delete")} onClick={() => quickDelete(f)}
                        className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-sm transition-all duration-100 hover:scale-110 hover:bg-[#e11d48] hover:text-white">
                        <I d={TRASH} className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button type="button" disabled={Boolean(sel) && !mine} aria-label={f.file_type === "pdf" ? f.file_name ?? "PDF" : kl(f.kind)}
                      onClick={() => { if (sel) toggle(f.id); else { setView(f); setDel(null); setNote(null); } }} className="absolute inset-0 block h-full w-full text-left">
                    {f.file_type === "pdf" ? (
                      <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[#fff7f2] px-2 text-[#e8713a]"><I d={DOC} className="h-8 w-8 transition-transform duration-150 group-hover:scale-110" />
                        <span className="line-clamp-2 break-all text-center text-[11px] font-medium text-slate-600">{f.file_name ?? "PDF"}</span></span>
                    ) : urls[f.path] ? <img src={urls[f.path]} alt={f.caption ?? kl(f.kind)} loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
                      : <span className="block h-full w-full animate-pulse bg-slate-200" />}
                    <span className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-5 text-[10.5px] font-semibold text-white">
                      <span>{kl(f.kind)}</span>{n > 0 && <span className="rounded-full bg-white/90 px-1.5 text-[10px] text-[#0f766e]">{n}</span>}
                    </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* Clic derecho sobre una foto o archivo */}
      {menu && (() => {
        const f = menu.f, mine = canDelete(f.uploaded_by);
        const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium text-[#0b1f3a] transition-colors duration-100 hover:bg-[#e9f7f4] hover:text-[#0f766e]";
        const left = Math.max(8, Math.min(menu.x, (typeof window === "undefined" ? 9999 : window.innerWidth) - 196));
        const top = Math.max(8, Math.min(menu.y, (typeof window === "undefined" ? 9999 : window.innerHeight) - (mine ? 176 : 56)));
        return (
          <div className="fixed inset-0 z-[97]" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}>
            <div role="menu" style={{ left, top }} onClick={(e) => e.stopPropagation()} className="absolute w-[11.5rem] rounded-xl border border-[#cfe9e3] bg-white p-1 shadow-[0_12px_28px_rgba(15,40,60,0.18)]">
              <button type="button" role="menuitem" className={item} onClick={() => { setMenu(null); setView(f); setDel(null); setNote(null); }}><I d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" className="h-4 w-4" />{tc("open")}</button>
              {mine && <button type="button" role="menuitem" className={item} onClick={() => { setMenu(null); setDel(null); setView(f); setNote(f.caption ?? ""); }}><I d={PEN} className="h-4 w-4" />{f.caption ? tf("editNote") : tf("addNote")}</button>}
              {mine && <button type="button" role="menuitem" className={item} onClick={() => { setMenu(null); toggle(f.id); }}><I d="M4 12.5 9 17.5 20 6.5" className="h-4 w-4" />{sel?.has(f.id) ? tf("unselect") : tf("select")}</button>}
              {mine && <button type="button" role="menuitem" className={`${item} !text-[#be123c] hover:!bg-[#fff1f2] hover:!text-[#be123c]`} onClick={() => { setMenu(null); quickDelete(f); }}><I d={TRASH} className="h-4 w-4" />{tc("delete")}</button>}
            </div>
          </div>
        );
      })()}

      {/* Motivo para borrar desde la papelera de la esquina (manager y oficina, cuando la foto es de otra persona) */}
      {del?.type === "file" && !view && (
        <div className="fixed inset-0 z-[98] flex items-center justify-center bg-slate-950/40 p-4 animate-[bp-fade_0.15s_ease-out]" role="dialog" aria-label={tf("deleteFile")} onClick={() => { setDel(null); setReason(""); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-3 shadow-xl" onClick={(e) => e.stopPropagation()}>{deletePanel(del)}</div>
        </div>
      )}

      {/* Visor: foto grande o PDF, con autor, nota, comentarios y borrar */}
      {view && (
        <div className="fixed inset-0 z-[98] flex flex-col bg-slate-950/90 animate-[bp-fade_0.15s_ease-out] lg:flex-row" role="dialog" aria-label={tf("file")} onClick={() => setView(null)}>
          <div className="flex min-h-0 flex-1 items-center justify-center p-3">
            {view.file_type === "pdf" ? (
              <a href={urls[view.path]} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-10 text-[#0b1f3a] transition-transform duration-150 hover:-translate-y-0.5">
                <I d={DOC} className="h-14 w-14 text-[#e8713a]" /><span className="max-w-[16rem] break-all text-center text-[14px] font-semibold">{view.file_name ?? "PDF"}</span>
                <span className="rounded-lg bg-[#0f766e] px-4 py-2 text-[13.5px] font-semibold text-white">{tf("openPdf")}</span></a>
            ) : urls[view.path] ? <img src={urls[view.path]} alt={view.caption ?? tf("short.other")} onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full rounded-xl object-contain" /> : null}
          </div>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[48vh] shrink-0 overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-h-none lg:w-[22rem] lg:rounded-none">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-[#0b1f3a]">{kl(view.kind)}{view.phase_id ? ` · ${d.phases.find((p) => p.id === view.phase_id)?.name ?? ""}` : ""}</p>
                <p className="text-[12.5px] text-slate-500">{view.uploaded_by_name ?? tf("member")} · {when(view.created_at)}{view.bytes ? ` · ${kb(view.bytes)}` : ""}</p>
              </div>
              <button type="button" onClick={() => setView(null)} aria-label={tc("close")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-all duration-200 hover:rotate-90 hover:bg-red-50 hover:text-red-600">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg></button>
            </div>
            {note === null ? (
              <>
                {view.caption && <p className="mt-2 text-[14px] text-slate-700">{view.caption}</p>}
                {canDelete(view.uploaded_by) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setNote(view.caption ?? "")} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-slate-700 transition-colors hover:border-[#b6dcd5] hover:bg-[#e9f7f4] hover:text-[#0f766e]">
                      <I d={PEN} className="h-4 w-4" />{view.caption ? tf("editNote") : tf("addNote")}</button>
                    {!(del?.type === "file" && del.id === view.id) && (
                      <button type="button" onClick={() => { setDel({ type: "file", id: view.id, author: view.uploaded_by, label: view.file_type === "pdf" ? "document" : "photo", path: view.path }); setReason(""); }}
                        className="flex items-center gap-1.5 rounded-lg border border-[#fecdd3] px-3 py-1.5 text-[13px] font-semibold text-[#be123c] transition-colors hover:bg-[#fff1f2]">
                        <I d={TRASH} className="h-4 w-4" />{tc("delete")}</button>
                    )}
                  </div>
                )}
                {del?.type === "file" && del.id === view.id && deletePanel(del)}
              </>
            ) : (
              <div className="mt-2">
                <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} placeholder={tf("notePh")}
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-[#0b1f3a] outline-none focus:border-[#14a39a]" />
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => setNote(null)} className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-slate-500 hover:bg-slate-100">{tc("cancel")}</button>
                  <button type="button" onClick={saveNote} className="rounded-lg bg-[#0f766e] px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0c5f59]">{tf("saveNote")}</button>
                </div>
              </div>
            )}
            <p className="mt-3 text-[12.5px] font-semibold text-slate-500">{tf("comments")}</p>
            {commentBox("file", view.id)}
          </div>
        </div>
      )}
    </section>
  );
}
