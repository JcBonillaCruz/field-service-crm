import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PREFS, PdfSettings, SalesDoc, SalesLine, docStatus, money, balanceOf, fmtD } from "@/lib/sales";
import DocPaper from "@/components/sales/DocPaper";
import ShareActions from "@/components/sales/ShareActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your document", robots: { index: false, follow: false } };

type Payload = {
  doc: SalesDoc; lines: SalesLine[]; company: { name: string } | null;
  prefs: { logo_url: string | null; org_info: Record<string, string> | null; quote_settings: Record<string, unknown> | null; invoice_settings: Record<string, unknown> | null; pdf_settings: PdfSettings | null } | null;
  white_label?: boolean;
};

// Enlace público para el cliente (no necesita cuenta)
export default async function SharePage({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const { data } = await supabase.rpc("public_sales_doc", { tok: params.token });
  const p = data as Payload | null;
  if (!p?.doc) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f6f8] px-6 text-center">
        <div><p className="text-xl font-semibold text-[#0b1f3a]">This link isn&apos;t available</p><p className="mt-2 text-slate-500">It may have expired or been disabled. Please contact the business that sent it.</p></div>
      </main>
    );
  }
  const doc = { ...p.doc, emails: p.doc.emails ?? [] } as SalesDoc;
  const status = docStatus(doc);
  const prefs = {
    logo_url: p.prefs?.logo_url ?? null, org_info: p.prefs?.org_info ?? {},
    quote_settings: { ...DEFAULT_PREFS.quote_settings, ...(p.prefs?.quote_settings ?? {}) }, invoice_settings: { ...DEFAULT_PREFS.invoice_settings, ...(p.prefs?.invoice_settings ?? {}) },
    pdf_settings: p.prefs?.pdf_settings ?? {}, white_label: Boolean(p.white_label),
  };
  const canRespond = doc.kind === "quote" && prefs.quote_settings.allow_customer_respond !== false && ["draft", "sent", "viewed"].includes(doc.status) && status.key !== "expired";
  const company = p.company?.name ?? "";
  return (
    <main className="min-h-screen bg-[#eef1f4] print:bg-white">
      <div className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-[860px] flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-[13px] text-slate-500">{company}</p>
            <p className="text-lg font-semibold text-[#0b1f3a]">
              {doc.kind === "quote" ? "Quote" : "Invoice"} {doc.number} · {money(doc.kind === "invoice" ? balanceOf(doc) : doc.total)}
              {doc.kind === "invoice" && doc.due_date && <span className="ml-2 text-sm font-normal text-slate-500">due {fmtD(doc.due_date)}</span>}
            </p>
          </div>
          <ShareActions token={params.token} canRespond={canRespond} defaultName={doc.customer_name} />
        </div>
      </div>
      <div className="px-2 py-6 sm:px-6 print:p-0">
        <DocPaper doc={doc} lines={p.lines ?? []} prefs={prefs} companyName={company} status={status} />
      </div>
      {!prefs.white_label && <p className="pb-8 text-center text-xs text-slate-400 print:hidden">Sent with BrightPro</p>}
    </main>
  );
}
