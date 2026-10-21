import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SalesDoc, canManageSales, pdfOf, today } from "@/lib/sales";
import { loadPrefs } from "@/lib/sales-server";
import { emailHtml } from "@/lib/sales-mail";
import NoAccess from "@/components/customers/NoAccess";

export const dynamic = "force-dynamic";

// Estado del envío de correos + cómo se ve el correo en la bandeja del cliente
export default async function EmailSettingsPage() {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageSales(current.role)) return <NoAccess />;
  const prefs = await loadPrefs(supabase, current.id);
  const ready = Boolean(process.env.RESEND_API_KEY && process.env.SALES_FROM_EMAIL);
  const from = process.env.SALES_FROM_EMAIL ?? "invoices@yourdomain.com";
  const accent = pdfOf(prefs.pdf_settings).accent === "#2f3437" ? "#0f766e" : pdfOf(prefs.pdf_settings).accent;
  const doc = { kind: "invoice", number: "INV-000123", total: 683.06, amount_paid: 0, written_off: 0, due_date: today(), expiry_date: null } as unknown as SalesDoc;
  const html = emailHtml({
    body: `Dear Rob & Joe Traders,\n\nIt was a pleasure doing business with you. Your invoice INV-000123 for **$683.06** is ready.\n\nYou can view, print or download the invoice from the link below.\n{link}\n\nRegards,\n${user.fullName || current.name}\n${current.name}`,
    link: "#", pixel: "", doc, companyName: current.name, logoUrl: prefs.logo_url, accent, whiteLabel: prefs.white_label,
  });
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f6f8f9] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-[1100px]">
        <Link href="/dashboard/settings" className="text-[13px] font-medium text-[#0f766e] hover:underline">← All Settings</Link>
        <h1 className="mb-1 mt-1 text-2xl font-semibold text-[#0b1f3a]">Email Notifications</h1>
        <p className="mb-6 text-[15px] text-slate-500">How quotes, invoices and reminders reach your customers.</p>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-4">
            <div className={`rounded-2xl border p-5 ${ready ? "border-[#bfe7de] bg-[#f3fbf8]" : "border-[#fde2c7] bg-[#fff7ef]"}`}>
              <p className={`text-[13px] font-semibold uppercase tracking-wide ${ready ? "text-[#0f766e]" : "text-[#c2410c]"}`}>{ready ? "● Sending is on" : "● Sending isn't set up yet"}</p>
              <p className="mt-1 text-[15px] text-slate-700">{ready
                ? <>Emails go out as <b>{current.name} &lt;{from}&gt;</b>. When your customer hits Reply, it goes to <b>{prefs.org_info?.email || user.email}</b>.</>
                : <>Until it&apos;s connected, the Send button offers to open your email app instead.</>}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-[15px] text-slate-700">
              <p className="mb-2 font-semibold text-[#0b1f3a]">What your customer gets</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Your logo, the amount and a &quot;View&quot; button to the secure link.</li>
                <li>The PDF attached (you can turn it off when sending).</li>
                <li>When they open it, the quote or invoice shows <b>Viewed</b> and it&apos;s logged in Activity.</li>
                <li>Quotes can be accepted and signed from the link.</li>
              </ul>
              <p className="mt-3 text-[13px] text-slate-500">Reply-to address: set it under <Link href="/dashboard/settings/branding" className="font-medium text-[#2563eb] hover:underline">Branding → Email</Link>.</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Inbox preview</p>
              <p className="mt-1 truncate text-[14px]"><b className="text-[#0b1f3a]">{current.name}</b> <span className="text-slate-500">&lt;{from}&gt;</span></p>
              <p className="truncate text-[14px] text-slate-700">Invoice from {current.name} (Invoice#: INV-000123)</p>
            </div>
            <iframe title="Email preview" srcDoc={html} className="h-[620px] w-full border-0" sandbox="" />
          </div>
        </div>
      </div>
    </div>
  );
}
