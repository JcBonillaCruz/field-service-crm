"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete } from "@/lib/confirm";
import { inputClass } from "@/components/customers/ui";
import SearchSelect from "@/components/ui/SearchSelect";
import { FormHeader, FormRow, SaveBar } from "@/components/catalog/FormBits";
import { LocIcon } from "@/components/inventory/PageBits";
import { InvLocation, InvMember, invError } from "@/lib/inventory";
import { useTranslations } from "next-intl";
import { useInvTx } from "@/i18n/useInvTx";

// Nueva / editar ubicación: pantalla completa (menú + formulario)
export default function LocationForm({ companyId, members, location, taken, initialKind, canEdit }: {
  companyId: string; members: InvMember[]; location?: InvLocation & { is_active: boolean }; taken: string[]; initialKind: "warehouse" | "van"; canEdit: boolean;
}) {
  const t = useTranslations("invLocForm");
  const tr = useTranslations("roles");
  const ix = useInvTx();
  const router = useRouter();
  const [kind, setKind] = useState<"warehouse" | "van">(initialKind);
  const [name, setName] = useState(location?.name ?? "");
  const [tech, setTech] = useState(location?.assigned_user_id ?? "");
  const [active, setActive] = useState(location?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const back = location ? `/dashboard/inventory/locations/${location.id}` : "/dashboard/inventory/locations";
  const options = members.map((m) => ({
    value: m.user_id, label: m.full_name,
    hint: taken.includes(m.user_id) ? t("hasVan") : tr.has(m.role as never) ? tr(m.role as never) : m.role,
  }));

  function pickTech(id: string) {
    setTech(id); setError("");
    const m = members.find((x) => x.user_id === id);
    if (m && !name.trim()) setName(t("vanOf", { name: m.full_name.split(" ")[0] }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return setError(t("eRole"));
    if (!name.trim()) return setError(t("eName"));
    if (kind === "van" && tech && taken.includes(tech)) return setError(t("eVan"));
    setSaving(true); setError("");
    const row = { name: name.trim(), kind, assigned_user_id: kind === "van" ? tech || null : null, is_active: location?.is_default ? true : active };
    const sb = createClient();
    const { data, error: dbErr } = location
      ? await sb.from("inventory_locations").update(row).eq("id", location.id).select("id").single()
      : await sb.from("inventory_locations").insert({ ...row, company_id: companyId }).select("id").single();
    if (dbErr || !data) { setSaving(false); return setError(ix.err(invError(dbErr))); }
    router.push(`/dashboard/inventory/locations/${data.id}`); router.refresh();
  }

  async function remove() {
    if (!location || !(await confirmDelete({ title: t("delQ", { name: location.name }), message: t("delMsg") }))) return;
    const { error: err } = await createClient().rpc("inv_delete_location", { p_company: companyId, p_location: location.id });
    if (err) return setError(ix.err(invError(err)));
    router.replace("/dashboard/inventory/locations"); router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title={location ? t("editTitle") : t("newTitle")} closeHref={back} />
      <div className="flex-1 space-y-6 px-5 py-7 sm:px-8">
        <FormRow label={t("type")} hint={t("typeHint")}>
          <div className="grid max-w-[420px] grid-cols-2 gap-3">
            {(["van", "warehouse"] as const).map((k) => (
              <button key={k} type="button" disabled={location?.is_default} onClick={() => setKind(k)}
                className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-60 ${kind === k ? "border-[#0f766e] bg-[#f3fbf8]" : "border-slate-200 hover:border-[#14a39a]"}`}>
                <LocIcon kind={k} />
                <span><span className="block text-[15px] font-semibold text-[#0b1f3a]">{k === "van" ? t("van") : t("warehouse")}</span>
                  <span className="block text-[12.5px] text-slate-500">{k === "van" ? t("vanSub") : t("warehouseSub")}</span></span>
              </button>
            ))}
          </div>
        </FormRow>
        {kind === "van" && (
          <FormRow label={t("tech")} htmlFor="loc-tech" width="max-w-[420px]" hint={t("techHint")}>
            <SearchSelect id="loc-tech" ariaLabel={t("tech")} value={tech} options={options} onChange={pickTech} placeholder={t("techPh")} />
            {members.filter((m) => m.role === "technician").length === 0 && (
              <p className="mt-1.5 text-[13px] text-slate-500">{t.rich("noTechs", { a: (c) => <a href="/dashboard/inventory/team/invite?role=technician" className="font-medium text-[#0f766e] hover:underline">{c}</a> })}</p>
            )}
          </FormRow>
        )}
        <FormRow label={t("name")} htmlFor="loc-name" required width="max-w-[420px]" hint={t("nameHint")}>
          <input id="loc-name" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} maxLength={60} placeholder={kind === "van" ? t("vanPh") : t("shopPh")} className={inputClass} />
        </FormRow>
        {location && !location.is_default && (
          <FormRow label={t("status")} hint={t("statusHint")}>
            <button type="button" role="switch" aria-checked={active} onClick={() => setActive((v) => !v)} className="group flex items-center gap-3 py-1.5">
              <span className={`relative h-6 w-11 rounded-full transition-colors ${active ? "bg-[#0f766e]" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${active ? "left-[22px]" : "left-0.5"}`} />
              </span>
              <span className="text-[15px] text-slate-700">{active ? t("active") : t("inactive")}</span>
            </button>
          </FormRow>
        )}
      </div>
      <SaveBar saving={saving} cancelHref={back} error={error} onDelete={location && !location.is_default && canEdit ? remove : undefined} deleteLabel={t("delete")} />
    </form>
  );
}
