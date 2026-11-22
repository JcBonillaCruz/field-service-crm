// =====================================================================
// Paso 6.2d · Lo que ve el CLIENTE, en SU idioma (Customer Language de la ficha del cliente).
// No depende del idioma de la persona que usa BrightPro: una oficina en inglés manda la factura en español
// si el cliente habla español. Se usa en la pantalla (DocPaper), el PDF del servidor, el enlace /share,
// el correo y el texto por SMS / WhatsApp. Sin nada de servidor aquí (sirve en el navegador y en el servidor).
// Lo que escribe la compañía (artículos, notas, términos, nombre del impuesto) NO se traduce.
// =====================================================================
import { langOf, type Lang } from "@/lib/customer-notice-text";

export type DocLang = Lang;
// "Spanish" (como se guarda en la ficha del cliente), "es", "Español" → español; todo lo demás, inglés
export const docLangOf = (customerLanguage?: string | null): DocLang => langOf(customerLanguage);
export const isDocLang = (v: unknown): v is DocLang => v === "en" || v === "es";

type Kind = "quote" | "invoice";
type Variant = "full" | "delivery" | "packing";

const EN = {
  title: { quote: "QUOTE", invoice: "INVOICE", delivery: "DELIVERY NOTE", packing: "PACKING SLIP" },
  noun: { quote: "Quote", invoice: "Invoice" },
  lowNoun: { quote: "quote", invoice: "invoice" },
  balanceDue: "Balance Due",
  billTo: "Bill To", jobSite: "Job Site", jobSiteShip: "Job Site / Ship To",
  quoteDate: "Quote Date", expiryDate: "Expiry Date", reference: "Reference#", salesperson: "Salesperson",
  invoiceDate: "Invoice Date", terms: "Terms", dueDate: "Due Date", po: "P.O.#",
  subject: "Subject", items: "Items", item: "Item", itemDesc: "Item & Description", qty: "Qty", rate: "Rate", amount: "Amount", packed: "Packed", noItems: "No items",
  subTotal: "Sub Total", discount: "Discount", tax: "Tax", shipping: "Shipping Charges", adjustment: "Adjustment", total: "Total",
  paymentMade: "Payment Made", writtenOff: "Written Off",
  notes: "Notes", termsConditions: "Terms & Conditions", thanks: "Thank you!",
  signedBy: "Accepted & signed by the customer", signatureOf: (n: string) => `Signature of ${n}`,
  receivedBy: "Received by (name & signature)", date: "Date", poweredBy: "POWERED BY",
  jobPhotos: "Job Photos", jobPhotosMore: "Job Photos (continued)",
  status: {
    draft: "Draft", sent: "Sent", viewed: "Viewed", accepted: "Accepted", declined: "Declined", invoiced: "Invoiced", expired: "Expired",
    void: "Void", written_off: "Written Off", paid: "Paid", overdue: "Overdue", partially_paid: "Partially Paid",
  } as Record<string, string>,
  payTerms: {} as Record<string, string>,
  // Correo
  viewBtn: { quote: "VIEW QUOTE", invoice: "VIEW INVOICE" },
  dueOn: (d: string) => `Due ${d}`, validUntil: (d: string) => `Valid until ${d}`, sentWith: "Sent with",
  // Enlace público
  share: {
    unavailable: "This link isn't available", unavailableText: "It may have expired or been disabled. Please contact the business that sent it.",
    due: (d: string) => `due ${d}`, sentWith: "Sent with BrightPro", other: "Ver en español", otherLang: "es" as DocLang,
    accept: "Accept & Sign", decline: "Decline", declineQ: "Decline this quote?", cancel: "Cancel", pdf: "Download PDF", print: "Print",
    fullName: "Full name", signHere: "Sign above with your finger or mouse", clear: "Clear", saving: "Saving...",
    agree: "I accept this quote and agree that this electronic signature is as valid as my handwritten signature.",
    eName: "Type your full name.", eSig: "Please sign in the box.", eAgree: "Please confirm you accept the quote.", eBoth: "Please sign and type your name.",
    accepted: "Thank you! The quote was accepted and signed.", declined: "The quote was declined.", locked: "This quote can't be changed anymore.",
    pageTitle: "Your document",
  },
};
type Dict = typeof EN;

const ES: Dict = {
  title: { quote: "COTIZACIÓN", invoice: "FACTURA", delivery: "NOTA DE ENTREGA", packing: "LISTA DE EMPAQUE" },
  noun: { quote: "Cotización", invoice: "Factura" },
  lowNoun: { quote: "cotización", invoice: "factura" },
  balanceDue: "Saldo pendiente",
  billTo: "Facturar a", jobSite: "Lugar del trabajo", jobSiteShip: "Lugar del trabajo / Envío",
  quoteDate: "Fecha de cotización", expiryDate: "Válida hasta", reference: "Referencia #", salesperson: "Vendedor",
  invoiceDate: "Fecha de factura", terms: "Condiciones", dueDate: "Fecha de vencimiento", po: "Orden de compra #",
  subject: "Asunto", items: "Artículos", item: "Artículo", itemDesc: "Artículo y descripción", qty: "Cant.", rate: "Precio", amount: "Importe", packed: "Empacado", noItems: "Sin artículos",
  subTotal: "Subtotal", discount: "Descuento", tax: "Impuesto", shipping: "Cargos de envío", adjustment: "Ajuste", total: "Total",
  paymentMade: "Pago recibido", writtenOff: "Saldo cancelado",
  notes: "Notas", termsConditions: "Términos y condiciones", thanks: "¡Gracias!",
  signedBy: "Aceptada y firmada por el cliente", signatureOf: (n: string) => `Firma de ${n}`,
  receivedBy: "Recibido por (nombre y firma)", date: "Fecha", poweredBy: "HECHO CON",
  jobPhotos: "Fotos del trabajo", jobPhotosMore: "Fotos del trabajo (continuación)",
  status: {
    draft: "Borrador", sent: "Enviada", viewed: "Vista", accepted: "Aceptada", declined: "Rechazada", invoiced: "Facturada", expired: "Vencida",
    void: "Anulada", written_off: "Cancelada", paid: "Pagada", overdue: "Vencida", partially_paid: "Pago parcial",
  },
  payTerms: {
    "Due on Receipt": "Pago al recibir", "Net 15": "15 días", "Net 30": "30 días", "Net 45": "45 días", "Net 60": "60 días",
    "Due end of the month": "Fin de mes", "Due end of next month": "Fin del próximo mes",
  },
  viewBtn: { quote: "VER COTIZACIÓN", invoice: "VER FACTURA" },
  dueOn: (d: string) => `Vence el ${d}`, validUntil: (d: string) => `Válida hasta el ${d}`, sentWith: "Enviado con",
  share: {
    unavailable: "Este enlace no está disponible", unavailableText: "Puede que haya vencido o que lo hayan desactivado. Comuníquese con el negocio que se lo envió.",
    due: (d: string) => `vence el ${d}`, sentWith: "Enviado con BrightPro", other: "View in English", otherLang: "en",
    accept: "Aceptar y firmar", decline: "Rechazar", declineQ: "¿Rechazar esta cotización?", cancel: "Cancelar", pdf: "Descargar PDF", print: "Imprimir",
    fullName: "Nombre completo", signHere: "Firme arriba con el dedo o el mouse", clear: "Borrar", saving: "Guardando...",
    agree: "Acepto esta cotización y estoy de acuerdo en que esta firma electrónica vale igual que mi firma a mano.",
    eName: "Escriba su nombre completo.", eSig: "Por favor firme en el recuadro.", eAgree: "Por favor confirme que acepta la cotización.", eBoth: "Por favor firme y escriba su nombre.",
    accepted: "¡Gracias! La cotización quedó aceptada y firmada.", declined: "La cotización fue rechazada.", locked: "Esta cotización ya no se puede cambiar.",
    pageTitle: "Su documento",
  },
};

export const docTx = (lang: DocLang): Dict => (lang === "es" ? ES : EN);

// Fechas como en el documento: "20 Oct 2026" / "20 oct 2026"
export function docDate(v: string | null | undefined, lang: DocLang) {
  if (!v) return "";
  return new Date(v.length === 10 ? `${v}T12:00:00` : v).toLocaleDateString(lang === "es" ? "es-US" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
export function docDateTime(v: string, lang: DocLang) {
  return new Date(v).toLocaleString(lang === "es" ? "es-US" : "en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}
export const docTitle = (lang: DocLang, kind: Kind, variant: Variant = "full") => {
  const t = docTx(lang).title;
  return variant === "delivery" ? t.delivery : variant === "packing" ? t.packing : t[kind];
};
// Las condiciones de pago se guardan en inglés ("Net 30"); se traducen solo si son de la lista
export const docTerms = (lang: DocLang, terms: string | null | undefined) => (terms ? docTx(lang).payTerms[terms] ?? terms : "");
// Cinta del documento: "Overdue by 3 days" → "Overdue" / "Vencida"
export const docRibbon = (lang: DocLang, status: { key: string; label: string }) =>
  lang === "en" ? status.label.replace(/^Overdue by .*/, "Overdue") : docTx(lang).status[status.key] ?? status.label;

// Los datos del encabezado (fecha, vence, referencia…) en el orden de siempre
export function docMeta(lang: DocLang, d: { kind: Kind; doc_date: string; expiry_date: string | null; reference: string | null; salesperson: string | null; payment_terms: string | null; due_date: string | null; order_number: string | null }): [string, string][] {
  const t = docTx(lang);
  const rows: [string, string][] = d.kind === "quote"
    ? [[t.quoteDate, docDate(d.doc_date, lang)], [t.expiryDate, docDate(d.expiry_date, lang)], [t.reference, d.reference ?? ""], [t.salesperson, d.salesperson ?? ""]]
    : [[t.invoiceDate, docDate(d.doc_date, lang)], [t.terms, docTerms(lang, d.payment_terms)], [t.dueDate, docDate(d.due_date, lang)], [t.po, d.order_number ?? ""], [t.salesperson, d.salesperson ?? ""]];
  return rows.filter(([, v]) => v);
}
// Qué ícono lleva cada dato (plantillas ✦): fecha, persona o número
export const metaIcon = (lang: DocLang, label: string): "calendar" | "user" | "hash" => {
  const t = docTx(lang);
  if ([t.quoteDate, t.expiryDate, t.invoiceDate, t.dueDate].includes(label)) return "calendar";
  return label === t.salesperson ? "user" : "hash";
};

// ---------- Correo y texto que se le manda al cliente ----------
export type MailVars = { kind: Kind; number: string; customer: string; amount: string; due: string | null; actor: string; company: string; whiteLabel: boolean; reminder?: boolean };

export function docEmailSubject(lang: DocLang, v: MailVars) {
  const tail = v.whiteLabel ? "" : lang === "es" ? " - Enviado con BrightPro" : " - Sent Using BrightPro";
  if (lang === "es") {
    if (v.reminder) return `Recordatorio de pago: la factura ${v.number} está por vencer${tail}`;
    return v.kind === "quote" ? `Cotización ${v.number}: espera su aprobación${tail}` : `Factura ${v.number} de ${v.company}${tail}`;
  }
  if (v.reminder) return `Payment reminder: Invoice - ${v.number} is due${tail}`;
  return v.kind === "quote" ? `Quote - ${v.number} is awaiting your approval${tail}` : `Invoice - ${v.number} from ${v.company}${tail}`;
}

// {link} es donde va el botón; **negrita** como en el cuadro de texto
export function docEmailBody(lang: DocLang, v: MailVars) {
  const sign = `${v.actor || v.company}\n${v.company}`;
  if (lang === "es") {
    if (v.reminder) return `Estimado(a) ${v.customer}:\n\nLe recordamos amablemente que la factura ${v.number} por ${v.amount} venció el ${v.due ?? ""}.\n\nPuede ver, imprimir o descargar la factura en el enlace de abajo.\n{link}\n\nGracias,\n${sign}`;
    return v.kind === "quote"
      ? `Estimado(a) ${v.customer}:\n\nGracias por comunicarse con nosotros. Su cotización ${v.number} por **${v.amount}** está lista.\n\nPuede verla, aceptarla y firmarla en el enlace de abajo.\n{link}\n\nQuedamos atentos para trabajar con usted.\n\nSaludos,\n${sign}`
      : `Estimado(a) ${v.customer}:\n\nFue un gusto atenderle. Su factura ${v.number} por **${v.amount}** vence el ${v.due ?? ""}.\n\nPuede ver, imprimir o descargar la factura en el enlace de abajo.\n{link}\n\nSaludos,\n${sign}`;
  }
  if (v.reminder) return `Dear ${v.customer},\n\nThis is a friendly reminder that invoice ${v.number} for ${v.amount} was due on ${v.due ?? ""}.\n\nYou can view, print or download the invoice from the link below.\n{link}\n\nThank you,\n${sign}`;
  return v.kind === "quote"
    ? `Dear ${v.customer},\n\nThank you for contacting us. Your quote ${v.number} for **${v.amount}** is ready.\n\nYou can view, accept and sign the quote from the link below.\n{link}\n\nWe look forward to working with you.\n\nRegards,\n${sign}`
    : `Dear ${v.customer},\n\nIt was a pleasure doing business with you. Your invoice ${v.number} for **${v.amount}** is due on ${v.due ?? ""}.\n\nYou can view, print or download the invoice from the link below.\n{link}\n\nRegards,\n${sign}`;
}

// Texto corto para mandarlo por SMS o WhatsApp
export function docTextMessage(lang: DocLang, v: { kind: Kind; number: string; customer: string; amount: string; company: string; url: string }) {
  if (lang === "es") return `Hola ${v.customer}, aquí está su ${v.kind === "quote" ? "cotización" : "factura"} ${v.number} por ${v.amount}${v.company ? ` de ${v.company}` : ""}. Puede verla aquí: ${v.url}`;
  return `Hi ${v.customer}, here is your ${v.kind} ${v.number} for ${v.amount}${v.company ? ` from ${v.company}` : ""}. You can view it here: ${v.url}`;
}

// ---------- Reporte de servicio (Paso 5.13) ----------
const REPORT_EN = {
  title: "Service report", serviceDate: "Service date", tech: "Technician", techs: "Technicians", type: "Type of service", service: "Service",
  customer: "Customer", address: "Service address", job: "Job", onSite: "On site", to: "to", visits: "Visits", reason: "Reason for the visit",
  tuneUp: "Tune-Up checklist and readings", work: (title: string) => `${title}: what we found and did`,
  items: "Services and materials", desc: "Description", kind: "Type", qty: "Qty", material: "Material", part: "Part",
  equipment: "Equipment at this address", equip: "Equipment", model: "Model", serial: "Serial", photos: "Photos",
  photo: { before: "Before", after: "After", during: "During", serial: "Equipment label", other: "" } as Record<string, string>,
  thanks: (c: string) => `Thank you for choosing ${c}. If you have any question about this visit, reply to this email or call us.`,
  visit: "Service visit", jobNo: (n: string) => `Job #${n}`, yes: "Yes",
};
const REPORT_ES: typeof REPORT_EN = {
  title: "Reporte de servicio", serviceDate: "Fecha del servicio", tech: "Técnico", techs: "Técnicos", type: "Tipo de servicio", service: "Servicio",
  customer: "Cliente", address: "Dirección del servicio", job: "Trabajo", onSite: "En el lugar", to: "a", visits: "Visitas", reason: "Motivo de la visita",
  tuneUp: "Lista y lecturas del mantenimiento (Tune-Up)", work: (title: string) => `${title}: lo que encontramos y lo que hicimos`,
  items: "Servicios y materiales", desc: "Descripción", kind: "Tipo", qty: "Cant.", material: "Material", part: "Pieza",
  equipment: "Equipos en esta dirección", equip: "Equipo", model: "Modelo", serial: "Serie", photos: "Fotos",
  photo: { before: "Antes", after: "Después", during: "Durante", serial: "Etiqueta del equipo", other: "" },
  thanks: (c: string) => `Gracias por elegir a ${c}. Si tiene alguna pregunta sobre esta visita, responda a este correo o llámenos.`,
  visit: "Visita de servicio", jobNo: (n: string) => `Trabajo #${n}`, yes: "Sí",
};
export const reportTx = (lang: DocLang) => (lang === "es" ? REPORT_ES : REPORT_EN);
