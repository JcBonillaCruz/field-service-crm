"use client";

import { confirmDelete } from "@/lib/confirm";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";

export default function DeleteCustomerButton({ id, name }: { id: string; name: string }) {
  const t = useTranslations("customers");
  const tu = useTranslations("custUi");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!(await confirmDelete({ title: t("delTitle", { name }), message: t("delMsg"),
      download: { filename: name, data: async () => (await createClient().from("customers").select("*, customer_addresses(*)").eq("id", id).maybeSingle()).data } }))) return;
    setBusy(true);
    const { error } = await createClient().from("customers").delete().eq("id", id);
    setBusy(false);
    if (error) return alert(tu("delFailRetry"));
    router.replace("/dashboard/customers");
    router.refresh();
  }

  return (
    <button type="button" onClick={remove} disabled={busy}
      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-60">
      {busy ? tu("deleting") : tu("deleteCustomer")}
    </button>
  );
}
