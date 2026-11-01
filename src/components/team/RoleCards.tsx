"use client";

import { Role } from "@/lib/types";
import { ROLE_INFO } from "@/lib/team";

// Elegir rol: cada tarjeta dice qué puede hacer esa persona
export default function RoleCards({ value, onChange, roles, disabled }: { value: Role; onChange: (r: Role) => void; roles: Role[]; disabled?: boolean }) {
  return (
    <div className="grid max-w-[900px] gap-3 sm:grid-cols-2">
      {roles.map((r) => {
        const info = ROLE_INFO[r], on = value === r;
        return (
          <button key={r} type="button" disabled={disabled} onClick={() => onChange(r)} aria-pressed={on}
            className={`group rounded-xl border p-4 text-left transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${on ? "border-[#0f766e] bg-[#f3fbf8] ring-1 ring-[#0f766e]" : "border-slate-200 bg-white hover:border-[#14a39a] hover:shadow-sm"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold ${info.tone}`}>{info.label}</span>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${on ? "border-[#0f766e] bg-[#0f766e]" : "border-slate-300"}`}>
                {on && <svg viewBox="0 0 20 20" className="h-3 w-3 text-white" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>}
              </span>
            </div>
            <p className="mt-2 text-[14px] font-medium text-[#0b1f3a]">{info.text}</p>
            <ul className="mt-1.5 space-y-0.5">
              {info.can.map((c) => <li key={c} className="flex gap-1.5 text-[12.5px] text-slate-500"><span className="text-[#14a39a]">•</span>{c}</li>)}
            </ul>
          </button>
        );
      })}
    </div>
  );
}
