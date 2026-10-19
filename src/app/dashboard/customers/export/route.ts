import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { canExportCustomers, phoneDisplay } from "@/lib/customers";
import { customerListQuery, readListParams } from "@/lib/customer-list";
import { exportHeaders } from "@/lib/customer-import";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  customer_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  salutation: string | null;
  notes: string | null;
  created_at: string;
  customer_phones: { label: string; country: string; dial_code: string; number: string; position: number }[];
  customer_emails: { label: string; email: string; position: number }[];
  customer_addresses: { label: string | null; street: string; unit: string | null; city: string; state: string | null; zip: string | null; country: string; is_primary: boolean; created_at: string }[];
};

const SELECT =
  "customer_type, salutation, first_name, last_name, company_name, notes, created_at, " +
  "customer_phones ( label, country, dial_code, number, position ), " +
  "customer_emails ( label, email, position ), " +
  "customer_addresses ( label, street, unit, city, state, zip, country, is_primary, created_at )";

type Body = {
  scope?: "all" | "view";
  q?: string; view?: string; sort?: string; dir?: string;
  period?: { from?: string; to?: string };
  format?: "csv" | "xlsx";
  password?: string;
};

function passwordOk(p: string) {
  return p.length >= 12 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p);
}

export async function POST(request: NextRequest) {
  const { supabase, current } = await getSession();
  if (!current || !canExportCustomers(current.role)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  let body: Body = {};
  try { body = await request.json(); } catch { /* defaults */ }

  const format = body.format === "xlsx" ? "xlsx" : "csv";
  const password = (body.password ?? "").trim();
  if (password) {
    if (format !== "xlsx") return NextResponse.json({ error: "A password can only be used with Excel (.xlsx)." }, { status: 400 });
    if (!passwordOk(password)) return NextResponse.json({ error: "Password must be 12+ chars with upper, lower, number and symbol." }, { status: 400 });
  }

  const params = body.scope === "view" ? readListParams({ q: body.q, view: body.view, sort: body.sort, dir: body.dir }) : readListParams({});

  // Traer todos los clientes (por páginas), con filtro de periodo opcional
  const rows: Row[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    let query = customerListQuery(supabase, current.id, params, SELECT);
    if (body.period?.from) query = query.gte("created_at", body.period.from);
    if (body.period?.to) query = query.lte("created_at", body.period.to + "T23:59:59");
    const { data, error } = await query.range(from, from + 999);
    if (error) return NextResponse.json({ error: "Export failed" }, { status: 500 });
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }

  const maxP = Math.max(1, ...rows.map((r) => r.customer_phones.length));
  const maxE = Math.max(1, ...rows.map((r) => r.customer_emails.length));
  const maxA = Math.max(1, ...rows.map((r) => r.customer_addresses.length));

  const header = exportHeaders(maxP, maxE, maxA);
  header.splice(1, 0, "Salutation"); // tras "Customer Type"

  const matrix: unknown[][] = [header];
  for (const r of rows) {
    const phones = [...r.customer_phones].sort((a, b) => a.position - b.position);
    const emails = [...r.customer_emails].sort((a, b) => a.position - b.position);
    const addrs = [...r.customer_addresses].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.created_at.localeCompare(b.created_at));
    const line: unknown[] = [
      r.customer_type === "commercial" ? "Commercial" : "Residential",
      r.salutation ?? "",
      r.first_name ?? "", r.last_name ?? "", r.company_name ?? "",
    ];
    for (let i = 0; i < maxP; i++) line.push(phones[i]?.label ?? "", phones[i] ? phoneDisplay(phones[i]) : "");
    for (let i = 0; i < maxE; i++) line.push(emails[i]?.label ?? "", emails[i]?.email ?? "");
    for (let i = 0; i < maxA; i++) {
      const a = addrs[i];
      line.push(a?.label ?? "", a?.street ?? "", a?.unit ?? "", a?.city ?? "", a?.state ?? "", a?.zip ?? "", a?.country ?? "");
    }
    line.push(r.notes ?? "");
    matrix.push(line);
  }

  const slug = current.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "company";
  const date = new Date().toISOString().slice(0, 10);
  const base = `customers-${slug}-${date}`;

  if (format === "csv") {
    return new NextResponse(toCsv(matrix), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Excel (.xlsx), con contraseña opcional
  const XlsxPopulate = (await import("xlsx-populate")).default;
  const wb = await XlsxPopulate.fromBlankAsync();
  const sheet = wb.sheet(0).name("Customers");
  matrix.forEach((line, r) => {
    line.forEach((val, c) => { sheet.cell(r + 1, c + 1).value(val == null ? "" : String(val)); });
  });
  sheet.row(1).style({ bold: true });
  sheet.freezePanes(0, 1);
  const out = (await wb.outputAsync(password ? { password } : undefined)) as Buffer;

  return new NextResponse(new Uint8Array(out), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${base}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
