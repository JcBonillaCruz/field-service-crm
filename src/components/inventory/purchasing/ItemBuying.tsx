"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { bustCache } from "@/lib/cache-client";
import SearchSelect from "@/components/ui/SearchSelect";
import { Modal, btnGhost, btnPrimary } from "@/components/sales/SalesBits";
import { inputClass } from "@/components/customers/ui";
import { QuickSupplier } from "@/components/inventory/purchasing/PoForm";
import { useInvTx } from "@/i18n/useInvTx";
import { useFmt } from "@/components/inventory/PageBits";
import { InvItem } from "@/lib/inventory";
import { ItemSupplier, Supplier, poErrKey } from "@/lib/purchasing";

// =====================================================================
// Paso 6.14 · En la ficha del producto: proveedores (su código y precio), consumible y descontinuado
// =====================================================================
type Extra = { is_consumable: boolean; discontinued_at: string | null; discontinued_reason: string | null; replacement_item_id: string | null };

export default function ItemBuying({ companyId, item, unitsPer = 1, buyUnit }: { companyId: string; item: InvItem; unitsPer?: number; buyUnit?: string | null }) {
  const t = useTranslations("itemBuy");
  const tp = useTranslations("purch");
  const ix = useInvTx();
  const { fmtDay } = useFmt();
  const router = useRouter();
  const [ready, setReady] = useState<"loading" | "ok" | "sql">("loading");
  const [extra, setExtra] = useState<Extra>({ is_consumable: false, discontinued_at: null, discontinued_reason: null, replacement_item_id: null });
  const [links, setLinks] = useState<ItemSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [others, setOthers] = useState<{ id: string; name: string }[]>([]);
  const [edit, setEdit] = useState<ItemSupplier | "new" | null>(null);
  const [disc, setDisc] = useState(false);
  const [err, setErr] = useState("");
  const [repName, setRepName] = useState("");

  const load = useCallback(async () => {
    const sb = createClient();
    const [ex, ln, sp] = await Promise.all([
      sb.from("items").select("is_consumable, discontinued_at, discontinued_reason, replacement_item_id").eq("id", item.id).maybeSingle(),
      sb.from("item_suppliers").select("id, item_id, supplier_id, supplier_sku, cost, is_preferred").eq("item_id", item.id),
      sb.from("inventory_suppliers").select("id, name, contact_name, phone, email, website, account_no, address, payment_terms, lead_days, notes, is_active").eq("company_id", companyId).order("name"),
    ]);
    if (ex.error || ln.error) return setReady("sql");
    setExtra(ex.data as Extra);
    const rid = (ex.data as Extra | null)?.replacement_item_id;
    if (rid) sb.from("items").select("name").eq("id", rid).maybeSingle().then(({ data }) => setRepName((data?.name as string) ?? ""));
    setLinks(((ln.data ?? []) as ItemSupplier[]).map((l) => ({ ...l, cost: l.cost == null ? null : Number(l.cost) })).sort((a, b) => Number(b.is_preferred) - Number(a.is_preferred)));
    setSuppliers((sp.data ?? []) as Supplier[]);
    setReady("ok");
  }, [companyId, item.id]);
  useEffect(() => { load(); }, [load]);

  async function toggleConsumable() {
    const v = !extra.is_consumable;
    setExtra((x) => ({ ...x, is_consumable: v }));
    const { error } = await createClient().from("items").update({ is_consumable: v }).eq("id", item.id);
    if (error) { setExtra((x) => ({ ...x, is_consumable: !v })); setErr(tp(poErrKey(error) as never)); }
  }
  async function reactivate() {
    const { error } = await createClient().rpc("inv_discontinue", { p_item: item.id, p_on: false });
    if (error) return setErr(tp(poErrKey(error) as never));
    await bustCache("catalog"); load(); router.refresh();
  }
  async function openDisc() {
    if (!others.length) {
      const { data } = await createClient().from("items").select("id, name").eq("company_id", companyId).eq("track_inventory", true).eq("is_active", true).neq("id", item.id).order("name").limit(5000);
      setOthers((data ?? []) as { id: string; name: string }[]);
    }
    setDisc(true);
  }
  const supName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "—";
  const replacement = extra.replacement_item_id;

  if (ready === "loading") return <div className="mx-5 mt-4 h-24 animate-pulse rounded-2xl bg-slate-50" />;
  if (ready === "sql") return <p className="mx-5 mt-4 rounded-xl bg-amber-50 px-4 py-3 text-[13.5px] text-amber-800 ring-1 ring-amber-200">{tp("eSql")}</p>;
  return (
    <>
      {extra.discontinued_at && (
        <div className="mx-5 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="rounded-full bg-slate-700 px-2.5 py-0.5 text-[12px] font-semibold text-white">{t("discontinued")}</span>
          <p className="min-w-0 flex-1 text-[13.5px] text-slate-700">
            {t("discSince", { d: fmtDay(extra.discontinued_at) })}{extra.discontinued_reason ? ` · ${extra.discontinued_reason}` : ""}
            {replacement && <> · {t("useInstead")} <Link prefetch={false} href={`/dashboard/inventory/${replacement}`} className="font-semibold text-[#0f766e] hover:underline">{repName || t("replacement")}</Link></>}
          </p>
          <button type="button" onClick={reactivate} className="text-[13.5px] font-semibold text-[#0f766e] hover:underline">{t("reactivate")}</button>
        </div>
      )}

      <section className="mx-5 mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <p className="text-[15px] font-semibold text-[#0b1f3a]">{t("title")}</p>
          <div className="flex items-center gap-3">
            {!extra.discontinued_at && <Link prefetch={false} href={`/dashboard/inventory/purchasing/new?item=${item.id}`} className="text-[13.5px] font-semibold text-[#0f766e] hover:underline">{t("order")}</Link>}
            <button type="button" onClick={() => setEdit("new")} className="group/a inline-flex items-center gap-1 text-[13.5px] font-semibold text-[#0f766e] hover:underline">
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 transition-transform duration-200 group-hover/a:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M10 4.5v11M4.5 10h11" /></svg>{t("addSupplier")}
            </button>
          </div>
        </div>
        {links.length === 0 ? <p className="px-4 py-5 text-[13.5px] text-slate-500">{t("noSuppliers")}</p> : (
          <ul className="divide-y divide-slate-100">
            {links.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => setEdit(l)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#f6fbfa]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium text-[#0b1f3a]">{supName(l.supplier_id)}{l.is_preferred && <span className="ml-2 rounded-full bg-[#e9f7f4] px-2 py-0.5 text-[11px] font-semibold text-[#0f766e]">{t("preferred")}</span>}</span>
                    {l.supplier_sku && <span className="block truncate font-mono text-[12px] text-slate-400">{l.supplier_sku}</span>}
                  </span>
                  <span className="text-right text-[14px] tabular-nums text-slate-700">{l.cost != null ? ix.money(l.cost) : "—"}<span className="block text-[11.5px] text-slate-400">{unitsPer > 1 ? t("perBox", { pu: buyUnit || tp("box"), n: unitsPer }) : t("perUnit")}</span></span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3">
          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
            <input type="checkbox" checked={extra.is_consumable} onChange={toggleConsumable} className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#0f766e]" />
            <span className="min-w-0"><span className="block text-[14px] font-medium text-[#0b1f3a]">{t("consumable")}</span><span className="block text-[12.5px] text-slate-500">{t("consumableHint")}</span></span>
          </label>
          {!extra.discontinued_at && (
            <button type="button" onClick={openDisc} className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-[13.5px] font-medium text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900">{t("discontinue")}</button>
          )}
        </div>
        {err && <p role="alert" className="px-4 pb-3 text-[13px] text-red-600">{err}</p>}
      </section>

      <LinkModal open={edit !== null} link={edit === "new" ? null : edit} companyId={companyId} itemId={item.id} suppliers={suppliers} taken={links.map((l) => l.supplier_id)}
        hasPreferred={links.some((l) => l.is_preferred)} unitHint={unitsPer > 1 ? t("perBox", { pu: buyUnit || tp("box"), n: unitsPer }) : t("perUnit")}
        onSupplier={(s) => setSuppliers((x) => [...x, s].sort((a, b) => a.name.localeCompare(b.name)))}
        onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />
      <DiscModal open={disc} onClose={() => setDisc(false)} item={item} others={others}
        onDone={async () => { setDisc(false); await bustCache("catalog"); load(); router.refresh(); }} />
    </>
  );
}

function LinkModal({ open, link, companyId, itemId, suppliers, taken, hasPreferred, unitHint, onSupplier, onClose, onSaved }: {
  open: boolean; link: ItemSupplier | null; companyId: string; itemId: string; suppliers: Supplier[]; taken: string[]; hasPreferred: boolean; unitHint: string;
  onSupplier: (s: Supplier) => void; onClose: () => void; onSaved: () => void;
}) {
  const t = useTranslations("itemBuy");
  const tp = useTranslations("purch");
  const [sup, setSup] = useState("");
  const [sku, setSku] = useState("");
  const [cost, setCost] = useState("");
  const [pref, setPref] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [quick, setQuick] = useState(false);
  useEffect(() => {
    if (!open) return;
    setSup(link?.supplier_id ?? ""); setSku(link?.supplier_sku ?? ""); setCost(link?.cost != null ? String(link.cost) : ""); setPref(link ? link.is_preferred : !hasPreferred); setErr("");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    if (!sup) return setErr(t("ePick"));
    setBusy(true);
    const sb = createClient();
    if (pref) await sb.from("item_suppliers").update({ is_preferred: false }).eq("item_id", itemId).neq("supplier_id", sup);
    const row = { company_id: companyId, item_id: itemId, supplier_id: sup, supplier_sku: sku.trim() || null, cost: cost ? Number(cost) : null, is_preferred: pref };
    const { error } = link ? await sb.from("item_suppliers").update(row).eq("id", link.id) : await sb.from("item_suppliers").insert(row);
    setBusy(false);
    if (error) return setErr(/duplicate|23505/.test(`${error.code} ${error.message}`) ? t("eTaken") : tp(poErrKey(error) as never));
    onSaved();
  }
  async function remove() {
    if (!link) return;
    setBusy(true);
    const { error } = await createClient().from("item_suppliers").delete().eq("id", link.id);
    setBusy(false);
    if (error) return setErr(tp(poErrKey(error) as never));
    onSaved();
  }
  return (
    <>
      <Modal open={open && !quick} onClose={onClose} title={link ? t("editSupplier") : t("addSupplier")}
        footer={<>
          <button type="button" disabled={busy} onClick={save} className={btnPrimary}>{busy ? t("saving") : t("save")}</button>
          <button type="button" onClick={onClose} className={btnGhost}>{t("cancel")}</button>
          {link && <button type="button" disabled={busy} onClick={remove} className="ml-auto text-sm font-medium text-red-600 hover:underline">{t("remove")}</button>}
          {err && <p role="alert" className="w-full text-sm text-red-600">{err}</p>}
        </>}>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[14px] font-medium text-slate-700">{t("supplier")}</p>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <SearchSelect ariaLabel={t("supplier")} value={sup} onChange={setSup} placeholder={t("pickSupplier")}
                  options={suppliers.filter((s) => s.id === link?.supplier_id || !taken.includes(s.id)).map((s) => ({ value: s.id, label: s.name }))} />
              </div>
              <button type="button" onClick={() => setQuick(true)} className="h-[46px] shrink-0 rounded-lg border border-slate-200 px-3 text-[14px] font-semibold text-[#0f766e] hover:border-[#14a39a] hover:bg-[#e9f7f4]">{t("new")}</button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-[14px] font-medium text-slate-700">{t("theirSku")}</span><input value={sku} onChange={(e) => setSku(e.target.value)} className={`${inputClass} font-mono`} /></label>
            <label className="block"><span className="mb-1.5 block text-[14px] font-medium text-slate-700">{t("price")} <span className="font-normal text-slate-400">({unitHint})</span></span>
              <input inputMode="decimal" value={cost} placeholder="0.00" onChange={(e) => setCost(e.target.value.replace(/[^0-9.]/g, ""))} className={`${inputClass} tabular-nums`} /></label>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[14.5px] text-slate-700">
            <input type="checkbox" checked={pref} onChange={(e) => setPref(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#0f766e]" />{t("makePreferred")}
          </label>
        </div>
      </Modal>
      <QuickSupplier open={open && quick} onClose={() => setQuick(false)} companyId={companyId} onCreated={(s) => { onSupplier(s); setSup(s.id); setQuick(false); }} />
    </>
  );
}

function DiscModal({ open, onClose, item, others, onDone }: { open: boolean; onClose: () => void; item: InvItem; others: { id: string; name: string }[]; onDone: () => void }) {
  const t = useTranslations("itemBuy");
  const tp = useTranslations("purch");
  const [rep, setRep] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setRep(""); setReason(""); setErr(""); } }, [open]);
  async function go() {
    setBusy(true);
    const { error } = await createClient().rpc("inv_discontinue", { p_item: item.id, p_on: true, p_replacement: rep || null, p_reason: reason.trim() || null });
    setBusy(false);
    if (error) return setErr(tp(poErrKey(error) as never));
    onDone();
  }
  return (
    <Modal open={open} onClose={onClose} title={t("discTitle", { name: item.name })}
      footer={<><button type="button" disabled={busy} onClick={go} className={btnPrimary}>{busy ? t("saving") : t("discYes")}</button><button type="button" onClick={onClose} className={btnGhost}>{t("cancel")}</button>{err && <p role="alert" className="text-sm text-red-600">{err}</p>}</>}>
      <p className="text-[14px] text-slate-600">{t("discText")}</p>
      <div className="mt-4 space-y-4">
        <div><p className="mb-1.5 text-[14px] font-medium text-slate-700">{t("replacement")} <span className="font-normal text-slate-400">{t("optional")}</span></p>
          <SearchSelect ariaLabel={t("replacement")} value={rep} onChange={setRep} placeholder={t("pickReplacement")} options={others.map((o) => ({ value: o.id, label: o.name }))} /></div>
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium text-slate-700">{t("reason")} <span className="font-normal text-slate-400">{t("optional")}</span></span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={160} placeholder={t("reasonPh")} className={inputClass} /></label>
      </div>
    </Modal>
  );
}
