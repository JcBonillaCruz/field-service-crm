import type { NextRequest } from "next/server";
import { salesExport } from "@/lib/sales-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return salesExport(request, "invoices");
}
