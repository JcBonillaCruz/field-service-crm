// Estilo único de las opciones en las hojas de abajo (celular): texto normal y limpio;
// solo la opción elegida lleva su marco menta con el check. Al tocar, se hunde un poquito.
export const sheetItem = (on: boolean) =>
  `group flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-left text-[15px] transition-all duration-150 active:scale-[0.98] ${on
    ? "border border-[#0f766e] bg-[#f6fbfa] font-medium text-[#0b1f3a]"
    : "border border-transparent text-slate-700 hover:bg-[#f6fbfa] active:bg-[#e9f7f4]"}`;

export const sheetAction =
  "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition-all duration-150 hover:bg-[#f6fbfa] active:scale-[0.97] active:bg-[#e9f7f4]";
