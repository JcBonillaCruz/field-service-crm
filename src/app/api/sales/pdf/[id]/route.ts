import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { canManageSales } from "@/lib/sales";
import { loadDoc } from "@/lib/sales-server";
import { buildSalesPdf, pdfFileName } from "@/lib/sales-pdf";
import { pdfInputFrom } from "@/lib/sales-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PDF real para descargar o abrir (PDF, Delivery Note, Packing Slip)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, current } = await getSession();
  if (!current || !canManageSales(current.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { data: row } = await supabase.from("sales_docs").select("kind").eq("id", params.id).eq("company_id", current.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d = await loadDoc(supabase, current.id, row.kind, params.id);
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const v = request.nextUrl.searchParams.get("v");
  const variant = v === "delivery" ? "delivery" : v === "packing" ? "packing" : "full";
  const bytes = await buildSalesPdf(pdfInputFrom(d, variant));
  const inline = request.nextUrl.searchParams.get("inline") === "1";
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf", "Cache-Control": "no-store",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${pdfFileName(d.doc, variant)}"`,
    },
  });
}
