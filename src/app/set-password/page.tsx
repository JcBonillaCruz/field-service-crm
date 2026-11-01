"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { createClient } from "@/lib/supabase/client";

// Primera vez que entra alguien con la contraseña temporal que le dio el dueño: crea la suya (el dueño ya no la sabe)
export default function SetPasswordPage() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError("Use at least 8 characters.");
    if (/^bright-\d{4}-/i.test(pw)) return setError("Choose a new password, not the temporary one.");
    if (pw !== pw2) return setError("The passwords don't match.");
    setBusy(true); setError("");
    const { error: err } = await createClient().auth.updateUser({ password: pw, data: { must_change_password: false } });
    setBusy(false);
    if (err) return setError(err.message.includes("different") ? "Choose a password different from the temporary one." : "It couldn't be saved. Try again.");
    router.replace("/dashboard"); router.refresh();
  }

  const input = "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15";
  return (
    <AuthShell>
      <Image src="/logo-brightpro.png" alt="BrightPro" width={160} height={44} priority className="h-9 w-auto" />
      <form onSubmit={submit} noValidate className="mt-10">
        <h1 className="text-[26px] font-semibold text-[#0b1f3a]">Create your password</h1>
        <p className="mt-2 text-[15px] text-slate-500">You signed in with a temporary password. Choose your own so only you can use your account.</p>
        <label className="mt-7 block text-sm font-medium text-slate-700">New password
          <input type={show ? "text" : "password"} autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setError(""); }} className={`${input} mt-1.5`} />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700">Repeat it
          <input type={show ? "text" : "password"} autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setError(""); }} className={`${input} mt-1.5`} />
        </label>
        <label className="mt-3 flex items-center gap-2 text-[14px] text-slate-600"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="accent-[#0f766e]" /> Show password</label>
        {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="mt-6 w-full rounded-lg bg-[#0f766e] py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-60">{busy ? "Saving..." : "Save and continue"}</button>
      </form>
    </AuthShell>
  );
}
