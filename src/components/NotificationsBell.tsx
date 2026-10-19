"use client";

import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";

export default function NotificationsBell() {
  return (
    <Popover className="relative">
      <PopoverButton aria-label="Notifications"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none data-[open]:bg-[#e9f7f4] data-[open]:text-[#0f766e]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
      </PopoverButton>
      <PopoverPanel anchor="bottom end" transition
        className="z-50 mt-2 w-80 origin-top-right rounded-2xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,40,60,0.18)] transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0">
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="font-semibold text-[#0b1f3a]">Notifications</p>
        </div>
        <div className="px-5 py-8 text-center">
          <svg viewBox="0 0 24 24" className="mx-auto h-10 w-10 text-slate-200" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /></svg>
          <p className="mt-3 text-sm text-slate-500">You&apos;re all caught up.</p>
          <p className="mt-1 text-xs text-slate-400">Quote accepted, payment received, a technician on the way or finishing a job, low van inventory… they&apos;ll show up here as we build each module.</p>
        </div>
      </PopoverPanel>
    </Popover>
  );
}
