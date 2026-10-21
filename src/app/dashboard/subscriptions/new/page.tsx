import { NewSubPage } from "@/components/sales/SalesPages";

export default function Page({ searchParams }: { searchParams: { clone?: string; customer?: string } }) {
  return <NewSubPage searchParams={searchParams} />;
}
