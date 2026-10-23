"use client";

import { bustCache } from "@/lib/cache-client";
import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import CompanyBadge from "@/components/CompanyBadge";
import { CompanySummary, CurrentUser, ROLE_LABEL, setCurrentCompany } from "@/lib/types";

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
    setUploadError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setUploadError("Use a PNG, JPG or WEBP image.");
    if (file.size > 2 * 1024 * 1024) return setUploadError("The image must be 2 MB or smaller.");
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { setUploading(false); return setUploadError("The photo couldn't be uploaded. Try again."); }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
    await bustCache("profile");
    setUploading(false);
    if (dbErr) return setUploadError("The photo uploaded but couldn't be saved to your profile.");
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
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
          </div>
          <p className="mt-4 text-lg font-semibold text-[#0b1f3a]">{user.fullName || "Your name"}</p>
          <p className="text-sm text-slate-500">{user.email}</p>
          {uploading && <p className="mt-2 text-sm text-slate-500">Uploading photo...</p>}
          {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-sm font-semibold text-slate-700">My companies</p>
          <ul className="mt-3 space-y-1">
            {companies.length === 0 && <li className="text-sm text-slate-500">No companies yet.</li>}
            {companies.map((c, i) => (
              <li key={c.id}>
                <button type="button" onClick={() => { switchTo(c.id); onClose(); }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 ${c.id === currentId ? "bg-[#f0faf7]" : ""}`}>
                  <span className="flex min-w-0 items-center gap-3">
                    <CompanyBadge id={c.id} name={c.name} index={i} size={32} logoUrl={c.logoUrl} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">{c.name}</span>
                      <span className="block text-xs text-slate-500">{c.industry ?? "Business"}</span>
                    </span>
                  </span>
                  <span className="ml-3 shrink-0 rounded-full bg-[#d6f3ec] px-2.5 py-0.5 text-xs font-medium text-[#0f766e]">{ROLE_LABEL[c.role]}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-400">Rename, leave or delete a company from the company selector at the top.</p>
        </div>

        <div className="border-t border-slate-100 p-6">
          <button type="button" onClick={signOut} className="w-full rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">Sign out</button>
        </div>
      </aside>
    </div>
  );
}
