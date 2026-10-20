"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CouponRow, FIELD_LABELS, HistoryRow, REDEMPTION_OPTIONS, couponStatus, discountLabel, fmtDate } from "@/lib/catalog";
import { CloseButton, HistoryTable, ICONS, MoreMenu, PencilButton, Tabs } from "@/components/catalog/DetailBits";
import { Tip } from "@/components/catalog/FormBits";

const TABS = ["Coupon Details", "Transactions", "Activity Logs"];
const RIBBON = {
  active: { bg: "bg-[#16a34a]", fold: "border-t-[#0f6b31]" },
  inactive: { bg: "bg-slate-500", fold: "border-t-slate-700" },
  expired: { bg: "bg-[#e11d48]", fold: "border-t-[#9f1239]" },
  used: { bg: "bg-[#d97706]", fold: "border-t-[#92400e]" },
};

export default function CouponDetailView({ coupon, history }: { coupon: CouponRow; history: HistoryRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState(TABS[0]);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const s = couponStatus(coupon);
  const rib = RIBBON[s.tone];
  const redemption = REDEMPTION_OPTIONS.find((r) => r.value === coupon.redemption_type)?.label.replace("-", " ") ?? "";

  async function toggleActive() {
    setBusy(true);
    const { error } = await createClient().from("coupons").update({ is_active: !coupon.is_active }).eq("id", coupon.id);
    setBusy(false);
    if (error) return setMsg("The status couldn't be changed.");
    router.refresh();
  }
  async function remove() {
    if (!window.confirm(`Delete the coupon "${coupon.code}"? This can't be undone.`)) return;
    const { error } = await createClient().from("coupons").delete().eq("id", coupon.id);
    if (error) return setMsg("The coupon couldn't be deleted.");
    router.push("/dashboard/coupons");
    router.refresh();
  }
  async function copy() {
    try { await navigator.clipboard.writeText(coupon.code); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* sin permiso */ }
  }

  return (
    <div className="flex min-h-full flex-col bg-[#f7f9fa]">
      <div className="flex items-center justify-between gap-3 bg-white px-5 pt-4 pb-3 sm:px-7">
        <h1 className="truncate text-[22px] font-semibold tracking-tight text-[#0b1f3a]">{coupon.name}</h1>
        <CloseButton href="/dashboard/coupons" red />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-y border-slate-200 bg-white px-5 py-2 sm:px-7">
        <PencilButton href={`/dashboard/coupons/${coupon.id}/edit`} label="Edit" withText />
        <button type="button" disabled={busy} onClick={toggleActive}
          className="group/act flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#14a39a] hover:bg-[#e9f7f4] hover:text-[#0f766e] hover:shadow-md disabled:opacity-60">
          <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-300 group-hover/act:rotate-90" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d={coupon.is_active ? ICONS.off : ICONS.on} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {coupon.is_active ? "Mark as Inactive" : "Mark as Active"}
        </button>
        <MoreMenu dots label="More actions" actions={[
          { label: "Clone", href: `/dashboard/coupons/new?clone=${coupon.id}`, icon: ICONS.clone },
          { label: "Delete", onClick: remove, danger: true, icon: ICONS.trash },
        ]} />
      </div>
      {msg && <p role="alert" className="mx-5 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-7">{msg}</p>}

      <div className="space-y-4 p-4 sm:p-6">
        {/* Tarjeta del cupón con su cintita de estado */}
        <div className="relative rounded-xl border border-slate-200 bg-white px-5 pb-5 pt-9 shadow-[0_1px_2px_rgba(15,40,60,0.04)] sm:px-6">
          <span key={s.tone} className={`absolute -left-1.5 top-3 rounded-r-md rounded-tl-sm px-3 py-1 text-xs font-semibold text-white shadow-sm animate-[bp-fade_0.35s_ease-out] ${rib.bg}`}>
            {s.label}
            <span className={`absolute left-0 top-full h-0 w-0 border-l-[6px] border-t-[6px] border-l-transparent ${rib.fold}`} />
          </span>
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="flex h-16 min-w-[5.5rem] shrink-0 flex-col items-center justify-center rounded-lg border border-slate-200 bg-[#fafbfc] px-3">
                <span className="text-xl font-semibold leading-none text-[#0b1f3a]">{discountLabel(coupon)}</span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Discount</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-[#0b1f3a]">{coupon.name}</p>
                <p className="text-sm text-slate-500">Redemption Type: <span className="font-medium text-[#0b1f3a]">{redemption}{coupon.cycles ? ` (${coupon.cycles} cycles)` : ""}</span></p>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-between gap-4">
              <div className="border-l-2 border-[#e8713a] pl-4">
                <p className="text-sm text-slate-500">Expiration Date</p>
                <p className="text-lg font-semibold text-[#0b1f3a]">{coupon.expires_on ? fmtDate(coupon.expires_on) : "Never expires"}</p>
              </div>
              <button type="button" onClick={copy} title="Copy code"
                className="group/code shrink-0 rounded-lg border border-dashed border-[#16a34a]/60 bg-[#f3fbf6] px-4 py-2 text-left transition-all hover:-translate-y-0.5 hover:border-[#16a34a] hover:shadow-md">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#16a34a]">Code :</span>
                <span className="flex items-center gap-2 font-mono text-[15px] font-semibold text-[#0b1f3a]">
                  {coupon.code}
                  {copied ? (
                    <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#16a34a]" fill="currentColor" aria-hidden="true"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>
                  ) : (
                    <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#16a34a] transition-transform group-hover/code:scale-110" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d={ICONS.clone} strokeLinecap="round" strokeLinejoin="round" /></svg>
                  )}
                </span>
                <span className={`block text-[11px] text-[#16a34a] transition-opacity ${copied ? "opacity-100" : "opacity-0"}`}>Copied!</span>
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          <Tabs tabs={TABS} active={tab} onChange={setTab} />
          {tab === "Coupon Details" && (
            <dl className="grid gap-x-10 gap-y-1 px-5 py-5 text-[15px] sm:px-7 lg:grid-cols-2">
              <Row label="Coupon Name">{coupon.name}</Row>
              <Row label="Coupon Code">{coupon.code}</Row>
              <Row label="Redemption Type">{redemption}</Row>
              <Row label="Maximum Redemptions" tip="How many times this code can be used in total.">{coupon.max_redemptions ?? "Unlimited"}</Row>
              <Row label="Product Name">
                <Link href={`/dashboard/coupons?q=${encodeURIComponent(coupon.catalog_products?.name ?? "")}`} className="text-[#2563eb] hover:underline">{coupon.catalog_products?.name ?? "—"}</Link>
              </Row>
              <Row label="Times Used">{coupon.redemptions}{coupon.max_redemptions ? ` of ${coupon.max_redemptions}` : ""}</Row>
              <Row label="Discount">{discountLabel(coupon)} ({coupon.discount_type === "percent" ? "Percentage" : "Flat"})</Row>
              <Row label="Created On">{fmtDate(coupon.created_at)}</Row>
            </dl>
          )}
          {tab === "Transactions" && (
            <div className="px-5 py-14 text-center text-slate-500 sm:px-7">
              This coupon hasn&apos;t been used yet.
              <span className="mt-1 block text-xs text-slate-400">Every quote, invoice or subscription that uses this code will show up here.</span>
            </div>
          )}
          {tab === "Activity Logs" && (
            <div className="py-2">
              <HistoryTable fallbackCreated={coupon.created_at}
                rows={history.map((h) => ({ ...h, changes: (h.changes ?? []).map((c) => FIELD_LABELS[c] ?? c) }))} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, tip, children }: { label: string; tip?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-4 py-1.5">
      <dt className="text-slate-500">
        {tip ? <Tip text={tip}><span className="cursor-help border-b border-dotted border-slate-400">{label}</span></Tip> : label}
      </dt>
      <dd className="min-w-0 text-[#0b1f3a]">{children}</dd>
    </div>
  );
}
