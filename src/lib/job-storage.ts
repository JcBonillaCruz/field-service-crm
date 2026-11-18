import { createClient } from "@/lib/supabase/client";
import { fileId, uploadReason } from "@/lib/photo-compress";

// =====================================================================
// Paso 5.8d · Guardar, ver y borrar los archivos de un trabajo (fotos, PDF y fotos del chat).
// Primero por el servidor (/api/jobs/files: revisa que la persona esté en el trabajo y da un pase para ese archivo).
// Si el servidor no tiene la llave de servicio, se hace directo como antes.
// =====================================================================
const BUCKET = "job-photos";
const api = async (body: Record<string, unknown>) => {
  try {
    const r = await fetch("/api/jobs/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, data: (await r.json().catch(() => ({}))) as { fallback?: boolean; error?: string; path?: string; token?: string; urls?: Record<string, string> } };
  } catch { return { status: 0, data: { error: "Failed to fetch" } as { fallback?: boolean; error?: string; path?: string; token?: string; urls?: Record<string, string> } }; }
};

// Devuelve la ruta guardada, o el motivo claro por el que no se pudo
export async function uploadJobFile(o: { companyId: string; jobId: string; body: Blob; ext: string; mime: string; chat?: boolean }): Promise<{ path: string } | { error: string }> {
  const sb = createClient(), id = fileId();
  const opts = { contentType: o.mime, cacheControl: "31536000", upsert: false };
  const r = await api({ action: "upload", jobId: o.jobId, ext: o.ext, chat: Boolean(o.chat), id });
  if (r.data.path && r.data.token) {
    const up = await sb.storage.from(BUCKET).uploadToSignedUrl(r.data.path, r.data.token, o.body, opts);
    return up.error ? { error: uploadReason(up.error) } : { path: r.data.path };
  }
  if (!r.data.fallback) return { error: r.status === 403 ? "you are not on this job" : uploadReason({ message: r.data.error }) };
  const path = `${o.companyId}/${o.jobId}/${o.chat ? "chat/" : ""}${id}.${o.ext}`;
  const up = await sb.storage.from(BUCKET).upload(path, o.body, opts);
  return up.error ? { error: uploadReason(up.error) } : { path };
}

// Enlaces para ver los archivos (duran 1 hora)
export async function signJobFiles(jobId: string, paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const r = await api({ action: "sign", jobId, paths });
  if (r.data.urls) return r.data.urls;
  const { data } = await createClient().storage.from(BUCKET).createSignedUrls(paths, 3600);
  const m: Record<string, string> = {};
  ((data ?? []) as { path: string | null; signedUrl: string }[]).forEach((x) => { if (x.path && x.signedUrl) m[x.path] = x.signedUrl; });
  return m;
}

export async function removeJobFiles(jobId: string, paths: string[]) {
  if (!paths.length) return;
  const r = await api({ action: "remove", jobId, paths });
  if (r.data.fallback || r.status === 0) await createClient().storage.from(BUCKET).remove(paths);
}
