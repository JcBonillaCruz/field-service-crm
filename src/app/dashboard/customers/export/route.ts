import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { canExportCustomers, phoneDisplay } from "@/lib/customers";
import { customerListQuery, readListParams } from "@/lib/customer-list";
import { exportHeaders } from "@/lib/customer-import";
import { toCsv } from "@/lib/csv";

type Row = {
  customer_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  notes: string | null;
  customer_phones: { label: string; country: string; dial_code: string; number: string; position: number }[];
  customer_emails: { label: string; email: string; position: number }[];
  customer_addresses: { label: string | null; street: string; unit: string | null; city: string; state: string | null; zip: string | null; country: string; is_primary: boolean; created_at: string }[];
};

const SELECT =
  "customer_type, first_name, last_name, company_name, notes, " +
  "customer_phones ( label, country, dial_code, number, position ), " +
  "customer_emails ( label, email, position ), " +
  "customer_addresses ( label, street, unit, city, state, zip, country, is_primary, created_at )";

export async function GET(request: NextRequest) {
  const { supabase, current } = await getSession();
  if (!current || !canExportCustomers(current.role)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const scope = sp.scope === "view" ? "view" : "all";
  const params = scope === "view" ? readListParams(sp) : readListParams({});

  // Supabase entrega máximo 1,000 por consulta: pedimos por páginas
  const rows: Row[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await customerListQuery(supabase, current.id, params, SELECT).range(from, from + 999);
    if (error) return NextResponse.json({ error: "Export failed" }, { status: 500 });
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }

  const maxP = Math.max(1, ...rows.map((r) => r.customer_phones.length));
  const maxE = Math.max(1, ...rows.map((r) => r.customer_emails.length));
  const maxA = Math.max(1, ...rows.map((r) => r.customer_addresses.length));

  const lines: unknown[][] = [exportHeaders(maxP, maxE, maxA)];
  for (const r of rows) {
    const phones = [...r.customer_phones].sort((a, b) => a.position - b.position);
    const emails = [...r.customer_emails].sort((a, b) => a.position - b.position);
    const addrs = [...r.customer_addresses].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.created_at.localeCompare(b.created_at));
    const line: unknown[] = [
      r.customer_type === "commercial" ? "Commercial" : "Residential",
      r.first_name ?? "", r.last_name ?? "", r.company_name ?? "",
    ];
    for (let i = 0; i < maxP; i++) line.push(phones[i]?.label ?? "", phones[i] ? phoneDisplay(phones[i]) : "");
    for (let i = 0; i < maxE; i++) line.push(emails[i]?.label ?? "", emails[i]?.email ?? "");
    for (let i = 0; i < maxA; i++) {
      const a = addrs[i];
      line.push(a?.label ?? "", a?.street ?? "", a?.unit ?? "", a?.city ?? "", a?.state ?? "", a?.zip ?? "", a?.country ?? "");
    }
    line.push(r.notes ?? "");
    lines.push(line);
  }

  const slug = current.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "company";
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(lines), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="customers-${slug}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
