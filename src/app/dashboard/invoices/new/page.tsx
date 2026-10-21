import { NewDocPage } from "@/components/sales/SalesPages";

export default function Page({ searchParams }: { searchParams: { clone?: string; customer?: string } }) {
  return <NewDocPage kind="invoice" searchParams={searchParams} />;
}
