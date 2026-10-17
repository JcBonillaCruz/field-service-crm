export type Role = "owner" | "manager" | "office" | "technician";

export type CompanySummary = {
  id: string;
  name: string;
  industry: string | null;
  role: Role;
};

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  office: "Office",
  technician: "Technician",
};

export const INDUSTRIES = [
  "HVAC",
  "Cleaning",
  "Water damage restoration",
  "Plumbing",
  "Electrical",
  "Landscaping",
  "Marketing / SEO",
  "Other",
];

export const COMPANY_COOKIE = "bp_company";

export function initials(text: string) {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function setCurrentCompany(id: string) {
  document.cookie = `${COMPANY_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
}
