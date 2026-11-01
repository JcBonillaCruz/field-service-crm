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

// Nueva / editar ubicación: pantalla completa (menú + formulario)
export default function LocationForm({ companyId, members, location, taken, initialKind, canEdit }: {
  companyId: string; members: InvMember[]; location?: InvLocation & { is_active: boolean }; taken: string[]; initialKind: "warehouse" | "van"; canEdit: boolean;
}) {
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
    hint: taken.includes(m.user_id) ? "Has a van" : m.role === "technician" ? "Technician" : m.role[0].toUpperCase() + m.role.slice(1),
  }));

  function pickTech(id: string) {
    setTech(id); setError("");
    const m = members.find((x) => x.user_id === id);
    if (m && !name.trim()) setName(`${m.full_name.split(" ")[0]}'s Van`);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return setError("Only the owner or a manager can change locations.");
    if (!name.trim()) return setError("Enter a name.");
    if (kind === "van" && tech && taken.includes(tech)) return setError("That person already has an active van.");
    setSaving(true); setError("");
    const row = { name: name.trim(), kind, assigned_user_id: kind === "van" ? tech || null : null, is_active: location?.is_default ? true : active };
    const sb = createClient();
    const { data, error: dbErr } = location
      ? await sb.from("inventory_locations").update(row).eq("id", location.id).select("id").single()
      : await sb.from("inventory_locations").insert({ ...row, company_id: companyId }).select("id").single();
    if (dbErr || !data) { setSaving(false); return setError(invError(dbErr)); }
    router.push(`/dashboard/inventory/locations/${data.id}`); router.refresh();
  }

  async function remove() {
    if (!location || !(await confirmDelete({ title: `Delete "${location.name}"?`, message: "Only empty locations can be deleted. Its movement history stays." }))) return;
    const { error: err } = await createClient().rpc("inv_delete_location", { p_company: companyId, p_location: location.id });
    if (err) return setError(invError(err));
    router.replace("/dashboard/inventory/locations"); router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate autoComplete="off" className="flex min-h-[calc(100vh-4rem)] flex-col bg-white">
      <FormHeader title={location ? "Edit Location" : "New Location"} closeHref={back} />
      <div className="flex-1 space-y-6 px-5 py-7 sm:px-8">
        <FormRow label="Type" hint="A van belongs to one technician: they only see and use the parts in their van.">
          <div className="grid max-w-[420px] grid-cols-2 gap-3">
            {(["van", "warehouse"] as const).map((k) => (
              <button key={k} type="button" disabled={location?.is_default} onClick={() => setKind(k)}
                className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-60 ${kind === k ? "border-[#0f766e] bg-[#f3fbf8]" : "border-slate-200 hover:border-[#14a39a]"}`}>
                <LocIcon kind={k} />
                <span><span className="block text-[15px] font-semibold text-[#0b1f3a]">{k === "van" ? "Van / Truck" : "Warehouse"}</span>
                  <span className="block text-[12.5px] text-slate-500">{k === "van" ? "For a technician" : "Shop, storage"}</span></span>
              </button>
            ))}
          </div>
        </FormRow>
        {kind === "van" && (
          <FormRow label="Technician" htmlFor="loc-tech" width="max-w-[420px]" hint="The person who drives this van. They will see only this van's stock and their scans are deducted from it.">
            <SearchSelect id="loc-tech" ariaLabel="Technician" value={tech} options={options} onChange={pickTech} placeholder="Choose a team member" />
            {members.filter((m) => m.role === "technician").length === 0 && (
              <p className="mt-1.5 text-[13px] text-slate-500">No technicians yet. <a href="/dashboard/team/invite?role=technician" className="font-medium text-[#0f766e] hover:underline">Invite one in Team</a> — you can create the van now and assign it later.</p>
            )}
          </FormRow>
        )}
        <FormRow label="Name" htmlFor="loc-name" required width="max-w-[420px]" hint="e.g. Hector's Van, Truck 2, Main Shop">
          <input id="loc-name" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} maxLength={60} placeholder={kind === "van" ? "e.g. Hector's Van" : "e.g. North Shop"} className={inputClass} />
        </FormRow>
        {location && !location.is_default && (
          <FormRow label="Status" hint="Inactive locations are hidden from transfers and scans, but keep their history.">
            <button type="button" role="switch" aria-checked={active} onClick={() => setActive((v) => !v)} className="group flex items-center gap-3 py-1.5">
              <span className={`relative h-6 w-11 rounded-full transition-colors ${active ? "bg-[#0f766e]" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${active ? "left-[22px]" : "left-0.5"}`} />
              </span>
              <span className="text-[15px] text-slate-700">{active ? "Active" : "Inactive"}</span>
            </button>
          </FormRow>
        )}
      </div>
      <SaveBar saving={saving} cancelHref={back} error={error} onDelete={location && !location.is_default && canEdit ? remove : undefined} deleteLabel="Delete location" />
    </form>
  );
}
