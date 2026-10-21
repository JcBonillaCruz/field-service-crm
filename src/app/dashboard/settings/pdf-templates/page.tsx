import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SalesDoc, SalesLine, canManageSales, today } from "@/lib/sales";
import { loadPrefs } from "@/lib/sales-server";
import NoAccess from "@/components/customers/NoAccess";
import TemplateGallery from "@/components/settings/TemplateGallery";

// Galería de plantillas del PDF (página completa, no pop-up)
export default async function PdfTemplatesPage({ searchParams }: { searchParams: { for?: string } }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageSales(current.role)) return <NoAccess />;
  const kind = searchParams.for === "quote" ? "quote" : "invoice";
  const [prefs, { data: last }] = await Promise.all([
    loadPrefs(supabase, current.id),
    supabase.from("sales_docs").select("*").eq("company_id", current.id).eq("kind", kind).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  let sample: SalesDoc; let lines: SalesLine[];
  if (last) {
    sample = last as SalesDoc;
    const { data } = await supabase.from("sales_lines").select("*").eq("doc_id", last.id).order("position").limit(6);
    lines = (data ?? []) as SalesLine[];
  } else {
    sample = {
      id: "sample", company_id: current.id, kind, number: kind === "quote" ? "QT-000001" : "INV-000001", customer_name: "Rob & Joe Traders", customer_id: null, emails: [],
      billing_address: { street: "4141 Hacienda Drive", city: "Pleasanton", state: "CA", zip: "94588", country: "US" }, site_address: null, address_id: null,
      reference: null, order_number: "SO-17", doc_date: today(), expiry_date: today(), due_date: today(), payment_terms: "Due on Receipt", salesperson: null, project_name: null,
      subject: null, status: "sent", discount_value: 0, discount_type: "percent", coupon_code: null, tax_name: "Sales Tax", tax_rate: 8.25, tax_amount: 52.06,
      shipping: 0, adjustment: 0, adjustment_label: "Adjustment", subtotal: 631, total: 683.06, amount_paid: 0, written_off: 0, notes: "Thanks for your business.",
      terms: "Payment is due on receipt.", quote_id: null, subscription_id: null, sent_at: null, viewed_at: null, accepted_at: null, declined_at: null, voided_at: null,
      reminders_stopped: false, expected_payment_date: null, share_token: null, share_expires_on: null, created_by_name: null, created_at: today(), updated_at: today(),
    };
    lines = [
      { position: 0, item_id: null, name: "AC Tune-Up", description: "Full inspection, coil cleaning and refrigerant check", quantity: 1, unit: "each", rate: 149, discount: 0, discount_type: "percent", amount: 149 },
      { position: 1, item_id: null, name: "Capacitor Replacement", description: "45/5 MFD dual run capacitor", quantity: 1, unit: "each", rate: 232, discount: 0, discount_type: "percent", amount: 232 },
      { position: 2, item_id: null, name: "Labor", description: "Technician hours", quantity: 2, unit: "hr", rate: 125, discount: 0, discount_type: "percent", amount: 250 },
    ];
  }
  return <TemplateGallery companyId={current.id} prefs={prefs} company={current.name} sample={sample} sampleLines={lines} />;
}
