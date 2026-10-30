// Técnicos: su van, escanear "Use" y su consumo llegan en el Paso 4.2
export default function TechnicianSoon() {
  return (
    <section className="mx-auto max-w-md px-5 py-16 text-center animate-[bp-fade_0.3s_ease-out]">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff7e6] text-[#d97706]">
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 7 19zM17 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z" />
        </svg>
      </span>
      <h1 className="mt-5 text-xl font-semibold text-[#0b1f3a]">Your van inventory is coming soon</h1>
      <p className="mt-2 text-slate-500">You&apos;ll see the parts in your van here and scan them when you use them on a job.</p>
    </section>
  );
}
