import { SubPage } from "@/components/sales/SalesPages";

export default function Page({ params }: { params: { id: string } }) {
  return <SubPage id={params.id} />;
}
