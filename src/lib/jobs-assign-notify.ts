// =====================================================================
// Aviso al colaborador RECIÉN ASIGNADO a un trabajo (campana + push + correo).
// Lo usan Assign jobs y Operations. Regla (Paso 5.3c):
//   · agregar a una persona a un trabajo  -> SÍ se le avisa (solo a esa persona)
//   · mover, reordenar, cambiar de columna o quitar a alguien -> NO se avisa ni se pregunta nada
// Devuelve null si todo salió bien, o un texto corto con el motivo si el aviso no pudo salir
// (antes fallaba en silencio y nadie se enteraba).
// =====================================================================
export async function notifyAssigned(target: { visitId?: string; jobId?: string }, assigned: string[]): Promise<string | null> {
  if (!assigned.length) return null;
  try {
    const r = await fetch("/api/jobs/notify", {
      method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...target, assigned }),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; skipped?: string; bell?: number };
    if (!r.ok || j.ok === false) return j.error || "the alert couldn't be sent";
    if (j.skipped === "setting_off") return null; // la compañía apagó "avisar al técnico" en Job settings: es a propósito
    if (!j.bell) return "the alert couldn't be saved";
    return null;
  } catch { return "no connection"; }
}
