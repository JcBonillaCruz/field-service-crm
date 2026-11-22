"use client";

import { bustCache } from "@/lib/cache-client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseCsv, downloadCsv } from "@/lib/csv";
import { ACCOUNTS, cleanCode } from "@/lib/catalog";
import { CatalogModule, MODULE_INFO } from "@/lib/catalog-views";
import SelectMenu from "@/components/ui/SelectMenu";
import { FormHeader, InfoIcon, Tip } from "@/components/catalog/FormBits";
import { useTranslations } from "next-intl";
import { useViewTx } from "@/i18n/useViewTx";

type Target = { key: string; label: string; required?: boolean; aliases: string[]; tip: string };

const TARGETS: Record<"items" | "coupons", Target[]> = {
  items: [
    { key: "name", label: "Item Name", required: true, aliases: ["item name", "name", "product name"], tip: "The name that shows on quotes and invoices." },
    { key: "rate", label: "Selling Price", required: true, aliases: ["rate", "selling price", "price", "sales price"], tip: "The rate at which you're going to sell this item." },
    { key: "type", label: "Type", aliases: ["product type", "item type", "type"], tip: "goods or service. Empty = goods." },
    { key: "unit", label: "Usage Unit", aliases: ["usage unit", "unit"], tip: "each, hour, visit, ton..." },
    { key: "sku", label: "SKU", aliases: ["sku", "item code", "part number"], tip: "Your own product or part code." },
    { key: "account", label: "Account", aliases: ["account", "sales account", "account name"], tip: "Where the income is tracked. Empty = Sales." },
    { key: "description", label: "Description", aliases: ["description", "sales description"], tip: "Shows under the item name." },
    { key: "status", label: "Status", aliases: ["status"], tip: "Active or Inactive. Empty = Active." },
  ],
  coupons: [
    { key: "name", label: "Coupon Name", required: true, aliases: ["coupon name", "name"], tip: "A name for your team." },
    { key: "code", label: "Coupon Code", required: true, aliases: ["coupon code", "code"], tip: "Letters, numbers, - and _ only." },
    { key: "product", label: "Product Name", required: true, aliases: ["product name", "product"], tip: "If the product doesn't exist yet, it will be created." },
    { key: "value", label: "Discount Value", required: true, aliases: ["discount value", "discount", "value"], tip: "The amount or percentage." },
    { key: "by", label: "Discount By", aliases: ["discount by", "discount type"], tip: "Flat or Percentage. Empty = Flat." },
    { key: "redemption", label: "Redemption Type", aliases: ["redemption type", "redemption"], tip: "One Time, Unlimited or Limited Cycles." },
    { key: "cycles", label: "Cycles", aliases: ["cycles", "number of cycles"], tip: "Only for Limited Cycles." },
    { key: "expires", label: "Expiration Date", aliases: ["expiration date", "expires", "expiry date"], tip: "yyyy-mm-dd or mm/dd/yyyy." },
    { key: "max", label: "Maximum Redemption", aliases: ["maximum redemption", "maximum redemptions", "max redemptions"], tip: "Empty = no limit." },
    { key: "status", label: "Status", aliases: ["status"], tip: "Active or Inactive. Empty = Active." },
  ],
};

const notNull = <T,>(x: T | null): x is T => x !== null;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const num = (s: string) => Number(String(s).replace(/[^0-9.-]/g, ""));
function toDate(s: string): string | null {
  const t = s.trim(); if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const d = new Date(t); return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-CA");
}

export default function CatalogImport({ module, companyId }: { module: CatalogModule; companyId: string }) {
  const t = useTranslations("catImport");
  const tc = useTranslations("common");
  const vx = useViewTx(module);
  const router = useRouter();
  const base = MODULE_INFO[module].base;
  const targets = TARGETS[module as "items" | "coupons"];
  const tl = (x: Target) => t(`tg.${module}.${x.key}` as never);
  const tt = (x: Target) => t(`tg.${module}.${x.key}Tip` as never);
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState("");
  const [head, setHead] = useState<string[]>([]);
  const [body, setBody] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; skipped: string[] } | null>(null);

  async function read(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError(t("eSize"));
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return setError(t("eEmpty"));
    const h = rows[0].map((x) => x.trim());
    const auto: Record<string, string> = {};
    targets.forEach((g) => { const i = h.findIndex((x) => g.aliases.includes(norm(x))); if (i >= 0) auto[g.key] = String(i); });
    setFileName(file.name); setHead(h); setBody(rows.slice(1)); setMap(auto); setError(""); setStep(2);
  }
  const get = (r: string[], k: string) => (map[k] != null && map[k] !== "" ? (r[Number(map[k])] ?? "").trim() : "");

  async function run() {
    const missing = targets.filter((g) => g.required && !map[g.key]);
    if (missing.length) return setError(t("eMissing", { list: missing.map((m) => tl(m)).join(", ") }));
    setBusy(true); setError("");
    const supabase = createClient();
    const skipped: string[] = [];
    let ok = 0;
    try {
      if (module === "items") {
        const rows = body.map((r, i) => {
          const name = get(r, "name"); const rate = num(get(r, "rate"));
          if (!name || Number.isNaN(rate)) { skipped.push(t("skipItem", { n: i + 2 })); return null; }
          const acc = get(r, "account");
          return {
            company_id: companyId, name, selling_price: Math.round(rate * 100) / 100,
            item_type: /serv/i.test(get(r, "type")) ? "service" : "goods", unit: get(r, "unit") || null, sku: get(r, "sku") || null,
            account: ACCOUNTS.find((a) => a.toLowerCase() === acc.toLowerCase()) ?? (acc || "Sales"),
            description: get(r, "description") || null, is_active: !/inactive/i.test(get(r, "status")), source: "import",
          };
        }).filter(notNull);
        for (let i = 0; i < rows.length; i += 300) {
          const { error: e } = await supabase.from("items").insert(rows.slice(i, i + 300));
          if (e) throw e;
          ok += rows.slice(i, i + 300).length;
        }
      } else {
        const { data: prods } = await supabase.from("catalog_products").select("id, name").eq("company_id", companyId);
        const byName = new Map((prods ?? []).map((p) => [p.name.toLowerCase(), p.id as string]));
        for (const pn of Array.from(new Set(body.map((r) => get(r, "product")).filter(Boolean)))) {
          if (byName.has(pn.toLowerCase())) continue;
          const { data } = await supabase.from("catalog_products").insert({ company_id: companyId, name: pn }).select("id").single();
          if (data) byName.set(pn.toLowerCase(), data.id);
        }
        const rows = body.map((r, i) => {
          const name = get(r, "name"); const code = cleanCode(get(r, "code")); const pid = byName.get(get(r, "product").toLowerCase());
          const value = num(get(r, "value")); const percent = /perc|%/i.test(get(r, "by"));
          if (!name || !code || !pid || !(value > 0) || (percent && value > 100)) { skipped.push(t("skipCoupon", { n: i + 2 })); return null; }
          const red = get(r, "redemption").toLowerCase();
          const rtype = red.includes("unlim") ? "unlimited" : red.includes("cycle") ? "limited_cycles" : "one_time";
          const cycles = num(get(r, "cycles"));
          return {
            company_id: companyId, product_id: pid, name, code, discount_type: percent ? "percent" : "flat", discount_value: Math.round(value * 100) / 100,
            redemption_type: rtype, cycles: rtype === "limited_cycles" && cycles > 0 ? cycles : rtype === "limited_cycles" ? 1 : null,
            expires_on: toDate(get(r, "expires")), max_redemptions: num(get(r, "max")) > 0 ? num(get(r, "max")) : null,
            is_active: !/inactive/i.test(get(r, "status")), source: "import",
          };
        }).filter(notNull);
        for (const row of rows) {
          const { error: e } = await supabase.from("coupons").insert(row);
          if (e) skipped.push(`${(row as { code: string }).code}: ${e.code === "23505" ? t("codeExists") : t("notSaved")}`);
          else ok++;
        }
      }
      setResult({ ok, skipped }); setStep(3); await bustCache("catalog"); router.refresh();
    } catch {
      setError(t("eStopped", { n: ok }));
    }
    setBusy(false);
  }

  function sample() {
    if (module === "items") downloadCsv("items-sample.csv", [["Item Name", "Rate", "Product Type", "Usage Unit", "SKU", "Account", "Description", "Status"], ["AC Tune-Up", "89", "service", "visit", "TUNE-01", "Service Income", "21-point inspection and cleaning", "Active"], ["Capacitor 45/5 MFD", "185", "goods", "each", "CAP-455", "Parts & Materials", "", "Active"]]);
    else downloadCsv("coupons-sample.csv", [["Coupon Name", "Coupon Code", "Product Name", "Discount Value", "Discount By", "Redemption Type", "Expiration Date", "Maximum Redemption", "Status"], ["Fall tune-up special", "FALL25", "Maintenance", "25", "Flat", "One Time", "2026-12-31", "100", "Active"]]);
  }

  const Steps = (
    <ol className="mb-8 flex flex-wrap items-center gap-3 text-sm">
      {[t("s1"), t("s2"), t("s3")].map((s, i) => (
        <li key={s} className="flex items-center gap-3">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${step > i ? "bg-[#0f766e] text-white" : "bg-slate-100 text-slate-500"}`}>{i + 1}</span>
          <span className={step === i + 1 ? "font-semibold text-[#0b1f3a]" : "text-slate-500"}>{s}</span>
          {i < 2 && <span className="h-px w-10 bg-slate-200" />}
        </li>
      ))}
    </ol>
  );

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title={t("title", { x: vx.many, lx: vx.many.toLowerCase() })} closeHref={base} />
      <div className="flex-1 px-5 py-8 sm:px-8">
        <div className="max-w-[880px]">
          {Steps}
          {step === 1 && (
            <>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => read(e.target.files?.[0])} />
              <button type="button" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); read(e.dataTransfer.files?.[0]); }}
                className="flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 bg-[#fafbfc] px-6 py-14 text-center transition-colors hover:border-[#14a39a] hover:bg-[#f0faf7]">
                <svg viewBox="0 0 24 24" className="h-11 w-11 text-[#0f766e]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4m0 0-4 4m4-4 4 4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
                <span className="mt-3 text-[15px] font-semibold text-[#0b1f3a]">{t("drop")}</span>
                <span className="mt-1 text-sm text-slate-500">{t("dropHelp")}</span>
              </button>
              <button type="button" onClick={sample} className="mt-4 text-sm font-medium text-[#2563eb] hover:underline">{t("sample")}</button>
            </>
          )}
          {step === 2 && (
            <>
              <p className="mb-5 text-[15px] text-slate-600"><span className="font-medium text-[#0b1f3a]">{fileName}</span> · {t("rowsMatch", { n: body.length })}</p>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-2 bg-[#fafbfc] px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><span>{t("bpField")}</span><span>{t("yourCol")}</span></div>
                {targets.map((g) => (
                  <div key={g.key} className="grid grid-cols-2 items-center gap-4 border-t border-slate-100 px-5 py-2.5">
                    <Tip text={tt(g)}><span className={`flex cursor-help items-center gap-1.5 text-[15px] ${g.required ? "text-red-600" : "text-slate-700"}`}><span className="border-b border-dotted border-current">{tl(g)}{g.required && "*"}</span><InfoIcon /></span></Tip>
                    <SelectMenu ariaLabel={tl(g)} value={map[g.key] ?? ""} placeholder={t("dont")}
                      options={[{ value: "", label: t("dont") }, ...head.map((h, i) => ({ value: String(i), label: h || t("colN", { n: i + 1 }) }))]}
                      onChange={(v) => setMap((m) => ({ ...m, [g.key]: v }))} />
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button type="button" onClick={run} disabled={busy} className="rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59] disabled:opacity-60">{busy ? t("importing") : t("importN", { n: body.length })}</button>
                <button type="button" onClick={() => setStep(1)} className="rounded-lg border border-slate-200 px-5 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50">{tc("back")}</button>
                {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              </div>
            </>
          )}
          {step === 3 && result && (
            <div className="rounded-2xl border border-slate-200 p-8 text-center animate-[bp-fade_0.3s_ease-out]">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e9f7f4] text-[#0f766e]">
                <svg viewBox="0 0 20 20" className="h-7 w-7" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>
              </span>
              <p className="mt-4 text-lg font-semibold text-[#0b1f3a]">{t("imported", { n: result.ok })}</p>
              {result.skipped.length > 0 && (
                <div className="mx-auto mt-4 max-w-md rounded-xl bg-amber-50 px-4 py-3 text-left text-sm text-amber-800">
                  <p className="font-medium">{t("skipped", { n: result.skipped.length })}</p>
                  <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5">{result.skipped.slice(0, 50).map((s) => <li key={s}>{s}</li>)}</ul>
                </div>
              )}
              <button type="button" onClick={() => router.push(base)} className="mt-6 rounded-lg bg-[#0f766e] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#0c5f59]">{t("goTo", { x: vx.many, lx: vx.many.toLowerCase() })}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
