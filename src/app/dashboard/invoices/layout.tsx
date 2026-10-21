import { SalesLayout } from "@/components/sales/SalesPages";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <SalesLayout module="invoices">{children}</SalesLayout>;
}
