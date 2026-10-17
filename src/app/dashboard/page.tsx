import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  const firstName = (profile?.full_name || user.email || "").split(" ")[0];

  return (
    <main className="min-h-screen bg-[#f4f6f8]">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <Image src="/logo-brightpro.png" alt="BrightPro" width={140} height={38} className="h-8 w-auto" />
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-sm text-slate-500">{user.email}</span>
          <SignOutButton />
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-[#0b1f3a]">Welcome, {firstName}</h1>
        <p className="mt-2 text-slate-500">Your BrightPro account is active.</p>

        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-[#0b1f3a]">Create your first company</h2>
          <p className="mx-auto mt-2 max-w-md text-slate-500">
            Each company keeps its own customers, invoices and inventory. You&apos;ll be able to add as many as you need.
          </p>
          <p className="mt-6 text-sm text-slate-400">Coming in the next step</p>
        </div>
      </section>
    </main>
  );
}
