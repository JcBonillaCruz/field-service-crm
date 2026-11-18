// =====================================================================
// Paso 5.8 · Avisos al cliente: los textos (inglés y español).
// Sin nada de servidor aquí: lo usan el correo, la página pública y la ficha del trabajo.
// =====================================================================
export type CnKind = "on_my_way" | "reminder" | "review";
export type Lang = "en" | "es";
export type CnSettings = { cn_on_my_way: boolean; cn_reminder: boolean; cn_reminder_days: number; cn_review: boolean; review_url: string | null; review_msg_en?: string | null; review_msg_es?: string | null };

// Hora de llegada: de 5 minutos a 4 horas, de 5 en 5 (el técnico la escoge en una rueda)
export const ETA_MIN = 5, ETA_MAX = 240, ETA_STEP = 5, ETA_DEFAULT = 30;
export const ETA_VALUES = Array.from({ length: (ETA_MAX - ETA_MIN) / ETA_STEP + 1 }, (_, i) => ETA_MIN + i * ETA_STEP);
export const etaValid = (m: unknown) => Number.isInteger(m) && (m as number) >= ETA_MIN && (m as number) <= ETA_MAX;
export const etaLabel = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`);
export const REVIEW_MSG_MAX = 600;
export const REVIEW_GAP_DAYS = 90;

// "Spanish", "Español", "es", "es-MX" → español; todo lo demás, inglés
export const langOf = (l?: string | null): Lang => (/^\s*(es([-_].*)?|spa(nish)?|espa[ñn]ol)\s*$/i.test(l ?? "") ? "es" : "en");
export const firstName = (name?: string | null) => (name ?? "").trim().split(/\s+/)[0] || "";
export const validReviewUrl = (u?: string | null) => /^https:\/\/[^\s"<>]+\.[^\s"<>]+/i.test((u ?? "").trim());

const loc = (lang: Lang) => (lang === "es" ? "es-US" : "en-US");
export function dayText(iso: string, tz: string, lang: Lang) {
  const t = new Date(iso).toLocaleDateString(loc(lang), { timeZone: tz, weekday: "long", month: "long", day: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
export const clockText = (d: Date | string, tz: string, lang: Lang) => new Date(d).toLocaleTimeString(loc(lang), { timeZone: tz, hour: "numeric", minute: "2-digit" });
// "9:00 AM – 10:00 AM" si hay ventana de llegada; si no, la hora exacta
export function arrivalText(v: { starts_at: string | null; arrival_window_min: number }, tz: string, lang: Lang) {
  if (!v.starts_at) return "";
  const s = new Date(v.starts_at);
  return v.arrival_window_min > 0 ? `${clockText(s, tz, lang)} – ${clockText(new Date(s.getTime() + v.arrival_window_min * 60000), tz, lang)}` : clockText(s, tz, lang);
}
// ¿La visita es hoy, mañana o en N días? (según el día del calendario en la zona de la compañía)
export function daysUntil(iso: string, tz: string, now = new Date()) {
  const d = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: tz });
  return Math.round((Date.parse(`${d(new Date(iso))}T00:00:00Z`) - Date.parse(`${d(now)}T00:00:00Z`)) / 86400000);
}

export type CnVars = {
  company: string; customer: string; tech?: string | null; service?: string | null; address?: string | null; number: string;
  day?: string; arrival?: string; eta?: string | null; daysAway?: number; companyPhone?: string | null;
  confirmUrl?: string; changeUrl?: string; reviewUrl?: string | null;
  customReview?: string | null; // mensaje propio de la compañía para pedir la reseña ({name} y {company} se reemplazan)
};
export type CnCopy = {
  subject: string; heading: string; intro: string; rows: [string, string][]; footer: string;
  button?: { label: string; url: string }; button2?: { label: string; url: string };
  sms: string; // el mismo aviso en corto, para mandarlo por texto o WhatsApp
};

// Un solo lugar para lo que dice cada aviso
export function noticeCopy(kind: CnKind, lang: Lang, v: CnVars): CnCopy {
  const es = lang === "es";
  const hi = es ? `Hola${v.customer ? ` ${v.customer}` : ""}` : `Hi ${v.customer || "there"}`;
  const call = v.companyPhone ? (es ? ` o llámenos al ${v.companyPhone}` : ` or call us at ${v.companyPhone}`) : "";

  if (kind === "on_my_way") {
    const who = v.tech || (es ? "Su técnico" : "Your technician");
    const around = v.eta ? (es ? `Llegada estimada: ${v.eta} aprox.` : `Estimated arrival: around ${v.eta}.`) : "";
    return {
      subject: es ? `${who} va en camino · ${v.company}` : `${who} is on the way · ${v.company}`,
      heading: es ? "Vamos en camino" : "We're on our way",
      intro: es ? `${hi}, ${who} de ${v.company} ya va en camino a su domicilio. ${around}`.trim() : `${hi}, ${who} from ${v.company} is on the way to you. ${around}`.trim(),
      rows: [[es ? "Llegada" : "Arriving", v.eta ? (es ? `${v.eta} aprox.` : `Around ${v.eta}`) : ""], [es ? "Técnico" : "Technician", v.tech ?? ""], [es ? "Servicio" : "Service", v.service ?? ""], [es ? "Dirección" : "Address", v.address ?? ""], [es ? "Referencia" : "Reference", v.number]],
      footer: es ? `${v.company} · La hora es aproximada y puede variar con el tráfico. Responda a este correo${call} si necesita algo.` : `${v.company} · The time is an estimate and can change with traffic. Reply to this email${call} if you need anything.`,
      sms: es ? `${hi}, ${who} de ${v.company} va en camino.${v.eta ? ` Llegada estimada: ${v.eta} aprox.` : ""}` : `${hi}, ${who} from ${v.company} is on the way.${v.eta ? ` Estimated arrival: around ${v.eta}.` : ""}`,
    };
  }

  if (kind === "reminder") {
    const n = v.daysAway ?? 1;
    const rel = es ? (n <= 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`) : (n <= 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);
    const whenLine = es ? `${v.day}, llegada ${v.arrival?.includes("–") ? `entre ${v.arrival.replace(" – ", " y ")}` : v.arrival}` : `${v.day}, arriving ${v.arrival?.includes("–") ? `between ${v.arrival.replace(" – ", " and ")}` : `at ${v.arrival}`}`;
    return {
      subject: es ? `Recordatorio: su cita con ${v.company} es ${rel}` : `Reminder: your appointment with ${v.company} is ${rel}`,
      heading: es ? `Su cita es ${rel}` : `Your appointment is ${rel}`,
      intro: es ? `${hi}, le recordamos su servicio con ${v.company}. Por favor confirme su cita, o avísenos si necesita otro horario.` : `${hi}, this is a reminder of your service with ${v.company}. Please confirm your appointment, or let us know if you need another time.`,
      rows: [[es ? "Cuándo" : "When", whenLine], [es ? "Servicio" : "Service", v.service ?? ""], [es ? "Dirección" : "Address", v.address ?? ""], [es ? "Referencia" : "Reference", v.number]],
      button: v.confirmUrl ? { label: es ? "Confirmar cita" : "Confirm appointment", url: v.confirmUrl } : undefined,
      button2: v.changeUrl ? { label: es ? "Pedir otro horario" : "Request another time", url: v.changeUrl } : undefined,
      footer: es ? `${v.company} · También puede responder a este correo${call}.` : `${v.company} · You can also reply to this email${call}.`,
      sms: es
        ? `${hi}, le recordamos su cita con ${v.company}: ${whenLine.replace(/\.$/, "")}.${v.confirmUrl ? ` Confirme o pida otro horario aquí: ${v.confirmUrl}` : ""}`
        : `${hi}, a reminder of your appointment with ${v.company}: ${whenLine}.${v.confirmUrl ? ` Confirm or ask for another time here: ${v.confirmUrl}` : ""}`,
    };
  }

  // review (con el mensaje propio de la compañía, si lo escribió)
  const own = (v.customReview ?? "").trim().replace(/\{name\}/gi, v.customer || (es ? "" : "there")).replace(/\{company\}/gi, v.company).replace(/\s+,/g, ",").replace(/ {2,}/g, " ").trim();
  if (own) return {
    subject: es ? `Gracias por elegir a ${v.company}` : `Thank you for choosing ${v.company}`,
    heading: es ? "Gracias por su confianza" : "Thank you for your business",
    intro: own,
    rows: [[es ? "Servicio" : "Service", v.service ?? ""], [es ? "Atendido por" : "Served by", v.tech ?? ""], [es ? "Referencia" : "Reference", v.number]],
    button: v.reviewUrl ? { label: es ? "Dejar una reseña en Google" : "Leave a Google review", url: v.reviewUrl } : undefined,
    footer: es ? `${v.company} · Si algo no quedó como esperaba, responda a este correo${call} y lo resolvemos.` : `${v.company} · If anything wasn't right, reply to this email${call} and we'll make it right.`,
    sms: `${own} ${v.reviewUrl ?? ""}`.trim(),
  };
  return {
    subject: es ? `Gracias por elegir a ${v.company}` : `Thank you for choosing ${v.company}`,
    heading: es ? "Gracias por su confianza" : "Thank you for your business",
    intro: es
      ? `${hi}, gracias por confiar en ${v.company}. Si tiene un minuto, su reseña en Google nos ayuda mucho y ayuda a otros vecinos a encontrarnos.`
      : `${hi}, thank you for trusting ${v.company}. If you have a minute, a Google review helps us a lot and helps your neighbors find us.`,
    rows: [[es ? "Servicio" : "Service", v.service ?? ""], [es ? "Atendido por" : "Served by", v.tech ?? ""], [es ? "Referencia" : "Reference", v.number]],
    button: v.reviewUrl ? { label: es ? "Dejar una reseña en Google" : "Leave a Google review", url: v.reviewUrl } : undefined,
    footer: es ? `${v.company} · Si algo no quedó como esperaba, responda a este correo${call} y lo resolvemos.` : `${v.company} · If anything wasn't right, reply to this email${call} and we'll make it right.`,
    sms: es
      ? `${hi}, gracias por elegir a ${v.company}. Si tiene un minuto, ¿nos deja una reseña en Google? ${v.reviewUrl ?? ""}`.trim()
      : `${hi}, thank you for choosing ${v.company}. If you have a minute, would you leave us a Google review? ${v.reviewUrl ?? ""}`.trim(),
  };
}

// Teléfono listo para sms: y wa.me (10 dígitos de EE. UU. → se les pone el 1)
export function phoneDigits(p?: string | null) {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length === 10 ? `1${d}` : d;
}
export const smsLink = (phone: string | null | undefined, text: string) => `sms:${phoneDigits(phone) ? `+${phoneDigits(phone)}` : ""}?&body=${encodeURIComponent(text)}`;
export const waLink = (phone: string | null | undefined, text: string) => `https://wa.me/${phoneDigits(phone)}?text=${encodeURIComponent(text)}`;

export const CN_LABEL: Record<CnKind, string> = { on_my_way: "On-my-way notice", reminder: "Appointment reminder", review: "Review request" };
