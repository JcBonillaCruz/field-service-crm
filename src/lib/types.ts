export type Role = "owner" | "manager" | "office" | "technician";

export type CompanySummary = {
  id: string;
  name: string;
  industry: string | null;
  role: Role;
  createdAt: string;
  logoUrl?: string | null; // logo de la compañía (Settings → Branding / Edit organization)
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

// Colores automáticos para iniciales (siempre el mismo color para la misma compañía o persona)
const SOFT_PALETTE = [
  { bg: "#d6f3ec", text: "#0f766e" }, // teal
  { bg: "#dbeafe", text: "#1d4ed8" }, // blue
  { bg: "#ede9fe", text: "#6d28d9" }, // violet
  { bg: "#fce7f3", text: "#be185d" }, // pink
  { bg: "#ffedd5", text: "#c2410c" }, // orange
  { bg: "#fef3c7", text: "#a16207" }, // amber
  { bg: "#dcfce7", text: "#15803d" }, // green
  { bg: "#e0f2fe", text: "#0369a1" }, // sky
  { bg: "#fee2e2", text: "#b91c1c" }, // red
  { bg: "#e2e8f0", text: "#334155" }, // slate
];

const SOLID_PALETTE = [
  "#0f766e", "#2563eb", "#7c3aed", "#db2777", "#ea580c",
  "#ca8a04", "#16a34a", "#0284c7", "#dc2626", "#475569",
];

function hash(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function softColor(seed: string | number) {
  const i = typeof seed === "number" ? seed : hash(seed);
  return SOFT_PALETTE[i % SOFT_PALETTE.length];
}

export const SOLID_COLORS = SOLID_PALETTE;
// Colores para una LISTA (celular y escritorio): cada cliente con un color distinto.
// No se repite ningún color hasta usar los 14, y nunca quedan dos parecidos juntos.
const LIST_PALETTE: [string, string][] = [
  ["#0f766e", "teal"], ["#2563eb", "blue"], ["#db2777", "pink"], ["#ea580c", "orange"],
  ["#7c3aed", "violet"], ["#16a34a", "green"], ["#dc2626", "red"], ["#ca8a04", "yellow"],
  ["#0891b2", "cyan"], ["#475569", "slate"], ["#c026d3", "fuchsia"], ["#65a30d", "lime"],
  ["#92400e", "brown"], ["#1e3a8a", "navy"],
];
const NEAR: Record<string, string[]> = {
  teal: ["green", "cyan"], green: ["teal", "lime"], lime: ["green", "yellow"], cyan: ["teal", "blue"],
  blue: ["navy", "cyan", "violet"], navy: ["blue", "slate"], violet: ["fuchsia", "blue"], fuchsia: ["violet", "pink"],
  pink: ["fuchsia", "red"], red: ["pink", "orange"], orange: ["red", "brown", "yellow"], brown: ["orange", "yellow"],
  yellow: ["brown", "lime", "orange"], slate: ["navy"],
};
export function listColors(seeds: string[]) {
  const N = LIST_PALETTE.length;
  const used = new Array(N).fill(0);
  let prev = -1;
  return seeds.map((sd) => {
    const start = hash(sd) % N;
    const low = Math.min(...used);
    const like = (k: number) => prev >= 0 && (k === prev || NEAR[LIST_PALETTE[prev][1]].includes(LIST_PALETTE[k][1]));
    let pick = -1;
    for (let t = 0; t < N && pick < 0; t++) { const k = (start + t) % N; if (used[k] === low && !like(k)) pick = k; }
    for (let t = 0; t < N && pick < 0; t++) { const k = (start + t) % N; if (used[k] === low) pick = k; }
    used[pick]++; prev = pick;
    return LIST_PALETTE[pick][0];
  });
}

export function solidColor(seed: string) {
  return SOLID_PALETTE[hash(seed) % SOLID_PALETTE.length];
}
