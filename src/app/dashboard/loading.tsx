// Se ve al instante mientras carga la siguiente pantalla (antes la pantalla se quedaba "pegada" sin respuesta)
export default function Loading() {
  return (
    <div className="px-4 py-6 lg:px-8" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 animate-pulse rounded-lg bg-slate-200/80" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" style={{ animationDelay: `${i * 80}ms` }} />)}
      </div>
      <div className="mt-4 h-72 animate-pulse rounded-2xl bg-white" />
    </div>
  );
}
