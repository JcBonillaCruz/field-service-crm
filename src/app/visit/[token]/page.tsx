import { admin } from "@/lib/push";
import { addressText, brandOf } from "@/lib/jobs-notify";
import { customerContact } from "@/lib/customer-notices";
import { arrivalText, dayText } from "@/lib/customer-notice-text";
import { linkState, visitByToken } from "@/lib/visit-link";
import VisitRespond from "@/components/jobs/VisitRespond";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your appointment", robots: { index: false, follow: false } };

// Paso 5.8 · Enlace del recordatorio: el cliente confirma su cita o pide otro horario (no necesita cuenta).
// Abrir el enlace NO confirma nada: siempre hay que tocar un botón (los filtros de correo abren los enlaces solos).
export default async function VisitPage({ params, searchParams }: { params: { token: string }; searchParams?: { a?: string } }) {
  const db = admin();
  const v = db ? await visitByToken(db, params.token) : null;
  if (!db || !v) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f6f8] px-6 text-center">
        <div><p className="text-xl font-semibold text-[#0b1f3a]">This link isn&apos;t available</p><p className="mt-2 text-slate-500">Please contact the business that sent it.</p>
          <p className="mt-4 text-sm text-slate-400">Este enlace no está disponible. Comuníquese con el negocio que se lo envió.</p></div>
      </main>
    );
  }
  const [brand, contact, { data: prefs }, { data: plan }] = await Promise.all([
    brandOf(db, v.company_id), customerContact(db, v.jobs),
    db.from("sales_prefs").select("org_info").eq("company_id", v.company_id).maybeSingle(),
    db.from("company_plans").select("white_label").eq("company_id", v.company_id).maybeSingle(),
  ]);
  const lang = contact.lang;
  return (
    <VisitRespond
      token={params.token} lang={lang} state={linkState(v)} reply={v.customer_reply} startChange={searchParams?.a === "change"}
      company={brand.companyName} logoUrl={brand.logoUrl} phone={((prefs?.org_info as { phone?: string } | null)?.phone ?? "").trim() || null}
      customer={contact.first} day={v.starts_at ? dayText(v.starts_at, brand.timezone, lang) : ""} arrival={arrivalText(v, brand.timezone, lang)}
      service={v.jobs.title} address={addressText(v.jobs.site_address)} number={v.jobs.number}
      whiteLabel={Boolean((plan as { white_label?: boolean } | null)?.white_label)}
    />
  );
}
