import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Coupon, REDEMPTION_OPTIONS, canManageCatalog, couponStatus, discountLabel } from "@/lib/catalog";
import NoAccess from "@/components/customers/NoAccess";
import ListHeader, { EmptyList } from "@/components/catalog/ListHeader";

const TONES = { active: "bg-emerald-50 text-emerald-700", expired: "bg-slate-100 text-slate-500", used: "bg-amber-50 text-amber-700", inactive: "bg-slate-100 text-slate-500" };

export default async function CouponsPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCatalog(current.role)) return <NoAccess />;
  const { data } = await supabase.from("coupons").select("*, catalog_products ( name )").eq("company_id", current.id).order("created_at", { ascending: false });
  const coupons = (data ?? []) as (Coupon & { catalog_products: { name: string } | null })[];

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-white">
      <ListHeader title="All Coupons" newHref="/dashboard/coupons/new" newLabel="New" count={coupons.length} />
      {coupons.length === 0 ? (
        <EmptyList title="Create your first coupon" text="Give customers a discount code, like $25 off a tune-up or 10% off a maintenance plan." href="/dashboard/coupons/new" label="New Coupon" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-[#fafbfc] text-left text-xs font-semibold text-slate-500">
                <th className="px-5 py-3 sm:pl-8">Coupon Name</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Discount</th><th className="px-4 py-3">Redemption</th><th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Used</th><th className="px-4 py-3 sm:pr-8">Status</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => {
                const s = couponStatus(c);
                const red = REDEMPTION_OPTIONS.find((r) => r.value === c.redemption_type)?.label ?? "";
                return (
                  <tr key={c.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                    <td className="px-5 py-3 sm:pl-8"><Link href={`/dashboard/coupons/${c.id}/edit`} className="font-medium text-[#0f766e] hover:underline">{c.name}</Link></td>
                    <td className="px-4 py-3"><span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">{c.code}</span></td>
                    <td className="px-4 py-3 text-slate-600">{c.catalog_products?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-medium tabular-nums text-[#0b1f3a]">{discountLabel(c)}</td>
                    <td className="px-4 py-3 text-slate-600">{red}{c.redemption_type === "limited_cycles" && c.cycles ? ` (${c.cycles})` : ""}</td>
                    <td className="px-4 py-3 text-slate-600">{c.expires_on ? new Date(`${c.expires_on}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Never"}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{c.redemptions}{c.max_redemptions ? ` / ${c.max_redemptions}` : ""}</td>
                    <td className="px-4 py-3 sm:pr-8"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[s.tone]}`}>{s.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
