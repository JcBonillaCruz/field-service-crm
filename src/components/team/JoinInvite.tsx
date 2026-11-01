"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { createClient } from "@/lib/supabase/client";
import { setCurrentCompany } from "@/lib/types";
import { ROLE_INFO, teamError } from "@/lib/team";

type Info = { company: string; logo: string | null; role: string; email: string; name: string | null; inviter: string | null };

// Aceptar la invitación: si no tiene cuenta la crea, si ya tiene entra, y queda en la compañía con su rol
export default function JoinInvite({ token, state, info, userEmail }: { token: string; state: "ok" | "missing" | "expired" | "revoked" | "used"; info: Info | null; userEmail: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next = `/join/${token}`;
  const q = info ? `?next=${encodeURIComponent(next)}&email=${encodeURIComponent(info.email)}${info.name ? `&name=${encodeURIComponent(info.name)}` : ""}` : "";
  const role = info ? ROLE_INFO[info.role as keyof typeof ROLE_INFO] : null;

  async function accept() {
    setBusy(true); setError("");
    const { data, error: err } = await createClient().rpc("accept_invite", { p_token: token });
    if (err || !data) { setBusy(false); return setError(teamError(err)); }
    setCurrentCompany(data as string);
    router.push(info?.role === "technician" ? "/dashboard/inventory/van" : "/dashboard");
    router.refresh();
  }
  async function switchAccount() {
    await createClient().auth.signOut();
    router.push(`/${q}`);
  }

  const bad = { missing: "This invitation link isn't valid.", expired: "This invitation expired.", revoked: "This invitation was cancelled.", used: "This invitation was already used." } as const;

  return (
    <AuthShell>
      <Image src="/logo-brightpro.png" alt="BrightPro" width={160} height={44} priority className="h-9 w-auto" />
      {state !== "ok" || !info ? (
        <div className="mt-10">
          <h1 className="text-2xl font-semibold text-[#0b1f3a]">{bad[state === "ok" ? "missing" : state]}</h1>
          <p className="mt-2 text-slate-500">Ask the person who invited you to send a new invitation.</p>
          <Link prefetch={false} href="/" className="mt-8 inline-block text-sm font-semibold text-[#0f766e] hover:underline">Go to sign in</Link>
        </div>
      ) : (
        <div className="mt-10">
          {info.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={info.logo} alt="" className="mb-5 max-h-14 w-auto" />
          )}
          <p className="text-[13px] font-semibold uppercase tracking-wide text-[#0f766e]">You&apos;re invited</p>
          <h1 className="mt-1 text-[26px] font-semibold leading-tight text-[#0b1f3a]">Join {info.company}</h1>
          <p className="mt-2 text-[15px] text-slate-600">{info.inviter ? `${info.inviter} invited you` : "You were invited"} to work with {info.company} on BrightPro.</p>
          {role && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-[#fafbfc] p-4">
              <span className={`rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold ${role.tone}`}>{role.label}</span>
              <ul className="mt-2 space-y-0.5">{role.can.map((c) => <li key={c} className="flex gap-1.5 text-[13.5px] text-slate-600"><span className="text-[#14a39a]">•</span>{c}</li>)}</ul>
            </div>
          )}
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {userEmail ? (
            <div className="mt-6 space-y-3">
              <button type="button" onClick={accept} disabled={busy} className="w-full rounded-lg bg-[#0f766e] py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-60">
                {busy ? "Joining..." : `Join ${info.company}`}
              </button>
              <p className="text-center text-[13px] text-slate-500">Signed in as <b>{userEmail}</b>{userEmail.toLowerCase() !== info.email.toLowerCase() && <> (the invitation was sent to {info.email})</>}. <button type="button" onClick={switchAccount} className="font-semibold text-[#0f766e] hover:underline">Use another account</button></p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              <Link prefetch={false} href={`/signup${q}`} className="block w-full rounded-lg bg-[#0f766e] py-3 text-center text-[15px] font-semibold text-white transition-colors hover:bg-[#0c5f59]">Create my account</Link>
              <Link prefetch={false} href={`/${q}`} className="block w-full rounded-lg border border-slate-200 py-3 text-center text-[15px] font-medium text-slate-700 hover:bg-slate-50">I already have an account</Link>
              <p className="text-center text-[13px] text-slate-500">Use <b>{info.email}</b> so we recognize you.</p>
            </div>
          )}
        </div>
      )}
    </AuthShell>
  );
}
