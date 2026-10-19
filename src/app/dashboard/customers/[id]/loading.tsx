export default function LoadingCustomer() {
  return (
    <div className="animate-pulse px-5 py-6 sm:px-8">
      <div className="h-7 w-48 rounded bg-slate-200" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="h-48 rounded-2xl bg-slate-100" />
        <div className="h-48 rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}
