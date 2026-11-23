import { TemplatesListPage } from "@/components/templates/TemplatePages";

export const dynamic = "force-dynamic";

// Paso 6.10: plantillas de cotización y de trabajo
export default function Page() {
  return <TemplatesListPage base="/dashboard/settings/templates" />;
}
