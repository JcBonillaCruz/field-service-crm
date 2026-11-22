"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import SocialButtons from "@/components/SocialButtons";
import { hideSplash, showSplash } from "@/lib/splash";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] placeholder:text-slate-400 focus:bg-white focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15";

export default function SignInPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  // Invitaciones: /?next=/join/… → después de entrar, regresa a la invitación
  const [qs, setQs] = useState("");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQs(window.location.search);
    if (p.get("email")) setEmail(p.get("email") as string);
  }, []);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return setError(t("eEmailSignIn"));
    if (!password) return setError(t("ePassword"));

    setLoading(true);
    setError("");
    showSplash(); // la bienvenida de BrightPro sale SOLO aquí, después de escribir tus datos
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      hideSplash();
      if (error.message.toLowerCase().includes("email not confirmed")) {
        return setError(t("eConfirm"));
      }
      return setError(t("eWrong"));
    }
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    router.refresh();
  }

  return (
    <AuthShell>
      <Image src="/logo-brightpro.png" alt="BrightPro" width={160} height={44} priority className="h-9 w-auto" />

      <h1 className="mt-8 text-[1.75rem] font-semibold text-[#0b1f3a] tracking-tight">{t("signIn")}</h1>
      <p className="mt-1 text-slate-500">{t("signInSub")}</p>

      <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
        <div>
          <label htmlFor="email" className="sr-only">{t("email")}</label>
          <input id="email" type="email" autoComplete="email" placeholder={t("email")} value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }} className={inputClass} />
        </div>

        <div className="relative">
          <label htmlFor="password" className="sr-only">{t("password")}</label>
          <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder={t("password")}
            value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} className={`${inputClass} pr-16`} />
          <button type="button" onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500 hover:text-slate-800">
            {showPassword ? t("hide") : t("show")}
          </button>
        </div>

        <div className="flex justify-end">
          <a href="#" className="text-sm font-medium text-[#0f766e] hover:underline">{t("forgot")}</a>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={loading}
          className="w-full rounded-lg bg-[#0f766e] py-3 text-[15px] font-semibold text-white hover:bg-[#0c5f59] transition-colors disabled:opacity-60">
          {loading ? t("signingIn") : t("signIn")}
        </button>
      </form>

      <SocialButtons />

      <p className="mt-8 text-sm text-slate-600">
        {t("noAccount")}{" "}
        <Link prefetch={false} href={`/signup${qs}`} className="font-semibold text-[#0f766e] hover:underline">{t("signUpNow")}</Link>
      </p>
    </AuthShell>
  );
}
