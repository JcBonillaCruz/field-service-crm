import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Item, canManageCatalog, usd } from "@/lib/catalog";
import NoAccess from "@/components/customers/NoAccess";
import ListHeader, { EmptyList } from "@/components/catalog/ListHeader";

export default async function ItemsPage() {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageCatalog(current.role)) return <NoAccess />;
  const { data } = await supabase.from("items").select("*").eq("company_id", current.id).order("name");
  const items = (data ?? []) as Item[];

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-white">
      <ListHeader title="All Items" newHref="/dashboard/items/new" newLabel="New" count={items.length} />
      {items.length === 0 ? (
        <EmptyList title="Add your first item" text="Save the products and services you sell, like a tune-up, a capacitor or an hour of labor, so quotes and invoices fill in by themselves." href="/dashboard/items/new" label="New Item" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-[#fafbfc] text-left text-xs font-semibold text-slate-500">
                <th className="px-5 py-3 sm:pl-8">Name</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Unit</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right sm:pr-8">Rate</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                  <td className="px-5 py-3 sm:pl-8">
                    <Link href={`/dashboard/items/${it.id}/edit`} className="flex items-center gap-3 font-medium text-[#0f766e] hover:underline">
                      {it.image_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={it.image_url} alt="" className="h-9 w-9 shrink-0 rounded-md border border-slate-200 object-cover" />
                        : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold uppercase text-slate-400">{it.name.slice(0, 2)}</span>}
                      {it.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{it.sku || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{it.item_type === "goods" ? "Goods" : "Service"}</td>
                  <td className="px-4 py-3 text-slate-600">{it.unit || "—"}</td>
                  <td className="max-w-[320px] truncate px-4 py-3 text-slate-500">{it.description || "—"}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-[#0b1f3a] sm:pr-8">{usd(it.selling_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
