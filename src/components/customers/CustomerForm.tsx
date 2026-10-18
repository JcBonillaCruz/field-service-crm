"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { dialCode } from "@/lib/geo";
import {
  Address,
  Customer,
  CustomerType,
  EMPTY_ADDRESS,
  Email,
  Phone,
  addressError,
  addressIsEmpty,
  cleanAddress,
  emailError,
  newEmail,
  newPhone,
  phoneError,
} from "@/lib/customers";
import AddressFields from "@/components/customers/AddressFields";
import PhoneList from "@/components/customers/PhoneList";
import EmailList from "@/components/customers/EmailList";
import { useNoFill } from "@/components/customers/noFill";
import { inputClass, labelClass, primaryButton, secondaryButton } from "@/components/customers/ui";

export default function CustomerForm({
  companyId,
  customer,
  initialPhones,
  initialEmails,
}: {
  companyId: string;
  customer?: Customer;
  initialPhones?: Phone[];
  initialEmails?: Email[];
}) {
  const router = useRouter();
  const noFill = useNoFill();
  const editing = Boolean(customer);

  const [type, setType] = useState<CustomerType>(customer?.customer_type ?? "residential");
  const [firstName, setFirstName] = useState(customer?.first_name ?? "");
  const [lastName, setLastName] = useState(customer?.last_name ?? "");
  const [companyName, setCompanyName] = useState(customer?.company_name ?? "");
  const [phones, setPhones] = useState<Phone[]>(initialPhones?.length ? initialPhones : [newPhone(true)]);
  const [emails, setEmails] = useState<Email[]>(initialEmails?.length ? initialEmails : [newEmail(true)]);
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [addresses, setAddresses] = useState<Address[]>([{ ...EMPTY_ADDRESS, is_primary: true }]);
  const [error, setError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  function validate() {
    if (type === "residential" && !firstName.trim() && !lastName.trim()) return "Enter the customer's name.";
    if (type === "commercial" && !companyName.trim()) return "Enter the business name.";
    if (phones.some((p) => phoneError(p))) return "Check the phone numbers marked in red.";
    if (emails.some((e) => emailError(e))) return "Check the emails marked in red.";
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
    setShowErrors(true);
    const msg = validate();
    if (msg) return setError(msg);

    setSaving(true);
    setError("");

    const filledPhones = phones.filter((p) => p.number.replace(/\D/g, ""));
    const filledEmails = emails.filter((x) => x.email.trim());
    const filledAddresses = addresses.filter((a) => !addressIsEmpty(a));

    const { data, error } = await createClient().rpc("save_customer", {
      p_company_id: companyId,
      p_customer_id: customer?.id ?? null,
      p_customer: {
        customer_type: type,
        first_name: firstName,
        last_name: lastName,
        company_name: type === "commercial" ? companyName : "",
        notes,
      },
      p_phones: filledPhones.map((p) => ({
        label: p.label.trim() || "Main",
        country: p.country,
        dial_code: dialCode(p.country),
        number: p.number.trim(),
        is_primary: p.is_primary,
      })),
      p_emails: filledEmails.map((x) => ({
        label: x.label.trim() || "Main",
        email: x.email.trim().toLowerCase(),
        is_primary: x.is_primary,
      })),
      p_addresses: editing ? null : filledAddresses.map(cleanAddress),
    });

    setSaving(false);
    if (error || !data) {
      return setError(editing ? "The changes couldn't be saved. Try again." : "The customer couldn't be saved. Try again.");
    }
    router.push(`/dashboard/customers/${data}`);
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
      if (next.length && !next.some((a) => a.is_primary)) next[0] = { ...next[0], is_primary: true };
      return next;
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate autoComplete="off" className="space-y-6">
      {/* Campo trampa: algunos navegadores rellenan el primer campo que encuentran */}
      <input type="text" tabIndex={-1} aria-hidden="true" autoComplete="off" className="hidden" />

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
              <label htmlFor="c-business" className={labelClass}>Business name</label>
              <input id="c-business" value={companyName} {...noFill("c1")} placeholder="e.g. Oak Lawn Dental Group"
                onChange={(e) => { setCompanyName(e.target.value); setError(""); }} className={inputClass} />
            </div>
          )}
          <div>
            <label htmlFor="c-given" className={labelClass}>
              {type === "commercial" ? "Contact first name" : "First name"}
              {type === "commercial" && <span className="font-normal text-slate-400"> (optional)</span>}
            </label>
            <input id="c-given" value={firstName} {...noFill("c2")}
              onChange={(e) => { setFirstName(e.target.value); setError(""); }} className={inputClass} />
          </div>
          <div>
            <label htmlFor="c-family" className={labelClass}>
              {type === "commercial" ? "Contact last name" : "Last name"}
              {type === "commercial" && <span className="font-normal text-slate-400"> (optional)</span>}
            </label>
            <input id="c-family" value={lastName} {...noFill("c3")}
              onChange={(e) => { setLastName(e.target.value); setError(""); }} className={inputClass} />
          </div>
        </div>

        <div className="mt-6">
          <p className={labelClass}>Phone numbers</p>
          <PhoneList phones={phones} showErrors={showErrors} onChange={(l) => { setPhones(l); setError(""); }} />
        </div>

        <div className="mt-6">
          <p className={labelClass}>Emails</p>
          <p className="-mt-1 mb-2 text-xs text-slate-500">Use labels like Quotes or Invoices to know where each document goes.</p>
          <EmailList emails={emails} showErrors={showErrors} onChange={(l) => { setEmails(l); setError(""); }} />
        </div>

        <div className="mt-6">
          <label htmlFor="c-notes" className={labelClass}>
            Notes <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea id="c-notes" rows={3} value={notes} {...noFill("c4")} placeholder="Gate code, pets, best time to call..."
            onChange={(e) => setNotes(e.target.value)} className={inputClass} />
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
                      <input type="radio" name="primary-address" checked={a.is_primary} onChange={() => setPrimary(i)} className="h-4 w-4 accent-[#0f766e]" />
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

          <button type="button" onClick={() => setAddresses((l) => [...l, { ...EMPTY_ADDRESS, country: l[l.length - 1]?.country ?? "US" }])}
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
