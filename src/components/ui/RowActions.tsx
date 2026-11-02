"use client";

import Link from "next/link";

// Botones rápidos de una fila (aparecen al pasar el mouse): ✏️ editar · 🗑️ eliminar (siempre con la alerta de confirmación)
// Se usan en todas las listas: Customers, Items, Coupons, Quotes, Invoices, Subscriptions, Team, Inventory.
export default function RowActions({ editHref, onEdit, onDelete, label, className = "" }: {
  editHref?: string; onEdit?: () => void; onDelete?: () => void; label: string; className?: string;
}) {
  const btn = "flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-all duration-200 ease-out hover:scale-110 hover:shadow-md";
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}
      className={`flex items-center gap-1.5 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 ${className}`}>
      {editHref && (
        <Link prefetch={false} href={editHref} aria-label={`Edit ${label}`} title="Edit" className={`group/edit ${btn} hover:border-[#14a39a] hover:bg-[#e9f7f4] hover:text-[#0f766e]`}>
          <svg viewBox="0 0 24 24" className="h-[17px] w-[17px] transition-transform duration-200 group-hover/edit:-rotate-12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        </Link>
      )}
      {!editHref && onEdit && (
        <button type="button" onClick={onEdit} aria-label={`Edit ${label}`} title="Edit" className={`group/edit ${btn} hover:border-[#14a39a] hover:bg-[#e9f7f4] hover:text-[#0f766e]`}>
          <svg viewBox="0 0 24 24" className="h-[17px] w-[17px] transition-transform duration-200 group-hover/edit:-rotate-12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        </button>
      )}
      {onDelete && (
        <button type="button" onClick={onDelete} aria-label={`Delete ${label}`} title="Delete" className={`group/del ${btn} hover:border-[#fda4af] hover:bg-[#fff1f2] hover:text-[#e11d48]`}>
          <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path className="origin-[18px_6px] transition-transform duration-200 group-hover/del:-rotate-12" d="M4 6.5h16M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7" />
            <path d="M6 6.5l.9 12.4c.1 1 .9 1.6 1.8 1.6h6.6c.9 0 1.7-.7 1.8-1.6L18 6.5M10 11v5M14 11v5" />
          </svg>
        </button>
      )}
    </span>
  );
}
