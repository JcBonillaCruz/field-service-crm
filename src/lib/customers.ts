import { Role } from "@/lib/types";

export type CustomerType = "residential" | "commercial";

export type Address = {
  id?: string;
  label: string;
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  is_primary: boolean;
};

export type Customer = {
  id: string;
  customer_type: CustomerType;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
};

export const EMPTY_ADDRESS: Address = {
  label: "",
  street: "",
  unit: "",
  city: "",
  state: "TX",
  zip: "",
  is_primary: false,
};

export function canManageCustomers(role: Role) {
  return role === "owner" || role === "manager" || role === "office";
}

export function canDeleteCustomers(role: Role) {
  return role === "owner" || role === "manager";
}

export function addressLine(a: Pick<Address, "street" | "unit">) {
  return [a.street, a.unit].filter(Boolean).join(", ");
}

export function cityLine(a: { city: string; state: string; zip?: string | null }) {
  return `${a.city}, ${a.state}${a.zip ? " " + a.zip : ""}`;
}

export function mapsUrl(a: Address) {
  const q = `${addressLine(a)}, ${cityLine(a)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function addressIsEmpty(a: Address) {
  return !a.street.trim() && !a.city.trim() && !a.zip.trim() && !a.unit.trim();
}

export function addressError(a: Address) {
  if (!a.street.trim()) return "Enter the street address.";
  if (!a.city.trim()) return "Enter the city.";
  if (!/^[A-Za-z]{2}$/.test(a.state.trim())) return "Use the 2-letter state code, like TX.";
  if (a.zip && !/^\d{5}$/.test(a.zip.trim())) return "ZIP code must be 5 digits.";
  return "";
}

export function cleanAddress(a: Address) {
  return {
    label: a.label.trim() || null,
    street: a.street.trim(),
    unit: a.unit.trim() || null,
    city: a.city.trim(),
    state: a.state.trim().toUpperCase(),
    zip: a.zip.trim() || null,
    is_primary: a.is_primary,
  };
}
