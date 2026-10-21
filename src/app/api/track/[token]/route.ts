import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// Pixel invisible del correo: cuando el cliente lo abre, se marca como visto
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try { await createClient().rpc("public_email_opened", { tok: params.token.replace(/\.gif$/, "") }); } catch { /* nunca falla para el cliente */ }
  return new NextResponse(GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } });
}
