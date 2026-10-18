"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Address, EMPTY_ADDRESS, addressError, addressLine, cityLine, cleanAddress, mapsUrl } from "@/lib/customers";
import AddressFields from "@/components/customers/AddressFields";
import { primaryButton, secondaryButton } from "@/components/customers/ui";

export default function AddressManager({
  customerId,
  companyId,
  addresses,
}: {
  customerId: string;
  companyId: string;
  addresses: (Address & { id: string })[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Address>(EMPTY_ADDRESS);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function startNew() {
    setDraft({ ...EMPTY_ADDRESS, is_primary: addresses.length === 0 });
    setEditingId("new");
    setError("");
  }

  function startEdit(a: Address & { id: string }) {
    setDraft({ ...a, label: a.label ?? "", unit: a.unit ?? "", zip: a.zip ?? "" });
    setEditingId(a.id);
    setError("");
  }

  async function save() {
    const msg = addressError(draft);
    if (msg) return setError(msg);
    setBusy(true);
    const supabase = createClient();
    const data = cleanAddress(draft);

    if (data.is_primary) {
      await supabase.from("customer_addresses").update({ is_primary: false }).eq("customer_id", customerId);
    }
    const { error } =
      editingId === "new"
        ? await supabase.from("customer_addresses").insert({ ...data, customer_id: customerId, company_id: companyId })
        : await supabase.from("customer_addresses").update(data).eq("id", editingId!);

    setBusy(false);
    if (error) return setError("The address couldn't be saved. Try again.");
    setEditingId(null);
    router.refresh();
  }

  async function makePrimary(id: string) {
    const supabase = createClient();
    await supabase.from("customer_addresses").update({ is_primary: false }).eq("customer_id", customerId);
    await supabase.from("customer_addresses").update({ is_primary: true }).eq("id", id);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this address?")) return;
    await createClient().from("customer_addresses").delete().eq("id", id);
    router.refresh();
  }

  const editor = (
    <div className="rounded-xl border border-[#14a39a]/40 bg-[#f6fbfa] p-4 sm:p-5">
      <AddressFields idPrefix="edit-addr" value={draft} onChange={(a) => { setDraft(a); setError(""); }} />
      <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={draft.is_primary} onChange={(e) => setDraft({ ...draft, is_primary: e.target.checked })}
          className="h-4 w-4 accent-[#0f766e]" />
        Primary address
      </label>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex gap-3">
        <button type="button" onClick={save} disabled={busy} className={primaryButton}>{busy ? "Saving..." : "Save address"}</button>
        <button type="button" onClick={() => setEditingId(null)} className={secondaryButton}>Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <ul className="space-y-3">
        {addresses.map((a) =>
          editingId === a.id ? (
            <li key={a.id}>{editor}</li>
          ) : (
            <li key={a.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-800">{a.label || "Service address"}</p>
                    {a.is_primary && (
                      <span className="rounded-full bg-[#d6f3ec] px-2 py-0.5 text-xs font-medium text-[#0f766e]">Primary</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{addressLine(a)}</p>
                  <p className="text-sm text-slate-600">{cityLine(a)}</p>
                </div>
                <a href={mapsUrl(a)} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 text-sm font-semibold text-[#0f766e] hover:underline">
                  Open in Maps
                </a>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <button type="button" onClick={() => startEdit(a)} className="font-medium text-slate-600 hover:text-slate-900">Edit</button>
                {!a.is_primary && (
                  <button type="button" onClick={() => makePrimary(a.id)} className="font-medium text-slate-600 hover:text-slate-900">Make primary</button>
                )}
                <button type="button" onClick={() => remove(a.id)} className="font-medium text-red-600 hover:underline">Delete</button>
              </div>
            </li>
          )
        )}
      </ul>

      {addresses.length === 0 && editingId !== "new" && (
        <p className="text-sm text-slate-500">No service addresses yet.</p>
      )}

      {editingId === "new" ? (
        <div className="mt-3">{editor}</div>
      ) : (
        <button type="button" onClick={startNew} className="mt-4 text-sm font-semibold text-[#0f766e] hover:underline">
          + Add address
        </button>
      )}
    </div>
  );
}
