import { redirect } from "next/navigation";

// Paso 6.12: ahora vive dentro de History (pestaña "transfers")
export default function Page({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const q = new URLSearchParams({ tab: "transfers" });
  Object.entries(searchParams).forEach(([k, v]) => { if (v && k !== "tab") q.set(k, v); });
  redirect(`/dashboard/inventory/history?${q.toString()}`);
}
