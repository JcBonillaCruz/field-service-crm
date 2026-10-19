"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Role } from "@/lib/types";

type Counts = { total: number; commercial: number; residential: number };
const PERIODS = ["Last 3 Months","Last 12 Months","This Quarter","Previous Quarter","This Year","Previous Year","Year To Date","Quarter To Date"];

export default function Dashboard({ firstName, companyName, industry, role, counts, daysLeft }: {
  firstName: string; companyName: string; industry: string; role: Role; counts: Counts; daysLeft: number;
}) {
  const [tab, setTab] = useState<"Dashboard"|"Announcements"|"Help">("Dashboard");
  const [m, setM] = useState(false);
  const [recvOpen, setRecvOpen] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setM(true)); return () => cancelAnimationFrame(r); }, []);

  const TABS: {label:string; icon:string}[] = [
    {label:"Dashboard",icon:"M9 12l2 2 4-4M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"},
    {label:"Announcements",icon:"M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.08"},
    {label:"Help",icon:"M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"},
  ];

  const fade = (i:number) => `transition-all duration-500 ease-out ${m?"translate-y-0 opacity-100":"translate-y-4 opacity-0"}`;
  const d = (i:number) => ({transitionDelay:`${i*60}ms`});

  return (
    <div className="min-h-full bg-[#f4f6f8]">
      {/* Pestañas */}
      <div className="sticky top-16 z-10 flex gap-1 border-b border-slate-200 bg-white px-4">
        {TABS.map((t) => (
          <button key={t.label} type="button" onClick={() => setTab(t.label as typeof tab)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors ${tab===t.label?"border-[#0f766e] font-semibold text-[#0f766e]":"border-transparent text-slate-500"}`}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon}/></svg>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "Dashboard" && (
        <div className="space-y-0">
          {/* 1. Total Receivables */}
          <div style={d(0)} className={`${fade(0)} mx-4 mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f766e] via-[#115e56] to-[#0b4a43] p-5 text-white shadow-lg shadow-[#0f766e]/20`}>
            <svg viewBox="0 0 300 80" className="absolute right-0 top-0 h-24 w-40 opacity-10" fill="white"><ellipse cx="200" cy="-10" rx="180" ry="80"/></svg>
            <p className="relative text-sm font-medium text-white/80">Total Receivables</p>
            <p className="relative mt-1 text-4xl font-bold tracking-tight">$0.00</p>
            <div className="relative mt-4 rounded-xl bg-white/10 px-4 py-3">
              <button type="button" onClick={()=>setRecvOpen(!recvOpen)} className="flex w-full items-center justify-between text-sm">
                <div className="flex gap-6">
                  <span><span className="text-emerald-300">Current</span> $0.00</span>
                  <span><span className="text-red-300">Overdue</span> $0.00</span>
                </div>
                <svg viewBox="0 0 20 20" className={`h-4 w-4 text-white/60 transition-transform ${recvOpen?"rotate-180":""}`} fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z"/></svg>
              </button>
              {recvOpen && <AgingChart mounted={m}/>}
            </div>
            <p className="relative mt-3 text-xs text-white/50">Fills in once you send invoices.</p>
          </div>

          {/* 2. Quick Create */}
          <div style={d(1)} className={`${fade(1)} mx-4 mt-5`}>
            <p className="mb-3 flex items-center gap-2 text-lg font-semibold text-[#0b1f3a]">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#e8713a]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg>
              Quick Create
            </p>
            <div className="grid grid-cols-4 gap-3">
              {([{l:"Customer",href:"/dashboard/customers/new",i:"M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6"},{l:"Invoice",href:"",i:"M6 3h12v18l-3-2-3 2-3-2-3 2z"},{l:"Subscription",href:"",i:"M9 12l2 2 4-4M12 22a10 10 0 1 0 0-20"},{l:"Quote",href:"",i:"M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"}]).map(a=>(
                <Link key={a.l} href={a.href||"/dashboard"} className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white py-4 text-center active:bg-slate-50">
                  <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${a.href?"bg-[#e9f7f4] text-[#0f766e]":"bg-slate-50 text-slate-300"}`}>
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={a.i}/></svg>
                  </span>
                  <span className={`text-xs font-medium ${a.href?"text-slate-700":"text-slate-400"}`}>{a.l}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* 3. Net Revenue */}
          <Section style={d(2)} className={fade(2)} title="Net Revenue" icon="M22 12h-4l-3 9L9 3l-3 9H2">
            <EmptyChart msg="Once you start to receive or record invoice payments, you can view your total revenue, minus refunds."/>
          </Section>

          {/* 4. Subscription Metrics (scroll horizontal) */}
          <div style={d(3)} className={`${fade(3)} mt-2 bg-[#f0f2f6] py-5`}>
            <div className="flex items-center justify-between px-4">
              <p className="flex items-center gap-2 text-lg font-semibold text-[#0b1f3a]">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2"/></svg>
                Subscription Metrics
              </p>
              <PeriodBadge/>
            </div>
            <div className="mt-3 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide">
              {([{l:"MRR",v:"$0.00"},{l:"Active Subscriptions",v:"0"},{l:"ARPU",v:"$0.00"},{l:"Churn Rate",v:"0.00%"},{l:"LTV",v:"$0.00"}]).map(c=>(
                <div key={c.l} className="w-52 shrink-0 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-[#0b1f3a]">{c.l}</p>
                  <p className="mt-2 text-2xl font-bold text-[#0b1f3a]">{c.v}</p>
                  <p className="mt-1 text-xs text-slate-400">0% Year on Year</p>
                  <p className="mt-3 text-xs text-slate-400">No data found.</p>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Subscription Summary */}
          <Section style={d(4)} className={fade(4)} title="Subscription Summary" icon="M9 12l2 2 4-4M12 22a10 10 0 1 0 0-20">
            <EmptyChart msg="Create subscriptions to view essential metrics like the number of signups, activations, cancellations, and reactivations."/>
          </Section>

          {/* 6. Income and Expense */}
          <Section style={d(5)} className={fade(5)} title="Income and Expense" icon="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6">
            <BarChart mounted={m}/>
            <div className="mt-4 grid grid-cols-3 text-center text-sm">
              <div><p className="font-medium text-blue-600">Income</p><p className="mt-0.5 text-lg font-bold text-[#0b1f3a]">$0.00</p></div>
              <div><p className="font-medium text-teal-600">Receipts</p><p className="mt-0.5 text-lg font-bold text-[#0b1f3a]">$0.00</p></div>
              <div><p className="font-medium text-orange-500">Expense</p><p className="mt-0.5 text-lg font-bold text-[#0b1f3a]">$0.00</p></div>
            </div>
          </Section>

          {/* 7. Project Summary */}
          <Section style={d(6)} className={fade(6)} title="Project Summary" icon="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2">
            <div className="rounded-2xl bg-[#eef6ff] px-6 py-8 text-center">
              <p className="text-4xl font-bold text-[#0b1f3a]">00:00</p>
              <p className="mt-2 text-sm text-slate-500">Start Project Timer</p>
              <p className="mt-4 text-xs text-slate-400">Track time on jobs once dispatch is ready.</p>
            </div>
          </Section>

          <div className="h-8"/>
        </div>
      )}

      {tab === "Announcements" && (
        <div className="px-4 py-8 text-center">
          <p className="text-lg font-semibold text-[#0b1f3a]">No announcements yet</p>
          <p className="mt-1 text-sm text-slate-500">Product updates and tips will appear here.</p>
        </div>
      )}

      {tab === "Help" && (
        <div className="px-4 py-8 text-center">
          <p className="text-lg font-semibold text-[#0b1f3a]">Need help?</p>
          <p className="mt-1 text-sm text-slate-500">Documentation and support channels are coming soon.</p>
        </div>
      )}
    </div>
  );
}

/* === Sub-componentes === */
function PeriodBadge(){ return <span className="text-sm font-medium text-slate-500">Last 12 Months ▾</span>; }

function Section({title,icon,children,className,style}:{title:string;icon:string;children:React.ReactNode;className?:string;style?:React.CSSProperties}){
  return (
    <div style={style} className={`${className??""} mt-2 bg-white py-5`}>
      <div className="flex items-center justify-between px-4">
        <p className="flex items-center gap-2 text-lg font-semibold text-[#0b1f3a]">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icon}/></svg>
          {title}
        </p>
        <PeriodBadge/>
      </div>
      <div className="mt-4 px-4">{children}</div>
    </div>
  );
}

function EmptyChart({msg}:{msg:string}){
  return (
    <div className="rounded-2xl bg-[#eef6ff] px-5 py-6">
      <div className="flex items-start gap-4">
        <p className="flex-1 text-sm text-slate-600">{msg}</p>
        <svg viewBox="0 0 80 50" className="h-12 w-20 shrink-0">
          <polyline points="5,35 20,28 35,32 50,18 65,22 75,12" fill="none" stroke="#c8d6e0" strokeWidth="2" strokeLinecap="round"
            strokeDasharray="200" strokeDashoffset="200" style={{animation:"bp-draw 1.6s ease-out forwards"}}/>
          <circle cx="75" cy="12" r="4" fill="#f6a35c"/>
          <style>{`@keyframes bp-draw{to{stroke-dashoffset:0}}`}</style>
        </svg>
      </div>
    </div>
  );
}

function AgingChart({mounted}:{mounted:boolean}){
  const bars = [{l:"Current",v:0},{l:"1-15",v:0},{l:"16-30",v:0},{l:"31-45",v:0},{l:"> 45",v:0}];
  return (
    <div className="mt-3">
      <div className="flex h-36 items-end gap-3 border-b border-white/20 pb-1">
        {bars.map((b,i)=>(
          <div key={b.l} className="flex flex-1 flex-col items-center gap-1">
            <div className="relative w-full">
              <div className={`mx-auto w-5 rounded-t bg-[#e8a94e] transition-all duration-700`}
                style={{height:mounted&&b.v?`${(b.v/2000)*120}px`:"4px",transitionDelay:`${i*100}ms`}}/>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-3">
        {bars.map(b=><span key={b.l} className="flex-1 text-center text-[10px] text-white/60">{b.l}</span>)}
      </div>
      <p className="mt-2 text-xs text-white/40">Aging chart populates with real invoice data.</p>
    </div>
  );
}

function BarChart({mounted}:{mounted:boolean}){
  const months = ["Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct"];
  return (
    <div className="overflow-x-auto">
      <div className="flex h-44 items-end gap-1 border-b border-slate-200 pb-1" style={{minWidth:"320px"}}>
        {months.map((mo,i)=>(
          <div key={mo+i} className="flex flex-1 flex-col items-center gap-0.5">
            <div className="mx-auto flex w-3 gap-px">
              <div className="w-1.5 rounded-t bg-blue-500 transition-all duration-700" style={{height:"2px"}}/>
              <div className="w-1.5 rounded-t bg-teal-500 transition-all duration-700" style={{height:"2px"}}/>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1" style={{minWidth:"320px"}}>
        {months.map((mo,i)=><span key={mo+i} className="flex-1 text-center text-[9px] text-slate-400">{mo}</span>)}
      </div>
    </div>
  );
}
