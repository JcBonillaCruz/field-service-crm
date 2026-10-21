import { PdfSettings, SalesDoc, SalesLine, Status, addressLines, balanceOf, discountSummary, fmtD, fmtDT, num2, pdfOf } from "@/lib/sales";
import { Ribbon } from "@/components/sales/SalesBits";

export type PaperVariant = "full" | "delivery" | "packing";
export type PaperPrefs = {
  logo_url: string | null; org_info: { address?: string; phone?: string; email?: string; website?: string };
  quote_settings?: { hide_zero_lines?: boolean }; invoice_settings?: { hide_zero_lines?: boolean }; pdf_settings?: PdfSettings; white_label?: boolean;
};

// El documento como se ve en "PDF" (mismo diseño que el PDF real). Lo usan el detalle, la impresión y el enlace público.
export default function DocPaper({ doc, lines, prefs, companyName, status, variant = "full", ribbon = true, compact = false }: {
  doc: SalesDoc; lines: SalesLine[]; prefs: PaperPrefs; companyName: string; status?: Status; variant?: PaperVariant; ribbon?: boolean; compact?: boolean;
}) {
  const s = pdfOf(prefs.pdf_settings);
  const isQuote = doc.kind === "quote";
  const priced = variant === "full";
  const hideZero = isQuote ? prefs.quote_settings?.hide_zero_lines : prefs.invoice_settings?.hide_zero_lines;
  const rows = lines.filter((l) => !(priced && hideZero && Number(l.amount) === 0));
  const title = variant === "delivery" ? "DELIVERY NOTE" : variant === "packing" ? "PACKING SLIP" : isQuote ? "QUOTE" : "INVOICE";
  const org = prefs.org_info ?? {};
  const bill = addressLines(doc.billing_address);
  const site = addressLines(doc.site_address);
  const disc = discountSummary(doc, lines);
  const pad = s.margin === "narrow" ? "px-5 py-7 sm:px-8 sm:py-9" : s.margin === "wide" ? "px-7 py-10 sm:px-16 sm:py-14" : "px-6 py-8 sm:px-11 sm:py-11";
  const size = s.font_size === "small" ? "text-[12px]" : s.font_size === "large" ? "text-[14px]" : "text-[13px]";
  const logoH = s.logo_size === "small" ? "max-h-16" : s.logo_size === "large" ? "max-h-44" : "max-h-28";
  const modern = s.template === "modern"; const minimal = s.template === "minimal";
  const showPowered = !prefs.white_label || s.show_powered;
  const meta: [string, string][] = isQuote
    ? [["Quote Date", fmtD(doc.doc_date)], ["Expiry Date", fmtD(doc.expiry_date)], ["Reference#", doc.reference ?? ""], ["Salesperson", doc.salesperson ?? ""]]
    : [["Invoice Date", fmtD(doc.doc_date)], ["Terms", doc.payment_terms ?? ""], ["Due Date", fmtD(doc.due_date)], ["P.O.#", doc.order_number ?? ""], ["Salesperson", doc.salesperson ?? ""]];
  const discLabel = doc.coupon_code ? `Discount (${doc.coupon_code})` : doc.discount_type === "percent" && Number(doc.discount_value) && !disc.itemDisc ? `Discount (${+doc.discount_value}%)` : "Discount";

  return (
    <div className={`bp-paper relative mx-auto w-full ${compact ? "max-w-[740px]" : "max-w-[820px]"} border border-slate-200 bg-white ${size} leading-relaxed text-slate-700 shadow-[0_2px_16px_rgba(15,40,60,0.08)] print:max-w-none print:border-0 print:shadow-none`}>
      {ribbon && status && priced && <Ribbon label={status.label.replace(/^Overdue by .*/, "Overdue")} tone={status.tone} />}
      {modern && (
        <div className="flex items-end justify-between gap-4 px-6 py-7 text-white sm:px-11" style={{ background: s.accent }}>
          <p className="text-[18px] font-semibold">{companyName}</p>
          <div className="text-right"><p className="text-[30px] font-semibold leading-none tracking-wide">{title}</p><p className="mt-1 opacity-90"># {doc.number}</p></div>
        </div>
      )}
      <div className={pad}>
        <div className="flex flex-col-reverse gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {prefs.logo_url && <img src={prefs.logo_url} alt={companyName} className={`mb-4 ${logoH} max-w-[240px] object-contain`} />}
            {!modern && <p className="text-[1.08em] font-semibold text-[#0b1f3a]">{companyName}</p>}
            {s.show_org_address && <>
              {org.address && <p className="whitespace-pre-line">{org.address}</p>}
              {org.phone && <p>{org.phone}</p>}{org.email && <p>{org.email}</p>}{org.website && <p>{org.website}</p>}
            </>}
          </div>
          <div className="text-left sm:text-right">
            {!modern && <p className={`${minimal ? "text-[22px] font-bold" : "text-[30px] font-light sm:text-[36px]"} tracking-wide text-[#0b1f3a]`}>{title}</p>}
            {!modern && <p className="font-semibold text-[#0b1f3a]"># {doc.number}</p>}
            {!isQuote && priced && (
              <div className="mt-3">
                <p className="text-[0.92em] font-semibold text-slate-500">Balance Due</p>
                <p className="text-[1.4em] font-semibold text-[#0b1f3a]">${num2(balanceOf(doc))}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="min-w-0">
              <p className="text-slate-500">Bill To</p>
              <p className="font-semibold" style={{ color: s.template === "standard" ? "#0f766e" : s.accent }}>{doc.customer_name}</p>
              {bill.map((l, i) => <p key={i}>{l}</p>)}
            </div>
            {site.length > 0 && (
              <div className="min-w-0">
                <p className="text-slate-500">{doc.site_address?.label ? `Job Site · ${doc.site_address.label}` : "Job Site / Ship To"}</p>
                {site.map((l, i) => <p key={i}>{l}</p>)}
              </div>
            )}
          </div>
          <table className="self-end">
            <tbody>
              {meta.filter(([, v]) => v).map(([k, v]) => (
                <tr key={k}><td className="py-0.5 pr-6 text-slate-500 sm:text-right">{k} :</td><td className="py-0.5 text-right text-[#0b1f3a]">{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        {doc.subject && <p className="mt-6"><span className="text-slate-500">Subject :</span><br /><span className="text-[#0b1f3a]">{doc.subject}</span></p>}

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse">
            <thead>
              <tr className={`text-left text-[0.92em] ${minimal ? "border-b-2 text-[#0b1f3a]" : "text-white"}`} style={minimal ? { borderColor: s.accent } : { background: s.accent }}>
                <th className="w-10 px-3 py-2.5 text-center font-medium">#</th>
                <th className="px-3 py-2.5 font-medium">Item & Description</th>
                <th className="w-20 px-3 py-2.5 text-right font-medium">Qty</th>
                {priced && <th className="w-28 px-3 py-2.5 text-right font-medium">Rate</th>}
                {priced && <th className="w-28 px-3 py-2.5 text-right font-medium">Amount</th>}
                {variant === "packing" && <th className="w-24 px-3 py-2.5 text-center font-medium">Packed</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No items</td></tr>}
              {rows.map((l, i) => (
                <tr key={l.id ?? i} className="border-b border-slate-200 align-top">
                  <td className="px-3 py-3 text-center">{i + 1}</td>
                  <td className="px-3 py-3"><p className="text-[#0b1f3a]">{l.name}</p>{l.description && <p className="whitespace-pre-line text-slate-500">{l.description}</p>}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{num2(l.quantity)}{l.unit ? <span className="block text-[0.85em] text-slate-400">{l.unit}</span> : null}</td>
                  {priced && <td className="px-3 py-3 text-right tabular-nums">{num2(l.rate)}</td>}
                  {priced && <td className="px-3 py-3 text-right tabular-nums">{num2((Number(l.quantity) || 0) * (Number(l.rate) || 0))}</td>}
                  {variant === "packing" && <td className="px-3 py-3 text-center"><span className="inline-block h-4 w-4 rounded border border-slate-400" /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {priced && (
          <div className="mt-2 flex justify-end">
            <table className="w-full max-w-[340px]">
              <tbody>
                <tr><td className="py-2 pr-6 text-right">Sub Total</td><td className="py-2 text-right tabular-nums">{num2(disc.gross)}</td></tr>
                {disc.total > 0 && <tr><td className="py-1.5 pr-6 text-right">{discLabel}</td><td className="py-1.5 text-right tabular-nums text-[#e11d48]">(-) {num2(disc.total)}</td></tr>}
                {Number(doc.tax_amount) > 0 && <tr><td className="py-1.5 pr-6 text-right">{doc.tax_name || "Tax"} ({+doc.tax_rate}%)</td><td className="py-1.5 text-right tabular-nums">{num2(doc.tax_amount)}</td></tr>}
                {Number(doc.shipping) !== 0 && <tr><td className="py-1.5 pr-6 text-right">Shipping Charges</td><td className="py-1.5 text-right tabular-nums">{num2(doc.shipping)}</td></tr>}
                {Number(doc.adjustment) !== 0 && <tr><td className="py-1.5 pr-6 text-right">{doc.adjustment_label || "Adjustment"}</td><td className="py-1.5 text-right tabular-nums">{num2(doc.adjustment)}</td></tr>}
                <tr className={`font-semibold text-[#0b1f3a] ${isQuote ? "bg-[#f5f4f3]" : ""}`}><td className="px-3 py-3 text-right">Total</td><td className="px-3 py-3 text-right tabular-nums">${num2(doc.total)}</td></tr>
                {!isQuote && Number(doc.amount_paid) > 0 && <tr><td className="py-2 pr-6 text-right">Payment Made</td><td className="py-2 text-right tabular-nums text-[#e11d48]">(-) {num2(doc.amount_paid)}</td></tr>}
                {!isQuote && Number(doc.written_off) > 0 && <tr><td className="py-2 pr-6 text-right">Written Off</td><td className="py-2 text-right tabular-nums">(-) {num2(doc.written_off)}</td></tr>}
                {!isQuote && <tr className="bg-[#f5f4f3] font-semibold text-[#0b1f3a]"><td className="px-3 py-3 text-right">Balance Due</td><td className="px-3 py-3 text-right tabular-nums">${num2(balanceOf(doc))}</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {(doc.notes || doc.terms) && (
          <div className="mt-10 space-y-5">
            {doc.notes && <div><p className="text-slate-500">Notes</p><p className="whitespace-pre-line text-[#0b1f3a]">{doc.notes}</p></div>}
            {doc.terms && <div><p className="text-slate-500">Terms & Conditions</p><p className="whitespace-pre-line text-[#0b1f3a]">{doc.terms}</p></div>}
          </div>
        )}
        {doc.signed_name && doc.signed_at && (
          <div className="mt-10">
            <p className="font-semibold text-[#0b1f3a]">Accepted & signed by the customer</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {doc.signature_data && <img src={doc.signature_data} alt={`Signature of ${doc.signed_name}`} className="mt-2 max-h-20 max-w-[260px] object-contain" />}
            <div className="mt-1 w-64 border-t border-slate-400 pt-1 text-slate-600">{doc.signed_name} · {fmtDT(doc.signed_at)}</div>
          </div>
        )}
        {variant !== "full" && (
          <div className="mt-16 grid gap-10 sm:grid-cols-2">
            <div className="border-t border-slate-400 pt-2 text-slate-500">Received by (name & signature)</div>
            <div className="border-t border-slate-400 pt-2 text-slate-500">Date</div>
          </div>
        )}
        {(s.footer_text || showPowered) && (
          <div className="mt-12 flex items-center gap-4 border-t border-slate-200 pt-3 text-[11px] text-slate-400">
            {s.footer_text && <span>{s.footer_text}</span>}
            {showPowered && <span className="flex items-center gap-1.5">POWERED BY <b className="text-[13px] text-[#0b1f3a]">Bright<span className="text-[#e8713a]">Pro</span></b></span>}
          </div>
        )}
      </div>
    </div>
  );
}
