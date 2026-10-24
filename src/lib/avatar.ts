import { createClient } from "@/lib/supabase/client";
import { bustCache } from "@/lib/cache-client";

export const MAX_PHOTO_MB = 20; // se acepta una foto grande del celular; se reduce sola antes de subirla

// Reduce la foto (máx. 1024 px, JPG ~85%) para que suba rápido y se vea nítida
export async function compressImage(file: File, max = 1024, quality = 0.86): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", quality));
    return blob ?? file;
  } catch { return file; }
}

// Sube la foto de perfil y la guarda. Devuelve un mensaje de error o null si salió bien.
export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return "Choose a photo (JPG, PNG, WEBP or HEIC).";
  if (file.size > MAX_PHOTO_MB * 1024 * 1024) return `The photo must be ${MAX_PHOTO_MB} MB or smaller.`;
  const blob = await compressImage(file);
  if (blob.size > 5 * 1024 * 1024) return "That photo is too large. Try another one.";
  const s = createClient();
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error: upErr } = await s.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
  if (upErr) return "The photo couldn't be uploaded. Try again.";
  const { data } = s.storage.from("avatars").getPublicUrl(path);
  const { error } = await s.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", userId);
  await bustCache("profile");
  return error ? "The photo uploaded but couldn't be saved to your profile." : null;
}

export async function removeAvatar(userId: string) {
  await createClient().from("profiles").update({ avatar_url: null }).eq("id", userId);
  await bustCache("profile");
}
