import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { docByToken, docUrl, pushToCompany } from "@/lib/push";

export const dynamic = "force-dynamic";
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// Pixel invisible del correo: cuando el cliente lo abre, se marca como visto y te avisa
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const token = params.token.replace(/\.gif$/, "");
  try {
    const before = await docByToken(token);
    await createClient().rpc("public_email_opened", { tok: token });
    if (before && (!before.email_opened_at || Date.now() - new Date(before.email_opened_at).getTime() > 30 * 60000)) {
      await pushToCompany(before.company_id, {
        title: `📬 ${before.customer_name} opened your email`,
        body: `${before.kind === "quote" ? "Quote" : "Invoice"} ${before.number} was just opened.`, url: docUrl(before), tag: `o-${before.id}`,
      });
    }
  } catch { /* nunca falla para el cliente */ }
  return new NextResponse(GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } });
}
