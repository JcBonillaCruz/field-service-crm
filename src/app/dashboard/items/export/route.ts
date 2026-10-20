import type { NextRequest } from "next/server";
import { catalogExport } from "@/lib/catalog-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return catalogExport(request, "items");
}
