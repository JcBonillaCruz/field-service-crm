import { formatPhone } from "@/lib/types";
import { COUNTRIES, cleanPostal, dialCode, getCountry, subdivisions } from "@/lib/geo";
import { emailError, formatPhoneFor, phoneError } from "@/lib/customers";

export const SLOTS = { phone: 5, email: 5, address: 3 };

// ---------- Campos de BrightPro a los que se puede asignar una columna ----------
export type Target = { key: string; label: string; group: string };

const ADDRESS_PARTS = [
  ["label", "Label"], ["street", "Street"], ["unit", "Unit"], ["city", "City"],
  ["state", "State / Province"], ["zip", "ZIP / Postal code"], ["country", "Country"],
] as const;

export const TARGETS: Target[] = [
  { key: "type", label: "Customer type", group: "Customer" },
  { key: "first_name", label: "First name", group: "Customer" },
  { key: "last_name", label: "Last name", group: "Customer" },
  { key: "full_name", label: "Full name", group: "Customer" },
  { key: "company_name", label: "Company name", group: "Customer" },
  { key: "notes", label: "Notes", group: "Customer" },
  ...Array.from({ length: SLOTS.phone }, (_, i) => [
    { key: `phone:${i + 1}`, label: `Phone ${i + 1}`, group: "Phones" },
    { key: `phoneLabel:${i + 1}`, label: `Phone ${i + 1} label`, group: "Phones" },
  ]).flat(),
  ...Array.from({ length: SLOTS.email }, (_, i) => [
    { key: `email:${i + 1}`, label: `Email ${i + 1}`, group: "Emails" },
    { key: `emailLabel:${i + 1}`, label: `Email ${i + 1} label`, group: "Emails" },
  ]).flat(),
  ...Array.from({ length: SLOTS.address }, (_, i) =>
    ADDRESS_PARTS.map(([part, label]) => ({ key: `addr${i + 1}:${part}`, label: `Address ${i + 1} · ${label}`, group: `Address ${i + 1}` }))
  ).flat(),
];

export const TARGET_LABEL = new Map(TARGETS.map((t) => [t.key, t.label]));

// ---------- Columnas del archivo de exportación (y de la plantilla) ----------
export function exportHeaders(phones: number, emails: number, addresses: number) {
  const h = ["Customer Type", "First Name", "Last Name", "Company Name"];
  for (let i = 1; i <= phones; i++) h.push(`Phone ${i} Label`, `Phone ${i}`);
  for (let i = 1; i <= emails; i++) h.push(`Email ${i} Label`, `Email ${i}`);
  for (let i = 1; i <= addresses; i++)
    h.push(`Address ${i} Label`, `Address ${i} Street`, `Address ${i} Unit`, `Address ${i} City`,
      `Address ${i} State`, `Address ${i} Postal Code`, `Address ${i} Country`);
  h.push("Notes");
  return h;
}

export const SAMPLE_ROWS = [
  exportHeaders(2, 2, 1),
  ["Residential", "Maria", "Lopez", "", "Mobile", "(214) 555-0123", "Home", "(972) 555-0199", "Main", "maria@email.com", "", "",
    "Home", "1200 Elm St", "Apt 4B", "Carrollton", "TX", "75006", "US", "Gate code 1234"],
  ["Commercial", "Jose", "Ramirez", "Taqueria El Sol", "Office", "(469) 555-0100", "Mobile", "+52 33 1234 5678", "Quotes", "compras@elsol.com", "Invoices", "pagos@elsol.com",
    "Main store", "500 Main St", "", "Dallas", "TX", "75201", "US", ""],
];

// ---------- Reconocer columnas automáticamente ----------
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const SIMPLE: Record<string, string> = {
  customertype: "type", type: "type", customersubtype: "type", clienttype: "type",
  firstname: "first_name", givenname: "first_name", contactfirstname: "first_name", nombre: "first_name",
  lastname: "last_name", surname: "last_name", familyname: "last_name", contactlastname: "last_name", apellido: "last_name", apellidos: "last_name",
  name: "full_name", fullname: "full_name", contactname: "full_name", customername: "full_name", displayname: "full_name", nombrecompleto: "full_name",
  company: "company_name", companyname: "company_name", businessname: "company_name", business: "company_name", empresa: "company_name", organization: "company_name",
  notes: "notes", note: "notes", comments: "notes", remarks: "notes", notas: "notes",
};

const ADDRESS_ALIASES: Record<string, string> = {
  street: "street", address: "street", streetaddress: "street", addressline1: "street", address1: "street", street1: "street", direccion: "street",
  unit: "unit", apt: "unit", suite: "unit", addressline2: "unit", street2: "unit", apartment: "unit",
  city: "city", town: "city", ciudad: "city",
  state: "state", province: "state", region: "state", stateprovince: "state", estado: "state",
  zip: "zip", zipcode: "zip", postalcode: "zip", postcode: "zip", code: "zip", codigopostal: "zip",
  country: "country", pais: "country",
  label: "label", attention: "label",
};

function addressTarget(h: string): string | null {
  const m = h.match(/^address([1-9])(label|street|unit|city|state|postalcode|zip|country)$/);
  if (m) return `addr${m[1]}:${m[2] === "postalcode" ? "zip" : m[2]}`;
  for (const [prefix, slot] of [["billing", 1], ["service", 1], ["shipping", 2]] as const) {
    if (h.startsWith(prefix)) {
      const part = ADDRESS_ALIASES[h.slice(prefix.length)];
      if (part && part !== "label") return `addr${slot}:${part}`;
    }
  }
  const part = ADDRESS_ALIASES[h];
  return part && part !== "label" ? `addr1:${part}` : null;
}

export function phoneLabelFromHeader(h: string) {
  const n = norm(h);
  if (/mobile|cell|celular|movil/.test(n)) return "Mobile";
  if (/fax/.test(n)) return "Fax";
  if (/home|casa/.test(n)) return "Home";
  if (/office|oficina/.test(n)) return "Office";
  if (/work|business|trabajo/.test(n)) return "Work";
  return "Main";
}

export function emailLabelFromHeader(h: string) {
  const n = norm(h);
  if (/quote|cotiza/.test(n)) return "Quotes";
  if (/invoice|factura/.test(n)) return "Invoices";
  if (/bill|pago/.test(n)) return "Billing";
  if (/work/.test(n)) return "Work";
  if (/personal/.test(n)) return "Personal";
  return "Main";
}

export function autoMap(headers: string[]): string[] {
  const used = new Set<string>();
  const take = (k: string | null) => (k && !used.has(k) ? (used.add(k), k) : "");
  let phoneSlot = 0;
  let emailSlot = 0;

  // Primero las columnas exactas de nuestra exportación (Phone 1, Email 2 Label...)
  const result = headers.map((raw) => {
    const h = norm(raw);
    let m = h.match(/^phone([1-9])(label)?$/);
    if (m) return take(`${m[2] ? "phoneLabel" : "phone"}:${m[1]}`);
    m = h.match(/^email([1-9])(label)?$/);
    if (m) return take(`${m[2] ? "emailLabel" : "email"}:${m[1]}`);
    return null;
  });
  for (const k of Array.from(used)) {
    const [kind, n] = k.split(":");
    if (kind === "phone") phoneSlot = Math.max(phoneSlot, +n);
    if (kind === "email") emailSlot = Math.max(emailSlot, +n);
  }

  return headers.map((raw, i) => {
    if (result[i] !== null) return result[i] as string;
    const h = norm(raw);
    if (SIMPLE[h]) return take(SIMPLE[h]);
    const addr = addressTarget(h);
    if (addr) return take(addr);
    if (/phone|mobile|cell|fax|telephone|telefono|celular/.test(h) && phoneSlot < SLOTS.phone) return take(`phone:${++phoneSlot}`);
    if (/email|mail|correo/.test(h) && emailSlot < SLOTS.email) return take(`email:${++emailSlot}`);
    return "";
  });
}

// ---------- Convertir un renglón del archivo en un cliente ----------
export type ImportRow = {
  row: number;
  name: string;
  error?: string;
  warnings: string[];
  payload?: {
    row: number;
    customer: Record<string, string>;
    phones: { label: string; country: string; dial_code: string; number: string; is_primary: boolean }[];
    emails: { label: string; email: string; is_primary: boolean }[];
    addresses: Record<string, string | boolean | null>[];
  };
};

const COUNTRY_BY_NAME = new Map(COUNTRIES.flatMap((c) => [[norm(c.name), c.code], [norm(c.code), c.code]]));
COUNTRY_BY_NAME.set("usa", "US"); COUNTRY_BY_NAME.set("unitedstatesofamerica", "US");
COUNTRY_BY_NAME.set("mexico", "MX"); COUNTRY_BY_NAME.set("espana", "ES"); COUNTRY_BY_NAME.set("uk", "GB");

function parseCountry(v: string) {
  return v.trim() ? COUNTRY_BY_NAME.get(norm(v)) ?? "US" : "US";
}

function parseState(country: string, v: string) {
  const t = v.trim();
  if (!t) return "";
  const list = subdivisions(country);
  const hit = list.find(([value, label]) => norm(value) === norm(t) || norm(label) === norm(t));
  return hit ? hit[0] : t;
}

const DIALS = COUNTRIES.filter((c) => c.dial).sort((a, b) => b.dial.length - a.dial.length);

function parsePhone(v: string) {
  // Zoho antepone un apóstrofo y usa guion (p. ej. '+1-9404844444)
  const t = v.trim().replace(/^'+/, "").trim();
  if (!t) return null;
  if (t.startsWith("+") || t.startsWith("00")) {
    const digits = t.replace(/\D/g, "").replace(/^00/, "");
    if (digits.startsWith("1") && digits.length === 11) return { country: "US", number: formatPhone(digits.slice(1)) };
    const c = DIALS.find((x) => digits.startsWith(x.dial.slice(1)) && x.code !== "US");
    if (c) {
      const rest = t.replace(/^(\+|00)\s*/, "").replace(c.dial.slice(1), "").trim().replace(/^[\s.-]+/, "");
      return { country: c.code, number: formatPhoneFor(c.code, rest.replace(/[().]/g, " ")).trim() };
    }
  }
  return { country: "US", number: formatPhone(t) };
}

function parseType(v: string, hasCompany: boolean) {
  const n = norm(v);
  if (/commercial|business|company|comercial|negocio/.test(n)) return "commercial";
  if (/residential|individual|home|person|residencial/.test(n)) return "residential";
  return hasCompany ? "commercial" : "residential";
}

export function buildRow(cells: string[], mapping: string[], headers: string[], rowNumber: number): ImportRow {
  const get = (key: string) => {
    const i = mapping.indexOf(key);
    return i >= 0 ? (cells[i] ?? "").trim() : "";
  };
  const headerOf = (key: string) => headers[mapping.indexOf(key)] ?? "";
  const warnings: string[] = [];

  let first = get("first_name");
  let last = get("last_name");
  let company = get("company_name");
  const full = get("full_name");
  const type = parseType(get("type"), Boolean(company));

  if (!first && !last && full) {
    if (type === "commercial" && !company) company = full;
    else if (type === "residential" || full !== company) {
      const parts = full.split(/\s+/);
      first = parts.shift() ?? "";
      last = parts.join(" ");
    }
  }
  const finalType = type === "commercial" && !company ? (first || last ? "residential" : type) : type;
  const name = finalType === "commercial" ? company : `${first} ${last}`.trim();
  if (!name) return { row: rowNumber, name: "", error: "No name or company name", warnings };

  const phones: NonNullable<ImportRow["payload"]>["phones"] = [];
  for (let i = 1; i <= SLOTS.phone; i++) {
    const p = parsePhone(get(`phone:${i}`));
    if (!p) continue;
    const label = get(`phoneLabel:${i}`) || phoneLabelFromHeader(headerOf(`phone:${i}`));
    if (phoneError({ ...p, label, is_primary: false })) { warnings.push(`Phone "${get(`phone:${i}`)}" skipped`); continue; }
    phones.push({ label, country: p.country, dial_code: dialCode(p.country), number: p.number, is_primary: phones.length === 0 });
  }

  const emails: NonNullable<ImportRow["payload"]>["emails"] = [];
  for (let i = 1; i <= SLOTS.email; i++) {
    const e = get(`email:${i}`).replace(/\s/g, "").toLowerCase();
    if (!e) continue;
    const label = get(`emailLabel:${i}`) || emailLabelFromHeader(headerOf(`email:${i}`));
    if (emailError({ email: e, label, is_primary: false })) { warnings.push(`Email "${e}" skipped`); continue; }
    if (emails.some((x) => x.email === e)) continue;
    emails.push({ label, email: e, is_primary: emails.length === 0 });
  }

  const addresses: Record<string, string | boolean | null>[] = [];
  for (let i = 1; i <= SLOTS.address; i++) {
    const street = get(`addr${i}:street`);
    const city = get(`addr${i}:city`);
    if (!street && !city) continue;
    if (!street || !city) { warnings.push(`Address ${i} skipped (needs street and city)`); continue; }
    const country = parseCountry(get(`addr${i}:country`));
    addresses.push({
      label: get(`addr${i}:label`) || null,
      street,
      unit: get(`addr${i}:unit`) || null,
      city,
      state: parseState(country, get(`addr${i}:state`)) || null,
      zip: cleanPostal(country, get(`addr${i}:zip`)) || null,
      country,
      is_primary: addresses.length === 0,
    });
  }

  return {
    row: rowNumber,
    name,
    warnings,
    payload: {
      row: rowNumber,
      customer: {
        customer_type: finalType,
        first_name: first,
        last_name: last,
        company_name: finalType === "commercial" ? company : "",
        notes: get("notes"),
      },
      phones,
      emails,
      addresses,
    },
  };
}

export function countryLabel(code: string) {
  return getCountry(code).name;
}
