// =====================================================================
// Compresión de fotos en el teléfono, ANTES de subirlas (Paso 5.4)
// Meta: ~100 KB por foto en WebP (unas 10 fotos por 1 MB), sin guardar el original pesado.
//  · Foto normal: se reduce hasta caber en la meta.
//  · Etiqueta / número de serie: nunca baja de 1280 px ni de calidad media, para que se pueda leer.
//    Si así no cabe en 100 KB, se guarda un poco más grande y se avisa.
//  · Si el navegador no puede crear WebP (algunos iPhone), se guarda como JPEG con las mismas reglas.
// =====================================================================
export const PHOTO_TARGET = 100 * 1024;
export type Compressed = { blob: Blob; width: number; height: number; mime: string; ext: string; overTarget: boolean };

async function decode(file: Blob): Promise<{ src: CanvasImageSource; w: number; h: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { src: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
    } catch { /* se intenta con <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i); i.onerror = () => bad(new Error("This photo can't be read. Try another one."));
      i.src = url;
    });
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) { URL.revokeObjectURL(url); throw e; }
}

const toBlob = (c: HTMLCanvasElement, mime: string, q: number) => new Promise<Blob | null>((ok) => c.toBlob(ok, mime, q));

export async function compressPhoto(file: Blob, opts: { label?: boolean; target?: number } = {}): Promise<Compressed> {
  const target = opts.target ?? PHOTO_TARGET;
  const img = await decode(file);
  try {
    if (!img.w || !img.h) throw new Error("This photo can't be read. Try another one.");
    const long = Math.max(img.w, img.h);
    // Etiquetas: más resolución y calidad mínima más alta. Fotos normales: se puede bajar más.
    const sides = (opts.label ? [1600, 1440, 1280] : [1440, 1280, 1100, 960, 800]).filter((s, i, a) => s <= long || i === a.length - 1);
    const qualities = opts.label ? [0.8, 0.7, 0.6, 0.52] : [0.8, 0.7, 0.6, 0.5, 0.42];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This device can't prepare photos.");
    let mime = "image/webp";
    let best: Compressed | null = null;
    for (const side of sides) {
      const k = Math.min(1, side / long);
      const w = Math.max(1, Math.round(img.w * k)), h = Math.max(1, Math.round(img.h * k));
      canvas.width = w; canvas.height = h;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img.src, 0, 0, w, h);
      for (const q of qualities) {
        let blob = await toBlob(canvas, mime, q);
        if (blob && mime === "image/webp" && blob.type !== "image/webp") { mime = "image/jpeg"; blob = await toBlob(canvas, mime, q); }
        if (!blob) continue;
        const out: Compressed = { blob, width: w, height: h, mime, ext: mime === "image/webp" ? "webp" : "jpg", overTarget: blob.size > target };
        if (!best || blob.size < best.blob.size) best = out;
        if (blob.size <= target) return out;
      }
    }
    if (!best) throw new Error("This photo couldn't be prepared. Try again.");
    return best; // no cupo en la meta: la versión más ligera que sigue siendo legible
  } finally { img.close(); }
}

// Por qué falló la subida al almacenamiento, en palabras claras (antes solo decía "upload failed")
export function uploadReason(e: { message?: string; statusCode?: string | number; error?: string } | null | undefined): string {
  const m = `${e?.message ?? ""} ${e?.error ?? ""} ${e?.statusCode ?? ""}`;
  if (/row-level security|unauthorized|not authorized|permission|403/i.test(m)) return "the photo storage didn't allow it (permissions). Tell the office: run paso-5.8b in Supabase";
  if (/bucket.*not found|not found.*bucket|404/i.test(m)) return "the photo storage isn't set up. Tell the office: run paso-5.8b in Supabase";
  if (/mime|type.*not (allowed|supported)|415/i.test(m)) return "the photo storage doesn't accept this kind of file. Tell the office: run paso-5.8b in Supabase";
  if (/too large|exceeded|maximum|413/i.test(m)) return "the file is too big for the photo storage";
  if (/jwt|token|401/i.test(m)) return "your session expired. Close the app, sign in again and retry";
  if (/failed to fetch|network|load failed|timeout/i.test(m)) return "no connection. Check your signal and try again";
  return `it couldn't be saved${e?.message ? ` (${e.message.slice(0, 90)})` : ""}`;
}

export const kb = (bytes: number | null | undefined) => (bytes ? (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`) : "");
export const fileId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
