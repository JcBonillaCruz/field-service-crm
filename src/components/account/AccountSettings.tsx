"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { bustCache } from "@/lib/cache-client";
import { MAX_PHOTO_MB, removeAvatar, uploadAvatar } from "@/lib/avatar";
import Avatar from "@/components/Avatar";
import OrganizationList, { NewOrgButton } from "@/components/OrganizationList";
import CreateCompanyForm from "@/components/CreateCompanyForm";
import { Modal } from "@/components/sales/SalesBits";
import { inputClass } from "@/components/customers/ui";
import { CompanySummary, CurrentUser, formatPhone, setCurrentCompany } from "@/lib/types";

// =====================================================================
// Mi cuenta (como un software profesional): foto, datos personales,
// correo, contraseña, organizaciones y borrar la cuenta completa.
// =====================================================================
function Card({ id, title, sub, children, danger }: { id?: string; title: string; sub?: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section id={id} className={`scroll-mt-24 rounded-2xl border bg-white p-5 sm:p-6 ${danger ? "border-[#fecdd3]" : "border-slate-200"}`}>
      <h2 className={`text-[17px] font-semibold ${danger ? "text-[#be123c]" : "text-[#0b1f3a]"}`}>{title}</h2>
      {sub && <p className="mt-0.5 text-[13.5px] text-slate-500">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
const lbl = "mb-1.5 block text-[13px] font-medium text-slate-700";
const btn = "rounded-lg bg-[#0f766e] px-5 py-2.5 text-[14px] font-semibold text-white transition-transform hover:bg-[#0c5f59] active:scale-95 disabled:opacity-50";
function Note({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return <p className={`mt-3 rounded-lg px-3 py-2 text-[13px] ${m.ok ? "bg-[#ecfdf5] text-[#047857]" : "bg-[#fff1f2] text-[#be123c]"}`}>{m.text}</p>;
}

export default function AccountSettings({ user, companies, currentId }: { user: CurrentUser; companies: CompanySummary[]; currentId: string | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [name, setName] = useState(user.fullName);
  const [phone, setPhone] = useState("");
  const [infoMsg, setInfoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [infoBusy, setInfoBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const [creating, setCreating] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState("");

  // El teléfono vive en los datos del usuario (Auth)
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setPhone(formatPhone(String(data.user?.user_metadata?.phone ?? ""))));
  }, []);

  async function onPhoto(f?: File) {
    if (!f) return;
    setPhotoBusy(true); setPhotoMsg(null);
    const err = await uploadAvatar(user.id, f);
    setPhotoBusy(false);
    setPhotoMsg(err ? { ok: false, text: err } : { ok: true, text: "Photo updated." });
    if (!err) router.refresh();
  }
  async function saveInfo() {
    if (!name.trim()) return setInfoMsg({ ok: false, text: "Enter your name." });
    setInfoBusy(true); setInfoMsg(null);
    const s = createClient();
    const [a, b] = await Promise.all([
      s.from("profiles").update({ full_name: name.trim() }).eq("id", user.id),
      s.auth.updateUser({ data: { full_name: name.trim(), phone: phone.replace(/\D/g, "") } }),
    ]);
    await bustCache("profile");
    setInfoBusy(false);
    setInfoMsg(a.error || b.error ? { ok: false, text: "It couldn't be saved. Try again." } : { ok: true, text: "Saved." });
    router.refresh();
  }
  async function changeEmail() {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return setEmailMsg({ ok: false, text: "Enter a valid email." });
    if (e === user.email.toLowerCase()) return setEmailMsg({ ok: false, text: "That's already your email." });
    const { error } = await createClient().auth.updateUser({ email: e });
    setEmailMsg(error ? { ok: false, text: error.message } : { ok: true, text: `We sent a confirmation link to ${e}. Your email changes after you confirm it.` });
    if (!error) setEmail("");
  }
  async function changePassword() {
    setPwMsg(null);
    if (pw.next.length < 8) return setPwMsg({ ok: false, text: "The new password needs at least 8 characters." });
    if (pw.next !== pw.again) return setPwMsg({ ok: false, text: "The new passwords don't match." });
    setPwBusy(true);
    const s = createClient();
    // Confirmar la contraseña actual antes de cambiarla
    const { error: e1 } = await s.auth.signInWithPassword({ email: user.email, password: pw.current });
    if (e1) { setPwBusy(false); return setPwMsg({ ok: false, text: "Your current password is not correct." }); }
    const { error } = await s.auth.updateUser({ password: pw.next });
    setPwBusy(false);
    setPwMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Password changed." });
    if (!error) setPw({ current: "", next: "", again: "" });
  }
  async function deleteAccount() {
    setDelBusy(true); setDelErr("");
    const r = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: delText.trim() }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setDelBusy(false); return setDelErr(j.error || "The account couldn't be deleted."); }
    await createClient().auth.signOut();
    window.location.href = "/";
  }
  const owned = companies.filter((c) => c.role === "owner");

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f6f8f9]">
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0b1f3a]">My account</h1>
          <p className="text-[14px] text-slate-500">Your personal information, sign-in and organizations.</p>
        </div>

        <Card title="Profile photo" sub={`JPG, PNG, WEBP or HEIC up to ${MAX_PHOTO_MB} MB. We resize it automatically.`}>
          <div className="flex flex-wrap items-center gap-5">
            <div className="relative">
              <Avatar name={user.fullName || user.email} url={user.avatarUrl} seed={user.id} size={96} />
              {photoBusy && <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70"><span className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#d7f1eb] border-t-[#0f766e]" /></span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={photoBusy} onClick={() => fileRef.current?.click()} className={btn}>Upload photo</button>
              <button type="button" disabled={photoBusy} onClick={() => camRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[14px] font-semibold text-slate-700 hover:border-[#14a39a] hover:text-[#0f766e]">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>Take a photo
              </button>
              {user.avatarUrl && <button type="button" disabled={photoBusy} onClick={async () => { await removeAvatar(user.id); router.refresh(); }} className="rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#e11d48] hover:bg-[#fff1f2]">Remove</button>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
            <input ref={camRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          <Note m={photoMsg} />
        </Card>

        <Card title="Personal information">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className={lbl}>Full name</span><input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></label>
            <label className="block"><span className={lbl}>Mobile phone</span><input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(214) 555-0123" className={inputClass} /></label>
          </div>
          <button type="button" disabled={infoBusy} onClick={saveInfo} className={`${btn} mt-4`}>{infoBusy ? "Saving…" : "Save changes"}</button>
          <Note m={infoMsg} />
        </Card>

        <Card id="security" title="Sign-in & security" sub="Change the email and password you use to sign in.">
          <div className="space-y-5">
            <div>
              <span className={lbl}>Email</span>
              <p className="mb-2 text-[14px] text-slate-600">Current: <b className="text-[#0b1f3a]">{user.email}</b></p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="New email" className={`${inputClass} sm:flex-1`} />
                <button type="button" onClick={changeEmail} className="rounded-lg border border-[#0f766e] px-4 py-2.5 text-[14px] font-semibold text-[#0f766e] hover:bg-[#f0faf7]">Change email</button>
              </div>
              <Note m={emailMsg} />
            </div>
            <div className="border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between"><span className={lbl}>Password</span>
                <button type="button" onClick={() => setShowPw((v) => !v)} className="text-[12px] font-medium text-[#0f766e]">{showPw ? "Hide" : "Show"} passwords</button></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <input type={showPw ? "text" : "password"} autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} placeholder="Current password" className={inputClass} />
                <input type={showPw ? "text" : "password"} autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="New password" className={inputClass} />
                <input type={showPw ? "text" : "password"} autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} placeholder="Repeat new password" className={inputClass} />
              </div>
              <button type="button" disabled={pwBusy || !pw.current} onClick={changePassword} className={`${btn} mt-3`}>{pwBusy ? "Changing…" : "Change password"}</button>
              <Note m={pwMsg} />
            </div>
          </div>
        </Card>

        <Card title="My organizations" sub="Open, edit or delete your businesses. Deleting an organization doesn't delete the accounts of people who had access to it.">
          <OrganizationList companies={companies} currentId={currentId} userId={user.id} compact
            onOpen={(id) => { setCurrentCompany(id); router.push("/dashboard"); router.refresh(); }} />
          <div className="mt-2 border-t border-slate-100 pt-2"><NewOrgButton onClick={() => setCreating(true)} /></div>
        </Card>

        <Card title="Team & invitations" sub="Coming soon">
          <p className="text-[14px] text-slate-600">As an owner you'll be able to add your employees (technicians, office, managers) or send them an invitation with their role already assigned, so they create their own login.</p>
        </Card>

        <Card id="delete" title="Delete account" sub="Permanently delete your BrightPro account." danger>
          <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-slate-600">
            <li>Organizations where you are the only owner{owned.length ? ` (${owned.map((c) => c.name).join(", ")})` : ""} are deleted with all their data.</li>
            <li>Organizations shared with another owner stay as they are; you just leave them.</li>
            <li>This can&apos;t be undone. Download backups from each organization first if you need them.</li>
          </ul>
          <button type="button" onClick={() => { setDelOpen(true); setDelText(""); setDelErr(""); }}
            className="mt-4 flex items-center gap-2 rounded-lg border border-[#fecdd3] bg-[#fff1f2] px-4 py-2.5 text-[14px] font-semibold text-[#be123c] hover:bg-[#ffe4e6]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6.5h16M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7M6 6.5l.9 12.4c.1 1 .9 1.6 1.8 1.6h6.6c.9 0 1.7-.7 1.8-1.6L18 6.5" /></svg>
            Delete my account
          </button>
        </Card>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="New organization" width="max-w-xl">
        <CreateCompanyForm onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />
      </Modal>
      <Modal open={delOpen} onClose={() => !delBusy && setDelOpen(false)} title="Delete your account?">
        <p className="text-[14px] leading-relaxed text-slate-600">Your login, your profile and the organizations where you&apos;re the only owner will be deleted forever. This can&apos;t be recovered and you do it under your own responsibility.</p>
        <p className="mt-4 text-[13px] text-slate-500">Type <b className="text-[#be123c]">DELETE</b> to confirm:</p>
        <input autoFocus value={delText} onChange={(e) => setDelText(e.target.value)} className={`${inputClass} mt-1`} />
        {delErr && <p className="mt-2 text-[13px] text-[#be123c]">{delErr}</p>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" disabled={delBusy} onClick={() => setDelOpen(false)} className="rounded-xl border border-slate-200 py-3 text-[15px] font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" disabled={delBusy || delText.trim() !== "DELETE"} onClick={deleteAccount} className="rounded-xl bg-[#e11d48] py-3 text-[15px] font-semibold text-white hover:bg-[#be123c] disabled:opacity-40">{delBusy ? "Deleting…" : "Delete forever"}</button>
        </div>
      </Modal>
    </div>
  );
}
