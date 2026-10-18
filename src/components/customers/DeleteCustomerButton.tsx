"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeleteCustomerButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(`Delete ${name} and all their addresses? This can't be undone.`)) return;
    setBusy(true);
    const { error } = await createClient().from("customers").delete().eq("id", id);
    setBusy(false);
    if (error) return alert("The customer couldn't be deleted. Try again.");
    router.push("/dashboard/customers");
    router.refresh();
  }

  return (
    <button type="button" onClick={remove} disabled={busy}
      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-60">
      {busy ? "Deleting..." : "Delete customer"}
    </button>
  );
}
