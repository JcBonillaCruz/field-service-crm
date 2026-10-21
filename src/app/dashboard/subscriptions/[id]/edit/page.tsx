import { EditSubPage } from "@/components/sales/SalesPages";

export default function Page({ params }: { params: { id: string } }) {
  return <EditSubPage id={params.id} />;
}
