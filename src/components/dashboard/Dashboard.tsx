"use client";

import { useSwipe } from "@/components/ui/useSwipe";

import type { MobileStats } from "@/lib/dashboard-server";
import { InsightsCard, MobileHero, MoneyChart, ReceivablesCard } from "@/components/dashboard/MobileWidgets";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Role } from "@/lib/types";
import BottomSheet from "@/components/customers/BottomSheet";
import { AppsGrid } from "@/components/AppsMenu";

type Counts = { total: number; commercial: number; residential: number };
const PERIODS = ["Last 3 Months","Last 12 Months","This Quarter","Previous Quarter","This Year","Previous Year","Year To Date","Quarter To Date"];
const TABS: {label:string;icon:string}[] = [
  {label:"Dashboard",icon:"M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"},
  {label:"All apps",icon:"M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"},
  {label:"Help",icon:"M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"},
];

export default function Dashboard({ firstName, companyName, industry, role, counts, daysLeft, stats }: {
  firstName: string; companyName: string; industry: string; role: Role; counts: Counts; daysLeft: number; stats?: MobileStats | null;
}) {
  const $ = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);
  const st = stats;
  const [tab, setTab] = useState("Dashboard");
  // Deslizar con el dedo: Home → Announcements → Help
  const names = TABS.map((t) => t.label);
  const ti = names.indexOf(tab);
  const swipe = useSwipe(() => ti > 0 && setTab(names[ti - 1]), () => ti < names.length - 1 && setTab(names[ti + 1]));
  const [m, setM] = useState(false);
  const [recvOpen, setRecvOpen] = useState(false);
  const [periodSheet, setPeriodSheet] = useState<string|null>(null);
  const [periods, setPeriods] = useState<Record<string,string>>({});
  useEffect(() => { const r = requestAnimationFrame(() => setM(true)); return () => cancelAnimationFrame(r); }, []);

  const getPeriod = (k:string) => periods[k] ?? "Last 12 Months";
  const fade = (i:number) => `transition-all duration-500 ease-out ${m?"translate-y-0 opacity-100":"translate-y-4 opacity-0"}`;
  const d = (i:number):React.CSSProperties => ({transitionDelay:`${i*60}ms`});

  return (
    <div className="min-h-full bg-[#f4f6f8]" {...swipe}>
      {/* Pestañas */}
      <div className="sticky top-16 z-10 flex gap-1 border-b border-slate-200 bg-white px-4">
        {TABS.map(t=>(
          <button key={t.label} type="button" onClick={()=>setTab(t.label)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors ${tab===t.label?"border-[#0f766e] font-semibold text-[#0f766e]":"border-transparent text-slate-500"}`}>
            <svg viewBox="0 0 24 24" className={t.label==="Dashboard"?"h-5 w-5":"h-4 w-4"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon}/></svg>
            {t.label==="Dashboard" ? <span className="sr-only">Home</span> : t.label}
          </button>
        ))}
      </div>

      {tab === "Dashboard" && (
        <div>
          {/* ══════ 1. Lo ganado en el año: Earned / Spent / Profit ══════ */}
          <div style={d(0)} className={`${fade(0)} mx-4 mt-5 space-y-3`}>
            {st ? <MobileHero st={st}/> : (
              <div className="rounded-3xl border border-slate-200 bg-white px-6 py-6"><p className="text-sm text-slate-500">Received this year</p><p className="mt-1 text-[38px] font-bold text-[#0b1f3a]">$0.00</p></div>
            )}
            {st && <ReceivablesCard st={st} mounted={m}/>}
          </div>

          {/* ══════ 2. Consejos de finanzas (en vez de accesos directos) ══════ */}
          {st && <div style={d(1)} className={`${fade(1)} mx-4 mt-3`}><InsightsCard st={st} compact neutral tip={false}/></div>}

          {/* ══════ 3. Net Revenue ══════ */}
          <SectionCard style={d(2)} className={fade(2)} title="Net Revenue" icon="M22 12h-4l-3 9L9 3l-3 9H2"
            period={getPeriod("rev")} onPeriod={()=>setPeriodSheet("rev")}>
            {st && st.revenue12 > 0 ? (
              <div className="rounded-2xl bg-[#f3fbf8] px-5 py-5">
                <p className="text-sm text-slate-500">Payments received, last 12 months</p>
                <p className="mt-1 text-3xl font-bold text-[#0b1f3a]">{$(st.revenue12)}</p>
                <MiniBars values={st.receipts} labels={st.months} color="#0f766e" mounted={m}/>
              </div>
            ) : <EmptyChart msg="Once you start to receive or record invoice payments, you can view your total revenue, minus refunds."/>}
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
              {([{l:"MRR",v:$(st?.mrr ?? 0)},{l:"Active Subscriptions",v:String(st?.activeSubs ?? 0)},{l:"ARPU",v:$(st?.arpu ?? 0)},{l:"Churn Rate",v:"0.00%"},{l:"LTV",v:$((st?.arpu ?? 0) * 12)}]).map(c=>(
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
            {st ? <MoneyChart st={st} mounted={m}/> : <BarChart mounted={m}/>}
            <div className="mt-4 grid grid-cols-3 text-center">
              <div><p className="text-sm font-medium text-blue-600">Income</p><p className="mt-1 text-lg font-bold text-[#0b1f3a]">{$(st?.income12 ?? 0)}</p></div>
              <div><p className="text-sm font-medium text-teal-600">Receipts</p><p className="mt-1 text-lg font-bold text-[#0b1f3a]">{$(st?.receipts12 ?? 0)}</p></div>
              <div><p className="text-sm font-medium text-orange-500">Expense</p><p className="mt-1 text-lg font-bold text-[#0b1f3a]">{$((st?.expenses ?? []).reduce((a,b)=>a+b,0))}</p></div>
            </div>
            <Link prefetch={false} href="/dashboard/expenses" className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-orange-300 py-2.5 text-sm font-medium text-orange-600 active:bg-orange-50">+ Add an expense</Link>
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

      {tab === "All apps" && (
        <div className="mx-4 mt-5 rounded-3xl border border-slate-200 bg-white p-3 animate-[bp-fade_0.25s_ease-out]">
          <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">All apps</p>
          <AppsGrid role={role} />
        </div>
      )}
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

function AgingChart({mounted,values}:{mounted:boolean;values:number[]}){
  const labels=["Current","1–15","16–30","31–45","> 45"]; const max=Math.max(1,...values);
  return (
    <div className="flex h-32 items-end gap-3 border-b border-slate-100 pb-2">
      {labels.map((l,i)=>(
        <div key={l} className="flex flex-1 flex-col items-center gap-1">
          <div className="mx-auto w-6 rounded-t bg-[#e8a94e] transition-all duration-700"
            style={{height:mounted && values[i] ? `${Math.max(4,(values[i]/max)*96)}px` : "3px", transitionDelay:`${i*100}ms`}} title={`$${values[i].toFixed(2)}`}/>
          <span className="text-[10px] text-slate-400">{l}</span>
        </div>
      ))}
    </div>
  );
}

function MiniBars({values,labels,color,mounted}:{values:number[];labels:string[];color:string;mounted:boolean}){
  const max=Math.max(1,...values);
  return (
    <div className="mt-4 flex h-20 items-end gap-1.5">
      {values.map((v,i)=>(
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-t transition-all duration-700" style={{height:mounted&&v?`${Math.max(3,(v/max)*64)}px`:"2px",background:color,opacity:v?1:0.25,transitionDelay:`${i*40}ms`}}/>
          <span className="text-[8px] text-slate-400">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function BarChart({mounted,months,income,receipts}:{mounted:boolean;months?:string[];income?:number[];receipts?:number[]}){
  const mo = months ?? ["Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct"];
  const inc = income ?? mo.map(()=>0), rec = receipts ?? mo.map(()=>0);
  const max = Math.max(1, ...inc, ...rec);
  const h = (v:number) => mounted && v ? `${Math.max(3,(v/max)*140)}px` : "3px";
  return (
    <div className="overflow-x-auto" style={{scrollbarWidth:"none"}}>
      <div className="flex h-40 items-end gap-2 border-b border-slate-100 pb-1" style={{minWidth:"340px"}}>
        {mo.map((m,i)=>(
          <div key={m+i} className="flex flex-1 flex-col items-center gap-0.5">
            <div className="flex items-end gap-px">
              <div className={`w-[5px] rounded-t transition-all duration-700 ${inc[i]?"bg-blue-500":"bg-blue-500/30"}`} style={{height:h(inc[i]),transitionDelay:`${i*40}ms`}}/>
              <div className={`w-[5px] rounded-t transition-all duration-700 ${rec[i]?"bg-teal-500":"bg-teal-500/30"}`} style={{height:h(rec[i]),transitionDelay:`${i*40}ms`}}/>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2" style={{minWidth:"340px"}}>
        {mo.map((m,i)=><span key={m+i} className="flex-1 text-center text-[9px] text-slate-400">{m}</span>)}
      </div>
    </div>
  );
}

function EmptyTab({title,text}:{title:string;text:string}){
  return <div className="px-6 py-12 text-center"><p className="text-lg font-semibold text-[#0b1f3a]">{title}</p><p className="mt-1 text-sm text-slate-500">{text}</p></div>;
}
