// =====================================================================
// Formularios del técnico (Paso 5.5): Work form y Tune-Up de HVAC.
//  · Los campos viven aquí (una sola definición para el teléfono, el iPad y la ficha de oficina).
//  · Las lecturas fuera de rango se calculan aquí mismo: salen en rojo y se guardan en "alerts".
//  · Los rangos son valores de partida; cada compañía los ajusta en Job settings (job_settings.tuneup_ranges).
// =====================================================================
export type FormKind = "work" | "tune_up";
export type FormData = Record<string, string | boolean | null | undefined>;
export type Range = { min?: number | null; max?: number | null };
export type Ranges = Record<string, Range>;

export type Choice = { value: string; label: string; bad?: boolean };
export type Field = {
  key: string; label: string; type: "number" | "choice" | "text" | "textarea" | "check";
  unit?: string; placeholder?: string; options?: Choice[]; required?: boolean; wide?: boolean;
  range?: string;                       // llave del rango que la revisa
  when?: (d: FormData) => boolean;      // campo condicional
};
export type Section = { id: string; title: string; note?: string; when?: (d: FormData) => boolean; fields: Field[] };

export type JobFormRow = {
  id: string; kind: FormKind; data: FormData; alerts: string[]; equipment_id: string | null;
  submitted_by_name: string | null; submitted_at: string | null; created_at: string; updated_at: string | null;
};

// ---------- Rangos (valores de partida, se pueden cambiar por compañía) ----------
export const RANGE_DEFS: { key: string; label: string; unit: string; help?: string }[] = [
  { key: "delta_t", label: "Delta T (cooling)", unit: "°F", help: "Return minus supply air" },
  { key: "temp_rise", label: "Temperature rise (heating)", unit: "°F", help: "Supply minus return air" },
  { key: "line_voltage", label: "Line voltage", unit: "V" },
  { key: "control_voltage", label: "Control voltage", unit: "V" },
  { key: "cap_tolerance", label: "Capacitor tolerance", unit: "%", help: "How far from the rated µF is still OK (only the max is used)" },
  { key: "superheat", label: "Superheat", unit: "°F" },
  { key: "subcooling", label: "Subcooling", unit: "°F" },
  { key: "suction_pressure", label: "Suction pressure", unit: "psi", help: "Empty = not checked (it depends on the refrigerant)" },
  { key: "liquid_pressure", label: "Liquid pressure", unit: "psi", help: "Empty = not checked (it depends on the refrigerant)" },
  { key: "gas_pressure_nat", label: "Gas pressure · natural gas", unit: "in. w.c." },
  { key: "gas_pressure_lp", label: "Gas pressure · propane", unit: "in. w.c." },
  { key: "flame_sensor", label: "Flame sensor", unit: "µA" },
  { key: "co_ppm", label: "Carbon monoxide", unit: "ppm" },
];
export const DEFAULT_RANGES: Ranges = {
  delta_t: { min: 16, max: 22 },
  temp_rise: { min: 30, max: 70 },
  line_voltage: { min: 197, max: 253 },
  control_voltage: { min: 22, max: 28 },
  cap_tolerance: { max: 6 },
  superheat: { min: 8, max: 18 },
  subcooling: { min: 8, max: 14 },
  suction_pressure: {},
  liquid_pressure: {},
  gas_pressure_nat: { min: 3.2, max: 3.8 },
  gas_pressure_lp: { min: 10, max: 11 },
  flame_sensor: { min: 2 },
  co_ppm: { max: 9 },
};
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
// Rangos de la compañía encima de los de la app (solo se aceptan números)
export function mergeRanges(custom: unknown): Ranges {
  const out: Ranges = {};
  const c = (custom && typeof custom === "object" ? custom : {}) as Record<string, Range | undefined>;
  for (const d of RANGE_DEFS) {
    const base = DEFAULT_RANGES[d.key] ?? {}, mine = c[d.key];
    out[d.key] = mine && typeof mine === "object"
      ? { min: isNum(mine.min) ? mine.min : mine.min === null ? null : base.min, max: isNum(mine.max) ? mine.max : mine.max === null ? null : base.max }
      : { ...base };
  }
  return out;
}
export const rangeText = (r: Range | undefined, unit = "", words?: { orMore: string; orLess: string }) => {
  if (!r) return "";
  const u = unit ? ` ${unit}` : "";
  if (isNum(r.min) && isNum(r.max)) return `${r.min}–${r.max}${u}`;
  if (isNum(r.min)) return `${r.min}${u} ${words?.orMore ?? "or more"}`;
  if (isNum(r.max)) return `${r.max}${u} ${words?.orLess ?? "or less"}`;
  return "";
};

// =====================================================================
// Paso 6.1 — Textos del formulario en el idioma de la persona.
// Solo cambia lo que se VE (nombres de campos, opciones, avisos en rojo). Las alertas que se guardan
// para la oficina (p_alerts) siguen en inglés hasta el Paso 6.2.
// =====================================================================
export type FormTx = {
  section: (kind: FormKind, s: Section) => string;
  label: (kind: FormKind, f: Field) => string;
  option: (kind: FormKind, f: Field, o: Choice) => string;
  placeholder: (kind: FormKind, f: Field) => string | undefined;
  words: { orMore: string; orLess: string };
  attention: string;
  outOfRange: (range: string) => string;
  above: (tag: string, value: string) => string;
  capOff: (off: string, tol: string) => string;
  deltaT: string;
  tempRise: string;
};
// Copia de las secciones con los textos traducidos (los "when" y llaves no cambian)
export function localizeSections<T extends Section>(kind: FormKind, list: T[], tx?: FormTx): T[] {
  if (!tx) return list;
  return list.map((s) => ({
    ...s, title: s.title ? tx.section(kind, s) : s.title,
    fields: s.fields.map((f) => ({ ...f, label: tx.label(kind, f), placeholder: tx.placeholder(kind, f), options: f.options?.map((o) => ({ ...o, label: tx.option(kind, f, o) })) })),
  }));
}

// ---------- Campos ----------
const cooling = (d: FormData) => d.mode !== "heating";
const heating = (d: FormData) => d.mode === "heating";
const gas = (d: FormData) => d.mode === "heating" && d.heat_type === "gas";

export const TUNE_UP: Section[] = [
  {
    id: "system", title: "System", fields: [
      { key: "mode", label: "Tune-Up for", type: "choice", required: true, options: [{ value: "cooling", label: "Cooling" }, { value: "heating", label: "Heating" }] },
      { key: "refrigerant", label: "Refrigerant", type: "choice", when: cooling, options: [{ value: "R-410A", label: "R-410A" }, { value: "R-22", label: "R-22" }, { value: "R-32", label: "R-32" }, { value: "R-454B", label: "R-454B" }, { value: "other", label: "Other" }] },
      { key: "metering", label: "Metering device", type: "choice", when: cooling, options: [{ value: "txv", label: "TXV" }, { value: "fixed", label: "Fixed orifice / piston" }] },
      { key: "heat_type", label: "Heat source", type: "choice", when: heating, required: true, options: [{ value: "gas", label: "Gas furnace" }, { value: "heat_pump", label: "Heat pump" }, { value: "electric", label: "Electric heat" }] },
      { key: "gas_type", label: "Gas", type: "choice", when: gas, options: [{ value: "natural", label: "Natural gas" }, { value: "lp", label: "Propane (LP)" }] },
    ],
  },
  {
    id: "air", title: "Airflow & temperatures", fields: [
      { key: "outdoor_temp", label: "Outdoor", type: "number", unit: "°F" },
      { key: "return_temp", label: "Return air", type: "number", unit: "°F", required: true },
      { key: "supply_temp", label: "Supply air", type: "number", unit: "°F", required: true },
      { key: "filter", label: "Air filter", type: "choice", required: true, options: [{ value: "clean", label: "Clean" }, { value: "replaced", label: "Replaced today" }, { value: "dirty", label: "Dirty — needs a new one", bad: true }] },
      { key: "filter_size", label: "Filter size", type: "text", placeholder: "20x25x1" },
      { key: "thermostat", label: "Thermostat", type: "choice", options: [{ value: "ok", label: "Working" }, { value: "batteries", label: "Batteries replaced" }, { value: "bad", label: "Not working right", bad: true }] },
    ],
  },
  {
    id: "electrical", title: "Electrical", fields: [
      { key: "line_voltage", label: "Line voltage", type: "number", unit: "V", range: "line_voltage" },
      { key: "control_voltage", label: "Control voltage", type: "number", unit: "V", range: "control_voltage" },
      { key: "comp_amps", label: "Compressor amps", type: "number", unit: "A", when: (d) => d.heat_type !== "gas" && d.heat_type !== "electric" },
      { key: "comp_rla", label: "Compressor RLA (label)", type: "number", unit: "A", when: (d) => d.heat_type !== "gas" && d.heat_type !== "electric" },
      { key: "fan_amps", label: "Condenser fan amps", type: "number", unit: "A", when: (d) => d.heat_type !== "gas" && d.heat_type !== "electric" },
      { key: "fan_fla", label: "Condenser fan FLA (label)", type: "number", unit: "A", when: (d) => d.heat_type !== "gas" && d.heat_type !== "electric" },
      { key: "blower_amps", label: "Blower amps", type: "number", unit: "A" },
      { key: "blower_fla", label: "Blower FLA (label)", type: "number", unit: "A" },
      { key: "cap_comp_rated", label: "Compressor capacitor · rated", type: "number", unit: "µF", when: (d) => d.heat_type !== "gas" && d.heat_type !== "electric" },
      { key: "cap_comp_actual", label: "Compressor capacitor · reading", type: "number", unit: "µF", when: (d) => d.heat_type !== "gas" && d.heat_type !== "electric" },
      { key: "cap_fan_rated", label: "Fan capacitor · rated", type: "number", unit: "µF" },
      { key: "cap_fan_actual", label: "Fan capacitor · reading", type: "number", unit: "µF" },
      { key: "contactor", label: "Contactor", type: "choice", when: (d) => d.heat_type !== "gas" && d.heat_type !== "electric", options: [{ value: "good", label: "Good" }, { value: "worn", label: "Pitted / worn", bad: true }] },
      { key: "wiring", label: "Wiring & connections", type: "choice", options: [{ value: "good", label: "Tight and clean" }, { value: "tightened", label: "Tightened today" }, { value: "bad", label: "Burnt or loose", bad: true }] },
    ],
  },
  {
    id: "refrigerant", title: "Refrigerant", when: (d) => d.heat_type !== "gas" && d.heat_type !== "electric", fields: [
      { key: "suction_pressure", label: "Suction pressure", type: "number", unit: "psi", range: "suction_pressure" },
      { key: "liquid_pressure", label: "Liquid pressure", type: "number", unit: "psi", range: "liquid_pressure" },
      { key: "superheat", label: "Superheat", type: "number", unit: "°F", range: "superheat" },
      { key: "subcooling", label: "Subcooling", type: "number", unit: "°F", range: "subcooling" },
    ],
  },
  {
    id: "drain", title: "Coils & drain", when: cooling, fields: [
      { key: "evap_coil", label: "Evaporator coil", type: "choice", options: [{ value: "clean", label: "Clean" }, { value: "cleaned", label: "Cleaned today" }, { value: "dirty", label: "Dirty", bad: true }] },
      { key: "cond_coil", label: "Condenser coil", type: "choice", options: [{ value: "clean", label: "Clean" }, { value: "cleaned", label: "Cleaned today" }, { value: "dirty", label: "Dirty", bad: true }] },
      { key: "drain", label: "Drain line", type: "choice", required: true, options: [{ value: "clear", label: "Clear" }, { value: "cleared", label: "Cleared today" }, { value: "clogged", label: "Clogged", bad: true }] },
      { key: "drain_pan", label: "Drain pan", type: "choice", options: [{ value: "dry", label: "Dry and clean" }, { value: "water", label: "Standing water", bad: true }, { value: "rust", label: "Rusted", bad: true }] },
      { key: "float_switch", label: "Float switch", type: "choice", options: [{ value: "ok", label: "Tested — works" }, { value: "none", label: "None installed" }, { value: "failed", label: "Failed", bad: true }] },
    ],
  },
  {
    id: "heat", title: "Heating safety", when: heating, fields: [
      { key: "gas_pressure", label: "Gas pressure", type: "number", unit: "in. w.c.", when: gas },
      { key: "flame_sensor", label: "Flame sensor", type: "number", unit: "µA", when: gas, range: "flame_sensor" },
      { key: "co_ppm", label: "Carbon monoxide", type: "number", unit: "ppm", when: gas, range: "co_ppm" },
      { key: "igniter", label: "Igniter", type: "choice", when: gas, options: [{ value: "good", label: "Good" }, { value: "weak", label: "Weak / cracked", bad: true }] },
      { key: "heat_exchanger", label: "Heat exchanger", type: "choice", when: gas, options: [{ value: "good", label: "No cracks seen" }, { value: "bad", label: "Cracks or heavy rust", bad: true }] },
      { key: "burners", label: "Burners", type: "choice", when: gas, options: [{ value: "clean", label: "Clean" }, { value: "cleaned", label: "Cleaned today" }, { value: "dirty", label: "Dirty / rusted", bad: true }] },
      { key: "heat_strips", label: "Heat strips", type: "choice", when: (d) => d.mode === "heating" && d.heat_type !== "gas", options: [{ value: "ok", label: "Working" }, { value: "none", label: "None installed" }, { value: "bad", label: "Not heating", bad: true }] },
      { key: "defrost", label: "Defrost cycle", type: "choice", when: (d) => d.mode === "heating" && d.heat_type === "heat_pump", options: [{ value: "ok", label: "Working" }, { value: "bad", label: "Not working", bad: true }] },
    ],
  },
  {
    id: "summary", title: "Summary", fields: [
      { key: "condition", label: "System condition", type: "choice", required: true, options: [{ value: "good", label: "Good" }, { value: "attention", label: "Needs attention soon" }, { value: "repair", label: "Needs repair now", bad: true }] },
      { key: "recommendations", label: "Recommendations for the customer", type: "textarea", placeholder: "Repairs or parts you recommend", wide: true },
      { key: "customer_informed", label: "Reviewed with the customer", type: "check", wide: true },
    ],
  },
];

export const WORK: Section[] = [
  {
    id: "work", title: "", fields: [
      { key: "found", label: "What you found", type: "textarea", required: true, placeholder: "The problem and where it is", wide: true },
      { key: "cause", label: "Cause", type: "textarea", placeholder: "Why it happened (if you know)", wide: true },
      { key: "done", label: "Work performed", type: "textarea", required: true, placeholder: "What you repaired, replaced or adjusted", wide: true },
      { key: "condition", label: "How it was left", type: "choice", required: true, options: [{ value: "working", label: "Working properly" }, { value: "temporary", label: "Working — temporary fix" }, { value: "not_working", label: "Not working", bad: true }] },
      { key: "followup", label: "Follow-up visit", type: "choice", options: [{ value: "no", label: "Not needed" }, { value: "yes", label: "Needed" }] },
      { key: "recommendations", label: "Recommendations for the customer", type: "textarea", placeholder: "Repairs, parts or maintenance you recommend", wide: true },
      { key: "customer_informed", label: "Reviewed with the customer", type: "check", wide: true },
    ],
  },
];

export const sectionsOf = (kind: FormKind) => (kind === "tune_up" ? TUNE_UP : WORK);
export const formTitle = (kind: FormKind) => (kind === "tune_up" ? "Tune-Up" : "Work form");
export const visibleSections = (kind: FormKind, d: FormData) =>
  sectionsOf(kind).filter((s) => !s.when || s.when(d)).map((s) => ({ ...s, fields: s.fields.filter((f) => !f.when || f.when(d)) })).filter((s) => s.fields.length);

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const fmt = (n: number) => String(Math.round(n * 10) / 10);
const outOf = (n: number, r: Range | undefined) => Boolean(r) && ((isNum(r!.min) && n < r!.min) || (isNum(r!.max) && n > r!.max));

export type Review = {
  bad: Record<string, string>;     // llave del campo → por qué está en rojo
  alerts: string[];                // lo que ve la oficina
  delta: { label: string; value: number; bad: string | null } | null; // Delta T / Temp rise calculado
  missing: string[];               // obligatorios sin llenar
};

// Revisa el formulario: campos en rojo, alertas para la oficina y lo que falta para enviarlo
// tx (Paso 6.1): traduce los avisos en rojo y la lista de lo que falta; las alertas para la oficina quedan en inglés
export function reviewForm(kind: FormKind, raw: FormData, ranges: Ranges, tx?: FormTx): Review {
  const d = cleanForm(kind, raw); // lo escondido (otro modo) no cuenta
  const bad: Record<string, string> = {}, alerts: string[] = [], missing: string[] = [];
  const sections = visibleSections(kind, d);
  const flag = (key: string, why: string, alert: string) => { bad[key] = why; alerts.push(alert); };
  const oor = (r: Range | undefined, unit?: string) => (tx ? tx.outOfRange(rangeText(r, unit, tx.words)) : `Out of range · ${rangeText(r, unit)}`);

  for (const s of sections) for (const f of s.fields) {
    const v = d[f.key];
    if (f.required && (v === undefined || v === null || v === "")) missing.push(tx ? tx.label(kind, f) : f.label);
    if (f.type === "choice") {
      const o = f.options?.find((x) => x.value === v);
      if (o?.bad) flag(f.key, tx ? tx.attention : "Needs attention", `${f.label}: ${o.label}`);
    }
    if (f.type === "number" && f.range) {
      const n = num(v), r = ranges[f.range];
      if (n !== null && outOf(n, r)) flag(f.key, oor(r, f.unit), `${f.label} ${fmt(n)} ${f.unit ?? ""} (${rangeText(r)})`.replace(/\s+/g, " "));
    }
  }
  if (kind !== "tune_up") return { bad, alerts, delta: null, missing };

  // Delta T (enfriando) o Temperature rise (calentando)
  let delta: Review["delta"] = null;
  const ret = num(d.return_temp), sup = num(d.supply_temp);
  if (ret !== null && sup !== null) {
    const heat = d.mode === "heating", value = Math.round((heat ? sup - ret : ret - sup) * 10) / 10;
    const key = heat ? "temp_rise" : "delta_t", r = ranges[key], label = heat ? "Temperature rise" : "Delta T";
    const why = outOf(value, r) ? oor(r, "°F") : null;
    delta = { label: tx ? (heat ? tx.tempRise : tx.deltaT) : label, value, bad: why };
    if (why) alerts.push(`${label} ${fmt(value)} °F (${rangeText(r)})`);
  }
  // Amperaje contra la etiqueta
  ([["comp_amps", "comp_rla", "Compressor amps", "RLA"], ["fan_amps", "fan_fla", "Condenser fan amps", "FLA"], ["blower_amps", "blower_fla", "Blower amps", "FLA"]] as const).forEach(([a, b, label, tag]) => {
    const x = num(d[a]), y = num(d[b]);
    if (x !== null && y !== null && y > 0 && x > y) flag(a, tx ? tx.above(tag, `${fmt(y)} A`) : `Above the ${tag} (${fmt(y)} A)`, `${label} ${fmt(x)} A (${tag} ${fmt(y)})`);
  });
  // Capacitores: lectura contra el valor de la etiqueta
  const tol = isNum(ranges.cap_tolerance?.max) ? (ranges.cap_tolerance!.max as number) : 6;
  ([["cap_comp_rated", "cap_comp_actual", "Compressor capacitor"], ["cap_fan_rated", "cap_fan_actual", "Fan capacitor"]] as const).forEach(([a, b, label]) => {
    const rated = num(d[a]), actual = num(d[b]);
    if (rated === null || actual === null || rated <= 0) return;
    const off = ((actual - rated) / rated) * 100;
    if (Math.abs(off) > tol) flag(b, tx ? tx.capOff(`${off > 0 ? "+" : "−"}${fmt(Math.abs(off))}%`, `±${tol}%`) : `${off > 0 ? "+" : "−"}${fmt(Math.abs(off))}% from rated · max ±${tol}%`, `${label} ${fmt(actual)} µF (rated ${fmt(rated)}, ${off > 0 ? "+" : "−"}${fmt(Math.abs(off))}%)`);
  });
  // Presión de gas según el tipo de gas
  const gp = num(d.gas_pressure);
  if (gp !== null && d.mode === "heating" && d.heat_type === "gas") {
    const r = ranges[d.gas_type === "lp" ? "gas_pressure_lp" : "gas_pressure_nat"];
    if (outOf(gp, r)) flag("gas_pressure", oor(r, "in. w.c."), `Gas pressure ${fmt(gp)} in. w.c. (${rangeText(r)})`);
  }
  return { bad, alerts, delta, missing };
}

// Solo lo que se ve en pantalla se guarda (si cambia de Cooling a Heating no quedan lecturas viejas escondidas)
export function cleanForm(kind: FormKind, d: FormData): FormData {
  const out: FormData = {};
  for (const s of visibleSections(kind, d)) for (const f of s.fields) {
    const v = d[f.key];
    if (v === undefined || v === null || v === "" || v === false) continue;
    out[f.key] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

// Valor listo para mostrar en la ficha de oficina
export function displayValue(f: Field, v: unknown, yes = "Yes"): string {
  if (v === undefined || v === null || v === "") return "";
  if (f.type === "check") return v ? yes : "";
  if (f.type === "choice") return f.options?.find((o) => o.value === v)?.label ?? String(v);
  if (f.type === "number") return `${v}${f.unit ? ` ${f.unit}` : ""}`;
  return String(v);
}

// ---------- Equipos del cliente (viven en el Job Site) ----------
export type Equipment = {
  id: string; address_id: string | null; kind: string; brand: string | null; model: string | null; serial: string | null;
  tonnage: number | null; seer: number | null; refrigerant: string | null; location_note: string | null; install_date: string | null;
  parts_warranty_until: string | null; labor_warranty_until: string | null; registered: boolean; notes: string | null; is_active: boolean;
  created_by_name: string | null; updated_at: string | null;
};
export const EQUIPMENT_COLS = "id, address_id, kind, brand, model, serial, tonnage, seer, refrigerant, location_note, install_date, parts_warranty_until, labor_warranty_until, registered, notes, is_active, created_by_name, updated_at";
export const EQUIPMENT_KINDS: { value: string; label: string }[] = [
  { value: "condenser", label: "Condenser (outdoor unit)" }, { value: "air_handler", label: "Air handler" }, { value: "furnace", label: "Furnace" },
  { value: "heat_pump", label: "Heat pump" }, { value: "package_unit", label: "Package unit" }, { value: "mini_split", label: "Mini split" },
  { value: "coil", label: "Evaporator coil" }, { value: "thermostat", label: "Thermostat" }, { value: "water_heater", label: "Water heater" }, { value: "other", label: "Other" },
];
export const kindLabel = (k: string) => EQUIPMENT_KINDS.find((x) => x.value === k)?.label.replace(/ \(.*\)$/, "") ?? "Equipment";
export const equipmentName = (e: Pick<Equipment, "kind" | "brand" | "model">) => [kindLabel(e.kind), [e.brand, e.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ");

export type Warranty = "active" | "expiring" | "expired" | "unknown";
const dayOf = (s: string) => { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const fmtDate = (s: string | null) => (s ? dayOf(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
// Estado de la garantía: la que dure más (piezas o mano de obra). "Por vencer" = le quedan menos de 60 días
export function warrantyOf(e: Pick<Equipment, "parts_warranty_until" | "labor_warranty_until">, today = new Date()): { status: Warranty; until: string | null } {
  const dates = [e.parts_warranty_until, e.labor_warranty_until].filter(Boolean) as string[];
  if (!dates.length) return { status: "unknown", until: null };
  const until = dates.sort()[dates.length - 1];
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(), end = dayOf(until).getTime();
  if (end < t) return { status: "expired", until };
  return { status: end < t + 60 * 86400000 ? "expiring" : "active", until };
}
export const WARRANTY_META: Record<Warranty, { label: string; cls: string }> = {
  active: { label: "Under warranty", cls: "bg-[#e7f6f1] text-[#0f766e]" },
  expiring: { label: "Warranty ends soon", cls: "bg-[#fff6e6] text-[#b45309]" },
  expired: { label: "Warranty expired", cls: "bg-[#fff1f2] text-[#be123c]" },
  unknown: { label: "Warranty not on file", cls: "bg-slate-100 text-slate-500" },
};
