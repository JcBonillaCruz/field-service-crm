import { TemplateFormPage } from "@/components/templates/TemplatePages";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  return <TemplateFormPage base="/dashboard/settings/templates" id={params.id} />;
}
