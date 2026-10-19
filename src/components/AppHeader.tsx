"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import CompanyBadge from "@/components/CompanyBadge";
import CompanySwitcher from "@/components/CompanySwitcher";
import TopSearch from "@/components/TopSearch";
import AppsMenu from "@/components/AppsMenu";
import CreateCompanyForm from "@/components/CreateCompanyForm";
import { CompanySummary, CurrentUser, ROLE_LABEL, setCurrentCompany } from "@/lib/types";

const TRIAL_DAYS = 14;
const popPanel =
  "z-50 mt-2 origin-top-right rounded-xl border border-slate-200 bg-white p-4 shadow-[0_16px_50px_rgba(15,40,60,0.18)] transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0";

export default function AppHeader({
  user, companies, currentId, onMenu,
}: {
  user: CurrentUser;
  companies: CompanySummary[];
  currentId: string | null;
  onMenu?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const current = companies.find((c) => c.id === currentId) ?? null;
  const role = current?.role ?? null;
  const daysLeft = current ? Math.max(0, TRIAL_DAYS - Math.floor((Date.now() - new Date(current.createdAt).getTime()) / 86400000)) : 0;

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
    setUploading(false);
    if (dbErr) return setUploadError("The photo uploaded but couldn't be saved to your profile.");
    router.refresh();
  }

  const avatarButton = (
    <button type="button" onClick={() => setProfileOpen(true)} aria-label="Open my profile" className="shrink-0 rounded-full">
      <Avatar name={user.fullName || user.email} url={user.avatarUrl} seed={user.id} size={36} />
    </button>
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-6">
        {/* Hamburguesa (celular) */}
        <button type="button" onClick={onMenu} aria-label="Open menu" className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>

        {/* ===== Celular: compañía + usuario ===== */}
        <div className="flex min-w-0 flex-1 items-center lg:hidden">
          <CompanySwitcher companies={companies} currentId={currentId} onSwitch={switchTo} onNewCompany={() => setCreating(true)} />
        </div>
        <div className="lg:hidden">{avatarButton}</div>

        {/* ===== Escritorio: barra completa estilo Zoho ===== */}
        <div className="hidden min-w-0 flex-1 items-center gap-4 lg:flex">
          <TopSearch />

          <div className="ml-auto flex items-center gap-1.5">
            {/* Prueba + Subscribe */}
            <Popover className="relative">
              <div className="mr-1 hidden items-center gap-2 text-sm xl:flex">
                <span className="text-slate-500">{daysLeft > 0 ? `Trial expires in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}` : "Trial expired"}</span>
                <PopoverButton className="font-semibold text-[#e8713a] hover:underline focus:outline-none">Subscribe</PopoverButton>
              </div>
              <PopoverButton className="mr-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-[#e8713a] hover:bg-[#fdf1ea] focus:outline-none xl:hidden">Subscribe</PopoverButton>
              <PopoverPanel anchor="bottom end" transition className={`${popPanel} w-72`}>
                <p className="font-semibold text-[#0b1f3a]">Online subscriptions are coming soon</p>
                <p className="mt-1 text-sm text-slate-500">You&apos;re on the free trial{daysLeft > 0 ? ` (${daysLeft} ${daysLeft === 1 ? "day" : "days"} left)` : ""}. Plans and payment will arrive with the billing step.</p>
              </PopoverPanel>
            </Popover>

            <CompanySwitcher companies={companies} currentId={currentId} onSwitch={switchTo} onNewCompany={() => setCreating(true)} />

            {/* Settings */}
            <Popover className="relative">
              <PopoverButton aria-label="Settings" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none data-[open]:bg-[#e9f7f4] data-[open]:text-[#0f766e]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0a1.7 1.7 0 0 0-2.8-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.8H3a2 2 0 1 1 0-4a1.7 1.7 0 0 0 1.2-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.8-1.2V3a2 2 0 1 1 4 0a1.7 1.7 0 0 0 2.8 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-1.2 2.8H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
              </PopoverButton>
              <PopoverPanel anchor="bottom end" transition className={`${popPanel} w-64`}>
                <p className="font-semibold text-[#0b1f3a]">Settings</p>
                <p className="mt-1 text-sm text-slate-500">Organization, users &amp; roles, modules and preferences are coming soon.</p>
              </PopoverPanel>
            </Popover>

            <AppsMenu role={role} />
            {avatarButton}
          </div>
        </div>
      </header>

      {/* Profile panel */}
      {profileOpen && (
        <div className="fixed inset-0 z-40">
          <button type="button" aria-label="Close" onClick={() => setProfileOpen(false)} className="absolute inset-0 bg-slate-900/20" />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex justify-end p-3">
              <button type="button" onClick={() => setProfileOpen(false)} aria-label="Close profile" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4z" /></svg>
              </button>
            </div>

            <div className="flex flex-col items-center border-b border-slate-100 px-6 pb-6 text-center">
              <div className="relative">
                <Avatar name={user.fullName || user.email} url={user.avatarUrl} seed={user.id} size={88} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Change photo"
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#0f766e] text-white hover:bg-[#0c5f59] disabled:opacity-60">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                </button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
              </div>
              <p className="mt-4 text-lg font-semibold text-[#0b1f3a]">{user.fullName || "Your name"}</p>
              <p className="text-sm text-slate-500">{user.email}</p>
              {uploading && <p className="mt-2 text-sm text-slate-500">Uploading photo...</p>}
              {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
              <p className="mt-2 text-xs text-slate-400">Use your photo or your company logo.</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-sm font-semibold text-slate-700">My companies</p>
              <ul className="mt-3 space-y-1">
                {companies.length === 0 && <li className="text-sm text-slate-500">No companies yet.</li>}
                {companies.map((c, i) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => { switchTo(c.id); setProfileOpen(false); }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-slate-50">
                      <span className="flex min-w-0 items-center gap-3">
                        <CompanyBadge id={c.id} name={c.name} index={i} size={32} />
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
            </div>

            <div className="border-t border-slate-100 p-6">
              <button type="button" onClick={signOut} className="w-full rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">Sign out</button>
            </div>
          </aside>
        </div>
      )}

      {/* New company dialog */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" onClick={() => setCreating(false)} className="absolute inset-0 bg-slate-900/30" />
          <div role="dialog" aria-modal="true" aria-labelledby="new-company-title" className="relative w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl">
            <h2 id="new-company-title" className="text-xl font-semibold text-[#0b1f3a]">New company</h2>
            <p className="mt-1 mb-6 text-sm text-slate-500">It gets its own customers, invoices and inventory.</p>
            <CreateCompanyForm onDone={() => setCreating(false)} />
          </div>
        </div>
      )}
    </>
  );
}
