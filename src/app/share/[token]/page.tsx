import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PREFS, PdfSettings, SalesDoc, SalesLine, docStatus, money, balanceOf } from "@/lib/sales";
import DocPaper from "@/components/sales/DocPaper";
import { docByToken, docUrl, pushToCompany } from "@/lib/push";
import ShareActions from "@/components/sales/ShareActions";
import { shareLang } from "@/lib/sales-mail";
import { docDate, docTx } from "@/lib/doc-lang";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your document · Su documento", robots: { index: false, follow: false } };

type Payload = {
  doc: SalesDoc; lines: SalesLine[]; company: { name: string } | null;
  prefs: { logo_url: string | null; org_info: Record<string, string> | null; quote_settings: Record<string, unknown> | null; invoice_settings: Record<string, unknown> | null; pdf_settings: PdfSettings | null } | null;
  white_label?: boolean;
};

// Enlace público para el cliente (no necesita cuenta).
// Paso 6.2d: sale en el idioma del cliente (Customer Language); él puede cambiarlo con un toque (?lang=es / ?lang=en).
export default async function SharePage({ params, searchParams }: { params: { token: string }; searchParams?: { lang?: string } }) {
  const supabase = createClient();
  const before = await docByToken(params.token);
  const { data } = await supabase.rpc("public_sales_doc", { tok: params.token });
  // Primera vez que el cliente abre el enlace: te suena el teléfono
  if (before && !before.viewed_at) {
    await pushToCompany(before.company_id, { title: `👀 ${before.customer_name} is viewing your ${before.kind}`, body: `${before.kind === "quote" ? "Quote" : "Invoice"} ${before.number} was opened.`, url: docUrl(before), tag: `v-${before.id}` }).catch(() => 0);
  }
  const p = data as Payload | null;
  const lang = await shareLang(p?.doc?.customer_id, searchParams?.lang, headers().get("accept-language"));
  const L = docTx(lang);
  if (!p?.doc) {
    return (
      <main lang={lang} className="flex min-h-screen items-center justify-center bg-[#f4f6f8] px-6 text-center">
        <div><p className="text-xl font-semibold text-[#0b1f3a]">{L.share.unavailable}</p><p className="mt-2 text-slate-500">{L.share.unavailableText}</p></div>
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
    <main lang={lang} className="min-h-screen bg-[#eef1f4] print:bg-white">
      <div className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-[860px] flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="flex items-center gap-3 text-[13px] text-slate-500">
              <span>{company}</span>
              <a href={`/share/${params.token}?lang=${L.share.otherLang}`} hrefLang={L.share.otherLang} className="font-medium text-[#0f766e] hover:underline">{L.share.other}</a>
            </p>
            <p className="text-lg font-semibold text-[#0b1f3a]">
              {L.noun[doc.kind]} {doc.number} · {money(doc.kind === "invoice" ? balanceOf(doc) : doc.total)}
              {doc.kind === "invoice" && doc.due_date && <span className="ml-2 text-sm font-normal text-slate-500">{L.share.due(docDate(doc.due_date, lang))}</span>}
            </p>
          </div>
          <ShareActions token={params.token} canRespond={canRespond} defaultName={doc.customer_name} lang={lang} />
        </div>
      </div>
      <div className="px-2 py-6 sm:px-6 print:p-0">
        <DocPaper doc={doc} lines={p.lines ?? []} prefs={prefs} companyName={company} status={status} lang={lang} />
      </div>
      {!prefs.white_label && <p className="pb-8 text-center text-xs text-slate-400 print:hidden">{L.share.sentWith}</p>}
    </main>
  );
}
