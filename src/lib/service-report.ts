import { createClient } from "@/lib/supabase/client";
import { addressLine, SiteAddress } from "@/lib/jobs";
import { FormData, FormKind, FormTx, displayValue, formTitle, localizeSections, visibleSections } from "@/lib/job-forms";
import { DocLang, docLangOf, reportTx } from "@/lib/doc-lang";
import { signJobFiles } from "@/lib/job-storage";
import { PdfBlock, PdfDoc, buildReportPdf, pdfFileName } from "@/lib/report-pdf";

// =====================================================================
// Reporte de servicio para el cliente (Paso 5.13)
// Un PDF con lo que se hizo en el trabajo: visita, técnico, formulario (Work / Tune-Up con sus lecturas),
// servicios y materiales SIN precios ni costos, equipos atendidos y las fotos del trabajo.
// Se arma en el navegador de la oficina (las fotos WebP se pasan a JPG ahí mismo) y se adjunta al correo de la factura.
// No lleva notas de oficina, notas internas del técnico, costos ni ganancias.
// =====================================================================
export const MAX_REPORT_PHOTOS = 12;
type Job = {
  job: { id: string; number: string; title: string | null; description: string | null; customer_name: string; site_address: SiteAddress; finished_at: string | null; completed_at: string | null; started_at: string | null };
  type: { name: string } | null;
  visits: { visit_no: number; starts_at: string | null; started_at: string | null; finished_at: string | null; techs: { name: string }[] }[];
  lines: { name: string; description: string | null; quantity: number; unit: string | null; kind: string }[];
  parts: { name: string; qty: number }[];
  forms: { kind: FormKind; data: Record<string, unknown>; submitted_by_name: string | null; submitted_at: string | null }[];
  photos: { id: string; path: string; kind: string; caption: string | null; created_at: string }[];
  equipment: { kind: string; brand: string | null; model: string | null; serial: string | null; location_note: string | null; is_active: boolean }[];
};
const tag = (lang: DocLang) => (lang === "es" ? "es-US" : "en-US");
const day = (iso: string | null | undefined, lang: DocLang) => (iso ? new Date(iso).toLocaleDateString(tag(lang), { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "");
const clock = (iso: string | null | undefined, lang: DocLang) => (iso ? new Date(iso).toLocaleTimeString(tag(lang), { hour: "numeric", minute: "2-digit" }) : "");
const isImage = (path: string) => /\.(webp|jpe?g|png)$/i.test(path);

// Paso 6.2d: el reporte sale en el idioma del cliente. Si no se dice, se toma de su ficha (Customer Language).
async function customerLangOfJob(jobId: string): Promise<DocLang> {
  const sb = createClient();
  const { data: j } = await sb.from("jobs").select("customer_id").eq("id", jobId).maybeSingle();
  if (!j?.customer_id) return "en";
  const { data: c } = await sb.from("customers").select("language").eq("id", j.customer_id).maybeSingle();
  return docLangOf((c as { language?: string | null } | null)?.language);
}
// Campos del formulario en español: se cargan solo cuando hacen falta (no pesan en las demás pantallas)
async function formTxFor(lang: DocLang): Promise<{ tx?: FormTx; title: (k: FormKind) => string }> {
  if (lang !== "es") return { title: formTitle };
  const [{ createTranslator }, msgs] = await Promise.all([import("next-intl"), import("@/messages/es.json")]);
  const t = createTranslator({ locale: "es", messages: (msgs as { default?: unknown }).default as never ?? msgs as never });
  const has = (k: string) => (t as unknown as { has: (k: string) => boolean }).has(k);
  const pick = (k: string, fb: string) => (has(k) ? String((t as unknown as (k: string) => string)(k)) : fb);
  const tx: FormTx = {
    section: (_k, sec) => pick(`forms.sec.${sec.id}`, sec.title),
    label: (k, f) => pick(`forms.f.${k}.${f.key}`, f.label),
    option: (k, f, o) => pick(`forms.o.${k}.${f.key}.${o.value}`, o.label),
    placeholder: (k, f) => f.placeholder,
    words: { orMore: "o más", orLess: "o menos" }, attention: "", outOfRange: () => "", above: () => "", capOff: () => "", deltaT: "", tempRise: "",
  };
  return { tx, title: (k) => pick(`forms.title.${k}`, formTitle(k)) };
}

// ¿Qué trabajo salió de esta factura? (null = la factura no viene de un trabajo)
export async function jobOfInvoice(invoiceId: string): Promise<{ id: string; number: string } | null> {
  const { data } = await createClient().from("jobs").select("id, number").eq("invoice_id", invoiceId).is("cancelled_at", null).limit(1);
  return ((data ?? [])[0] as { id: string; number: string } | undefined) ?? null;
}

// Foto (WebP/PNG/JPG) → JPG de máximo 1000 px, que es lo que el PDF sabe guardar
async function toJpg(url: string): Promise<Uint8Array | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext("2d"); if (!g) return null;
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    const out: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.72));
    return out ? new Uint8Array(await out.arrayBuffer()) : null;
  } catch { return null; }
}

export type ServiceReport = { doc: PdfDoc; photos: number; photosLeftOut: number; hasForm: boolean };

export async function loadServiceReport(jobId: string, companyName: string, langIn?: DocLang): Promise<ServiceReport | { error: string }> {
  const { data, error } = await createClient().rpc("tech_job", { p_job: jobId });
  if (error || !data) return { error: "The job couldn't be loaded." };
  const lang = langIn ?? await customerLangOfJob(jobId);
  const R = reportTx(lang);
  const ftx = await formTxFor(lang);
  const d = data as Job, j = d.job;
  const blocks: PdfBlock[] = [];
  const visits = [...(d.visits ?? [])].sort((a, b) => a.visit_no - b.visit_no);
  const last = visits.filter((v) => v.finished_at).pop() ?? visits[visits.length - 1];
  const techs = Array.from(new Set(visits.flatMap((v) => (v.techs ?? []).map((t) => t.name)).filter(Boolean)));
  const when = last?.finished_at ?? j.finished_at ?? j.completed_at ?? last?.starts_at ?? null;

  blocks.push({ type: "kpis", items: [
    { label: R.serviceDate, value: day(when, lang) || "-" },
    { label: techs.length > 1 ? R.techs : R.tech, value: techs.join(", ") || "-" },
    { label: R.type, value: d.type?.name ?? R.service },
  ] });
  const info: [string, string][] = [[R.customer, j.customer_name], [R.address, addressLine(j.site_address)], [R.job, `#${j.number}${j.title ? ` · ${j.title}` : ""}`]];
  if (last?.started_at && last?.finished_at) info.push([R.onSite, `${clock(last.started_at, lang)} ${R.to} ${clock(last.finished_at, lang)}`]);
  if (visits.length > 1) info.push([R.visits, String(visits.length)]);
  blocks.push({ type: "table", hideHeader: true, columns: [{ label: "", width: 1 }, { label: "", width: 3 }], rows: info.filter(([, v]) => v).map(([a, b]) => ({ cells: [{ text: a, tone: "muted" }, b] })) });
  if (j.description?.trim()) { blocks.push({ type: "heading", text: R.reason }); blocks.push({ type: "bullets", items: j.description.trim().split(/\n+/).filter(Boolean) }); }

  // Formularios del técnico: solo lo que llenó
  for (const f of d.forms ?? []) {
    const fd = (f.data ?? {}) as FormData;
    const rows: { cells: (string | { text: string; tone?: "muted" })[]; style?: "section" }[] = [];
    for (const s of localizeSections(f.kind, visibleSections(f.kind, fd), ftx.tx)) {
      const filled = s.fields.filter((x) => !x.when || x.when(fd)).map((x) => [x.label, displayValue(x, fd[x.key], R.yes)] as const).filter(([, v]) => v);
      if (!filled.length) continue;
      rows.push({ cells: [s.title], style: "section" });
      filled.forEach(([l, v]) => rows.push({ cells: [{ text: l, tone: "muted" }, v] }));
    }
    if (!rows.length) continue;
    blocks.push({ type: "heading", text: f.kind === "tune_up" ? R.tuneUp : R.work(ftx.title(f.kind)) });
    blocks.push({ type: "table", hideHeader: true, columns: [{ label: "", width: 1.3 }, { label: "", width: 2 }], rows });
  }

  const items = [...(d.lines ?? []).map((l) => ({ name: l.name, qty: Number(l.quantity) || 0, what: l.kind === "material" ? R.material : R.service })),
    ...(d.parts ?? []).filter((p) => !(d.lines ?? []).some((l) => l.name === p.name)).map((p) => ({ name: p.name, qty: Number(p.qty) || 0, what: R.part }))];
  if (items.length) {
    blocks.push({ type: "heading", text: R.items });
    blocks.push({ type: "table", columns: [{ label: R.desc, width: 4 }, { label: R.kind, width: 1.2 }, { label: R.qty, width: 0.7, align: "right" }], rows: items.map((i) => ({ cells: [i.name, i.what, String(i.qty)] })) });
  }
  const eq = (d.equipment ?? []).filter((e) => e.is_active !== false);
  if (eq.length) {
    blocks.push({ type: "heading", text: R.equipment });
    blocks.push({ type: "table", columns: [{ label: R.equip, width: 2 }, { label: R.model, width: 1.6 }, { label: R.serial, width: 1.6 }], rows: eq.map((e) => ({ cells: [[e.brand, e.location_note].filter(Boolean).join(" · ") || R.equip, e.model ?? "-", e.serial ?? "-"] })) });
  }

  // Fotos: primero Before / After, hasta 12
  const order = ["before", "after", "during", "serial"];
  const all = (d.photos ?? []).filter((p) => isImage(p.path)).sort((a, b) => (order.indexOf(a.kind) + 9) % 9 - (order.indexOf(b.kind) + 9) % 9 || a.created_at.localeCompare(b.created_at));
  const chosen = all.slice(0, MAX_REPORT_PHOTOS);
  let shown = 0;
  if (chosen.length) {
    const urls = await signJobFiles(j.id, chosen.map((p) => p.path));
    const jpgs = await Promise.all(chosen.map((p) => (urls[p.path] ? toJpg(urls[p.path]) : Promise.resolve(null))));
    const photoItems = chosen.map((p, i) => ({ jpg: jpgs[i], caption: [R.photo[p.kind] ?? "", p.caption ?? ""].filter(Boolean).join(" · ") })).filter((x): x is { jpg: Uint8Array; caption: string } => Boolean(x.jpg));
    shown = photoItems.length;
    if (shown) { blocks.push({ type: "heading", text: R.photos }); blocks.push({ type: "photos", items: photoItems }); }
  }
  blocks.push({ type: "note", text: R.thanks(companyName) });

  return {
    doc: { title: R.title, subtitle: `${j.customer_name} · ${addressLine(j.site_address) || R.visit} · ${R.jobNo(j.number)}`, company: companyName, blocks, footer: R.jobNo(j.number), lang, fileName: pdfFileName(lang === "es" ? "reporte-de-servicio" : "service-report", j.number) },
    photos: shown, photosLeftOut: all.length - chosen.length, hasForm: (d.forms ?? []).length > 0,
  };
}

// El PDF listo para adjuntar (base64)
export async function serviceReportAttachment(report: ServiceReport): Promise<{ filename: string; content: string }> {
  const bytes = await buildReportPdf(report.doc);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
  return { filename: report.doc.fileName, content: btoa(bin) };
}
