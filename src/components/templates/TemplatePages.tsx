import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import NoAccess from "@/components/customers/NoAccess";
import { canManageSales } from "@/lib/sales";
import { loadTemplateForm, loadTemplates } from "@/lib/templates-server";
import TemplatesView from "@/components/templates/TemplatesView";
import TemplateForm from "@/components/templates/TemplateForm";

// Paso 6.10: las mismas páginas viven en Settings (Finances) y en Jobs, cada una con su menú
export async function TemplatesListPage({ base }: { base: string }) {
  const { supabase, current } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageSales(current.role)) return <NoAccess />;
  const { list, types, needsSql } = await loadTemplates(supabase, current.id);
  return <TemplatesView base={base} list={list} needsSql={needsSql} typeNames={Object.fromEntries(types.map((x) => [x.id, x.name]))} />;
}

export async function TemplateFormPage({ base, id }: { base: string; id?: string }) {
  const { supabase, current, user } = await getSession();
  if (!current) redirect("/dashboard");
  if (!canManageSales(current.role)) return <NoAccess />;
  const data = await loadTemplateForm(supabase, current.id, id);
  if (id && !data.template) notFound();
  return <TemplateForm companyId={current.id} actor={user.fullName || user.email} base={base} template={data.template} items={data.items} types={data.types} canEdit />;
}
