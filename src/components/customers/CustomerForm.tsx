"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPhone } from "@/lib/types";
import {
  Address,
  Customer,
  CustomerType,
  EMPTY_ADDRESS,
  addressError,
  addressIsEmpty,
  cleanAddress,
} from "@/lib/customers";
import AddressFields from "@/components/customers/AddressFields";
import { inputClass, labelClass, primaryButton, secondaryButton } from "@/components/customers/ui";

export default function CustomerForm({
  companyId,
  customer,
}: {
  companyId: string;
  customer?: Customer;
}) {
  const router = useRouter();
  const editing = Boolean(customer);

  const [type, setType] = useState<CustomerType>(customer?.customer_type ?? "residential");
  const [firstName, setFirstName] = useState(customer?.first_name ?? "");
  const [lastName, setLastName] = useState(customer?.last_name ?? "");
  const [companyName, setCompanyName] = useState(customer?.company_name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [addresses, setAddresses] = useState<Address[]>([{ ...EMPTY_ADDRESS, is_primary: true }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function validate() {
    if (type === "residential" && !firstName.trim() && !lastName.trim()) return "Enter the customer's name.";
    if (type === "commercial" && !companyName.trim()) return "Enter the business name.";
    if (phone && phone.replace(/\D/g, "").length !== 10) return "Enter a 10-digit phone number, or leave it blank.";
    if (email && !/^\S+@\S+\.\S+$/.test(email.trim())) return "Enter a valid email, or leave it blank.";
    if (!editing) {
      for (const a of addresses) {
        if (addressIsEmpty(a)) continue;
        const msg = addressError(a);
        if (msg) return msg;
      }
    }
    return "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = validate();
    if (msg) return setError(msg);

    setSaving(true);
    setError("");
    const supabase = createClient();
    const payload = {
      customer_type: type,
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      company_name: type === "commercial" ? companyName.trim() || null : null,
      phone: phone || null,
      email: email.trim().toLowerCase() || null,
      notes: notes.trim() || null,
    };

    if (editing && customer) {
      const { error } = await supabase.from("customers").update(payload).eq("id", customer.id);
      setSaving(false);
      if (error) return setError("The changes couldn't be saved. Try again.");
      router.push(`/dashboard/customers/${customer.id}`);
      router.refresh();
      return;
    }

    const { data, error } = await supabase
      .from("customers")
      .insert({ ...payload, company_id: companyId })
      .select("id")
      .single();

    if (error || !data) {
      setSaving(false);
      return setError("The customer couldn't be saved. Try again.");
    }

    const filled = addresses.filter((a) => !addressIsEmpty(a));
    if (filled.length > 0) {
      if (!filled.some((a) => a.is_primary)) filled[0].is_primary = true;
      const { error: addrErr } = await supabase.from("customer_addresses").insert(
        filled.map((a) => ({ ...cleanAddress(a), customer_id: data.id, company_id: companyId }))
      );
      if (addrErr) {
        setSaving(false);
        router.push(`/dashboard/customers/${data.id}?warn=addresses`);
        return;
      }
    }

    setSaving(false);
    router.push(`/dashboard/customers/${data.id}`);
    router.refresh();
  }

  function updateAddress(i: number, a: Address) {
    setAddresses((list) => list.map((x, j) => (j === i ? a : x)));
    setError("");
  }

  function setPrimary(i: number) {
    setAddresses((list) => list.map((x, j) => ({ ...x, is_primary: j === i })));
  }

  function removeAddress(i: number) {
    setAddresses((list) => {
      const next = list.filter((_, j) => j !== i);
      if (next.length && !next.some((a) => a.is_primary)) next[0].is_primary = true;
      return next;
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <h2 className="text-base font-semibold text-[#0b1f3a]">Customer details</h2>

        <div className="mt-5 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="radiogroup" aria-label="Customer type">
          {(["residential", "commercial"] as CustomerType[]).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => { setType(t); setError(""); }}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${type === t ? "bg-white text-[#0f766e] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
              {t === "residential" ? "Residential" : "Commercial"}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {type === "commercial" && (
            <div className="sm:col-span-2">
              <label htmlFor="company" className={labelClass}>Business name</label>
              <input id="company" value={companyName} autoComplete="off" placeholder="e.g. Oak Lawn Dental Group"
                onChange={(e) => { setCompanyName(e.target.value); setError(""); }} className={inputClass} />
            </div>
          )}
          <div>
            <label htmlFor="first" className={labelClass}>
              {type === "commercial" ? "Contact first name" : "First name"}
              {type === "commercial" && <span className="font-normal text-slate-400"> (optional)</span>}
            </label>
            <input id="first" value={firstName} autoComplete="off"
              onChange={(e) => { setFirstName(e.target.value); setError(""); }} className={inputClass} />
          </div>
          <div>
            <label htmlFor="last" className={labelClass}>
              {type === "commercial" ? "Contact last name" : "Last name"}
              {type === "commercial" && <span className="font-normal text-slate-400"> (optional)</span>}
            </label>
            <input id="last" value={lastName} autoComplete="off"
              onChange={(e) => { setLastName(e.target.value); setError(""); }} className={inputClass} />
          </div>
          <div>
            <label htmlFor="phone" className={labelClass}>Phone</label>
            <input id="phone" type="tel" inputMode="tel" maxLength={14} value={phone} placeholder="(214) 555-0123"
              onChange={(e) => { setPhone(formatPhone(e.target.value)); setError(""); }} className={inputClass} />
          </div>
          <div>
            <label htmlFor="email" className={labelClass}>Email</label>
            <input id="email" type="email" value={email} autoComplete="off" placeholder="name@email.com"
              onChange={(e) => { setEmail(e.target.value); setError(""); }} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="notes" className={labelClass}>
              Notes <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea id="notes" rows={3} value={notes} placeholder="Gate code, pets, best time to call..."
              onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </div>
        </div>
      </section>

      {!editing && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <h2 className="text-base font-semibold text-[#0b1f3a]">Service addresses</h2>
          <p className="mt-1 text-sm text-slate-500">Add every place you work for this customer. You can add more later.</p>

          <div className="mt-5 space-y-5">
            {addresses.map((a, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-700">Address {i + 1}</p>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="radio" name="primary" checked={a.is_primary} onChange={() => setPrimary(i)} className="h-4 w-4 accent-[#0f766e]" />
                      Primary
                    </label>
                    {addresses.length > 1 && (
                      <button type="button" onClick={() => removeAddress(i)} className="text-sm font-medium text-red-600 hover:underline">
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <AddressFields idPrefix={`addr-${i}`} value={a} onChange={(v) => updateAddress(i, v)} />
              </div>
            ))}
          </div>

          <button type="button" onClick={() => setAddresses((l) => [...l, { ...EMPTY_ADDRESS }])}
            className="mt-4 text-sm font-semibold text-[#0f766e] hover:underline">
            + Add another address
          </button>
        </section>
      )}

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={editing && customer ? `/dashboard/customers/${customer.id}` : "/dashboard/customers"}
          className={`${secondaryButton} text-center`}>
          Cancel
        </Link>
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving ? "Saving..." : editing ? "Save changes" : "Save customer"}
        </button>
      </div>
    </form>
  );
}
