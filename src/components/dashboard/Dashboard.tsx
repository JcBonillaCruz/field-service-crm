"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Role } from "@/lib/types";
import BottomSheet from "@/components/customers/BottomSheet";

type Counts = { total: number; commercial: number; residential: number };
const PERIODS = ["Last 3 Months","Last 12 Months","This Quarter","Previous Quarter","This Year","Previous Year","Year To Date","Quarter To Date"];
const TABS: {label:string;icon:string}[] = [
  {label:"Dashboard",icon:"M9 12l2 2 4-4M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"},
  {label:"Announcements",icon:"M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.08"},
  {label:"Help",icon:"M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"},
];

export default function Dashboard({ firstName, companyName, industry, role, counts, daysLeft }: {
  firstName: string; companyName: string; industry: string; role: Role; counts: Counts; daysLeft: number;
}) {
  const [tab, setTab] = useState("Dashboard");
  const [m, setM] = useState(false);
  const [recvOpen, setRecvOpen] = useState(false);
  const [periodSheet, setPeriodSheet] = useState<string|null>(null);
  const [periods, setPeriods] = useState<Record<string,string>>({});
  useEffect(() => { const r = requestAnimationFrame(() => setM(true)); return () => cancelAnimationFrame(r); }, []);

  const getPeriod = (k:string) => periods[k] ?? "Last 12 Months";
  const fade = (i:number) => `transition-all duration-500 ease-out ${m?"translate-y-0 opacity-100":"translate-y-4 opacity-0"}`;
  const d = (i:number):React.CSSProperties => ({transitionDelay:`${i*60}ms`});

  return (
    <div className="min-h-full bg-[#f4f6f8]">
      {/* Pestañas */}
      <div className="sticky top-16 z-10 flex gap-1 border-b border-slate-200 bg-white px-4">
        {TABS.map(t=>(
          <button key={t.label} type="button" onClick={()=>setTab(t.label)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors ${tab===t.label?"border-[#0f766e] font-semibold text-[#0f766e]":"border-transparent text-slate-500"}`}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon}/></svg>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "Dashboard" && (
        <div>
          {/* ══════ 1. Total Receivables (AZUL) ══════ */}
          <div style={d(0)} className={`${fade(0)} mx-4 mt-5`}>
            <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-[#1a2744] via-[#243555] to-[#1e3a5f] px-6 pb-8 pt-6 text-white">
              {/* formas decorativas */}
              <svg viewBox="0 0 400 150" className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]" preserveAspectRatio="none"><ellipse cx="320" cy="20" rx="200" ry="100" fill="white"/><ellipse cx="100" cy="130" rx="160" ry="70" fill="white"/></svg>
              <p className="relative text-sm font-medium text-white/70">Total Receivables</p>
              <p className="relative mt-1 text-[42px] font-bold leading-none tracking-tight">$0.00</p>
            </div>
            {/* Current / Overdue (FUERA de la tarjeta, en blanco) */}
            <div className="rounded-b-2xl border border-t-0 border-slate-200 bg-white">
              <button type="button" onClick={()=>setRecvOpen(!recvOpen)} className="flex w-full items-center justify-between px-6 py-4">
                <div className="flex gap-8 text-sm">
                  <span><span className="font-medium text-emerald-600">Current</span> <span className="text-[#0b1f3a]">$0.00</span></span>
                  <span><span className="font-medium text-red-500">Overdue</span> <span className="text-[#0b1f3a]">$0.00</span></span>
                </div>
                <svg viewBox="0 0 20 20" className={`h-4 w-4 text-slate-400 transition-transform ${recvOpen?"rotate-180":""}`} fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z"/></svg>
              </button>
              {recvOpen && (
                <div className="border-t border-slate-100 px-6 pb-5 pt-3">
                  <AgingChart mounted={m}/>
                  <p className="mt-3 text-xs text-slate-400">Aging chart populates with real invoice data.</p>
                </div>
              )}
            </div>
          </div>

          {/* ══════ 2. Quick Create ══════ */}
          <div style={d(1)} className={`${fade(1)} mx-4 mt-8`}>
            <p className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#0b1f3a]">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#e8713a]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg>
              Quick Create
            </p>
            <div className="flex justify-between gap-4">
              {([
                {l:"Customer",href:"/dashboard/customers/new",i:<><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M4 20a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></>},
                {l:"Invoice",href:"/dashboard/invoices/new",i:<><rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M9 8h6M9 12h6M9 16h3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></>},
                {l:"Subscription",href:"/dashboard/subscriptions/new",i:<><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>},
                {l:"Quote",href:"/dashboard/quotes/new",i:<><rect x="5" y="2" width="14" height="19" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M9 7h3M9 11h6M9 15h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M14 2v4h5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></>},
              ]).map(a => {
                const active = !!a.href;
                const box = (
                  <div key={a.l} className="flex flex-col items-center gap-2.5">
                    <span className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-transform active:scale-95 ${active?"bg-[#e9f7f4]":"bg-slate-50"}`}>
                      <svg viewBox="0 0 24 24" className={`h-7 w-7 ${active?"text-[#0f766e]":"text-slate-300"}`}>{a.i}</svg>
                    </span>
                    <span className={`text-[13px] font-medium ${active?"text-[#0b1f3a]":"text-slate-400"}`}>{a.l}</span>
                  </div>
                );
                return active ? <Link key={a.l} href={a.href!}>{box}</Link> : box;
              })}
            </div>
          </div>

          {/* ══════ 3. Net Revenue ══════ */}
          <SectionCard style={d(2)} className={fade(2)} title="Net Revenue" icon="M22 12h-4l-3 9L9 3l-3 9H2"
            period={getPeriod("rev")} onPeriod={()=>setPeriodSheet("rev")}>
            <EmptyChart msg="Once you start to receive or record invoice payments, you can view your total revenue, minus refunds."/>
          </SectionCard>

          {/* ══════ 4. Subscription Metrics (scroll) ══════ */}
          <div style={d(3)} className={`${fade(3)} mt-6 bg-[#eef1f5] py-6`}>
            <div className="flex items-center justify-between px-4">
              <p className="flex items-center gap-2 text-lg font-semibold text-[#0b1f3a]">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                Subscription Metrics
              </p>
              <button type="button" onClick={()=>setPeriodSheet("sub")} className="text-sm font-medium text-slate-500">{getPeriod("sub")} ▾</button>
            </div>
            <div className="mt-4 flex gap-3 overflow-x-auto px-4 pb-1" style={{scrollbarWidth:"none"}}>
              {([{l:"MRR",v:"$0.00"},{l:"Active Subscriptions",v:"0"},{l:"ARPU",v:"$0.00"},{l:"Churn Rate",v:"0.00%"},{l:"LTV",v:"$0.00"}]).map(c=>(
                <div key={c.l} className="w-56 shrink-0 rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-[#0b1f3a]">{c.l}</p>
                  <p className="mt-3 text-3xl font-bold text-[#0b1f3a]">{c.v}</p>
                  <p className="mt-1 rounded-md bg-slate-50 px-2 py-0.5 text-xs text-slate-400 inline-block">0% Year on Year</p>
                  <p className="mt-3 text-xs text-slate-400">No data found.</p>
                </div>
              ))}
            </div>
          </div>

          {/* ══════ 5. Subscription Summary ══════ */}
          <SectionCard style={d(4)} className={fade(4)} title="Subscription Summary" icon="M9 12l2 2 4-4M12 22a10 10 0 1 0 0-20"
            period={getPeriod("subsum")} onPeriod={()=>setPeriodSheet("subsum")}>
            <EmptyChart msg="Create subscriptions to view essential metrics like the number of signups, activations, cancellations, and reactivations."/>
          </SectionCard>

          {/* ══════ 6. Income and Expense ══════ */}
          <SectionCard style={d(5)} className={fade(5)} title="Income and Expense" icon="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
            period={getPeriod("inc")} onPeriod={()=>setPeriodSheet("inc")}>
            <BarChart mounted={m}/>
            <div className="mt-5 grid grid-cols-3 text-center">
              <div><p className="text-sm font-medium text-blue-600">Income</p><p className="mt-1 text-xl font-bold text-[#0b1f3a]">$0.00</p></div>
              <div><p className="text-sm font-medium text-teal-600">Receipts</p><p className="mt-1 text-xl font-bold text-[#0b1f3a]">$0.00</p></div>
              <div><p className="text-sm font-medium text-orange-500">Expense</p><p className="mt-1 text-xl font-bold text-[#0b1f3a]">$0.00</p></div>
            </div>
          </SectionCard>

          {/* ══════ 7. Project Summary ══════ */}
          <SectionCard style={d(6)} className={fade(6)} title="Project Summary" icon="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2"
            period={getPeriod("proj")} onPeriod={()=>setPeriodSheet("proj")}>
            <div className="rounded-2xl bg-[#eef6ff] px-6 py-10 text-center">
              <p className="text-5xl font-bold text-[#0b1f3a]">00:00</p>
              <p className="mt-3 text-sm font-medium text-slate-500">Start Project Timer</p>
              <p className="mt-2 text-xs text-slate-400">Track time on jobs once dispatch is ready.</p>
            </div>
          </SectionCard>

          <div className="h-10"/>
        </div>
      )}

      {tab === "Announcements" && <EmptyTab title="No announcements yet" text="Product updates and tips will appear here."/>}
      {tab === "Help" && <EmptyTab title="Need help?" text="Documentation and support channels are coming soon."/>}

      {/* Period sheet */}
      <BottomSheet open={!!periodSheet} onClose={()=>setPeriodSheet(null)} title="Select period">
        <ul className="space-y-1">
          {PERIODS.map(p=>{
            const active = periodSheet ? getPeriod(periodSheet)===p : false;
            return (
              <li key={p}>
                <button type="button" onClick={()=>{if(periodSheet) setPeriods(prev=>({...prev,[periodSheet]:p})); setPeriodSheet(null);}}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left text-[15px] ${active?"bg-[#f6fbfa] font-medium text-[#0b1f3a] border border-[#0f766e]":"text-slate-700 border border-transparent"}`}>
                  {p}
                  {active && <svg viewBox="0 0 20 20" className="h-5 w-5 text-[#0f766e]" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z"/></svg>}
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </div>
  );
}

/* ═══ Subcomponentes ═══ */
function SectionCard({title,icon,period,onPeriod,children,className,style}:{title:string;icon:string;period:string;onPeriod:()=>void;children:React.ReactNode;className?:string;style?:React.CSSProperties}){
  return (
    <div style={style} className={`${className??""} mx-4 mt-6 rounded-2xl border border-slate-200 bg-white p-5`}>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-semibold text-[#0b1f3a]">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icon}/></svg>
          {title}
        </p>
        <button type="button" onClick={onPeriod} className="text-sm font-medium text-slate-500 active:text-slate-800">{period} ▾</button>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function EmptyChart({msg}:{msg:string}){
  return (
    <div className="rounded-2xl bg-[#f0f6ff] px-5 py-6">
      <div className="flex items-start gap-4">
        <p className="flex-1 text-sm leading-relaxed text-slate-600">{msg}</p>
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
  const bars = [{l:"Current",v:0},{l:"1–15",v:0},{l:"16–30",v:0},{l:"31–45",v:0},{l:"> 45",v:0}];
  return (
    <div className="flex h-32 items-end gap-3 border-b border-slate-100 pb-2">
      {bars.map((b,i)=>(
        <div key={b.l} className="flex flex-1 flex-col items-center gap-1">
          <div className={`mx-auto w-6 rounded-t bg-[#e8a94e] transition-all duration-700`}
            style={{height:mounted && b.v ? `${(b.v/2000)*100}px` : "3px", transitionDelay:`${i*100}ms`}}/>
          <span className="text-[10px] text-slate-400">{b.l}</span>
        </div>
      ))}
    </div>
  );
}

function BarChart({mounted}:{mounted:boolean}){
  const months = ["Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct"];
  return (
    <div className="overflow-x-auto" style={{scrollbarWidth:"none"}}>
      <div className="flex h-40 items-end gap-2 border-b border-slate-100 pb-1" style={{minWidth:"340px"}}>
        {months.map((mo,i)=>(
          <div key={mo+i} className="flex flex-1 flex-col items-center gap-0.5">
            <div className="flex gap-px">
              <div className="w-[5px] rounded-t bg-blue-500/30" style={{height:"3px"}}/>
              <div className="w-[5px] rounded-t bg-teal-500/30" style={{height:"3px"}}/>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2" style={{minWidth:"340px"}}>
        {months.map((mo,i)=><span key={mo+i} className="flex-1 text-center text-[9px] text-slate-400">{mo}</span>)}
      </div>
    </div>
  );
}

function EmptyTab({title,text}:{title:string;text:string}){
  return <div className="px-6 py-12 text-center"><p className="text-lg font-semibold text-[#0b1f3a]">{title}</p><p className="mt-1 text-sm text-slate-500">{text}</p></div>;
}
