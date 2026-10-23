import NoAccess from "@/components/customers/NoAccess";
import ExpensesWorkspace from "@/components/expenses/ExpensesWorkspace";
import { loadLedger } from "@/lib/ledger-server";

export default async function ExpensesPage({ searchParams }: { searchParams?: { range?: string; from?: string; to?: string } }) {
  const r = await loadLedger("expense", searchParams);
  if (r.denied) return <NoAccess />;
  return <ExpensesWorkspace kind="expense" companyId={r.companyId} actor={r.actor} rows={r.rows} needsSql={r.needsSql} range={r.range} />;
}
