import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { docByToken, docUrl, pushToCompany } from "@/lib/push";

export const dynamic = "force-dynamic";

// El cliente acepta (con firma) o rechaza desde el enlace público; al dueño le suena el teléfono
export async function POST(request: NextRequest) {
  const b = await request.json().catch(() => null) as { token?: string; accept?: boolean; sig?: string | null; signer?: string | null } | null;
  if (!b?.token) return NextResponse.json({ result: "not_found" }, { status: 400 });
  const { data } = await createClient().rpc("public_quote_respond", { tok: b.token, accept: Boolean(b.accept), sig: b.sig ?? null, signer: b.signer ?? null });
  if (data === "accepted" || data === "declined") {
    const d = await docByToken(b.token);
    if (d) await pushToCompany(d.company_id, {
      title: data === "accepted" ? `✍️ Quote ${d.number} accepted & signed` : `Quote ${d.number} declined`,
      body: data === "accepted" ? `${b.signer || d.customer_name} signed it. Convert it to an invoice.` : `${d.customer_name} declined the quote.`,
      url: docUrl(d), tag: `q-${d.id}`,
    });
  }
  return NextResponse.json({ result: data });
}
