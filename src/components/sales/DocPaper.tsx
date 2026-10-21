import { PdfSettings, SalesDoc, SalesLine, Status, addressLines, balanceOf, discountSummary, fmtD, fmtDT, num2, pdfOf } from "@/lib/sales";
import { tplOf } from "@/lib/pdf-templates";
import { Ribbon } from "@/components/sales/SalesBits";

export type PaperVariant = "full" | "delivery" | "packing";
export type PaperPrefs = {
  logo_url: string | null; org_info: { address?: string; phone?: string; email?: string; website?: string };
  quote_settings?: { hide_zero_lines?: boolean }; invoice_settings?: { hide_zero_lines?: boolean }; pdf_settings?: PdfSettings; white_label?: boolean;
};

// El documento como se ve en "PDF" (mismo diseño que el PDF real), en cualquiera de las 30 plantillas.
export default function DocPaper({ doc, lines, prefs, companyName, status, variant = "full", ribbon = true, compact = false }: {
  doc: SalesDoc; lines: SalesLine[]; prefs: PaperPrefs; companyName: string; status?: Status; variant?: PaperVariant; ribbon?: boolean; compact?: boolean;
}) {
  const s = pdfOf(prefs.pdf_settings);
  const tp = tplOf(s.template);
  const A = s.accent;
  const isQuote = doc.kind === "quote";
  const priced = variant === "full";
  const hideZero = isQuote ? prefs.quote_settings?.hide_zero_lines : prefs.invoice_settings?.hide_zero_lines;
  const rows = lines.filter((l) => !(priced && hideZero && Number(l.amount) === 0));
  const title = variant === "delivery" ? "DELIVERY NOTE" : variant === "packing" ? "PACKING SLIP" : isQuote ? "QUOTE" : "INVOICE";
  const org = prefs.org_info ?? {};
  const bill = addressLines(doc.billing_address);
  const site = addressLines(doc.site_address);
  const disc = discountSummary(doc, lines);
  const showRibbon = Boolean(ribbon && status && priced);
  const pad = s.margin === "narrow" ? "px-5 sm:px-8" : s.margin === "wide" ? "px-7 sm:px-16" : "px-6 sm:px-11";
  const padY = s.margin === "narrow" ? "pb-8" : s.margin === "wide" ? "pb-14" : "pb-11";
  // Con cinta, el contenido baja para que la cinta nunca tape el logo (como Zoho)
  const top = tp.header === "band" ? "" : showRibbon ? "pt-20 sm:pt-24" : s.margin === "wide" ? "pt-14" : "pt-10";
  const size = s.font_size === "small" ? "text-[12px]" : s.font_size === "large" ? "text-[14px]" : "text-[13px]";
  const fontCls = tp.font === "serif" ? "font-serif" : tp.font === "mono" ? "font-mono" : "";
  const logoH = s.logo_size === "small" ? "max-h-14" : s.logo_size === "large" ? "max-h-40" : "max-h-24";
  const showPowered = !prefs.white_label || s.show_powered;
  const meta = (isQuote
    ? [["Quote Date", fmtD(doc.doc_date)], ["Expiry Date", fmtD(doc.expiry_date)], ["Reference#", doc.reference ?? ""], ["Salesperson", doc.salesperson ?? ""]]
    : [["Invoice Date", fmtD(doc.doc_date)], ["Terms", doc.payment_terms ?? ""], ["Due Date", fmtD(doc.due_date)], ["P.O.#", doc.order_number ?? ""], ["Salesperson", doc.salesperson ?? ""]]
  ).filter(([, v]) => v) as [string, string][];
  const discLabel = doc.coupon_code ? `Discount (${doc.coupon_code})` : doc.discount_type === "percent" && Number(doc.discount_value) && !disc.itemDisc ? `Discount (${+doc.discount_value}%)` : "Discount";
  const titleCls = `${tp.titleWeight === "bold" ? "font-bold" : "font-light"} tracking-wide ${tp.receipt ? "text-[22px]" : "text-[28px] sm:text-[34px]"}`;

  const logo = prefs.logo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={prefs.logo_url} alt={companyName} className={`mb-3 ${logoH} max-w-[220px] object-contain ${tp.header === "centered" ? "mx-auto" : tp.header === "reversed" ? "sm:ml-auto" : ""}`} />
  ) : null;
  const orgBlock = (
    <>
      {tp.header !== "band" && <p className="text-[1.08em] font-semibold text-[#0b1f3a]">{companyName}</p>}
      {s.show_org_address && <>
        {org.address && <p className="whitespace-pre-line">{org.address}</p>}
        {org.phone && <p>{org.phone}</p>}{org.email && <p>{org.email}</p>}{org.website && <p>{org.website}</p>}
      </>}
    </>
  );
  const balance = !isQuote && priced && (
    <div className="mt-3"><p className="text-[0.9em] font-semibold text-slate-500">Balance Due</p><p className="text-[1.35em] font-semibold text-[#0b1f3a]">${num2(balanceOf(doc))}</p></div>
  );
  const titleBlock = (align: string) => (
    <div className={align}>
      <p className={titleCls} style={{ color: tp.header === "split" ? A : "#0b1f3a" }}>{title}</p>
      <p className="font-semibold text-[#0b1f3a]"># {doc.number}</p>
      {balance}
    </div>
  );

  let header: React.ReactNode;
  if (tp.header === "band") {
    header = (
      <>
        <div className={`flex items-end justify-between gap-4 py-7 text-white ${showRibbon ? "pl-24 pr-6 sm:pr-11" : pad}`} style={{ background: A }}>
          <p className="text-[18px] font-semibold">{companyName}</p>
          <div className="text-right"><p className={`${titleCls} leading-none`}>{title}</p><p className="mt-1 opacity-90"># {doc.number}</p></div>
        </div>
        <div className={`${pad} mt-6 flex flex-col-reverse gap-4 sm:flex-row sm:justify-between`}>
          <div className="min-w-0">{logo}{orgBlock}</div>
          <div className="sm:text-right">{balance}</div>
        </div>
      </>
    );
  } else if (tp.header === "centered") {
    header = <div className={`${pad} text-center`}>{logo}{orgBlock}<div className="mt-5">{titleBlock("text-center")}</div></div>;
  } else if (tp.header === "reversed") {
    header = <div className={`${pad} flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between`}>{titleBlock("text-left")}<div className="min-w-0 sm:text-right">{logo}{orgBlock}</div></div>;
  } else {
    header = (
      <div className={`${pad} flex flex-col-reverse gap-6 sm:flex-row sm:items-start sm:justify-between`}>
        <div className="min-w-0">{logo}{orgBlock}</div>
        {titleBlock("text-left sm:text-right")}
      </div>
    );
  }

  const th: React.CSSProperties = tp.table === "dark" || tp.table === "accent" ? { background: A, color: "#fff" }
    : tp.table === "light" ? { background: `${A}1f`, color: "#0b1f3a" }
      : tp.table === "grid" ? { background: "#f1f5f9", color: "#0b1f3a" } : { color: "#0b1f3a", borderBottom: `2px solid ${A}` };
  const cellB = tp.table === "grid" ? "border border-slate-300" : "";
  const finalStyle: React.CSSProperties | undefined = tp.totals === "accent" ? { background: A, color: "#fff" } : tp.totals === "shade" || tp.totals === "box" ? { background: "#f5f4f3" } : undefined;

  return (
    <div className={`bp-paper relative mx-auto w-full ${tp.receipt ? "max-w-[460px]" : compact ? "max-w-[740px]" : "max-w-[820px]"} bg-white ${size} ${fontCls} leading-relaxed text-slate-700 shadow-[0_2px_16px_rgba(15,40,60,0.08)] print:max-w-none print:shadow-none ${tp.border ? "border-2 border-slate-300" : "border border-slate-200"}`}>
      {showRibbon && <Ribbon label={status!.label.replace(/^Overdue by .*/, "Overdue")} tone={status!.tone} />}
      <div className={`${top} ${padY}`}>
        {header}
        {tp.header === "split" && <div className={`${pad} mt-6`}><div className="h-1 rounded-full" style={{ background: A }} /></div>}
        <div className={pad}>
          {tp.meta === "row" && meta.length > 0 && (
            <div className="mt-6 grid grid-cols-2 border border-slate-200 sm:grid-cols-4">
              {meta.slice(0, 4).map(([k, v]) => <div key={k} className="border-slate-200 px-3 py-2 [&:not(:last-child)]:border-r"><p className="text-[0.85em] text-slate-500">{k}</p><p className="text-[#0b1f3a]">{v}</p></div>)}
            </div>
          )}
          <div className={`mt-8 grid gap-6 ${tp.receipt ? "" : "sm:grid-cols-[minmax(0,1fr)_auto]"}`}>
            <div className={`grid gap-6 ${tp.receipt ? "" : "sm:grid-cols-2"}`}>
              <div className="min-w-0">
                <p className="text-slate-500">Bill To</p>
                <p className="font-semibold" style={{ color: tp.id === "standard" ? "#0f766e" : A }}>{doc.customer_name}</p>
                {bill.map((l, i) => <p key={i}>{l}</p>)}
              </div>
              {site.length > 0 && (
                <div className="min-w-0">
                  <p className="text-slate-500">{doc.site_address?.label ? `Job Site · ${doc.site_address.label}` : "Job Site / Ship To"}</p>
                  {site.map((l, i) => <p key={i}>{l}</p>)}
                </div>
              )}
            </div>
            {tp.meta === "right" && meta.length > 0 && (
              <table className="self-end">
                <tbody>{meta.map(([k, v]) => <tr key={k}><td className="py-0.5 pr-6 text-slate-500 sm:text-right">{k} :</td><td className="py-0.5 text-right text-[#0b1f3a]">{v}</td></tr>)}</tbody>
              </table>
            )}
          </div>

          {doc.subject && <p className="mt-6"><span className="text-slate-500">Subject :</span><br /><span className="text-[#0b1f3a]">{doc.subject}</span></p>}

          <div className="mt-6 overflow-x-auto">
            <table className={`w-full border-collapse ${tp.receipt ? "" : "min-w-[460px]"}`}>
              <thead>
                <tr className="text-left text-[0.92em]" style={th}>
                  {!tp.receipt && <th className={`w-10 px-3 py-2.5 text-center font-medium ${cellB}`}>#</th>}
                  <th className={`px-3 py-2.5 font-medium ${cellB}`}>{tp.receipt ? "Item" : "Item & Description"}</th>
                  <th className={`w-16 px-3 py-2.5 text-right font-medium ${cellB}`}>Qty</th>
                  {priced && <th className={`w-24 px-3 py-2.5 text-right font-medium ${cellB}`}>Rate</th>}
                  {priced && <th className={`w-24 px-3 py-2.5 text-right font-medium ${cellB}`}>Amount</th>}
                  {variant === "packing" && <th className={`w-20 px-3 py-2.5 text-center font-medium ${cellB}`}>Packed</th>}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No items</td></tr>}
                {rows.map((l, i) => (
                  <tr key={l.id ?? i} className={`align-top ${cellB ? "" : "border-b border-slate-200"} ${tp.table === "accent" && i % 2 ? "bg-slate-50" : ""}`}>
                    {!tp.receipt && <td className={`px-3 py-3 text-center ${cellB}`}>{i + 1}</td>}
                    <td className={`px-3 py-3 ${cellB}`}><p className="text-[#0b1f3a]">{l.name}</p>{l.description && !tp.receipt && <p className="whitespace-pre-line text-slate-500">{l.description}</p>}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${cellB}`}>{num2(l.quantity)}{l.unit && !tp.receipt ? <span className="block text-[0.85em] text-slate-400">{l.unit}</span> : null}</td>
                    {priced && <td className={`px-3 py-3 text-right tabular-nums ${cellB}`}>{num2(l.rate)}</td>}
                    {priced && <td className={`px-3 py-3 text-right tabular-nums ${cellB}`}>{num2((Number(l.quantity) || 0) * (Number(l.rate) || 0))}</td>}
                    {variant === "packing" && <td className={`px-3 py-3 text-center ${cellB}`}><span className="inline-block h-4 w-4 rounded border border-slate-400" /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {priced && (
            <div className="mt-2 flex justify-end">
              <table className={`w-full ${tp.receipt ? "" : "max-w-[330px]"} ${tp.totals === "box" ? "mt-2 border border-slate-300" : ""}`}>
                <tbody>
                  <tr><td className="py-2 pr-6 text-right">Sub Total</td><td className="py-2 pr-3 text-right tabular-nums">{num2(disc.gross)}</td></tr>
                  {disc.total > 0 && <tr><td className="py-1.5 pr-6 text-right">{discLabel}</td><td className="py-1.5 pr-3 text-right tabular-nums text-[#e11d48]">(-) {num2(disc.total)}</td></tr>}
                  {Number(doc.tax_amount) > 0 && <tr><td className="py-1.5 pr-6 text-right">{doc.tax_name || "Tax"} ({+doc.tax_rate}%)</td><td className="py-1.5 pr-3 text-right tabular-nums">{num2(doc.tax_amount)}</td></tr>}
                  {Number(doc.shipping) !== 0 && <tr><td className="py-1.5 pr-6 text-right">Shipping Charges</td><td className="py-1.5 pr-3 text-right tabular-nums">{num2(doc.shipping)}</td></tr>}
                  {Number(doc.adjustment) !== 0 && <tr><td className="py-1.5 pr-6 text-right">{doc.adjustment_label || "Adjustment"}</td><td className="py-1.5 pr-3 text-right tabular-nums">{num2(doc.adjustment)}</td></tr>}
                  <tr className={`font-semibold text-[#0b1f3a] ${tp.totals === "plain" ? "border-t-2 border-slate-800" : ""}`} style={isQuote ? finalStyle : undefined}>
                    <td className="px-3 py-3 text-right">Total</td><td className="px-3 py-3 text-right tabular-nums">${num2(doc.total)}</td></tr>
                  {!isQuote && Number(doc.amount_paid) > 0 && <tr><td className="py-2 pr-6 text-right">Payment Made</td><td className="py-2 pr-3 text-right tabular-nums text-[#e11d48]">(-) {num2(doc.amount_paid)}</td></tr>}
                  {!isQuote && Number(doc.written_off) > 0 && <tr><td className="py-2 pr-6 text-right">Written Off</td><td className="py-2 pr-3 text-right tabular-nums">(-) {num2(doc.written_off)}</td></tr>}
                  {!isQuote && <tr className="font-semibold text-[#0b1f3a]" style={finalStyle}><td className="px-3 py-3 text-right">Balance Due</td><td className="px-3 py-3 text-right tabular-nums">${num2(balanceOf(doc))}</td></tr>}
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
          {tp.receipt && priced && <p className="mt-8 text-center text-[1.1em] text-[#0b1f3a]">Thank you!</p>}
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
            <div className="mt-12 flex items-center gap-4 border-t border-slate-200 pt-3 font-sans text-[11px] text-slate-400">
              {s.footer_text && <span>{s.footer_text}</span>}
              {showPowered && <span className="flex items-center gap-1.5">POWERED BY <b className="text-[13px] text-[#0b1f3a]">Bright<span className="text-[#e8713a]">Pro</span></b></span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
