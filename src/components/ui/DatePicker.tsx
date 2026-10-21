"use client";

import { useState } from "react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const pad = (n: number) => String(n).padStart(2, "0");
const toStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromStr = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const display = (s: string) => { if (!s) return ""; const d = fromStr(s); return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`; };

// Calendario con nuestro diseño (reemplaza el del navegador)
export default function DatePicker({
  value, onChange, placeholder = "mm/dd/yyyy", minDate, id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minDate?: string; // "yyyy-mm-dd": los días anteriores salen apagados (como Zoho)
  id?: string;
}) {
  const [cursor, setCursor] = useState(() => (value ? fromStr(value) : new Date()));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const today = toStr(new Date());
  const monthName = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <Popover className="relative">
      <PopoverButton id={id} className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-[15px] focus:border-[#0f766e] focus:bg-white focus:outline-none data-[open]:border-[#0f766e] data-[open]:bg-white">
        <span className={value ? "text-slate-800" : "text-slate-400"}>{value ? display(value) : placeholder}</span>
        <svg viewBox="0 0 20 20" className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="14" height="13" rx="2" /><path d="M3 8h14M7 2v3M13 2v3" strokeLinecap="round" /></svg>
      </PopoverButton>
      <PopoverPanel anchor="bottom start" transition
        className="z-[100] mt-1 w-72 origin-top rounded-xl border border-slate-200 bg-white p-3 shadow-[0_12px_40px_rgba(15,40,60,0.18)] transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0">
        {({ close }) => (
          <>
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="text-sm font-semibold text-[#0b1f3a]">{monthName}</span>
              <div className="flex gap-1">
                <button type="button" aria-label="Previous month" onClick={() => setCursor(new Date(year, month - 1, 1))} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15 7 10l5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button type="button" aria-label="Next month" onClick={() => setCursor(new Date(year, month + 1, 1))} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m8 5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 text-center text-[11px] font-medium text-slate-400">
              {DOW.map((d) => <span key={d} className="py-1">{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((d, i) => {
                if (d === null) return <span key={i} />;
                const ds = toStr(new Date(year, month, d));
                const selected = ds === value;
                const isToday = ds === today;
                const off = Boolean(minDate && ds < minDate);
                return (
                  <button key={i} type="button" disabled={off} onClick={() => { onChange(ds); close(); }}
                    className={`h-9 rounded-lg text-sm transition-colors ${off ? "cursor-not-allowed text-slate-300" : selected ? "bg-[#0f766e] font-semibold text-white" : isToday ? "bg-[#e9f7f4] font-medium text-[#0f766e]" : "text-slate-700 hover:bg-slate-100"}`}>
                    {d}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between px-1 text-sm">
              <button type="button" onClick={() => { onChange(""); close(); }} className="font-medium text-slate-500 hover:text-slate-800">Clear</button>
              <button type="button" onClick={() => { const t = toStr(new Date()); onChange(t); setCursor(new Date()); close(); }} className="font-medium text-[#0f766e]">Today</button>
            </div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}
