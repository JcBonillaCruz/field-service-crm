import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SalesDoc, canManageSales, pdfOf, today } from "@/lib/sales";
import { loadPrefs } from "@/lib/sales-server";
import { emailHtml } from "@/lib/sales-mail";
import NoAccess from "@/components/customers/NoAccess";
import { getLocale, getTranslations } from "next-intl/server";
import { docEmailBody, docEmailSubject } from "@/lib/doc-lang";

export const dynamic = "force-dynamic";

// Estado del envío de correos + cómo se ve el correo en la bandeja del cliente
export default async function EmailSettingsPage() {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageSales(current.role)) return <NoAccess />;
  const t = await getTranslations("emailSettings");
  const b = (c: React.ReactNode) => <b>{c}</b>;
  const prefs = await loadPrefs(supabase, current.id);
  const ready = Boolean(process.env.RESEND_API_KEY && process.env.SALES_FROM_EMAIL);
  const from = process.env.SALES_FROM_EMAIL ?? "invoices@yourdomain.com";
  const accent = pdfOf(prefs.pdf_settings).accent === "#2f3437" ? "#0f766e" : pdfOf(prefs.pdf_settings).accent;
  const doc = { kind: "invoice", number: "INV-000123", total: 683.06, amount_paid: 0, written_off: 0, due_date: today(), expiry_date: null } as unknown as SalesDoc;
  // Paso 6.2d: la muestra en el idioma de quien la ve (al cliente le llega en SU idioma)
  const lang = (await getLocale()) === "es" ? "es" : "en";
  const mail = { kind: "invoice" as const, number: "INV-000123", customer: "Rob & Joe Traders", amount: "$683.06", due: null, actor: user.fullName || current.name, company: current.name, whiteLabel: prefs.white_label };
  const html = emailHtml({
    body: docEmailBody(lang, mail).replace(/ (?:is due on|vence el) \./, lang === "es" ? " está lista." : " is ready."),
    link: "#", pixel: "", doc, companyName: current.name, logoUrl: prefs.logo_url, accent, whiteLabel: prefs.white_label, lang,
  });
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f6f8f9] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-[1100px]">
        <Link prefetch={false} href="/dashboard/settings" className="text-[13px] font-medium text-[#0f766e] hover:underline">← {t("all")}</Link>
        <h1 className="mb-1 mt-1 text-2xl font-semibold text-[#0b1f3a]">{t("title")}</h1>
        <p className="mb-6 text-[15px] text-slate-500">{t("subtitle")}</p>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-4">
            <div className={`rounded-2xl border p-5 ${ready ? "border-[#bfe7de] bg-[#f3fbf8]" : "border-[#fde2c7] bg-[#fff7ef]"}`}>
              <p className={`text-[13px] font-semibold uppercase tracking-wide ${ready ? "text-[#0f766e]" : "text-[#c2410c]"}`}>● {ready ? t("on") : t("off")}</p>
              <p className="mt-1 text-[15px] text-slate-700">{ready
                ? t.rich("onText", { from: `${current.name} <${from}>`, reply: prefs.org_info?.email || user.email, b })
                : t("offText")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-[15px] text-slate-700">
              <p className="mb-2 font-semibold text-[#0b1f3a]">{t("gets")}</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>{t("g1")}</li>
                <li>{t("g2")}</li>
                <li>{t.rich("g3", { b })}</li>
                <li>{t("g4")}</li>
              </ul>
              <p className="mt-3 text-[13px] text-slate-500">{t("replyTo")} <Link prefetch={false} href="/dashboard/settings/branding" className="font-medium text-[#2563eb] hover:underline">{t("replyLink")}</Link>.</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("inbox")}</p>
              <p className="mt-1 truncate text-[14px]"><b className="text-[#0b1f3a]">{current.name}</b> <span className="text-slate-500">&lt;{from}&gt;</span></p>
              <p className="truncate text-[14px] text-slate-700">{docEmailSubject(lang, mail)}</p>
            </div>
            <iframe title={t("inbox")} srcDoc={html} className="h-[620px] w-full border-0" sandbox="" />
          </div>
        </div>
      </div>
    </div>
  );
}
