// =====================================================================
// Advertencia antes de BORRAR cualquier cosa de la base de datos.
// Uso:  if (!(await confirmDelete({ title: "Delete invoice INV-0012?", download: { filename: "INV-0012", data: doc } }))) return;
// Muestra que no se puede recuperar, ofrece descargar una copia antes y pide marcar "Entiendo".
// =====================================================================
export type DeleteAsk = {
  title: string;
  message?: string;
  confirmLabel?: string;
  // Copia de respaldo opcional: datos listos o una función que los trae (se descarga como .json)
  download?: { filename: string; data: unknown | (() => Promise<unknown>) };
};
type Pending = DeleteAsk & { resolve: (ok: boolean) => void };
let listener: ((p: Pending) => void) | null = null;

export function onDeleteAsk(fn: ((p: Pending) => void) | null) { listener = fn; }

export function confirmDelete(ask: DeleteAsk): Promise<boolean> {
  if (!listener) return Promise.resolve(typeof window !== "undefined" && window.confirm(`${ask.title}\n\nThis can't be undone.`));
  return new Promise((resolve) => listener!({ ...ask, resolve }));
}

export function downloadJson(filename: string, data: unknown) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = `${filename.replace(/[^\w.-]+/g, "_")}-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
