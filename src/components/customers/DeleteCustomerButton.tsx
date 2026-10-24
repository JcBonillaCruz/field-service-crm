"use client";

import { confirmDelete } from "@/lib/confirm";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeleteCustomerButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!(await confirmDelete({ title: `Delete ${name}?`, message: "The customer and all their addresses will be deleted and can't be recovered.",
      download: { filename: name, data: async () => (await createClient().from("customers").select("*, customer_addresses(*)").eq("id", id).maybeSingle()).data } }))) return;
    setBusy(true);
    const { error } = await createClient().from("customers").delete().eq("id", id);
    setBusy(false);
    if (error) return alert("The customer couldn't be deleted. Try again.");
    router.replace("/dashboard/customers");
    router.refresh();
  }

  return (
    <button type="button" onClick={remove} disabled={busy}
      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-60">
      {busy ? "Deleting..." : "Delete customer"}
    </button>
  );
}
