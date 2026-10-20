import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";

// Arma la descarga (CSV o Excel con contraseña opcional) para cualquier módulo
export const passwordOk = (p: string) => p.length >= 12 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p);

export function checkExportBody(format: string, password: string) {
  if (!password) return null;
  if (format !== "xlsx") return "A password can only be used with Excel (.xlsx).";
  if (!passwordOk(password)) return "Password must be 12+ chars with upper, lower, number and symbol.";
  return null;
}

export async function exportResponse(matrix: unknown[][], base: string, format: "csv" | "xlsx", password: string, sheetName: string) {
  if (format === "csv") {
    return new NextResponse(toCsv(matrix), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"`, "Cache-Control": "no-store" },
    });
  }
  const XlsxPopulate = (await import("xlsx-populate")).default;
  const wb = await XlsxPopulate.fromBlankAsync();
  const sheet = wb.sheet(0).name(sheetName);
  matrix.forEach((line, r) => line.forEach((val, c) => {
    sheet.cell(r + 1, c + 1).value(val == null ? "" : typeof val === "number" ? val : String(val));
  }));
  sheet.row(1).style({ bold: true });
  sheet.freezePanes(0, 1);
  const out = (await wb.outputAsync(password ? { password } : undefined)) as Buffer;
  return new NextResponse(new Uint8Array(out), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${base}.xlsx"`, "Cache-Control": "no-store",
    },
  });
}

export const fileBase = (module: string, company: string) =>
  `${module}-${company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "company"}-${new Date().toISOString().slice(0, 10)}`;
