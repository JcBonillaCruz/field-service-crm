"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Buscador de la barra superior: se alarga al hacer clic (escritorio)
export default function TopSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/dashboard/customers?q=${encodeURIComponent(term)}` : "/dashboard/customers");
  }

  return (
    <form onSubmit={submit} className={`relative transition-all duration-300 ease-out ${focused ? "w-[26rem]" : "w-64"}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
      </span>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search customers by name, phone or email"
        aria-label="Search customers"
        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm placeholder:text-slate-400 focus:border-[#0f766e] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#14a39a]/15"
      />
    </form>
  );
}
