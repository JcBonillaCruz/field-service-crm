"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import Link from "next/link";
import OrganizationList from "@/components/OrganizationList";
import { uploadAvatar } from "@/lib/avatar";
import { CompanySummary, CurrentUser, setCurrentCompany } from "@/lib/types";

export default function ProfilePanel({
  user, companies, currentId, open, onClose,
}: {
  user: CurrentUser;
  companies: CompanySummary[];
  currentId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function switchTo(id: string) {
    setCurrentCompany(id);
    const section = pathname.match(/^\/dashboard\/[^/]+/)?.[0];
    if (section && pathname !== section) router.push(section);
    router.refresh();
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function uploadPhoto(file: File) {
    setUploadError(""); setUploading(true);
    const err = await uploadAvatar(user.id, file);
    setUploading(false);
    if (err) return setUploadError(err);
    router.refresh();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-900/30" />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
        <div className="flex justify-end p-3">
          <button type="button" onClick={onClose} aria-label="Close profile" className="rounded-lg p-2 text-slate-400 transition-all duration-200 hover:rotate-90 hover:bg-red-50 hover:text-red-600">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
          </button>
        </div>
        <div className="flex flex-col items-center border-b border-slate-100 px-6 pb-6 text-center">
          <div className="relative">
            <Avatar name={user.fullName || user.email} url={user.avatarUrl} seed={user.id} size={88} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Change photo"
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#0f766e] text-white hover:bg-[#0c5f59] disabled:opacity-60">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
          </div>
          <p className="mt-4 text-lg font-semibold text-[#0b1f3a]">{user.fullName || "Your name"}</p>
          <p className="text-sm text-slate-500">{user.email}</p>
          <Link prefetch={false} href="/dashboard/account" onClick={onClose}
            className="group mt-4 flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-[14px] font-semibold text-[#0b1f3a] transition-colors hover:border-[#14a39a] hover:bg-[#f3fbf8] hover:text-[#0f766e]">
            <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-500 group-hover:rotate-90" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" /></svg>
            Account settings
          </Link>
          {uploading && <p className="mt-2 text-sm text-slate-500">Uploading photo...</p>}
          {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-sm font-semibold text-slate-700">My companies</p>
          <div className="-mx-3 mt-2">
            <OrganizationList companies={companies} currentId={currentId} userId={user.id} compact onOpen={(id) => { switchTo(id); onClose(); }} />
          </div>
        </div>

        <div className="border-t border-slate-100 p-6">
          <button type="button" onClick={signOut} className="w-full rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">Sign out</button>
        </div>
      </aside>
    </div>
  );
}
