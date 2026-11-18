import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================================
// Paso 5.8d · Fotos, PDF y fotos del chat de un trabajo, por el servidor.
// Antes el teléfono guardaba directo en Supabase Storage y dependía de los permisos de la carpeta
// (a Juan le rechazaba la foto con "permissions"). Ahora:
//   1. Aquí se revisa, con la sesión de la persona, que de verdad puede ver ese trabajo (job_can_see).
//   2. El servidor entrega un pase de un solo uso para subir ESE archivo, o los enlaces para verlo.
// El archivo viaja directo del teléfono a Supabase (no pasa por Vercel), así no hay límite de tamaño nuevo.
// =====================================================================
const BUCKET = "job-photos";
const EXT = new Set(["webp", "jpg", "pdf"]);
const cleanPath = (p: unknown, prefix: string): p is string => typeof p === "string" && p.startsWith(prefix) && !p.includes("..") && p.length < 300;

export async function POST(request: NextRequest) {
  const { supabase, current } = await getSession();
  if (!current) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const b = await request.json().catch(() => null) as { action?: string; jobId?: string; ext?: string; chat?: boolean; id?: string; paths?: unknown[] } | null;
  if (!b?.jobId || !/^[0-9a-f-]{36}$/i.test(b.jobId)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const db = admin();
  // Sin llave de servicio el teléfono sigue subiendo directo, como antes
  if (!db) return NextResponse.json({ fallback: true });

  // ¿Puede ver este trabajo? Lo decide la base con la sesión de quien pregunta (oficina, o colaborador asignado)
  const can = await supabase.rpc("job_can_see", { p_job: b.jobId });
  let allowed = can.data === true;
  if (can.error) {
    const { data: seen } = await supabase.from("jobs").select("id").eq("id", b.jobId).eq("company_id", current.id).maybeSingle();
    allowed = Boolean(seen);
  }
  if (!allowed) return NextResponse.json({ error: "You are not on this job." }, { status: 403 });
  const { data: job } = await db.from("jobs").select("id, company_id").eq("id", b.jobId).maybeSingle();
  if (!job || job.company_id !== current.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const prefix = `${job.company_id}/${job.id}/`;
  const store = db.storage.from(BUCKET);

  if (b.action === "upload") {
    if (!EXT.has(b.ext ?? "") || !/^[a-z0-9-]{6,40}$/i.test(b.id ?? "")) return NextResponse.json({ error: "Bad request" }, { status: 400 });
    const path = `${prefix}${b.chat ? "chat/" : ""}${b.id}.${b.ext}`;
    let r = await store.createSignedUploadUrl(path);
    if (r.error && /bucket/i.test(r.error.message)) {
      // La carpeta de fotos no existe todavía: se crea (privada) y se intenta otra vez
      await db.storage.createBucket(BUCKET, { public: false });
      r = await store.createSignedUploadUrl(path);
    }
    if (r.error || !r.data) return NextResponse.json({ error: r.error?.message ?? "Storage is not available" }, { status: 500 });
    return NextResponse.json({ path, token: r.data.token });
  }

  const paths = (b.paths ?? []).filter((p) => cleanPath(p, prefix)).slice(0, 200) as string[];
  if (b.action === "sign") {
    if (!paths.length) return NextResponse.json({ urls: {} });
    const { data, error } = await store.createSignedUrls(paths, 3600);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const urls: Record<string, string> = {};
    (data ?? []).forEach((x) => { if (x.path && x.signedUrl) urls[x.path] = x.signedUrl; });
    return NextResponse.json({ urls });
  }
  if (b.action === "remove") {
    // Solo se borra del almacenamiento lo que ya no está en ningún registro (lo que la base ya dejó borrar, o una subida que no se guardó)
    const [{ data: used }, { data: inChat }] = await Promise.all([
      db.from("job_photos").select("path").eq("job_id", job.id).in("path", paths.length ? paths : ["-"]),
      db.from("job_messages").select("photo_path").eq("job_id", job.id).in("photo_path", paths.length ? paths : ["-"]),
    ]);
    const keep = new Set([...(used ?? []).map((x) => x.path as string), ...(inChat ?? []).map((x) => x.photo_path as string)]);
    const gone = paths.filter((p) => !keep.has(p));
    if (gone.length) await store.remove(gone);
    return NextResponse.json({ removed: gone.length });
  }
  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}
