import { EditDocPage } from "@/components/sales/SalesPages";

export default function Page({ params }: { params: { id: string } }) {
  return <EditDocPage kind="invoice" id={params.id} />;
}
