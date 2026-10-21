import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PREFS, SalesDoc, SalesLine } from "@/lib/sales";
import { buildSalesPdf, pdfFileName } from "@/lib/sales-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El cliente descarga el PDF desde el enlace público
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const { data } = await createClient().rpc("public_sales_doc", { tok: params.token });
  const p = data as { doc: SalesDoc; lines: SalesLine[]; company: { name: string } | null; white_label: boolean;
    prefs: { logo_url: string | null; org_info: Record<string, string> | null; pdf_settings: Record<string, unknown> | null; quote_settings: { hide_zero_lines?: boolean } | null; invoice_settings: { hide_zero_lines?: boolean } | null } | null } | null;
  if (!p?.doc) return NextResponse.json({ error: "This link isn't available" }, { status: 404 });
  const doc = { ...p.doc, emails: p.doc.emails ?? [] } as SalesDoc;
  const bytes = await buildSalesPdf({
    doc, lines: p.lines ?? [], companyName: p.company?.name ?? "", logoUrl: p.prefs?.logo_url ?? null, org: p.prefs?.org_info ?? {},
    pdf: (p.prefs?.pdf_settings ?? {}) as never, whiteLabel: Boolean(p.white_label),
    hideZero: doc.kind === "quote" ? p.prefs?.quote_settings?.hide_zero_lines ?? DEFAULT_PREFS.quote_settings.hide_zero_lines : p.prefs?.invoice_settings?.hide_zero_lines,
  });
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${pdfFileName(doc)}"`, "Cache-Control": "no-store" } });
}
