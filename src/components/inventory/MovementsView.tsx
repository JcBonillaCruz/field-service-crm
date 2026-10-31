"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import SelectMenu from "@/components/ui/SelectMenu";
import { InvLocation, MOVE_LABEL, MoveKind, qtyFmt, usd } from "@/lib/inventory";
import type { MoveRow } from "@/lib/inventory-server";
import { PageHead, card, fmtWhen, pageWrap } from "@/components/inventory/PageBits";
import { toCsv } from "@/lib/csv";

const KINDS: { value: string; label: string }[] = [{ value: "all", label: "All movements" }, ...(Object.keys(MOVE_LABEL) as MoveKind[]).map((k) => ({ value: k, label: MOVE_LABEL[k] }))];
const DAYS = [{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }, { value: "365", label: "Last 12 months" }];

// Todo lo que entró, salió, se movió o se contó — firmado, no se puede borrar
export default function MovementsView({ locations, moves, days, initialLocation }: { locations: InvLocation[]; moves: MoveRow[]; days: number; initialLocation: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [kind, setKind] = useState("all");
  const [loc, setLoc] = useState(locations.some((l) => l.id === initialLocation) ? initialLocation : "all");
  const [person, setPerson] = useState("all");
  const [q, setQ] = useState("");
  const name = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "—";
  const people = useMemo(() => Array.from(new Set(moves.flatMap((m) => [m.actor_name, m.responsible_name]).filter(Boolean) as string[])).sort(), [moves]);
  const shown = useMemo(() => moves.filter((m) => (kind === "all" || m.kind === kind)
    && (loc === "all" || m.from_location === loc || m.to_location === loc)
    && (person === "all" || m.actor_name === person || m.responsible_name === person)
    && (!q.trim() || `${m.items?.name} ${m.items?.sku} ${m.reason} ${m.note}`.toLowerCase().includes(q.trim().toLowerCase()))), [moves, kind, loc, person, q]);
  const where = (m: MoveRow) => m.kind === "transfer" || m.kind === "return" ? `${name(m.from_location)} → ${name(m.to_location)}` : name(m.to_location ?? m.from_location);
  const sign = (m: MoveRow) => m.kind === "transfer" || m.kind === "return" ? "" : m.kind === "count" && m.qty === 0 ? "±" : m.to_location ? "+" : "−";

  function exportCsv() {
    const rows = [["Date", "Type", "Item", "SKU", "Qty", "From", "To", "Reason", "Expected", "Counted", "Unit cost", "Value", "By", "Responsible", "Note"],
      ...shown.map((m) => [m.created_at, MOVE_LABEL[m.kind as MoveKind] ?? m.kind, m.items?.name ?? "", m.items?.sku ?? "", `${sign(m)}${m.qty}`,
        m.from_location ? name(m.from_location) : "", m.to_location ? name(m.to_location) : "", m.reason ?? "", m.expected_qty ?? "", m.counted_qty ?? "",
        m.unit_cost ?? "", m.unit_cost != null ? Math.round(m.qty * m.unit_cost * 100) / 100 : "", m.actor_name ?? "", m.responsible_name ?? "", m.note ?? ""])];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv" }));
    a.download = `inventory-movements-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  return (
    <div className={pageWrap}>
      <PageHead title="Movements" subtitle="Every unit that came in, went out, moved or was counted — signed by who did it.">
        <button type="button" onClick={exportCsv} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-[14px] font-medium text-slate-700 transition-colors hover:border-[#14a39a] hover:text-[#0f766e]">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" /></svg> Export
        </button>
      </PageHead>
      <div className="mt-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item, reason, note" className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-[15px] focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15 xl:col-span-1" />
        <SelectMenu ariaLabel="Period" value={String(days)} onChange={(v) => router.replace(`${pathname}?days=${v}`, { scroll: false })} options={DAYS} />
        <SelectMenu ariaLabel="Type" value={kind} onChange={setKind} options={KINDS} />
        <SelectMenu ariaLabel="Location" value={loc} onChange={setLoc} options={[{ value: "all", label: "All locations" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]} />
        <SelectMenu ariaLabel="Person" value={person} onChange={setPerson} options={[{ value: "all", label: "Everyone" }, ...people.map((p) => ({ value: p, label: p }))]} />
      </div>
      <p className="mt-3 text-[13px] text-slate-500">{shown.length} movement{shown.length === 1 ? "" : "s"}</p>
      {shown.length === 0 ? <p className={`${card} mt-3 px-4 py-12 text-center text-sm text-slate-500`}>No movements for these filters.</p> : (
        <div className={`${card} mt-3 overflow-hidden`}>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[980px] text-left text-[14px]">
              <thead><tr className="border-b border-slate-200 bg-[#fafbfc] text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Date</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Item</th><th className="px-3 py-3 text-right">Qty</th>
                <th className="px-3 py-3">Location</th><th className="px-3 py-3">Reason</th><th className="px-3 py-3">By</th><th className="px-4 py-3 text-right">Value</th>
              </tr></thead>
              <tbody>
                {shown.slice(0, 1500).map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-[#f6fbfa]">
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{fmtWhen(m.created_at)}</td>
                    <td className="px-3 py-2.5"><KindPill k={m.kind} /></td>
                    <td className="px-3 py-2.5"><p className="truncate font-medium text-[#0b1f3a]">{m.items?.name}</p><p className="truncate font-mono text-[11.5px] text-slate-400">{m.items?.sku}</p></td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{sign(m)}{qtyFmt(m.qty)}</td>
                    <td className="px-3 py-2.5 text-slate-600">{where(m)}</td>
                    <td className="px-3 py-2.5 text-slate-600">{m.kind === "count" ? `${m.reason ?? ""} (${qtyFmt(Number(m.expected_qty ?? 0))} → ${qtyFmt(Number(m.counted_qty ?? 0))})` : m.reason}{m.note ? <span className="block text-[12px] italic text-slate-400">{m.note}</span> : null}</td>
                    <td className="px-3 py-2.5 text-slate-600">{m.actor_name}{m.responsible_name && m.responsible_name !== m.actor_name ? <span className="block text-[12px] text-slate-400">for {m.responsible_name}</span> : null}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{m.unit_cost != null ? usd(m.qty * m.unit_cost) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-slate-100 lg:hidden">
            {shown.slice(0, 500).map((m) => (
              <li key={m.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2"><KindPill k={m.kind} /><span className="text-[12px] text-slate-400">{fmtWhen(m.created_at)}</span></div>
                <p className="mt-1.5 truncate text-[15px] font-medium text-[#0b1f3a]"><span className="tabular-nums">{sign(m)}{qtyFmt(m.qty)}</span> · {m.items?.name}</p>
                <p className="truncate text-[13px] text-slate-500">{[where(m), m.reason, m.actor_name].filter(Boolean).join(" · ")}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function KindPill({ k }: { k: string }) {
  const tone: Record<string, string> = {
    receive: "bg-[#e7f6f1] text-[#0f766e]", transfer: "bg-[#eef6ff] text-[#2563eb]", use: "bg-[#fff4ec] text-[#ea580c]",
    return: "bg-[#f1ebff] text-[#7c3aed]", adjust: "bg-slate-100 text-slate-600", count: "bg-[#fff7e6] text-[#b45309]",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${tone[k] ?? tone.adjust}`}>{MOVE_LABEL[k as MoveKind] ?? k}</span>;
}
