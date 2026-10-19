"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Role } from "@/lib/types";

type Counts = { total: number; commercial: number; residential: number };
const TABS = ["Dashboard", "Getting started", "What's new"] as const;
const RANGES = ["This month", "Last 3 months", "Last 12 months", "This year"];

export default function Dashboard({
  firstName, companyName, industry, role, counts, daysLeft,
}: {
  firstName: string;
  companyName: string;
  industry: string;
  role: Role;
  counts: Counts;
  daysLeft: number;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Dashboard");
  const [range, setRange] = useState("Last 12 months");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(r); }, []);

  const canManage = role === "owner" || role === "manager" || role === "office";
  const anim = (i: number) =>
    `transition-all duration-500 ease-out ${mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`;
  const delay = (i: number) => ({ transitionDelay: `${i * 70}ms` });

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      {/* Saludo */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#0f766e]">{industry}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[#0b1f3a] sm:text-3xl">Hello, {firstName} 👋</h1>
          <p className="mt-1 text-slate-500">Here&apos;s what&apos;s happening at {companyName}.</p>
        </div>
      </div>

      {/* Pestañas */}
      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors ${tab === t ? "border-[#0f766e] font-semibold text-[#0f766e]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Dashboard" && (
        <div className="mt-6">
          {/* Rango de fechas */}
          <div className="mb-5 flex items-center gap-2">
            <span className="text-sm text-slate-500">Date range</span>
            <select value={range} onChange={(e) => setRange(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-[#0f766e] focus:outline-none">
              {RANGES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Receivables (gradiente) */}
            <div style={delay(0)} className={`${anim(0)} overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f766e] to-[#115e56] p-6 text-white shadow-lg shadow-[#0f766e]/20`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white/80">Total receivables</p>
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-white/70" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7h18v10H3zM3 11h18M7 15h2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <p className="mt-2 text-4xl font-semibold tracking-tight">$0.00</p>
              <div className="mt-5 flex gap-6 text-sm">
                <div><p className="text-white/70">Current</p><p className="mt-0.5 font-semibold">$0.00</p></div>
                <div><p className="text-white/70">Overdue</p><p className="mt-0.5 font-semibold">$0.00</p></div>
              </div>
              <p className="mt-4 text-xs text-white/60">Fills in once you send invoices.</p>
            </div>

            {/* Clientes (datos reales + dona animada) */}
            <div style={delay(1)} className={`${anim(1)} rounded-2xl border border-slate-200 bg-white p-6`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">Customers</p>
                <Link href="/dashboard/customers" className="text-xs font-semibold text-[#0f766e] hover:underline">View all</Link>
              </div>
              <div className="mt-3 flex items-center gap-5">
                <Donut commercial={counts.commercial} residential={counts.residential} mounted={mounted} />
                <div className="space-y-2 text-sm">
                  <p className="text-3xl font-semibold text-[#0b1f3a]">{counts.total}</p>
                  <p className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-[#0f766e]" />Commercial <span className="font-semibold">{counts.commercial}</span></p>
                  <p className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-[#f6a35c]" />Residential <span className="font-semibold">{counts.residential}</span></p>
                </div>
              </div>
            </div>

            {/* Prueba / siguiente paso */}
            <div style={delay(2)} className={`${anim(2)} flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6`}>
              <div>
                <p className="text-sm font-medium text-slate-500">Your free trial</p>
                <p className="mt-2 text-3xl font-semibold text-[#0b1f3a]">{daysLeft} <span className="text-lg font-normal text-slate-400">days left</span></p>
                <p className="mt-1 text-xs text-slate-400">Plans and billing arrive later in the build.</p>
              </div>
              {canManage && (
                <Link href="/dashboard/customers/new" className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0c5f58]">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 4v12M4 10h12" strokeLinecap="round" /></svg>
                  New customer
                </Link>
              )}
            </div>
          </div>

          {/* Gráfica de ingresos (vacía, animada) */}
          <div style={delay(3)} className={`${anim(3)} mt-5 rounded-2xl border border-slate-200 bg-white p-6`}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-[#0b1f3a]">Revenue &amp; expenses</p>
              <span className="text-xs text-slate-400">{range}</span>
            </div>
            <div className="mt-4 flex flex-col items-center justify-center rounded-xl bg-[#f6fbfa] px-6 py-10 text-center">
              <RevenueSpark />
              <p className="mt-4 max-w-sm text-sm text-slate-500">Once you record invoice payments and expenses, your income, costs and net profit will show up here — animated and ready for tax time.</p>
            </div>
          </div>

          {/* Accesos a módulos */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Quotes", text: "Signed on the phone", soon: true },
              { title: "Invoices", text: "Send & get paid", soon: true },
              { title: "Dispatch", text: "Crew & job timer", soon: true },
              { title: "Van inventory", text: "Stock & alerts", soon: true },
            ].map((m, i) => (
              <div key={m.title} style={delay(4 + i)} className={`${anim(4 + i)} rounded-2xl border border-slate-200 bg-white p-5`}>
                <p className="font-semibold text-[#0b1f3a]">{m.title}</p>
                <p className="mt-1 text-sm text-slate-500">{m.text}</p>
                <span className="mt-3 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-400">Coming soon</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "Getting started" && <GettingStarted hasCustomers={counts.total > 0} canManage={canManage} />}
      {tab === "What's new" && <WhatsNew />}
    </section>
  );
}

function Donut({ commercial, residential, mounted }: { commercial: number; residential: number; mounted: boolean }) {
  const total = commercial + residential;
  const r = 34, c = 2 * Math.PI * r;
  const commPct = total ? commercial / total : 0;
  const commLen = mounted ? c * commPct : 0;
  const resLen = mounted ? c * (1 - commPct) : 0;
  return (
    <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
      <circle cx="40" cy="40" r={r} fill="none" stroke="#eef2f4" strokeWidth="11" />
      {total > 0 ? (
        <>
          <circle cx="40" cy="40" r={r} fill="none" stroke="#0f766e" strokeWidth="11" strokeLinecap="round"
            strokeDasharray={`${commLen} ${c}`} style={{ transition: "stroke-dasharray 900ms ease-out" }} />
          <circle cx="40" cy="40" r={r} fill="none" stroke="#f6a35c" strokeWidth="11" strokeLinecap="round"
            strokeDasharray={`${resLen} ${c}`} strokeDashoffset={-commLen} style={{ transition: "stroke-dasharray 900ms ease-out, stroke-dashoffset 900ms ease-out" }} />
        </>
      ) : null}
    </svg>
  );
}

function RevenueSpark() {
  return (
    <svg viewBox="0 0 220 70" className="h-20 w-56">
      <polyline points="5,55 40,40 70,48 100,25 135,35 170,15 215,22" fill="none" stroke="#14a39a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="600" strokeDashoffset="600" style={{ animation: "bp-draw 1.6s ease-out forwards" }} />
      <circle cx="215" cy="22" r="5" fill="#f6a35c" />
      <style>{`@keyframes bp-draw { to { stroke-dashoffset: 0; } }`}</style>
    </svg>
  );
}

function GettingStarted({ hasCustomers, canManage }: { hasCustomers: boolean; canManage: boolean }) {
  const steps = [
    { label: "Create your company", done: true },
    { label: "Add your first customer", done: hasCustomers, href: canManage ? "/dashboard/customers/new" : undefined },
    { label: "Send your first quote", done: false, soon: true },
    { label: "Record your first payment", done: false, soon: true },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <div className="mt-6 max-w-2xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="font-semibold text-[#0b1f3a]">Get set up</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-[#14a39a] transition-all duration-700" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
        <p className="mt-1 text-xs text-slate-400">{doneCount} of {steps.length} done</p>
        <ul className="mt-5 space-y-3">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-3">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${s.done ? "bg-[#0f766e] text-white" : "border-2 border-slate-200"}`}>
                {s.done && <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>}
              </span>
              <span className={`flex-1 text-sm ${s.done ? "text-slate-400 line-through" : "text-slate-700"}`}>{s.label}</span>
              {s.soon ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-400">Soon</span>
                : !s.done && s.href ? <Link href={s.href} className="text-sm font-semibold text-[#0f766e] hover:underline">Start</Link> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function WhatsNew() {
  const items = [
    { t: "Customers, your way", d: "Multiple phones and emails with labels, addresses by country, and fast search." },
    { t: "Import & export", d: "Bring customers from a CSV (even from Zoho) and export to CSV or password-protected Excel." },
    { t: "Organizations", d: "Switch, rename, leave or delete your companies from one panel." },
    { t: "Built for the phone", d: "A clean mobile view with quick call and email buttons on each customer." },
  ];
  return (
    <div className="mt-6 max-w-2xl space-y-3">
      {items.map((it) => (
        <div key={it.t} className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="font-semibold text-[#0b1f3a]">{it.t}</p>
          <p className="mt-1 text-sm text-slate-500">{it.d}</p>
        </div>
      ))}
    </div>
  );
}
