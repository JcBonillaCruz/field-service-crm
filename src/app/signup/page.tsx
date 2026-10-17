"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] placeholder:text-slate-400 focus:bg-white focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15";

export default function SignUpPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return setError("Enter your full name.");
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (!agree) return setError("Accept the Terms of Service to continue.");

    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);

    if (error) {
      if (error.message.toLowerCase().includes("rate limit")) {
        return setError("Too many sign-up emails were sent. Wait a few minutes and try again.");
      }
      return setError(error.message);
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
          <h1 className="mt-5 text-[1.75rem] font-semibold text-[#0b1f3a] tracking-tight">Check your email</h1>
          <p className="mt-2 text-slate-600 leading-relaxed">
            We sent a confirmation link to <span className="font-medium text-slate-800">{email}</span>.
            Open it to activate your BrightPro account.
          </p>
          <p className="mt-4 text-sm text-slate-500">Can&apos;t find it? Look in your spam or promotions folder.</p>
          <Link href="/" className="mt-8 inline-block text-sm font-semibold text-[#0f766e] hover:underline">Back to sign in</Link>
        </div>
      ) : (
        <>
          <h1 className="mt-8 text-[1.75rem] font-semibold text-[#0b1f3a] tracking-tight">Create your account</h1>
          <p className="mt-1 text-slate-500">Start free. No credit card needed.</p>

          <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
            <div>
              <label htmlFor="name" className="sr-only">Full name</label>
              <input id="name" autoComplete="name" placeholder="Full name" value={fullName}
                onChange={(e) => { setFullName(e.target.value); setError(""); }} className={inputClass} />
            </div>
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input id="email" type="email" autoComplete="email" placeholder="Email address" value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }} className={inputClass} />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input id="password" type="password" autoComplete="new-password" placeholder="Password (8+ characters)" value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }} className={inputClass} />
            </div>

            <label className="flex items-start gap-3 text-sm text-slate-600">
              <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setError(""); }}
                className="mt-0.5 h-4 w-4 accent-[#0f766e]" />
              <span>I agree to the Terms of Service and Privacy Policy.</span>
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-[#0f766e] py-3 text-[15px] font-semibold text-white hover:bg-[#0c5f59] transition-colors disabled:opacity-60">
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-8 text-sm text-slate-600">
            Already have an account?{" "}
            <Link href="/" className="font-semibold text-[#0f766e] hover:underline">Sign in</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
