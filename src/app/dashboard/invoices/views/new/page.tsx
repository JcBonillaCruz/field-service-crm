import { NewViewPage } from "@/components/sales/SalesPages";

export default function Page({ searchParams }: { searchParams: { from?: string } }) {
  return <NewViewPage module="invoices" from={searchParams.from} />;
}
