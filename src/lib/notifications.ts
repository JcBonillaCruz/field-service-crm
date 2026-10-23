import { daysBetween, money, today } from "@/lib/sales";

export type NoticeKind = "overdue" | "due_today" | "due_soon" | "activity";
export type Notice = { id: string; key: string; kind: NoticeKind; title: string; body: string; href: string; when: string };

// Lo que devuelve la función get_company_notifications_digest (1 sola llamada a la base de datos)
export type Digest = {
  invoices: { id: string; number: string; customer_name: string; total: number; amount_paid: number; written_off: number; due_date: string; status: string }[];
  activity: { id: string; entity: string; entity_id: string; message: string; detail: string | null; created_at: string }[];
  reads: string[];
  version: string | null;
};

// Convierte el resumen en avisos. Clave de "leído": la actividad por evento; los vencimientos por día
// (si la factura sigue sin pagarse, mañana vuelve a avisar).
export function buildNotices(d: Digest): Notice[] {
  const t = today();
  const items: Notice[] = [];
  for (const inv of d.invoices ?? []) {
    const bal = Math.round((Number(inv.total) - Number(inv.amount_paid) - Number(inv.written_off)) * 100) / 100;
    if (bal <= 0 || !inv.due_date) continue;
    const days = daysBetween(t, inv.due_date);
    const href = `/dashboard/invoices/${inv.id}`;
    const body = `${inv.number} · ${inv.customer_name} · ${money(bal)}`;
    let n: Omit<Notice, "key"> | null = null;
    if (days < 0) n = { id: `o-${inv.id}`, kind: "overdue", title: `Invoice overdue by ${-days} ${days === -1 ? "day" : "days"}`, body, href, when: inv.due_date };
    else if (days === 0) n = { id: `t-${inv.id}`, kind: "due_today", title: "Invoice due today", body, href, when: inv.due_date };
    else if (days <= 2) n = { id: `s-${inv.id}`, kind: "due_soon", title: `Invoice due in ${days} ${days === 1 ? "day" : "days"}`, body, href, when: inv.due_date };
    if (n) items.push({ ...n, key: `${n.id}-${t}` });
  }
  for (const a of d.activity ?? []) {
    const id = `a-${a.id}`;
    items.push({ id, key: id, kind: "activity", title: a.message, body: a.detail ?? (a.entity === "quote" ? "Quote" : "Invoice"),
      href: `/dashboard/${a.entity === "quote" ? "quotes" : "invoices"}/${a.entity_id}`, when: a.created_at });
  }
  const rank: Record<NoticeKind, number> = { overdue: 0, due_today: 1, due_soon: 2, activity: 3 };
  items.sort((a, b) => rank[a.kind] - rank[b.kind] || (a.kind === "activity" ? b.when.localeCompare(a.when) : a.when.localeCompare(b.when)));
  const read = new Set(d.reads ?? []);
  return items.filter((n) => !read.has(n.key)).slice(0, 40);
}
