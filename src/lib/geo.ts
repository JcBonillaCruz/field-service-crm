import { COUNTRIES, Country, SUBDIVISIONS } from "@/lib/geo-data";

export { COUNTRIES };

// Países que más usan nuestros clientes: salen arriba en las listas
export const PINNED_COUNTRIES = ["US", "MX", "SV", "ES"];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function getCountry(code: string | null | undefined): Country {
  return BY_CODE.get((code || "US").toUpperCase()) ?? BY_CODE.get("US")!;
}

export function countryName(code: string | null | undefined) {
  return getCountry(code).name;
}

export function dialCode(code: string | null | undefined) {
  return getCountry(code).dial || "+1";
}

export function subdivisions(code: string | null | undefined): [string, string][] {
  return SUBDIVISIONS[(code || "US").toUpperCase()] ?? [];
}

export function subdivisionName(country: string, value: string | null | undefined) {
  if (!value) return "";
  return subdivisions(country).find(([v]) => v === value)?.[1] ?? value;
}

export function stateLabel(country: string) {
  switch (country) {
    case "US":
    case "MX":
    case "AU":
    case "BR":
      return "State";
    case "CA":
    case "ES":
    case "AR":
      return "Province";
    case "SV":
    case "GT":
    case "HN":
    case "CO":
      return "Department";
    default:
      return "State / Province";
  }
}

export function postalLabel(country: string) {
  return country === "US" ? "ZIP" : "Postal code";
}

export function postalPlaceholder(country: string) {
  switch (country) {
    case "US": return "75006";
    case "MX": return "44100";
    case "ES": return "28001";
    case "CA": return "M5V 2T6";
    default: return "";
  }
}

export function cleanPostal(country: string, value: string) {
  if (country === "US") return value.replace(/[^\d-]/g, "").slice(0, 10);
  if (country === "MX" || country === "ES") return value.replace(/\D/g, "").slice(0, 5);
  return value.toUpperCase().replace(/[^A-Z0-9 -]/g, "").slice(0, 10);
}

export function postalError(country: string, value: string) {
  const v = value.trim();
  if (!v) return "";
  if (country === "US" && !/^\d{5}(-\d{4})?$/.test(v)) return "ZIP code must be 5 digits.";
  if ((country === "MX" || country === "ES") && !/^\d{5}$/.test(v)) return "Postal code must be 5 digits.";
  return "";
}

// Teléfonos: Estados Unidos y Canadá usan el formato (214) 555-0123
export function usesNanpFormat(country: string) {
  return country === "US" || country === "CA";
}
