"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setCurrentCompany } from "@/lib/types";
import { ROLE_INFO, teamError } from "@/lib/team";
import CreateCompanyForm from "@/components/CreateCompanyForm";

type PendingInvite = { token: string; company_name: string; role: string; invited_by_name: string | null };

// Primera vez sin compañía:
//   · Si lo invitaron (técnico, oficina…) → "Únete a {compañía}" (no le pedimos crear una compañía)
//   · Si no → asistente de 3 pasos para crear su compañía
export default function NoCompanyWelcome({ firstName, invites }: { firstName: string; invites: PendingInvite[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(invites.length === 0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function join(i: PendingInvite) {
    setBusy(i.token); setError("");
    const { data, error: err } = await createClient().rpc("accept_invite", { p_token: i.token });
    if (err || !data) { setBusy(null); return setError(teamError(err)); }
    setCurrentCompany(data as string);
    router.push(i.role === "technician" ? "/dashboard/inventory/van" : "/dashboard");
    router.refresh();
  }

  return (
    <section className="relative mx-auto max-w-xl px-5 py-10 sm:py-14">
      {/* Fondo con formas suaves */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-10 -z-10 h-72 overflow-hidden">
        <span className="absolute -left-10 top-6 h-48 w-48 rounded-full bg-[#14a39a]/15 blur-2xl animate-[bp-float_9s_ease-in-out_infinite]" />
        <span className="absolute right-0 top-16 h-40 w-40 rounded-full bg-[#e8713a]/15 blur-2xl animate-[bp-float_11s_ease-in-out_infinite_reverse]" />
      </div>
      <p className="text-[13px] font-semibold uppercase tracking-wide text-[#0f766e] animate-[bp-fade_0.4s_ease-out]">Welcome to BrightPro</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#0b1f3a] animate-[bp-fade_0.5s_ease-out]">Hi {firstName || "there"} 👋</h1>

      {!creating ? (
        <>
          <p className="mt-2 text-slate-500">You&apos;ve been invited to a team. Join to start working.</p>
          <div className="mt-7 space-y-3">
            {invites.map((i) => {
              const role = ROLE_INFO[i.role as keyof typeof ROLE_INFO];
              return (
                <div key={i.token} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,40,60,0.06)] animate-[bp-pop-in_0.35s_ease-out]">
                  <p className="text-[18px] font-semibold text-[#0b1f3a]">{i.company_name}</p>
                  <p className="mt-0.5 text-[14px] text-slate-500">{i.invited_by_name ? `${i.invited_by_name} invited you` : "You were invited"} as <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${role?.tone ?? ""}`}>{role?.label ?? i.role}</span></p>
                  <button type="button" onClick={() => join(i)} disabled={busy !== null}
                    className="mt-4 w-full rounded-lg bg-[#0f766e] py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#0c5f59] disabled:opacity-60">
                    {busy === i.token ? "Joining..." : `Join ${i.company_name}`}
                  </button>
                </div>
              );
            })}
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
          <p className="mt-6 text-center text-[13.5px] text-slate-500">
            Do you own a business? <button type="button" onClick={() => setCreating(true)} className="font-semibold text-[#0f766e] hover:underline">Create your own company</button>
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-slate-500">Let&apos;s set up your company. It takes less than a minute.</p>
          <div className="mt-7 rounded-2xl bg-white p-6 shadow-[0_12px_40px_rgba(15,40,60,0.07)] sm:p-8">
            <CreateCompanyForm onCancel={invites.length ? () => setCreating(false) : undefined} />
          </div>
        </>
      )}
    </section>
  );
}
