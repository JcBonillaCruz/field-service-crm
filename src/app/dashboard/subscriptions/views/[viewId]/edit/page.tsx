import { EditViewPage } from "@/components/sales/SalesPages";

export default function Page({ params }: { params: { viewId: string } }) {
  return <EditViewPage module="subscriptions" viewId={params.viewId} />;
}
