"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] placeholder:text-slate-400 focus:bg-white focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15";

export default function SignUpPage() {
  const t = useTranslations("auth");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  // Invitaciones: llega con ?next=/join/…&email=…&name=… → se llenan solos y al confirmar regresa a la invitación
  const [qs, setQs] = useState("");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQs(window.location.search);
    if (p.get("email")) setEmail(p.get("email") as string);
    if (p.get("name")) setFullName(p.get("name") as string);
  }, []);
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return setError(t("eName"));
    if (!email.includes("@")) return setError(t("eEmail"));
    if (password.length < 8) return setError(t("ePwShort"));
    if (!agree) return setError(t("eTerms"));

    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: (() => {
          const next = new URLSearchParams(window.location.search).get("next");
          return `${window.location.origin}/auth/callback${next && next.startsWith("/") && !next.startsWith("//") ? `?next=${encodeURIComponent(next)}` : ""}`;
        })(),
      },
    });
    setLoading(false);

    if (error) {
      if (error.message.toLowerCase().includes("rate limit")) {
        return setError(t("eRate"));
      }
      return setError(error.message.toLowerCase().includes("already") ? t("eExists") : /password/i.test(error.message) ? t("ePwWeak") : t("eSignUp"));
    }
    setSent(true);
  }

  return (
    <AuthShell>
      <Image src="/logo-brightpro.png" alt="BrightPro" width={160} height={44} priority className="h-9 w-auto" />

      {sent ? (
        <div className="mt-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d6f3ec]">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="#0f766e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" />
            </svg>
          </div>
          <h1 className="mt-5 text-[1.75rem] font-semibold text-[#0b1f3a] tracking-tight">{t("checkEmail")}</h1>
          <p className="mt-2 text-slate-600 leading-relaxed">
            {t.rich("sentTo", { email, b: (c) => <span className="font-medium text-slate-800">{c}</span> })}
          </p>
          <p className="mt-4 text-sm text-slate-500">{t("spam")}</p>
          <Link prefetch={false} href="/" className="mt-8 inline-block text-sm font-semibold text-[#0f766e] hover:underline">{t("backSignIn")}</Link>
        </div>
      ) : (
        <>
          <h1 className="mt-8 text-[1.75rem] font-semibold text-[#0b1f3a] tracking-tight">{t("createTitle")}</h1>
          <p className="mt-1 text-slate-500">{t("createSub")}</p>

          <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
            <div>
              <label htmlFor="name" className="sr-only">{t("fullName")}</label>
              <input id="name" autoComplete="name" placeholder={t("fullName")} value={fullName}
                onChange={(e) => { setFullName(e.target.value); setError(""); }} className={inputClass} />
            </div>
            <div>
              <label htmlFor="email" className="sr-only">{t("email")}</label>
              <input id="email" type="email" autoComplete="email" placeholder={t("email")} value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }} className={inputClass} />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">{t("password")}</label>
              <input id="password" type="password" autoComplete="new-password" placeholder={t("passwordNew")} value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }} className={inputClass} />
            </div>

            <label className="flex items-start gap-3 text-sm text-slate-600">
              <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setError(""); }}
                className="mt-0.5 h-4 w-4 accent-[#0f766e]" />
              <span>{t("agree")}</span>
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-[#0f766e] py-3 text-[15px] font-semibold text-white hover:bg-[#0c5f59] transition-colors disabled:opacity-60">
              {loading ? t("creating") : t("create")}
            </button>
          </form>

          <p className="mt-8 text-sm text-slate-600">
            {t("haveAccount")}{" "}
            <Link prefetch={false} href={`/${qs}`} className="font-semibold text-[#0f766e] hover:underline">{t("signIn")}</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
