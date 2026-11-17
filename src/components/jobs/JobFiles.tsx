"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { jobError } from "@/lib/jobs";
import { compressPhoto, fileId, kb } from "@/lib/photo-compress";
import SelectMenu from "@/components/ui/SelectMenu";

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
const KIND_LABEL: Record<string, string> = { before: "Before", after: "After", issue: "Problem", serial: "Label", equipment: "Equipment", document: "PDF", other: "Photo" };
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const I = ({ d, className = "h-5 w-5" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const CAM = "M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z";
const UP = "M12 16V4M7 9l5-5 5 5M4 20h16";
const PEN = "M4 20h4L19 9l-4-4L4 16zM14 6l4 4";
const DOC = "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6";

export default function JobFiles({ jobId, variant = "office", readOnly = false, onToast }: {
  jobId: string; variant?: "tech" | "office"; readOnly?: boolean; onToast?: (m: string, err?: boolean) => void;
}) {
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
  const camRef = useRef<HTMLInputElement>(null);
  const upRef = useRef<HTMLInputElement>(null);
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
      const { data: s } = await sb.storage.from(BUCKET).createSignedUrls(need, 3600);
      const m: Record<string, string> = {};
      ((s ?? []) as { path: string | null; signedUrl: string }[]).forEach((r) => { if (r.path && r.signedUrl) m[r.path] = r.signedUrl; });
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

  // Fase sugerida: la que está en proceso (o bloqueada); si no hay, "General"
  const autoPhase = useMemo(() => d?.phases.find((p) => p.status === "in_progress" || p.status === "blocked")?.id ?? "", [d]);
  const phaseId = phase === "auto" ? autoPhase : phase;
  const phaseOpts = useMemo(() => [{ value: "", label: "General (no phase)" }, ...(d?.phases ?? []).map((p) => ({ value: p.id, label: p.name }))], [d]);
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
      setWork(files.length > 1 ? `Uploading ${i + 1} of ${files.length}…` : "Uploading…");
      try {
        const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
        if (!isPdf && !f.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)) { bad.push(`${f.name}: only photos and PDF files`); continue; }
        if (isPdf && f.size > MAX_PDF) { bad.push(`${f.name}: PDF files can be up to 10 MB`); continue; }
        let body: Blob = f, ext = "pdf", mime = "application/pdf", w: number | null = null, h: number | null = null;
        if (!isPdf) {
          const c = await compressPhoto(f, { label: kind === "serial" || kind === "equipment" });
          body = c.blob; ext = c.ext; mime = c.mime; w = c.width; h = c.height;
          if (c.overTarget) big++;
        }
        const path = `${d.company_id}/${jobId}/${fileId()}.${ext}`;
        const up = await sb.storage.from(BUCKET).upload(path, body, { contentType: mime, cacheControl: "31536000", upsert: false });
        if (up.error) { bad.push(`${f.name}: upload failed`); continue; }
        const { error } = await sb.rpc("job_file_add", {
          p_job: jobId, p_path: path, p_kind: kind, p_caption: null, p_phase: phaseId || null,
          p_file_type: isPdf ? "pdf" : "image", p_file_name: isPdf ? f.name : null, p_bytes: body.size, p_width: w, p_height: h,
        });
        if (error) { await sb.storage.from(BUCKET).remove([path]); bad.push(`${f.name}: ${jobError(error)}`); continue; }
        ok++;
      } catch (e) { bad.push(`${f.name}: ${e instanceof Error ? e.message : "could not be prepared"}`); }
    }
    setWork("");
    if (camRef.current) camRef.current.value = "";
    if (upRef.current) upRef.current.value = "";
    await load();
    if (bad.length) say(bad.slice(0, 3).join(" · "), true);
    else if (big) say(`${ok} saved. ${big} kept a little over 100 KB so the label stays readable.`);
    else if (ok) say(ok === 1 ? "Saved" : `${ok} files saved`);
  }

  // ---------- Reportes y comentarios ----------
  async function saveReport() {
    if (!rep || saving) return;
    if (!rep.body.trim()) return say("Write the report first.", true);
    setSaving(true);
    const { error } = await createClient().rpc("job_report_save", { p_job: jobId, p_body: rep.body, p_phase: rep.phase || null, p_id: rep.id });
    setSaving(false);
    if (error) return say(jobError(error), true);
    setRep(null); say("Report saved"); load();
  }
  async function addComment(type: "file" | "report", id: string) {
    const key = `${type}-${id}`, body = (draft[key] ?? "").trim();
    if (!body) return;
    setDraft((x) => ({ ...x, [key]: "" }));
    const { error } = await createClient().rpc("job_comment_add", { p_job: jobId, p_target_type: type, p_target: id, p_body: body });
    if (error) { setDraft((x) => ({ ...x, [key]: body })); return say(jobError(error), true); }
    load();
  }

  // ---------- Borrar (con aviso, motivo y registro) ----------
  async function doDelete() {
    if (!del) return;
    const why = reason.trim();
    if (needsReason(del.author) && !why) return say("Write why you are deleting it.", true);
    if (!(await confirmDelete({ title: `Delete this ${del.label}?`, message: "It's removed for everyone on the job. The job history keeps who deleted it and when." }))) return;
    const sb = createClient();
    if (del.type === "file") {
      const { data: path, error } = await sb.rpc("job_file_delete", { p_id: del.id, p_reason: why || null });
      if (error) return say(jobError(error), true);
      if (path) await sb.storage.from(BUCKET).remove([path as string]);
      setView(null);
    } else {
      const { error } = await sb.rpc("job_report_delete", { p_id: del.id, p_reason: why || null });
      if (error) return say(jobError(error), true);
    }
    setDel(null); setReason(""); say("Deleted"); load();
  }

  if (off || !d) return null;

  const groups = [...d.phases.map((p) => ({ id: p.id as string | null, name: p.name })), { id: null as string | null, name: d.phases.length ? "General" : "" }]
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
            <span className="font-semibold text-[#0b1f3a]">{c.author_name ?? "Team member"}</span> <span className="text-[11.5px] text-slate-400">{when(c.created_at)}</span><br />{c.body}
          </p>
        ))}
        <div className="mt-2 flex gap-2">
          <input value={draft[key] ?? ""} onChange={(e) => setDraft((x) => ({ ...x, [key]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addComment(type, id); } }}
            maxLength={1000} placeholder="Add a comment" aria-label="Add a comment" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-[#0b1f3a] outline-none focus:border-[#14a39a]" />
          <button type="button" onClick={() => addComment(type, id)} disabled={!(draft[key] ?? "").trim()} className="shrink-0 rounded-lg bg-[#0f766e] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:bg-slate-200 disabled:text-slate-400">Send</button>
        </div>
      </div>
    );
  };
  const deletePanel = (t: Target) => (
    <div className="mt-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] p-3">
      <p className="text-[13px] font-semibold text-[#9f1239]">Delete this {t.label}?</p>
      {needsReason(t.author) && (
        <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} placeholder="Why are you deleting it? (the owner will see this)"
          className="mt-2 w-full resize-none rounded-lg border border-[#fecdd3] bg-white px-3 py-2 text-[14px] text-[#0b1f3a] outline-none focus:border-[#e11d48]" />
      )}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={() => { setDel(null); setReason(""); }} className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-slate-600 hover:bg-white">Cancel</button>
        <button type="button" onClick={doDelete} className="rounded-lg bg-[#e11d48] px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#be123c]">Delete</button>
      </div>
    </div>
  );

  return (
    <section className={box}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={title}>Photos, reports &amp; files</h2>
        {!empty && <span className="text-[12.5px] text-slate-400">{photos} photo{photos === 1 ? "" : "s"} · {d.reports.length} report{d.reports.length === 1 ? "" : "s"}</span>}
      </div>

      {!readOnly && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div><p className="mb-1 text-[12px] font-semibold text-slate-500">Type of photo</p><SelectMenu value={kind} ariaLabel="Type of photo" options={KINDS} onChange={setKind} /></div>
            <div><p className="mb-1 text-[12px] font-semibold text-slate-500">Phase</p><SelectMenu value={phaseId} ariaLabel="Phase" options={phaseOpts} onChange={setPhase} /></div>
          </div>
          <div className={`mt-2 grid gap-2 ${tech ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}>
            <button type="button" onClick={() => camRef.current?.click()} disabled={Boolean(work)} className={`${btn} bg-[#0f766e] text-white hover:bg-[#0c5f59] ${tech ? "" : "lg:hidden"}`}><I d={CAM} />Take photo</button>
            <button type="button" onClick={() => upRef.current?.click()} disabled={Boolean(work)} className={`${btn} border border-slate-200 text-[#0b1f3a] hover:border-[#14a39a] hover:bg-[#f3fbf9]`}><I d={UP} />Upload</button>
            <button type="button" onClick={() => setRep({ id: null, body: "", phase: phaseId })} disabled={Boolean(work)} className={`${btn} border border-slate-200 text-[#0b1f3a] hover:border-[#14a39a] hover:bg-[#f3fbf9]`}><I d={PEN} />Report</button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => addFiles(e.target.files)} />
          <input ref={upRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
          <p className="mt-2 text-[12px] text-slate-400">Photos are made lighter on this device before they upload (about 100 KB each). PDF files up to 10 MB.</p>
        </>
      )}
      {work && <p className="mt-2 flex items-center gap-2 rounded-lg bg-[#e9f7f4] px-3 py-2 text-[13px] font-medium text-[#0f766e]"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0f766e] border-t-transparent" />{work}</p>}
      {notice && !work && <p role="status" className={`mt-2 rounded-lg px-3 py-2 text-[13px] font-medium ${notice.err ? "bg-[#fff1f2] text-[#be123c]" : "bg-[#e9f7f4] text-[#0f766e]"}`}>{notice.m}</p>}

      {/* Escribir o editar un reporte */}
      {rep && (
        <div className="mt-3 rounded-xl border border-slate-200 p-3">
          <p className="text-[13.5px] font-semibold text-[#0b1f3a]">{rep.id ? "Edit report" : "New report"}</p>
          <textarea autoFocus value={rep.body} onChange={(e) => setRep({ ...rep, body: e.target.value })} rows={4} maxLength={6000} placeholder="What you found, what you did and what's next"
            className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-[14.5px] text-[#0b1f3a] outline-none focus:border-[#14a39a]" />
          <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
            <div className="w-48"><SelectMenu value={rep.phase} ariaLabel="Phase of the report" options={phaseOpts} onChange={(v) => setRep({ ...rep, phase: v })} /></div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setRep(null)} className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-slate-500 hover:bg-slate-100">Cancel</button>
              <button type="button" onClick={saveReport} disabled={saving} className="rounded-lg bg-[#0f766e] px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-60">{saving ? "Saving…" : "Save report"}</button>
            </div>
          </div>
        </div>
      )}

      {empty && !rep && <p className="mt-3 text-[14px] text-slate-500">{readOnly ? "No photos, reports or files on this job." : "Nothing yet. Photos, written reports and PDF files for this job show up here, by phase."}</p>}

      {groups.map((g) => (
        <div key={g.id ?? "general"} className="mt-4">
          {g.name && <p className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-wide text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-[#e8713a]" />{g.name}</p>}
          {g.reports.map((r) => {
            const n = commentsOf("report", r.id).length, k = `report-${r.id}`;
            return (
              <div key={r.id} className="mb-2 rounded-xl border border-slate-100 bg-[#fbfdfc] px-3.5 py-3">
                <p className="whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-[#0b1f3a]">{r.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-400">
                  <span><span className="font-semibold text-slate-600">{r.author_name ?? "Team member"}</span> · {when(r.created_at)}{r.updated_at ? " · edited" : ""}</span>
                  <button type="button" onClick={() => setOpenC(openC === k ? null : k)} className="font-semibold text-[#0f766e] hover:underline">{n ? `${n} comment${n === 1 ? "" : "s"}` : "Comment"}</button>
                  {!readOnly && r.author_id === d.me && <button type="button" onClick={() => setRep({ id: r.id, body: r.body, phase: r.phase_id ?? "" })} className="font-semibold text-slate-500 hover:text-[#0f766e]">Edit</button>}
                  {canDelete(r.author_id) && <button type="button" onClick={() => { setDel({ type: "report", id: r.id, author: r.author_id, label: "report" }); setReason(""); }} className="font-semibold text-slate-400 hover:text-[#e11d48]">Delete</button>}
                </div>
                {del?.type === "report" && del.id === r.id && deletePanel(del)}
                {openC === k && commentBox("report", r.id)}
              </div>
            );
          })}
          {g.files.length > 0 && (
            <div className={`grid gap-2 ${tech ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-4 xl:grid-cols-6"}`}>
              {g.files.map((f) => {
                const n = commentsOf("file", f.id).length;
                return (
                  <button key={f.id} type="button" onClick={() => { setView(f); setDel(null); }} className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 text-left transition-shadow duration-150 hover:shadow-[0_8px_18px_rgba(15,40,60,0.14)]">
                    {f.file_type === "pdf" ? (
                      <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[#fff7f2] px-2 text-[#e8713a]"><I d={DOC} className="h-8 w-8 transition-transform duration-150 group-hover:scale-110" />
                        <span className="line-clamp-2 break-all text-center text-[11px] font-medium text-slate-600">{f.file_name ?? "PDF"}</span></span>
                    ) : urls[f.path] ? <img src={urls[f.path]} alt={f.caption ?? KIND_LABEL[f.kind] ?? "Photo"} loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
                      : <span className="block h-full w-full animate-pulse bg-slate-200" />}
                    <span className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-5 text-[10.5px] font-semibold text-white">
                      <span>{KIND_LABEL[f.kind] ?? "Photo"}</span>{n > 0 && <span className="rounded-full bg-white/90 px-1.5 text-[10px] text-[#0f766e]">{n}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* Visor: foto grande o PDF, con autor, nota, comentarios y borrar */}
      {view && (
        <div className="fixed inset-0 z-[98] flex flex-col bg-slate-950/90 animate-[bp-fade_0.15s_ease-out] lg:flex-row" role="dialog" aria-label="File" onClick={() => setView(null)}>
          <div className="flex min-h-0 flex-1 items-center justify-center p-3">
            {view.file_type === "pdf" ? (
              <a href={urls[view.path]} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-10 text-[#0b1f3a] transition-transform duration-150 hover:-translate-y-0.5">
                <I d={DOC} className="h-14 w-14 text-[#e8713a]" /><span className="max-w-[16rem] break-all text-center text-[14px] font-semibold">{view.file_name ?? "PDF"}</span>
                <span className="rounded-lg bg-[#0f766e] px-4 py-2 text-[13.5px] font-semibold text-white">Open PDF</span></a>
            ) : urls[view.path] ? <img src={urls[view.path]} alt={view.caption ?? "Photo"} onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full rounded-xl object-contain" /> : null}
          </div>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[48vh] shrink-0 overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-h-none lg:w-[22rem] lg:rounded-none">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-[#0b1f3a]">{KIND_LABEL[view.kind] ?? "Photo"}{view.phase_id ? ` · ${d.phases.find((p) => p.id === view.phase_id)?.name ?? ""}` : ""}</p>
                <p className="text-[12.5px] text-slate-500">{view.uploaded_by_name ?? "Team member"} · {when(view.created_at)}{view.bytes ? ` · ${kb(view.bytes)}` : ""}</p>
              </div>
              <button type="button" onClick={() => setView(null)} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-all duration-200 hover:rotate-90 hover:bg-red-50 hover:text-red-600">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg></button>
            </div>
            {view.caption && <p className="mt-2 text-[14px] text-slate-700">{view.caption}</p>}
            <p className="mt-3 text-[12.5px] font-semibold text-slate-500">Comments</p>
            {commentBox("file", view.id)}
            {canDelete(view.uploaded_by) && (del?.type === "file" && del.id === view.id ? deletePanel(del) : (
              <button type="button" onClick={() => { setDel({ type: "file", id: view.id, author: view.uploaded_by, label: view.file_type === "pdf" ? "document" : "photo", path: view.path }); setReason(""); }}
                className="mt-4 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-slate-400 transition-colors hover:bg-[#fff1f2] hover:text-[#e11d48]">Delete {view.file_type === "pdf" ? "document" : "photo"}</button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
