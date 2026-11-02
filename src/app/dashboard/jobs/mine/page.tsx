// Técnico: "My Jobs" llega en el Paso 5.4 (lista del día, mapa, On my way / Start / Pause / Finish)
export default function MyJobsPage() {
  return (
    <section className="mx-auto max-w-md px-5 py-16 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e9f7f4] text-[#0f766e]">
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3M8 17h6" />
        </svg>
      </span>
      <h1 className="mt-5 text-xl font-semibold text-[#0b1f3a]">Your jobs are coming soon</h1>
      <p className="mt-2 text-slate-500">You&apos;ll see the jobs assigned to you, with the map and the On my way, Start and Finish buttons.</p>
    </section>
  );
}
