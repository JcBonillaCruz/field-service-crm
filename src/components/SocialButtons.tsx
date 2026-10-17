"use client";

import { useState } from "react";

export default function SocialButtons() {
  const [note, setNote] = useState("");
  const soon = (name: string) => () => setNote(`${name} sign-in is coming soon. Use your email for now.`);

  return (
    <div>
      <p className="mt-7 text-sm font-medium text-slate-600">Sign in using</p>
      <div className="mt-3 flex gap-3">
        <button type="button" onClick={soon("Google")} aria-label="Sign in with Google" className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8z" />
            <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
            <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
          </svg>
        </button>
        <button type="button" onClick={soon("Microsoft")} aria-label="Sign in with Microsoft" className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <rect x="2" y="2" width="9.5" height="9.5" fill="#F25022" />
            <rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00" />
            <rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF" />
            <rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900" />
          </svg>
        </button>
        <button type="button" onClick={soon("Apple")} aria-label="Sign in with Apple" className="flex h-11 w-11 items-center justify-center rounded-lg bg-black hover:bg-slate-800">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#fff" aria-hidden="true">
            <path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7a4.6 4.6 0 0 0-3.6-2c-1.5-.1-3 .9-3.7.9-.8 0-2-.9-3.2-.9a4.8 4.8 0 0 0-4 2.5c-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.1-1.2 2.9-2.4a10 10 0 0 0 1.3-2.7c0 0-2.3-.9-2.3-3.8zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z" />
          </svg>
        </button>
      </div>
      {note && <p className="mt-3 text-sm text-slate-500">{note}</p>}
    </div>
  );
}
