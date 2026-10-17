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

export const INDUSTRY_GROUPS: { group: string; items: string[] }[] = [
  {
    group: "Home services",
    items: [
      "HVAC", "Plumbing", "Electrical", "Roofing", "General contractor", "Handyman",
      "Painting", "Flooring", "Remodeling", "Garage doors", "Appliance repair",
      "Locksmith", "Pool service", "Solar installation", "Security systems",
    ],
  },
  {
    group: "Cleaning & restoration",
    items: [
      "Residential cleaning", "Commercial cleaning", "Carpet cleaning", "Window cleaning",
      "Pressure washing", "Water damage restoration", "Mold remediation",
      "Fire & smoke restoration", "Junk removal", "Pest control",
    ],
  },
  {
    group: "Outdoor",
    items: ["Landscaping", "Lawn care", "Tree service", "Irrigation", "Fencing", "Concrete"],
  },
  {
    group: "Auto & moving",
    items: ["Auto repair", "Mobile mechanic", "Auto detailing", "Towing", "Moving"],
  },
  {
    group: "Health",
    items: [
      "Medical practice", "Dental office", "Chiropractic", "Physical therapy",
      "Mental health", "Home health care", "Veterinary",
    ],
  },
  {
    group: "Professional services",
    items: [
      "Law firm", "Accounting & tax", "Insurance agency", "Real estate",
      "Property management", "Consulting", "IT services", "Marketing / SEO",
      "Web design", "Photography & video",
    ],
  },
  {
    group: "Personal care & lifestyle",
    items: [
      "Beauty salon", "Barbershop", "Spa & massage", "Nail salon",
      "Fitness & personal training", "Pet grooming",
    ],
  },
  {
    group: "Food, events & education",
    items: ["Restaurant", "Catering", "Food truck", "Event planning", "Tutoring", "Childcare"],
  },
  { group: "Other", items: ["Retail store", "Nonprofit", "Other"] },
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

export function formatPhone(value: string) {
  const d = value.replace(/\D/g, "").replace(/^1(?=\d{10})/, "").slice(0, 10);
  if (d.length === 0) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
