"use client";

import { useState } from "react";

// Compartir el enlace de la invitación: copiar, WhatsApp o mensaje de texto
export default function ShareInvite({ link, name, company }: { link: string; name?: string | null; company: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Hi${name ? ` ${name.split(" ")[0]}` : ""}! Join ${company} on BrightPro: ${link}`;
  const btn = "flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-[14.5px] font-medium text-slate-700 transition-colors hover:border-[#14a39a] hover:text-[#0f766e]";
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 pl-3">
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-slate-600">{link}</span>
        <button type="button" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
          className="shrink-0 rounded-lg bg-[#0f766e] px-3 py-2 text-[13.5px] font-semibold text-white hover:bg-[#0c5f59]">{copied ? "Copied ✓" : "Copy link"}</button>
      </div>
      <div className="flex gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className={btn}>
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#25d366]" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l2 .9c.3.2.5.2.5.4.1.1.1.7-.1 1.3z" /></svg>
          WhatsApp
        </a>
        <a href={`sms:?&body=${encodeURIComponent(text)}`} className={btn}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H8l-4 4z" /></svg>
          Text message
        </a>
      </div>
    </div>
  );
}
