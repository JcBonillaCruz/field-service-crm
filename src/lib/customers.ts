import { Role, formatPhone } from "@/lib/types";
import { cleanPostal, countryName, dialCode, postalError, subdivisionName, subdivisions, usesNanpFormat } from "@/lib/geo";

export type CustomerType = "residential" | "commercial";

export type Address = {
  id?: string;
  label: string;
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  is_primary: boolean;
};

export type Phone = {
  label: string;
  country: string;
  number: string;
  is_primary: boolean;
};

export type Email = {
  label: string;
  email: string;
  is_primary: boolean;
};

export type Customer = {
  id: string;
  customer_type: CustomerType;
  salutation: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  // Paso 3.21 (requieren el SQL nuevo; si faltan se usan los valores por defecto)
  language?: string | null;
  currency?: string | null;
  payment_terms?: string | null;
  portal_enabled?: boolean | null;
  billing_attention?: string | null;
  shipping_attention?: string | null;
};

export const LANGUAGES = ["English", "Spanish", "Portuguese", "French", "Vietnamese", "Chinese", "Korean", "Arabic", "Hindi", "Tagalog", "Russian", "German"];

export const CURRENCIES = [
  { value: "USD", label: "USD - United States Dollar" },
  { value: "MXN", label: "MXN - Mexican Peso" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - Pound Sterling" },
  { value: "AUD", label: "AUD - Australian Dollar" },
  { value: "COP", label: "COP - Colombian Peso" },
  { value: "GTQ", label: "GTQ - Guatemalan Quetzal" },
  { value: "HNL", label: "HNL - Honduran Lempira" },
  { value: "DOP", label: "DOP - Dominican Peso" },
  { value: "BRL", label: "BRL - Brazilian Real" },
  { value: "INR", label: "INR - Indian Rupee" },
  { value: "JPY", label: "JPY - Japanese Yen" },
];

export const PAYMENT_TERMS = ["Due on Receipt", "Net 15", "Net 30", "Net 45", "Net 60", "Due end of the month", "Due end of next month"];

export const SALUTATIONS = ["Mr.", "Mrs.", "Ms.", "Miss", "Dr.", "Mx.", "Prof."];

export const PHONE_LABELS = ["Main", "Mobile", "Office", "Home", "Work", "Fax", "Other"];
export const EMAIL_LABELS = ["Main", "Quotes", "Invoices", "Billing", "Work", "Personal", "Other"];

export const EMPTY_ADDRESS: Address = {
  label: "",
  street: "",
  unit: "",
  city: "",
  state: "",
  zip: "",
  country: "US",
  is_primary: false,
};

export const newPhone = (is_primary = false): Phone => ({ label: "Mobile", country: "US", number: "", is_primary });
export const newEmail = (is_primary = false): Email => ({ label: "Main", email: "", is_primary });

export function canManageCustomers(role: Role) {
  return role === "owner" || role === "manager" || role === "office";
}

// Exportar saca toda la lista de clientes: solo el dueño y el encargado
export function canExportCustomers(role: Role) {
  return role === "owner" || role === "manager";
}

export function canDeleteCustomers(role: Role) {
  return role === "owner" || role === "manager";
}

// ---------- Teléfonos ----------
export function formatPhoneFor(country: string, value: string) {
  if (usesNanpFormat(country)) return formatPhone(value);
  return value.replace(/[^\d\s-]/g, "").replace(/\s{2,}/g, " ").slice(0, 20);
}

export function phoneError(p: Phone) {
  const digits = p.number.replace(/\D/g, "");
  if (!digits) return "";
  if (usesNanpFormat(p.country) && digits.length !== 10) return "Enter a 10-digit phone number.";
  if (!usesNanpFormat(p.country) && (digits.length < 6 || digits.length > 15)) return "Enter a valid phone number.";
  return "";
}

export function phoneDisplay(p: { country: string; dial_code?: string; number: string }) {
  if (usesNanpFormat(p.country)) return p.number;
  return `${p.dial_code || dialCode(p.country)} ${p.number}`;
}

export function phoneHref(p: { country: string; dial_code?: string; number: string }) {
  return `tel:${p.dial_code || dialCode(p.country)}${p.number.replace(/\D/g, "")}`;
}

// ---------- Correos ----------
export function emailError(e: Email) {
  const v = e.email.trim();
  if (!v) return "";
  return /^\S+@\S+\.\S+$/.test(v) ? "" : "Enter a valid email address.";
}

// ---------- Direcciones ----------
export function addressLine(a: Pick<Address, "street" | "unit">) {
  return [a.street, a.unit].filter(Boolean).join(", ");
}

export function cityLine(a: { city: string; state: string | null; zip?: string | null; country?: string | null }) {
  const state = a.country && a.country !== "US" ? subdivisionName(a.country, a.state) : a.state || "";
  const left = [a.city, state].filter(Boolean).join(", ");
  return `${left}${a.zip ? " " + a.zip : ""}`;
}

export function countryLine(a: { country?: string | null }) {
  return a.country && a.country !== "US" ? countryName(a.country) : "";
}

export function mapsUrl(a: Address) {
  const q = [addressLine(a), cityLine(a), countryName(a.country)].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function addressIsEmpty(a: Address) {
  return !a.street.trim() && !a.city.trim() && !a.zip.trim() && !a.unit.trim();
}

export function addressError(a: Address) {
  if (!a.street.trim()) return "Enter the street address.";
  if (!a.city.trim()) return "Enter the city.";
  if (subdivisions(a.country).length > 0 && !a.state.trim()) return "Choose the state or province.";
  return postalError(a.country, a.zip);
}

export function cleanAddress(a: Address) {
  return {
    label: a.label.trim() || null,
    street: a.street.trim(),
    unit: a.unit.trim() || null,
    city: a.city.trim(),
    state: a.state.trim() || null,
    zip: cleanPostal(a.country, a.zip).trim() || null,
    country: a.country || "US",
    is_primary: a.is_primary,
  };
}
