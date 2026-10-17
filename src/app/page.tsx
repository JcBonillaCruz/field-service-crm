"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const TEAL = "#0f766e";
const TEAL_LIGHT = "#14a39a";
const MINT = "#d6f3ec";
const INK = "#0b1f3a";

function InvoiceArt() {
  return (
    <svg viewBox="0 0 260 170" className="w-full h-full" aria-hidden="true">
      <ellipse cx="130" cy="150" rx="100" ry="10" fill="#eef2f6" />
      <rect x="70" y="18" width="120" height="128" rx="10" fill="#fff" stroke="#dbe4ea" />
      <rect x="86" y="34" width="44" height="8" rx="4" fill={INK} />
      <rect x="86" y="50" width="70" height="5" rx="2.5" fill="#cbd5e1" />
      <rect x="86" y="72" width="88" height="5" rx="2.5" fill="#e2e8f0" />
      <rect x="86" y="84" width="88" height="5" rx="2.5" fill="#e2e8f0" />
      <rect x="86" y="96" width="60" height="5" rx="2.5" fill="#e2e8f0" />
      <rect x="86" y="118" width="40" height="10" rx="5" fill={MINT} />
      <rect x="140" y="118" width="34" height="10" rx="5" fill={INK} />
      <circle cx="190" cy="44" r="24" fill={TEAL_LIGHT} />
      <path d="M179 44 L187 52 L202 37" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="62" cy="62" r="12" fill="#ff7a1a" opacity="0.9" />
      <text x="62" y="67" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">$</text>
    </svg>
  );
}

function VanArt() {
  return (
    <svg viewBox="0 0 260 170" className="w-full h-full" aria-hidden="true">
      <ellipse cx="130" cy="150" rx="100" ry="10" fill="#eef2f6" />
      <path d="M50 60 h110 a8 8 0 0 1 8 8 v66 h-118 a8 8 0 0 1 -8 -8 v-58 a8 8 0 0 1 8 -8z" fill="#fff" stroke="#dbe4ea" />
      <path d="M168 78 h26 l22 26 v30 h-48z" fill={TEAL} />
      <path d="M176 86 h16 l14 17 h-30z" fill="#bfe9e1" />
      <rect x="62" y="74" width="28" height="22" rx="4" fill={MINT} />
      <rect x="96" y="74" width="28" height="22" rx="4" fill={MINT} />
      <rect x="130" y="74" width="24" height="22" rx="4" fill="#ffe2cc" />
      <rect x="62" y="102" width="92" height="6" rx="3" fill="#e2e8f0" />
      <circle cx="82" cy="136" r="13" fill={INK} />
      <circle cx="82" cy="136" r="5" fill="#fff" />
      <circle cx="190" cy="136" r="13" fill={INK} />
      <circle cx="190" cy="136" r="5" fill="#fff" />
      <rect x="160" y="30" width="62" height="28" rx="14" fill={INK} />
      <text x="191" y="49" textAnchor="middle" fontSize="12" fontWeight="600" fill="#fff">3 left</text>
    </svg>
  );
}

function DispatchArt() {
  return (
    <svg viewBox="0 0 260 170" className="w-full h-full" aria-hidden="true">
      <ellipse cx="130" cy="152" rx="100" ry="10" fill="#eef2f6" />
      <rect x="40" y="20" width="180" height="124" rx="12" fill="#fff" stroke="#dbe4ea" />
      <path d="M40 70 H220 M40 108 H220 M100 20 V144 M162 20 V144" stroke="#eef2f6" strokeWidth="6" />
      <path d="M70 124 C 100 124, 100 84, 130 84 S 170 50, 192 46" stroke={TEAL_LIGHT} strokeWidth="4" fill="none" strokeDasharray="2 8" strokeLinecap="round" />
      <circle cx="70" cy="124" r="8" fill={INK} />
      <circle cx="70" cy="124" r="3" fill="#fff" />
      <path d="M192 22 C 180 22 172 31 172 41 C 172 55 192 70 192 70 C 192 70 212 55 212 41 C 212 31 204 22 192 22Z" fill="#ff7a1a" />
      <circle cx="192" cy="41" r="6" fill="#fff" />
    </svg>
  );
}

const SLIDES = [
  {
    art: <InvoiceArt />,
    title: "Quotes that turn into paid invoices",
    text: "Your customer signs the estimate on their phone, and BrightPro creates the job and the invoice for you.",
  },
  {
    art: <VanArt />,
    title: "Know what's in every van",
    text: "Parts used on a job come off the van's stock automatically, and you get an alert before anything runs out.",
  },
  {
    art: <DispatchArt />,
    title: "Dispatch your crew in one tap",
    text: "Assign jobs on the calendar and follow each technician from on the way to job done.",
  },
];

export default function SignInPage() {
  const [slide, setSlide] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 6000);
    return () => clearInterval(id);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Enter the email address you signed up with.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setError("");
    alert("Sign-in will be connected in step 2.2");
  }

  const current = SLIDES[slide];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f6f8] flex flex-col">
      {/* Soft geometric background */}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1440 900" aria-hidden="true">
        <polygon points="0,0 520,0 180,900 0,900" fill="#ffffff" opacity="0.7" />
        <polygon points="760,0 1440,0 1440,380 1100,900 900,900" fill="#ffffff" opacity="0.55" />
        <polygon points="300,900 820,420 1440,900" fill="#eef7f5" opacity="0.8" />
      </svg>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[920px] overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_rgba(15,40,60,0.08)] grid md:grid-cols-[1.1fr_1fr]">
          {/* Form */}
          <section className="p-8 sm:p-12">
            <Image src="/logo-brightpro.png" alt="BrightPro" width={160} height={44} priority className="h-9 w-auto" />

            <h1 className="mt-8 text-[1.75rem] font-semibold text-[#0b1f3a] tracking-tight">Sign in</h1>
            <p className="mt-1 text-slate-500">to access BrightPro</p>

            <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
              <div>
                <label htmlFor="email" className="sr-only">Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] placeholder:text-slate-400 focus:bg-white focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15"
                />
              </div>

              <div className="relative">
                <label htmlFor="password" className="sr-only">Password</label>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 pr-16 text-[15px] placeholder:text-slate-400 focus:bg-white focus:border-[#0f766e] focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500 hover:text-slate-800"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <div className="flex justify-end">
                <a href="#" className="text-sm font-medium text-[#0f766e] hover:underline">Forgot password?</a>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                className="w-full rounded-lg bg-[#0f766e] py-3 text-[15px] font-semibold text-white hover:bg-[#0c5f59] transition-colors"
              >
                Sign in
              </button>
            </form>

            <p className="mt-7 text-sm font-medium text-slate-600">Sign in using</p>
            <div className="mt-3 flex gap-3">
              <button type="button" aria-label="Sign in with Google" className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8z" />
                  <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
                  <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
                  <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
                </svg>
              </button>
              <button type="button" aria-label="Sign in with Microsoft" className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <rect x="2" y="2" width="9.5" height="9.5" fill="#F25022" />
                  <rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00" />
                  <rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF" />
                  <rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900" />
                </svg>
              </button>
              <button type="button" aria-label="Sign in with Apple" className="flex h-11 w-11 items-center justify-center rounded-lg bg-black hover:bg-slate-800">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#fff" aria-hidden="true">
                  <path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7a4.6 4.6 0 0 0-3.6-2c-1.5-.1-3 .9-3.7.9-.8 0-2-.9-3.2-.9a4.8 4.8 0 0 0-4 2.5c-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.1-1.2 2.9-2.4a10 10 0 0 0 1.3-2.7c0 0-2.3-.9-2.3-3.8zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z" />
                </svg>
              </button>
            </div>

            <p className="mt-8 text-sm text-slate-600">
              Don&apos;t have a BrightPro account?{" "}
              <a href="#" className="font-semibold text-[#0f766e] hover:underline">Sign up now</a>
            </p>
          </section>

          {/* Feature carousel */}
          <section className="hidden md:flex flex-col items-center justify-center border-l border-slate-100 px-10 py-12 text-center">
            <div key={slide} className="flex flex-col items-center animate-[fadeIn_0.5s_ease]">
              <div className="h-[170px] w-[260px]">{current.art}</div>
              <h2 className="mt-6 text-lg font-semibold text-[#0b1f3a]">{current.title}</h2>
              <p className="mt-2 max-w-[300px] text-[15px] leading-relaxed text-slate-500">{current.text}</p>
            </div>
            <div className="mt-8 flex gap-2">
              {SLIDES.map((s, i) => (
                <button
                  key={s.title}
                  type="button"
                  aria-label={`Show slide ${i + 1}`}
                  onClick={() => setSlide(i)}
                  className={`h-1.5 rounded-full transition-all ${i === slide ? "w-6 bg-[#0f766e]" : "w-1.5 bg-slate-300"}`}
                />
              ))}
            </div>
          </section>
        </div>
      </div>

      <footer className="relative z-10 pb-6 text-center text-xs text-slate-400">
        © 2026 BrightPro. All rights reserved.
      </footer>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </main>
  );
}
