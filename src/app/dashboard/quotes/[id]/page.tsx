import { DocPage } from "@/components/sales/SalesPages";

export default function Page({ params }: { params: { id: string } }) {
  return <DocPage kind="quote" id={params.id} />;
}
