import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { DocKind, SalesDoc, SalesLine, SalesModule, Subscription, canManageSales } from "@/lib/sales";
import { findView, loadViews } from "@/lib/catalog-server";
import { loadDoc, loadFormData, loadPrefs, loadSubscription } from "@/lib/sales-server";
import { Row } from "@/lib/catalog-views";
import NoAccess from "@/components/customers/NoAccess";
import ViewForm from "@/components/catalog/ViewForm";
import SalesWorkspace from "@/components/sales/SalesWorkspace";
import DocForm from "@/components/sales/DocForm";
import DocDetail from "@/components/sales/DocDetail";
import SubscriptionForm from "@/components/sales/SubscriptionForm";
import SubscriptionDetail from "@/components/sales/SubscriptionDetail";

async function guard() {
  const s = await getSession();
  if (!s.current) redirect("/dashboard");
  return s as typeof s & { current: NonNullable<typeof s.current> };
}
const actorOf = (u: { fullName: string; email: string }) => u.fullName || u.email;

export async function SalesLayout({ module, children }: { module: SalesModule; children: React.ReactNode }) {
  const { supabase, current } = await guard();
  if (!canManageSales(current.role)) return <NoAccess />;
  const rowsQ = module === "subscriptions"
    ? supabase.from("subscriptions").select("*").eq("company_id", current.id).order("created_at", { ascending: false }).limit(5000)
    : supabase.from("sales_docs").select("*").eq("company_id", current.id).eq("kind", module === "quotes" ? "quote" : "invoice").order("created_at", { ascending: false }).limit(5000);
  const [{ data }, views, prefs] = await Promise.all([rowsQ, loadViews(supabase, current.id, module), loadPrefs(supabase, current.id)]);
  return (
    <SalesWorkspace module={module} rows={(data ?? []) as Row[]} customViews={views} companyId={current.id} prefs={prefs}>
      {children}
    </SalesWorkspace>
  );
}

export async function NewDocPage({ kind, searchParams }: { kind: DocKind; searchParams: { clone?: string; customer?: string } }) {
  const { supabase, current, user } = await guard();
  if (!canManageSales(current.role)) return <NoAccess />;
  const form = await loadFormData(supabase, current.id);
  let doc: SalesDoc | null = null; let lines: SalesLine[] = [];
  if (searchParams.clone) {
    const d = await loadDoc(supabase, current.id, kind, searchParams.clone);
    if (d) { doc = d.doc; lines = d.lines; }
  }
  return <DocForm kind={kind} companyId={current.id} actor={actorOf(user)} {...form} doc={doc} lines={lines} clone={Boolean(doc)} presetCustomer={searchParams.customer} />;
}

export async function EditDocPage({ kind, id }: { kind: DocKind; id: string }) {
  const { supabase, current, user } = await guard();
  if (!canManageSales(current.role)) return <NoAccess />;
  const [d, form] = await Promise.all([loadDoc(supabase, current.id, kind, id), loadFormData(supabase, current.id)]);
  if (!d) notFound();
  return <DocForm kind={kind} companyId={current.id} actor={actorOf(user)} {...form} doc={d.doc} lines={d.lines} />;
}

export async function DocPage({ kind, id }: { kind: DocKind; id: string }) {
  const { supabase, current, user } = await guard();
  if (!canManageSales(current.role)) return <NoAccess />;
  const d = await loadDoc(supabase, current.id, kind, id);
  if (!d) notFound();
  return <DocDetail data={d} actor={actorOf(user)} />;
}

export async function NewSubPage({ searchParams }: { searchParams: { clone?: string; customer?: string } }) {
  const { supabase, current, user } = await guard();
  if (!canManageSales(current.role)) return <NoAccess />;
  const form = await loadFormData(supabase, current.id);
  let sub: Subscription | null = null; let lines: SalesLine[] = [];
  if (searchParams.clone) {
    const d = await loadSubscription(supabase, current.id, searchParams.clone);
    if (d) { sub = d.sub; lines = d.lines; }
  }
  return <SubscriptionForm companyId={current.id} actor={actorOf(user)} {...form} sub={sub} lines={lines} clone={Boolean(sub)} presetCustomer={searchParams.customer} />;
}

export async function EditSubPage({ id }: { id: string }) {
  const { supabase, current, user } = await guard();
  if (!canManageSales(current.role)) return <NoAccess />;
  const [d, form] = await Promise.all([loadSubscription(supabase, current.id, id), loadFormData(supabase, current.id)]);
  if (!d) notFound();
  return <SubscriptionForm companyId={current.id} actor={actorOf(user)} {...form} sub={d.sub} lines={d.lines} />;
}

export async function SubPage({ id }: { id: string }) {
  const { supabase, current, user } = await guard();
  if (!canManageSales(current.role)) return <NoAccess />;
  const [d, prefs] = await Promise.all([loadSubscription(supabase, current.id, id), loadPrefs(supabase, current.id)]);
  if (!d) notFound();
  return <SubscriptionDetail data={d} prefs={prefs} actor={actorOf(user)} />;
}

export async function NewViewPage({ module, from }: { module: SalesModule; from?: string }) {
  const { supabase, current } = await guard();
  if (!canManageSales(current.role)) return <NoAccess />;
  const src = from ? await findView(supabase, current.id, module, from) : null;
  return <ViewForm module={module} companyId={current.id} from={src ?? undefined} />;
}

export async function EditViewPage({ module, viewId }: { module: SalesModule; viewId: string }) {
  const { supabase, current } = await guard();
  if (!canManageSales(current.role)) return <NoAccess />;
  const view = await findView(supabase, current.id, module, viewId);
  if (!view || view.builtin) notFound();
  return <ViewForm module={module} companyId={current.id} view={view} />;
}
