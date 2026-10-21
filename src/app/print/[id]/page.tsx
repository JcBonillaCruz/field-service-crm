import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageSales, docStatus } from "@/lib/sales";
import { loadDoc } from "@/lib/sales-server";
import DocPaper, { PaperVariant } from "@/components/sales/DocPaper";
import PrintBar from "@/components/sales/PrintBar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Print | BrightPro" };

// Página limpia para imprimir o guardar como PDF (Quote, Invoice, Delivery Note, Packing Slip)
export default async function PrintPage({ params, searchParams }: { params: { id: string }; searchParams: { v?: string; auto?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageSales(current.role)) notFound();
  const { data: row } = await supabase.from("sales_docs").select("kind").eq("id", params.id).eq("company_id", current.id).maybeSingle();
  if (!row) notFound();
  const d = await loadDoc(supabase, current.id, row.kind, params.id);
  if (!d) notFound();
  const variant: PaperVariant = searchParams.v === "delivery" ? "delivery" : searchParams.v === "packing" ? "packing" : "full";
  const label = variant === "delivery" ? "Delivery Note" : variant === "packing" ? "Packing Slip" : d.doc.kind === "quote" ? "Quote" : "Invoice";
  return (
    <div className="min-h-screen bg-[#eef1f4] print:bg-white">
      <PrintBar auto={searchParams.auto === "1"} title={`${label} ${d.doc.number} · ${d.doc.customer_name}`} />
      <div className="px-2 py-6 sm:px-6 print:p-0">
        <DocPaper doc={d.doc} lines={d.lines} prefs={d.prefs} companyName={d.companyName} status={docStatus(d.doc)} variant={variant} ribbon={false} />
      </div>
    </div>
  );
}
