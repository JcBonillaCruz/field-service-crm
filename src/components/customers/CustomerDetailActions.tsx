"use client";

import Link from "next/link";
import { secondaryButton } from "@/components/customers/ui";

export default function CustomerDetailActions({ customerId }: { customerId: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link href={`/dashboard/customers/${customerId}/edit`} className={`${secondaryButton} hidden sm:inline-flex`}>Edit</Link>
      <Link href={`/dashboard/customers/${customerId}/edit`} aria-label="Edit"
        className="group/edit flex h-11 w-11 items-center justify-center rounded-full bg-[#e9f7f4] text-[#0f766e] shadow-sm transition-all duration-200 ease-out hover:scale-110 active:scale-95 sm:hidden">
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] transition-transform duration-200 group-hover/edit:-rotate-12" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </Link>
      <span title="Coming soon" className="hidden cursor-default items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-400 sm:inline-flex">
        New transaction<span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium">Soon</span>
      </span>
      <Link href="/dashboard/customers" aria-label="Close" className="hidden h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:flex">
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
      </Link>
    </div>
  );
}
