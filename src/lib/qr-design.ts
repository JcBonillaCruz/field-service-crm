import QRCode from "qrcode";
// @ts-expect-error módulo interno sin tipos (tablas de corrección de errores)
import ECCode from "qrcode/lib/core/error-correction-code";
// @ts-expect-error módulo interno sin tipos
import QRUtils from "qrcode/lib/core/utils";

/* =====================================================================
   Diseños de código QR: cuerpo (módulos), marco del ojo, centro del ojo
   y marcos con texto. Todo se arma como SVG puro (vector).
   ===================================================================== */

// ---------- Ayudantes de formas ----------
const f = (v: number) => +v.toFixed(3);
const circle = (cx: number, cy: number, r: number) => `M${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)}Z`;
const rect = (x: number, y: number, w: number, h: number) => `M${f(x)} ${f(y)}H${f(x + w)}V${f(y + h)}H${f(x)}Z`;
// Rectángulo con radio distinto en cada esquina [arriba-izq, arriba-der, abajo-der, abajo-izq]
function rr4(x: number, y: number, w: number, h: number, tl: number, tr: number, br: number, bl: number) {
  const m = Math.min(w, h) / 2; tl = Math.min(tl, m); tr = Math.min(tr, m); br = Math.min(br, m); bl = Math.min(bl, m);
  return `M${f(x + tl)} ${f(y)}H${f(x + w - tr)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + tr)}V${f(y + h - br)}Q${f(x + w)} ${f(y + h)} ${f(x + w - br)} ${f(y + h)}H${f(x + bl)}Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - bl)}V${f(y + tl)}Q${f(x)} ${f(y)} ${f(x + tl)} ${f(y)}Z`;
}
const rr = (x: number, y: number, w: number, h: number, r: number) => rr4(x, y, w, h, r, r, r, r);
// Esquinas con curva más suave (tipo iPhone) usando curvas cúbicas
function squircle(x: number, y: number, s: number, k = 0.42) {
  const r = s * k, c = r * 0.1;
  return `M${f(x + r)} ${f(y)}H${f(x + s - r)}C${f(x + s - c)} ${f(y)} ${f(x + s)} ${f(y + c)} ${f(x + s)} ${f(y + r)}V${f(y + s - r)}C${f(x + s)} ${f(y + s - c)} ${f(x + s - c)} ${f(y + s)} ${f(x + s - r)} ${f(y + s)}H${f(x + r)}C${f(x + c)} ${f(y + s)} ${f(x)} ${f(y + s - c)} ${f(x)} ${f(y + s - r)}V${f(y + r)}C${f(x)} ${f(y + c)} ${f(x + c)} ${f(y)} ${f(x + r)} ${f(y)}Z`;
}
function poly(cx: number, cy: number, n: number, r: number, rot = -Math.PI / 2) {
  let d = "";
  for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n + rot; d += `${i ? "L" : "M"}${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`; }
  return d + "Z";
}
function star(cx: number, cy: number, R: number, r: number, n: number, rot = -Math.PI / 2) {
  let d = "";
  for (let i = 0; i < n * 2; i++) { const a = (Math.PI / n) * i + rot; const k = i % 2 ? r : R; d += `${i ? "L" : "M"}${f(cx + k * Math.cos(a))} ${f(cy + k * Math.sin(a))}`; }
  return d + "Z";
}
// Destello de 4 puntas con lados curvos
const sparkle = (cx: number, cy: number, R: number, k = 0.18) =>
  `M${f(cx)} ${f(cy - R)}Q${f(cx + R * k)} ${f(cy - R * k)} ${f(cx + R)} ${f(cy)}Q${f(cx + R * k)} ${f(cy + R * k)} ${f(cx)} ${f(cy + R)}Q${f(cx - R * k)} ${f(cy + R * k)} ${f(cx - R)} ${f(cy)}Q${f(cx - R * k)} ${f(cy - R * k)} ${f(cx)} ${f(cy - R)}Z`;
const chamfer = (x: number, y: number, s: number, c: number) =>
  `M${f(x + c)} ${f(y)}H${f(x + s - c)}L${f(x + s)} ${f(y + c)}V${f(y + s - c)}L${f(x + s - c)} ${f(y + s)}H${f(x + c)}L${f(x)} ${f(y + s - c)}V${f(y + c)}Z`;
const plusShape = (x: number, y: number, s: number, t: number) => {
  const a = x + (s - t) / 2, b = a + t, c = y + (s - t) / 2, d = c + t;
  return `M${f(a)} ${f(y)}H${f(b)}V${f(c)}H${f(x + s)}V${f(d)}H${f(b)}V${f(y + s)}H${f(a)}V${f(d)}H${f(x)}V${f(c)}H${f(a)}Z`;
};
const roundPlus = (x: number, y: number, s: number, t: number) => rr(x + (s - t) / 2, y, t, s, t / 2) + rr(x, y + (s - t) / 2, s, t, t / 2);
const xShape = (x: number, y: number, s: number, t: number) => {
  const k = t / Math.SQRT2, m = s / 2;
  return `M${f(x + k)} ${f(y)}L${f(x + m)} ${f(y + m - k)}L${f(x + s - k)} ${f(y)}L${f(x + s)} ${f(y + k)}L${f(x + m + k)} ${f(y + m)}L${f(x + s)} ${f(y + s - k)}L${f(x + s - k)} ${f(y + s)}L${f(x + m)} ${f(y + m + k)}L${f(x + k)} ${f(y + s)}L${f(x)} ${f(y + s - k)}L${f(x + m - k)} ${f(y + m)}L${f(x)} ${f(y + k)}Z`;
};
const heart = (x: number, y: number, s: number) => {
  const X = (v: number) => f(x + v * s), Y = (v: number) => f(y + v * s);
  return `M${X(0.5)} ${Y(0.92)}C${X(0.14)} ${Y(0.66)} ${X(0)} ${Y(0.46)} ${X(0)} ${Y(0.3)}C${X(0)} ${Y(0.12)} ${X(0.14)} ${Y(0.02)} ${X(0.28)} ${Y(0.02)}C${X(0.38)} ${Y(0.02)} ${X(0.46)} ${Y(0.08)} ${X(0.5)} ${Y(0.17)}C${X(0.54)} ${Y(0.08)} ${X(0.62)} ${Y(0.02)} ${X(0.72)} ${Y(0.02)}C${X(0.86)} ${Y(0.02)} ${X(1)} ${Y(0.12)} ${X(1)} ${Y(0.3)}C${X(1)} ${Y(0.46)} ${X(0.86)} ${Y(0.66)} ${X(0.5)} ${Y(0.92)}Z`;
};
const roundDiamond = (cx: number, cy: number, R: number, k = 0.22) => {
  const a = R * k;
  return `M${f(cx - a)} ${f(cy - R + a)}Q${f(cx)} ${f(cy - R)} ${f(cx + a)} ${f(cy - R + a)}L${f(cx + R - a)} ${f(cy - a)}Q${f(cx + R)} ${f(cy)} ${f(cx + R - a)} ${f(cy + a)}L${f(cx + a)} ${f(cy + R - a)}Q${f(cx)} ${f(cy + R)} ${f(cx - a)} ${f(cy + R - a)}L${f(cx - R + a)} ${f(cy + a)}Q${f(cx - R)} ${f(cy)} ${f(cx - R + a)} ${f(cy - a)}Z`;
};
const shield = (x: number, y: number, w: number, h: number) =>
  `M${f(x)} ${f(y)}H${f(x + w)}V${f(y + h * 0.55)}Q${f(x + w)} ${f(y + h)} ${f(x + w / 2)} ${f(y + h)}Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h * 0.55)}Z`;
const dotsGrid = (x: number, y: number, s: number, n: number, k = 0.42) => {
  let d = ""; const step = s / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) d += circle(x + step * (j + 0.5), y + step * (i + 0.5), step * k);
  return d;
};

// Mueve y escala un trazo (solo comandos absolutos) para dibujar todo el código en un solo <path>
function placePath(d: string, ox: number, oy: number, k: number) {
  const tok = d.match(/[MLHVQCAZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  let out = "", cmd = "", i = 0;
  const num = () => Number(tok[i++]);
  const X = (v: number) => +(v * k + ox).toFixed(2), Y = (v: number) => +(v * k + oy).toFixed(2);
  while (i < tok.length) {
    if (/[A-Z]/i.test(tok[i])) { cmd = tok[i++].toUpperCase(); out += cmd; if (cmd === "Z") continue; }
    if (cmd === "H") out += `${X(num())} `;
    else if (cmd === "V") out += `${Y(num())} `;
    else if (cmd === "A") { const rx = num() * k, ry = num() * k, rot = num(), la = num(), sw = num(); out += `${+rx.toFixed(2)} ${+ry.toFixed(2)} ${rot} ${la} ${sw} ${X(num())} ${Y(num())} `; }
    else if (cmd === "Q") out += `${X(num())} ${Y(num())} ${X(num())} ${Y(num())} `;
    else if (cmd === "C") out += `${X(num())} ${Y(num())} ${X(num())} ${Y(num())} ${X(num())} ${Y(num())} `;
    else out += `${X(num())} ${Y(num())} `; // M, L
  }
  return out;
}

/* ===================== CUERPO (cada módulo en un cuadrito 0–1) ===================== */
export type Nb = { t: boolean; r: boolean; b: boolean; l: boolean };
export type BodyShape = { label: string; d?: string; fn?: (n: Nb) => string };
// Estilos "conectados": redondean solo las esquinas que no tocan a un vecino
const joined = (r: number, only?: "classy" | "classy2") => (n: Nb) => {
  const tl = !n.t && !n.l && only !== "classy2" ? r : 0, tr = !n.t && !n.r && only !== "classy" ? r : 0;
  const br = !n.b && !n.r && only !== "classy2" ? r : 0, bl = !n.b && !n.l && only !== "classy" ? r : 0;
  return rr4(0, 0, 1.01, 1.01, tl, tr, br, bl);
};
const vline = (w: number) => (n: Nb) => { const x = (1 - w) / 2, r = w / 2; return rr4(x, 0, w, 1.01, n.t ? 0 : r, n.t ? 0 : r, n.b ? 0 : r, n.b ? 0 : r); };
const hline = (h: number) => (n: Nb) => { const y = (1 - h) / 2, r = h / 2; return rr4(0, y, 1.01, h, n.l ? 0 : r, n.r ? 0 : r, n.r ? 0 : r, n.l ? 0 : r); };

export const BODY: Record<string, BodyShape> = {
  square: { label: "Square", d: rect(0, 0, 1.02, 1.02) },
  smooth: { label: "Liquid", fn: joined(0.5) },
  "smooth-soft": { label: "Soft liquid", fn: joined(0.3) },
  classy: { label: "Classy", fn: joined(0.5, "classy") },
  "classy-2": { label: "Classy 2", fn: joined(0.5, "classy2") },
  vlines: { label: "Vertical lines", fn: vline(0.76) },
  "vlines-thin": { label: "Thin vertical", fn: vline(0.52) },
  hlines: { label: "Horizontal lines", fn: hline(0.76) },
  "hlines-thin": { label: "Thin horizontal", fn: hline(0.52) },
  rounded: { label: "Rounded", d: rr(0.05, 0.05, 0.9, 0.9, 0.3) },
  "rounded-sm": { label: "Slightly rounded", d: rr(0.04, 0.04, 0.92, 0.92, 0.16) },
  squircle: { label: "Squircle", d: squircle(0.06, 0.06, 0.88) },
  "square-sm": { label: "Small square", d: rect(0.14, 0.14, 0.72, 0.72) },
  circle: { label: "Circle", d: circle(0.5, 0.5, 0.5) },
  dot: { label: "Dot", d: circle(0.5, 0.5, 0.4) },
  "dot-sm": { label: "Small dot", d: circle(0.5, 0.5, 0.3) },
  diamond: { label: "Diamond", d: "M.5 0L1 .5L.5 1L0 .5Z" },
  "diamond-round": { label: "Soft diamond", d: roundDiamond(0.5, 0.5, 0.52) },
  "diamond-sm": { label: "Small diamond", d: "M.5 .12L.88 .5L.5 .88L.12 .5Z" },
  hexagon: { label: "Hexagon", d: poly(0.5, 0.5, 6, 0.54, 0) },
  "hexagon-v": { label: "Hexagon 2", d: poly(0.5, 0.5, 6, 0.54) },
  octagon: { label: "Octagon", d: poly(0.5, 0.5, 8, 0.54, Math.PI / 8) },
  chamfer: { label: "Cut corners", d: chamfer(0.03, 0.03, 0.94, 0.26) },
  plus: { label: "Plus", d: plusShape(0, 0, 1, 0.38) },
  "plus-round": { label: "Soft plus", d: roundPlus(0, 0, 1, 0.42) },
  cross: { label: "X", d: xShape(0.04, 0.04, 0.92, 0.3) },
  sparkle: { label: "Sparkle", d: sparkle(0.5, 0.5, 0.56) },
  star: { label: "Star", d: star(0.5, 0.54, 0.56, 0.24, 5) },
  heart: { label: "Heart", d: heart(0.02, 0.06, 0.96) },
  leaf: { label: "Leaf", d: rr4(0, 0, 1, 1, 0.5, 0, 0.5, 0) },
  "leaf-2": { label: "Leaf 2", d: rr4(0, 0, 1, 1, 0, 0.5, 0, 0.5) },
  drop: { label: "Drop", d: rr4(0.04, 0.04, 0.92, 0.92, 0.46, 0.46, 0, 0.46) },
  vpill: { label: "Vertical pill", d: rr(0.22, 0.02, 0.56, 0.96, 0.28) },
  hpill: { label: "Horizontal pill", d: rr(0.02, 0.22, 0.96, 0.56, 0.28) },
  shield: { label: "Shield", d: shield(0.06, 0.04, 0.88, 0.92) },
  flower: { label: "Flower", d: circle(0.5, 0.27, 0.23) + circle(0.73, 0.5, 0.23) + circle(0.5, 0.73, 0.23) + circle(0.27, 0.5, 0.23) + circle(0.5, 0.5, 0.2) },
  dots4: { label: "Four dots", d: dotsGrid(0, 0, 1, 2, 0.38) },
  triangle: { label: "Triangle", d: "M.5 .06L.98 .92H.02Z" },
};

// Patrón de muestra para dibujar la vista previa de cada cuerpo
export const BODY_SAMPLE = ["10110", "11010", "01111", "10101", "11001"];
export function bodyPreviewPath(key: string) {
  const sh = BODY[key] ?? BODY.square, g = BODY_SAMPLE;
  const on = (r: number, c: number) => g[r]?.[c] === "1";
  let d = "";
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    if (!on(r, c)) continue;
    const base = sh.fn ? sh.fn({ t: on(r - 1, c), r: on(r, c + 1), b: on(r + 1, c), l: on(r, c - 1) }) : sh.d!;
    d += placePath(base, c, r, 1);
  }
  return d;
}

/* ===================== MARCO DEL OJO (7×7 con hueco, evenodd) ===================== */
const ring = (outer: string, inner: string) => outer + inner;
const dotsRing = () => { let d = ""; for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) if (i === 0 || j === 0 || i === 6 || j === 6) d += circle(j + 0.5, i + 0.5, 0.46); return d; };
const dotsCircle = () => { let d = ""; for (let i = 0; i < 18; i++) { const a = (2 * Math.PI * i) / 18; d += circle(3.5 + 3 * Math.cos(a), 3.5 + 3 * Math.sin(a), 0.5); } return d; };
const dashes = () => {
  let d = "";
  for (const [x, y, w, h] of [[0, 0, 2.2, 1], [2.6, 0, 1.8, 1], [4.8, 0, 2.2, 1], [0, 6, 2.2, 1], [2.6, 6, 1.8, 1], [4.8, 6, 2.2, 1], [0, 1.4, 1, 1.6], [0, 4, 1, 1.6], [6, 1.4, 1, 1.6], [6, 4, 1, 1.6]] as const) d += rect(x, y, w, h);
  return d;
};
const brackets = (rad: number) => {
  const L = 2.7, t = 1;
  const pts = (d: string, rot: number) => {
    // rota alrededor del centro del ojo: (x,y) -> rotado
    const a = (rot * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
    return d.replace(/(-?\d*\.?\d+) (-?\d*\.?\d+)/g, (_, X, Y) => { const x = +X - 3.5, y = +Y - 3.5; return `${f(x * cs - y * sn + 3.5)} ${f(x * sn + y * cs + 3.5)}`; });
  };
  const base = rad ? `M0 ${L}L0 ${rad}Q0 0 ${rad} 0L${L} 0L${L} ${t}L${t + 0.4} ${t}Q${t} ${t} ${t} ${t + 0.4}L${t} ${L}Z` : `M0 0L${L} 0L${L} ${t}L${t} ${t}L${t} ${L}L0 ${L}Z`;
  return [0, 90, 180, 270].map((r) => pts(base, r)).join("");
};

export const EYE_FRAME: Record<string, { label: string; d: string }> = {
  square: { label: "Square", d: ring(rect(0, 0, 7, 7), rect(1, 1, 5, 5)) },
  "rounded-xs": { label: "Soft square", d: ring(rr(0, 0, 7, 7, 0.9), rr(1, 1, 5, 5, 0.4)) },
  rounded: { label: "Rounded", d: ring(rr(0, 0, 7, 7, 2), rr(1, 1, 5, 5, 1.3)) },
  "rounded-lg": { label: "Extra round", d: ring(rr(0, 0, 7, 7, 2.9), rr(1, 1, 5, 5, 2)) },
  squircle: { label: "Squircle", d: ring(squircle(0, 0, 7, 0.46), squircle(1, 1, 5, 0.4)) },
  circle: { label: "Circle", d: ring(circle(3.5, 3.5, 3.5), circle(3.5, 3.5, 2.5)) },
  thin: { label: "Thin square", d: ring(rect(0, 0, 7, 7), rect(0.65, 0.65, 5.7, 5.7)) },
  "thin-round": { label: "Thin round", d: ring(rr(0, 0, 7, 7, 2.2), rr(0.65, 0.65, 5.7, 5.7, 1.7)) },
  "thin-circle": { label: "Thin circle", d: ring(circle(3.5, 3.5, 3.5), circle(3.5, 3.5, 2.85)) },
  thick: { label: "Bold square", d: ring(rect(0, 0, 7, 7), rect(1.3, 1.3, 4.4, 4.4)) },
  "thick-round": { label: "Bold round", d: ring(rr(0, 0, 7, 7, 2.2), rr(1.3, 1.3, 4.4, 4.4, 1.1)) },
  "leaf-l": { label: "Leaf", d: ring(rr4(0, 0, 7, 7, 3, 0, 3, 0), rr4(1, 1, 5, 5, 2.1, 0, 2.1, 0)) },
  "leaf-r": { label: "Leaf 2", d: ring(rr4(0, 0, 7, 7, 0, 3, 0, 3), rr4(1, 1, 5, 5, 0, 2.1, 0, 2.1)) },
  drop: { label: "Drop", d: ring(rr4(0, 0, 7, 7, 3.2, 3.2, 0, 3.2), rr4(1, 1, 5, 5, 2.3, 2.3, 0, 2.3)) },
  "drop-in": { label: "Drop 2", d: ring(rr4(0, 0, 7, 7, 3.2, 3.2, 3.2, 0), rr4(1, 1, 5, 5, 2.3, 2.3, 2.3, 0)) },
  "one-corner": { label: "One round corner", d: ring(rr4(0, 0, 7, 7, 3, 0, 0, 0), rr4(1, 1, 5, 5, 2.1, 0, 0, 0)) },
  chamfer: { label: "Cut corners", d: ring(chamfer(0, 0, 7, 2), chamfer(1, 1, 5, 1.4)) },
  "chamfer-thin": { label: "Thin cut", d: ring(chamfer(0, 0, 7, 1.6), chamfer(0.7, 0.7, 5.6, 1.3)) },
  "one-cut": { label: "One cut corner", d: ring("M2 0H7V7H0V2Z", "M2.4 1H6V6H1V2.4Z") },
  octagon: { label: "Octagon", d: ring(poly(3.5, 3.5, 8, 3.79, Math.PI / 8), poly(3.5, 3.5, 8, 2.75, Math.PI / 8)) },
  shield: { label: "Shield", d: ring(shield(0, 0, 7, 7), shield(1, 1, 5, 5)) },
  "sq-round-in": { label: "Square + round", d: ring(rect(0, 0, 7, 7), rr(1, 1, 5, 5, 1.8)) },
  "round-sq-in": { label: "Round + square", d: ring(rr(0, 0, 7, 7, 2.4), rect(1, 1, 5, 5)) },
  "circle-sq-in": { label: "Circle + square", d: ring(circle(3.5, 3.5, 3.5), rr(1.35, 1.35, 4.3, 4.3, 0.6)) },
  double: { label: "Double line", d: rect(0, 0, 7, 7) + rect(0.55, 0.55, 5.9, 5.9) + rect(1.05, 1.05, 4.9, 4.9) + rect(1.5, 1.5, 4, 4) },
  "double-round": { label: "Double round", d: rr(0, 0, 7, 7, 2.3) + rr(0.55, 0.55, 5.9, 5.9, 1.9) + rr(1.05, 1.05, 4.9, 4.9, 1.5) + rr(1.5, 1.5, 4, 4, 1.1) },
  "double-circle": { label: "Double circle", d: circle(3.5, 3.5, 3.5) + circle(3.5, 3.5, 2.95) + circle(3.5, 3.5, 2.45) + circle(3.5, 3.5, 2.05) },
  dashed: { label: "Dashed", d: dashes() },
  dotted: { label: "Dotted", d: dotsRing() },
  "dotted-circle": { label: "Dot circle", d: dotsCircle() },
  brackets: { label: "Corners", d: brackets(0) },
  "brackets-round": { label: "Round corners", d: brackets(1.4) },
  hexagon: { label: "Hexagon", d: ring(poly(3.5, 3.5, 6, 3.75, 0), poly(3.5, 3.5, 6, 2.8, 0)) },
};

/* ===================== CENTRO DEL OJO (3×3) ===================== */
export const EYE_INNER: Record<string, { label: string; d: string }> = {
  square: { label: "Square", d: rect(0, 0, 3, 3) },
  "square-sm": { label: "Small square", d: rect(0.3, 0.3, 2.4, 2.4) },
  "rounded-xs": { label: "Soft square", d: rr(0, 0, 3, 3, 0.4) },
  rounded: { label: "Rounded", d: rr(0, 0, 3, 3, 0.85) },
  "rounded-lg": { label: "Extra round", d: rr(0, 0, 3, 3, 1.2) },
  squircle: { label: "Squircle", d: squircle(0, 0, 3, 0.46) },
  circle: { label: "Circle", d: circle(1.5, 1.5, 1.5) },
  "circle-sm": { label: "Small circle", d: circle(1.5, 1.5, 1.15) },
  diamond: { label: "Diamond", d: "M1.5 0L3 1.5L1.5 3L0 1.5Z" },
  "diamond-round": { label: "Soft diamond", d: roundDiamond(1.5, 1.5, 1.6) },
  "leaf-l": { label: "Leaf", d: rr4(0, 0, 3, 3, 1.4, 0, 1.4, 0) },
  "leaf-r": { label: "Leaf 2", d: rr4(0, 0, 3, 3, 0, 1.4, 0, 1.4) },
  drop: { label: "Drop", d: rr4(0, 0, 3, 3, 1.45, 1.45, 0, 1.45) },
  "drop-in": { label: "Drop 2", d: rr4(0, 0, 3, 3, 1.45, 1.45, 1.45, 0) },
  "one-corner": { label: "One round corner", d: rr4(0, 0, 3, 3, 1.4, 0, 0, 0) },
  chamfer: { label: "Cut corners", d: chamfer(0, 0, 3, 0.8) },
  octagon: { label: "Octagon", d: poly(1.5, 1.5, 8, 1.62, Math.PI / 8) },
  hexagon: { label: "Hexagon", d: poly(1.5, 1.5, 6, 1.62, 0) },
  plus: { label: "Plus", d: plusShape(0, 0, 3, 1.1) },
  "plus-round": { label: "Soft plus", d: roundPlus(0, 0, 3, 1.2) },
  cross: { label: "X", d: xShape(0.1, 0.1, 2.8, 0.85) },
  sparkle: { label: "Sparkle", d: sparkle(1.5, 1.5, 1.7, 0.2) },
  star: { label: "Star", d: star(1.5, 1.62, 1.7, 0.75, 5) },
  "star-8": { label: "Burst", d: star(1.5, 1.5, 1.65, 1.05, 8) },
  heart: { label: "Heart", d: heart(0, 0.1, 3) },
  flower: { label: "Flower", d: circle(1.5, 0.75, 0.72) + circle(2.25, 1.5, 0.72) + circle(1.5, 2.25, 0.72) + circle(0.75, 1.5, 0.72) + circle(1.5, 1.5, 0.7) },
  clover: { label: "Clover", d: circle(0.82, 0.82, 0.8) + circle(2.18, 0.82, 0.8) + circle(2.18, 2.18, 0.8) + circle(0.82, 2.18, 0.8) },
  dots9: { label: "Nine dots", d: dotsGrid(0, 0, 3, 3, 0.44) },
  dots4: { label: "Four dots", d: dotsGrid(0, 0, 3, 2, 0.42) },
  vbars: { label: "Vertical bars", d: rr(0.05, 0, 0.8, 3, 0.4) + rr(1.1, 0, 0.8, 3, 0.4) + rr(2.15, 0, 0.8, 3, 0.4) },
  hbars: { label: "Horizontal bars", d: rr(0, 0.05, 3, 0.8, 0.4) + rr(0, 1.1, 3, 0.8, 0.4) + rr(0, 2.15, 3, 0.8, 0.4) },
  shield: { label: "Shield", d: shield(0.1, 0, 2.8, 3) },
  "pill-v": { label: "Vertical pill", d: rr(0.6, 0, 1.8, 3, 0.9) },
};

/* ===================== MARCOS CON TEXTO ===================== */
export const FRAMES: Record<string, { label: string }> = {
  none: { label: "No frame" },
  bottom: { label: "Banner below" },
  top: { label: "Banner above" },
  thick: { label: "Bold frame" },
  outline: { label: "Outline + text" },
  pill: { label: "Pill label" },
  cta: { label: "Button" },
  bubble: { label: "Bubble above" },
  "bubble-below": { label: "Bubble below" },
  "tab-bottom": { label: "Tab below" },
  "tab-top": { label: "Tab above" },
  ribbon: { label: "Ribbon" },
  sticker: { label: "Sticker" },
  badge: { label: "Round badge" },
  pin: { label: "Map pin" },
  phone: { label: "Phone" },
  browser: { label: "Browser" },
  clipboard: { label: "Clipboard" },
  polaroid: { label: "Polaroid" },
  stamp: { label: "Stamp" },
  double: { label: "Double line" },
  corners: { label: "Corner accents" },
  brackets: { label: "Scan corners" },
  ticket: { label: "Dashed ticket" },
  header: { label: "Title on top" },
  side: { label: "Side label" },
  arrow: { label: "Arrows" },
  underline: { label: "Underlined" },
  minimal: { label: "Text only" },
};

export type QrOptions = {
  text: string; ec: "L" | "M" | "Q" | "H"; margin: number;
  body: string; eyeFrame: string; eyeInner: string;
  fg: string; bg: string; eyeFrameColor: string; eyeInnerColor: string; transparent: boolean;
  gradient: "none" | "linear" | "radial"; fg2: string; gradientAngle: number;
  logo: string | null; logoSize: number; logoPad: number; logoRadius: number; logoBg: boolean;
  frame: string; frameText: string; frameColor: string; frameTextColor: string; radius: number;
};

const xml = (s: string) => s.replace(/[<>&"]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[m]!));

// ¿El punto (px,py) cae dentro del rectángulo redondeado?
function inRound(px: number, py: number, x: number, y: number, w: number, h: number, r: number) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const dx = Math.max(x + r - px, 0, px - (x + w - r)), dy = Math.max(y + r - py, 0, py - (y + h - r));
  return dx * dx + dy * dy <= r * r;
}

// =====================================================================
// GARANTÍA DE ESCANEO con logo.
// El logo tapa módulos del código. Cada pedazo de información (codeword) pertenece a un
// "bloque" y cada bloque solo aguanta cierta cantidad de daño. Aquí calculamos EXACTAMENTE
// cuántos codewords tapa el logo en cada bloque y, si alguno se pasa del límite seguro,
// achicamos primero el espacio blanco y luego el logo hasta que el código sí se pueda leer.
// =====================================================================
type QrLike = { modules: { size: number; get: (r: number, c: number) => number; isReserved?: (r: number, c: number) => boolean | number }; version: number; errorCorrectionLevel: unknown };
function codewordBlocks(qr: QrLike) {
  const n = qr.modules.size, mods = qr.modules;
  const total: number = QRUtils.getSymbolTotalCodewords(qr.version);
  const ecTotal: number = ECCode.getTotalCodewordsCount(qr.version, qr.errorCorrectionLevel);
  const nb: number = ECCode.getBlocksCount(qr.version, qr.errorCorrectionLevel);
  const ecPer = ecTotal / nb, dataTotal = total - ecTotal;
  const g2 = dataTotal % nb, d1 = Math.floor(dataTotal / nb);
  const dataLen = (b: number) => (b < nb - g2 ? d1 : d1 + 1);
  // codeword -> bloque (orden intercalado del estándar)
  const blockOf: number[] = [];
  for (let i = 0; i <= d1; i++) for (let b = 0; b < nb; b++) if (i < dataLen(b)) blockOf.push(b);
  for (let i = 0; i < ecPer; i++) for (let b = 0; b < nb; b++) blockOf.push(b);
  // módulo -> codeword (mismo recorrido en zigzag con el que se dibuja el código)
  const cwAt = new Int32Array(n * n).fill(-1);
  let bit = 0, row = n - 1, inc = -1;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (;;) {
      for (let c = 0; c < 2; c++) {
        if (!mods.isReserved?.(row, col - c)) { const k = bit >> 3; if (k < total) cwAt[row * n + col - c] = k; bit++; }
      }
      row += inc;
      if (row < 0 || row >= n) { row -= inc; inc = -inc; break; }
    }
  }
  return { n, nb, ecPer, blockOf, cwAt };
}
// ¿El área tapada deja el código legible? (margen de seguridad: 75% de lo que cada bloque puede corregir)
function logoIsSafe(map: ReturnType<typeof codewordBlocks>, covered: (r: number, c: number) => boolean) {
  const hit = new Set<number>();
  for (let r = 0; r < map.n; r++) for (let c = 0; c < map.n; c++) { const k = map.cwAt[r * map.n + c]; if (k >= 0 && covered(r, c)) hit.add(k); }
  const per = new Array(map.nb).fill(0);
  hit.forEach((k) => { per[map.blockOf[k]]++; });
  const limit = Math.floor((map.ecPer / 2) * 0.75);
  return Math.max(...per) <= limit;
}
// Medidas finales del logo (en módulos) ya ajustadas para que el código siempre escanee
export function fitLogo(qr: QrLike, size: number, pad: number, radius: number) {
  const n = qr.modules.size;
  let map: ReturnType<typeof codewordBlocks> | null = null;
  try { map = codewordBlocks(qr); } catch { map = null; }
  let lm = Math.max(3, Math.round(n * size)), p = pad;
  const asked = { lm, p };
  for (let guard = 0; guard < 120; guard++) {
    const lo = (n - lm) / 2, bx = lo - p, bs = lm + p * 2, pr = (bs * Math.min(1, Math.max(0, radius))) / 2, g = 0.2;
    const covered = (r: number, c: number) => inRound(c + 0.5, r + 0.5, bx - g, bx - g, bs + 2 * g, bs + 2 * g, pr + g);
    if (!map || logoIsSafe(map, covered) || (p === 0 && lm <= 3)) return { lm, pad: p, lo, bx, bs, pr, covered, reduced: lm !== asked.lm || p !== asked.p };
    if (p > 0) p = Math.max(0, p - 0.5); else lm -= 1;
  }
  const lo = (n - lm) / 2;
  return { lm, pad: p, lo, bx: lo - p, bs: lm + 2 * p, pr: 0, covered: () => false, reduced: true };
}
// Para la pantalla: avisar si el logo se achicó para que el código funcione
export function logoWasReduced(o: QrOptions) {
  if (!o.logo) return false;
  try {
    const qr = QRCode.create(o.text || " ", { errorCorrectionLevel: "H" }) as unknown as QrLike;
    return fitLogo(qr, o.logoSize, o.logoPad, o.logoRadius).reduced;
  } catch { return false; }
}

// Arma el SVG completo (cuerpo, ojos, colores, logo y marco)
export function buildQrSvg(o: QrOptions) {
  // Con logo SIEMPRE nivel H (el más fuerte), para aguantar lo que el logo tapa
  const qr = QRCode.create(o.text || " ", { errorCorrectionLevel: o.logo ? "H" : o.ec });
  const n = qr.modules.size, m = o.margin, U = 10, S = (n + 2 * m) * U;
  const isEye = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  // ----- Logo: caja del logo + placa blanca (redondeada por fuera), ajustada para que SIEMPRE escanee -----
  const fit = o.logo ? fitLogo(qr as unknown as QrLike, o.logoSize, o.logoPad, o.logoRadius) : null;
  const lm = fit ? fit.lm : 0, lo = fit ? fit.lo : n / 2, pad = fit ? fit.pad : 0;
  const bx = fit ? fit.bx : 0, bs = fit ? fit.bs : 0, pr = fit ? fit.pr : 0;
  const inLogo = (r: number, c: number) => Boolean(fit && fit.covered(r, c));

  const on = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && qr.modules.get(r, c) === 1 && !isEye(r, c) && !inLogo(r, c);
  const shape = BODY[o.body] ?? BODY.square;
  let body = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!on(r, c)) continue;
    const d = shape.fn ? shape.fn({ t: on(r - 1, c), r: on(r, c + 1), b: on(r + 1, c), l: on(r, c - 1) }) : shape.d!;
    body += placePath(d, (c + m) * U, (r + m) * U, U);
  }

  const ef = EYE_FRAME[o.eyeFrame] ?? EYE_FRAME.square, ei = EYE_INNER[o.eyeInner] ?? EYE_INNER.square;
  const eye = (r0: number, c0: number, rot: number) => {
    const x = (c0 + m) * U, y = (r0 + m) * U;
    const t = `translate(${x} ${y}) rotate(${rot} ${3.5 * U} ${3.5 * U}) scale(${U})`;
    return `<path transform="${t}" d="${ef.d}" fill="${o.eyeFrameColor}" fill-rule="evenodd"/>`
      + `<path transform="${t} translate(2 2)" d="${ei.d}" fill="${o.eyeInnerColor}"/>`;
  };
  const eyes = eye(0, 0, 0) + eye(0, n - 7, 90) + eye(n - 7, 0, -90);
  const paint = o.gradient === "none" ? o.fg : "url(#qg)";
  const grad = o.gradient === "none" ? "" : o.gradient === "radial"
    ? `<radialGradient id="qg" gradientUnits="userSpaceOnUse" cx="${S / 2}" cy="${S / 2}" r="${S * 0.62}"><stop offset="0" stop-color="${o.fg}"/><stop offset="1" stop-color="${o.fg2}"/></radialGradient>`
    : `<linearGradient id="qg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${S}" y2="0" gradientTransform="rotate(${o.gradientAngle} ${S / 2} ${S / 2})"><stop offset="0" stop-color="${o.fg}"/><stop offset="1" stop-color="${o.fg2}"/></linearGradient>`;

  let logo = "";
  if (o.logo) {
    const px = (bx + m) * U, ps = bs * U, prr = pr * U;
    // Placa 100% blanca (#FFFFFF), con las esquinas de AFUERA redondeadas
    if (o.logoBg) logo += `<rect x="${f(px)}" y="${f(px)}" width="${f(ps)}" height="${f(ps)}" rx="${f(prr)}" ry="${f(prr)}" fill="#FFFFFF"/>`;
    // El logo va completo (sin recortarlo); si la placa está muy redonda, se achica un poco para no tocar las curvas
    const inset = pad < 1.5 ? lm * U * o.logoRadius * 0.16 : 0;
    const lx = (lo + m) * U + inset, ls = lm * U - inset * 2;
    logo += `<image href="${o.logo}" x="${f(lx)}" y="${f(lx)}" width="${f(ls)}" height="${f(ls)}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  const code = `${grad ? `<defs>${grad}</defs>` : ""}<path d="${body}" fill="${paint}"/>${eyes}${logo}`;
  const fr = frameSvg(o, S, U);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(fr.W)} ${f(fr.H)}" width="${f(fr.W)}" height="${f(fr.H)}">${fr.back}<g transform="translate(${f(fr.x)} ${f(fr.y)})">${code}</g>${fr.front ?? ""}</svg>`;
}

/* ---------- Marcos ---------- */
function frameSvg(o: QrOptions, S: number, U: number): { W: number; H: number; x: number; y: number; back: string; front?: string } {
  const fc = o.frameColor, tc = o.frameTextColor, raw = (o.frameText || "").toUpperCase(), txt = xml(raw);
  const bgFill = o.transparent ? "none" : o.bg;
  const solid = o.transparent ? "#ffffff" : o.bg; // donde el código va sobre color, siempre fondo sólido
  const P = U * 2.5, len = Math.max(1, raw.length);
  const font = `font-family="Helvetica, Arial, sans-serif" font-weight="700" letter-spacing="${U * 0.2}"`;
  const fit = (maxW: number, big = 3.4) => Math.max(U * 1.5, Math.min(U * big, (maxW / len - U * 0.2) / 0.62));
  const textW = (fs: number) => len * (fs * 0.62 + U * 0.2);
  const T = (x: number, cy: number, fill: string, maxW: number, big = 3.4) => {
    if (!raw) return "";
    const fs = fit(maxW, big);
    return `<text x="${f(x)}" y="${f(cy + fs * 0.36)}" text-anchor="middle" font-size="${f(fs)}" ${font} fill="${fill}">${txt}</text>`;
  };
  const rrS = (x: number, y: number, w: number, h: number, r: number, fill: string, extra = "") => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="${fill}" ${extra}/>`;
  const B = S + P * 2; // caja del código con su aire
  const k = o.frame;

  if (k === "bottom" || k === "top") {
    const bh = U * 8, W = B, H = B + bh, sw = U * 1.2, e = sw / 2;
    const band = k === "top"
      ? `M${e} ${bh}V${U * 3.6}Q${e} ${e} ${U * 3.6} ${e}H${W - U * 3.6}Q${W - e} ${e} ${W - e} ${U * 3.6}V${bh}Z`
      : `M${e} ${H - bh}H${W - e}V${H - U * 3.6}Q${W - e} ${H - e} ${W - U * 3.6} ${H - e}H${U * 3.6}Q${e} ${H - e} ${e} ${H - U * 3.6}Z`;
    return { W, H, x: P, y: k === "top" ? bh + P : P,
      back: rrS(e, e, W - sw, H - sw, U * 3, bgFill, `stroke="${fc}" stroke-width="${sw}"`) + `<path d="${band}" fill="${fc}"/>` + T(W / 2, k === "top" ? bh / 2 + U * 0.3 : H - bh / 2 - U * 0.3, tc, W - U * 5) };
  }
  if (k === "thick") {
    const t = U * 2, bh = U * 8.5, W = S + t * 2, H = S + t + bh;
    return { W, H, x: t, y: t, back: rrS(0, 0, W, H, U * 3.5, fc) + rrS(t, t, S, S, U * 1.6, solid) + T(W / 2, S + t + bh / 2, tc, W - U * 5) };
  }
  if (k === "outline") {
    const th = U * 7.5, W = B, H = B + th, sw = U * 1.2;
    return { W, H, x: P, y: P, back: rrS(0, 0, W, H, U * 3, bgFill) + rrS(sw / 2, sw / 2, W - sw, B - sw, U * 3, bgFill, `stroke="${fc}" stroke-width="${sw}"`) + T(W / 2, B + th / 2, fc, W - U * 3) };
  }
  if (k === "pill") {
    const ph = U * 7.5, W = B, H = B + ph + U * 2, fs = fit(W - U * 12), pw = Math.min(W - U * 4, textW(fs) + U * 8);
    return { W, H, x: P, y: P, back: rrS(0, 0, W, H, U * 3, bgFill) + rrS((W - pw) / 2, B, pw, ph, ph / 2, fc) + T(W / 2, B + ph / 2, tc, W - U * 12) };
  }
  if (k === "cta") {
    const ph = U * 8.5, W = B, H = B + ph + U * 1.5, px = P * 0.6, pw = W - px * 2, py = B - U * 0.5, cr = ph * 0.34, ccx = px + pw - ph / 2;
    const arrow = `<path d="M${f(ccx - cr * 0.45)} ${f(py + ph / 2)}H${f(ccx + cr * 0.4)}M${f(ccx + cr * 0.02)} ${f(py + ph / 2 - cr * 0.4)}L${f(ccx + cr * 0.45)} ${f(py + ph / 2)}L${f(ccx + cr * 0.02)} ${f(py + ph / 2 + cr * 0.4)}" fill="none" stroke="${fc}" stroke-width="${U * 0.55}" stroke-linecap="round" stroke-linejoin="round"/>`;
    return { W, H, x: P, y: P, back: rrS(0, 0, W, H, U * 3, bgFill) + rrS(px, py, pw, ph, ph / 2, fc) + `<circle cx="${f(ccx)}" cy="${f(py + ph / 2)}" r="${f(cr)}" fill="${tc}"/>` + arrow + T(px + (pw - ph) / 2 + U, py + ph / 2, tc, pw - ph - U * 4) };
  }
  if (k === "bubble") {
    const bh = U * 8, tail = U * 3, W = B, H = bh + tail + B;
    return { W, H, x: P, y: bh + tail + P,
      back: rrS(0, 0, W, bh, U * 3, fc) + `<path d="M${W / 2 - tail} ${bh - 1}L${W / 2} ${bh + tail}L${W / 2 + tail} ${bh - 1}Z" fill="${fc}"/>` + T(W / 2, bh / 2, tc, W - U * 4) + rrS(0, bh + tail, W, B, U * 3, bgFill) };
  }
  if (k === "bubble-below") {
    const bh = U * 8, tail = U * 3, W = B, H = B + tail + bh;
    return { W, H, x: P, y: P,
      back: rrS(0, 0, W, B, U * 3, bgFill) + `<path d="M${W / 2 - tail} ${B + tail + 1}L${W / 2} ${B}L${W / 2 + tail} ${B + tail + 1}Z" fill="${fc}"/>` + rrS(0, B + tail, W, bh, U * 3, fc) + T(W / 2, B + tail + bh / 2, tc, W - U * 4) };
  }
  if (k === "tab-bottom" || k === "tab-top") {
    const th = U * 8, W = B, H = B + th, sw = U * 1, tw = W * 0.72, tx = (W - tw) / 2, top = k === "tab-top";
    const cardY = top ? th : 0, r = U * 3;
    const tab = top
      ? `M${f(tx)} ${f(th + sw)}V${f(r)}Q${f(tx)} 0 ${f(tx + r)} 0H${f(tx + tw - r)}Q${f(tx + tw)} 0 ${f(tx + tw)} ${f(r)}V${f(th + sw)}Z`
      : `M${f(tx)} ${f(B - sw)}V${f(H - r)}Q${f(tx)} ${f(H)} ${f(tx + r)} ${f(H)}H${f(tx + tw - r)}Q${f(tx + tw)} ${f(H)} ${f(tx + tw)} ${f(H - r)}V${f(B - sw)}Z`;
    return { W, H, x: P, y: cardY + P, back: rrS(sw / 2, cardY + sw / 2, W - sw, B - sw, U * 3, bgFill, `stroke="${fc}" stroke-width="${sw}"`) + `<path d="${tab}" fill="${fc}"/>` + T(W / 2, top ? th / 2 : B + th / 2 - sw / 2, tc, tw - U * 3) };
  }
  if (k === "ribbon") {
    const ext = U * 2.5, bh = U * 8, W = B + ext * 2, by = B - U * 1.5, H = by + bh + U * 2.2, fold = U * 2.2;
    const band = `M0 ${f(by)}H${f(W)}L${f(W - U * 1.6)} ${f(by + bh / 2)}L${f(W)} ${f(by + bh)}H0L${f(U * 1.6)} ${f(by + bh / 2)}Z`;
    const folds = `<path d="M${ext} ${f(by + bh)}V${f(by + bh + fold)}L0 ${f(by + bh)}ZM${f(W - ext)} ${f(by + bh)}V${f(by + bh + fold)}L${f(W)} ${f(by + bh)}Z" fill="${fc}"/><path d="M${ext} ${f(by + bh)}V${f(by + bh + fold)}L0 ${f(by + bh)}ZM${f(W - ext)} ${f(by + bh)}V${f(by + bh + fold)}L${f(W)} ${f(by + bh)}Z" fill="#000" opacity=".3"/>`;
    return { W, H, x: ext + P, y: P, back: rrS(ext, 0, B, by + bh * 0.6, U * 3, bgFill, `stroke="${fc}" stroke-width="${U * 0.8}"`) + folds + `<path d="${band}" fill="${fc}"/>` + T(W / 2, by + bh / 2, tc, W - U * 7) };
  }
  if (k === "sticker") {
    const in1 = U * 1.4, gap = U * 1.5, W = S + (in1 + gap) * 2, oh = S + (in1 + gap) * 2 + U * 2.5, ph = U * 7, pw = W * 0.78, H = oh + ph / 2 + U * 0.6;
    return { W, H, x: in1 + gap, y: in1 + gap,
      back: rrS(0, 0, W, oh, U * 4.5, fc) + rrS(in1, in1, W - in1 * 2, oh - in1 * 2, U * 3.2, solid),
      front: rrS((W - pw) / 2, oh - ph / 2, pw, ph, ph / 2, fc, `stroke="${solid}" stroke-width="${U * 0.8}"`) + T(W / 2, oh, tc, pw - U * 4) };
  }
  if (k === "badge") {
    const c = S + U * 2, R = Math.sqrt((c / 2) ** 2 + (c / 2 + U * 3.5) ** 2) + U * 1.5, W = R * 2, H = R * 2;
    const top = R - c / 2 - U * 3.5, ty = top + c + U * 4.6, chord = 2 * Math.sqrt(Math.max(0, R * R - (ty - R + U * 1.5) ** 2));
    return { W, H, x: R - S / 2, y: top + U, back: `<circle cx="${f(R)}" cy="${f(R)}" r="${f(R)}" fill="${fc}"/>` + rrS(R - c / 2, top, c, c, U * 3, solid) + T(R, ty, tc, chord - U * 6, 4.6) };
  }
  if (k === "pin") {
    const c = S + U * 2, R = c * 0.74, cx = R + U * 1.5, cy = R + U * 1.5, d = R * 1.55, W = cx * 2;
    const a = Math.acos(R / d), lx = cx - R * Math.sin(a), ly = cy + R * Math.cos(a), rx = cx + R * Math.sin(a);
    const pinPath = `M${f(cx)} ${f(cy + d)}L${f(lx)} ${f(ly)}A${f(R)} ${f(R)} 0 1 1 ${f(rx)} ${f(ly)}Z`;
    const H = cy + d + U * 10.5;
    return { W, H, x: cx - S / 2, y: cy - S / 2, back: `<path d="${pinPath}" fill="${fc}"/>` + rrS(cx - c / 2, cy - c / 2, c, c, U * 3, solid) + `<ellipse cx="${f(cx)}" cy="${f(cy + d + U * 0.6)}" rx="${f(U * 3)}" ry="${f(U * 0.8)}" fill="${fc}" opacity=".25"/>` + T(cx, cy + d + U * 5.6, fc, W - U * 3, 5.2) };
  }
  if (k === "phone") {
    const b = U * 1.6, top = U * 5.5, tH = U * 8, W = B + b * 2, H = b + top + S + tH + U * 3.5 + b;
    return { W, H, x: b + P, y: b + top,
      back: rrS(0, 0, W, H, U * 6, fc) + rrS(b, b, W - b * 2, H - b * 2, U * 4.4, solid) + rrS(W * 0.34, b - 1, W * 0.32, U * 2.4, U * 1.2, fc)
        + T(W / 2, b + top + S + tH / 2, fc, W - U * 7) + rrS(W * 0.35, H - b - U * 2.4, W * 0.3, U * 0.8, U * 0.4, fc, `opacity=".35"`) };
  }
  if (k === "browser") {
    const bar = U * 5.5, th = U * 8, W = B, H = bar + B + th - P * 0.6, sw = U * 0.7;
    const dots = [0, 1, 2].map((i) => `<circle cx="${f(U * 3 + i * U * 2.4)}" cy="${f(bar / 2)}" r="${f(U * 0.8)}" fill="${tc}" opacity="${1 - i * 0.25}"/>`).join("");
    return { W, H, x: P, y: bar + P * 0.6,
      back: rrS(sw / 2, sw / 2, W - sw, H - sw, U * 3, bgFill, `stroke="${fc}" stroke-width="${sw}"`) + `<path d="M0 ${f(bar)}V${f(U * 3)}Q0 0 ${f(U * 3)} 0H${f(W - U * 3)}Q${f(W)} 0 ${f(W)} ${f(U * 3)}V${f(bar)}Z" fill="${fc}"/>` + dots
        + rrS(U * 10.5, bar * 0.25, W - U * 13, bar * 0.5, bar * 0.25, tc, `opacity=".25"`) + T(W / 2, bar + P * 0.6 + S + th / 2, fc, W - U * 4) };
  }
  if (k === "clipboard") {
    const s = U * 1.8, top = U * 6, th = U * 8.5, W = B + s * 2, H = top + B + th + s - P;
    const cw = W * 0.38, cx = (W - cw) / 2;
    return { W, H, x: s + P, y: top + P * 0.7,
      back: rrS(0, U * 2, W, H - U * 2, U * 3.5, fc) + rrS(s, top - U * 0.5, W - s * 2, H - top - s + U * 0.5, U * 2, solid)
        + rrS(cx, 0, cw, U * 5, U * 1.6, solid, `stroke="${fc}" stroke-width="${U * 0.9}"`) + `<circle cx="${f(W / 2)}" cy="${f(U * 1.7)}" r="${f(U * 0.7)}" fill="${fc}"/>`
        + T(W / 2, top + P * 0.7 + S + th / 2 - U * 0.5, fc, W - U * 7) };
  }
  if (k === "polaroid") {
    const s = U * 2, bot = U * 10, W = S + s * 2, H = S + s + bot;
    return { W, H, x: s, y: s, back: rrS(U * 0.25, U * 0.25, W - U * 0.5, H - U * 0.5, U * 1.2, solid, `stroke="${fc}" stroke-opacity=".22" stroke-width="${U * 0.5}"`) + T(W / 2, S + s + bot / 2, fc, W - U * 5) };
  }
  if (k === "stamp") {
    const rs = U * 1.1, inner = U * 2.6, gap = U * 1.2, th = U * 7.5, W = S + (inner + gap) * 2, H = S + (inner + gap) * 2 + th;
    let bumps = "";
    const edge = (x1: number, y1: number, x2: number, y2: number) => {
      const L = Math.hypot(x2 - x1, y2 - y1), cnt = Math.max(2, Math.round(L / (rs * 2)));
      for (let i = 0; i <= cnt; i++) bumps += circle(x1 + ((x2 - x1) * i) / cnt, y1 + ((y2 - y1) * i) / cnt, rs);
    };
    edge(rs, rs, W - rs, rs); edge(W - rs, rs, W - rs, H - rs); edge(W - rs, H - rs, rs, H - rs); edge(rs, H - rs, rs, rs);
    return { W, H, x: inner + gap, y: inner + gap,
      back: `<path d="${bumps}${rect(rs, rs, W - rs * 2, H - rs * 2)}" fill="${fc}"/>` + rrS(inner, inner, W - inner * 2, H - inner * 2, U, solid) + T(W / 2, H - inner - th / 2 - U * 0.3, fc, W - inner * 2 - U * 3) };
  }
  if (k === "double") {
    const o1 = U * 0.6, i1 = U * 1.8, pad = U * 1.4, th = U * 7.5, W = S + (i1 + pad) * 2, inH = S + pad * 2, H = i1 + inH + th + o1;
    return { W, H, x: i1 + pad, y: i1 + pad,
      back: rrS(o1 / 2, o1 / 2, W - o1, H - o1, U * 3.5, bgFill, `stroke="${fc}" stroke-width="${o1}"`) + rrS(i1, i1, W - i1 * 2, inH, U * 2.2, "none", `stroke="${fc}" stroke-width="${o1}"`) + T(W / 2, i1 + inH + th / 2, fc, W - U * 6) };
  }
  if (k === "corners") {
    const th = U * 7.5, W = B, H = B + th, t = U * 1.4, L = U * 9, e = U * 0.9;
    const ls = `<path d="M${f(e)} ${f(e + L)}V${f(e)}H${f(e + L)}M${f(W - e - L)} ${f(B - e)}H${f(W - e)}V${f(B - e - L)}" fill="none" stroke="${fc}" stroke-width="${t}" stroke-linecap="round" stroke-linejoin="round"/>`;
    return { W, H, x: P, y: P, back: rrS(0, 0, W, H, U * 3, bgFill) + ls + T(W / 2, B + th / 2, fc, W - U * 3) };
  }
  if (k === "brackets") {
    const th = U * 7, L = U * 6, W = B, H = B + th, sw = U * 1.1, e = sw / 2;
    return { W, H, x: P, y: P, back: rrS(0, 0, W, H, U * 2, bgFill) + `<g fill="none" stroke="${fc}" stroke-width="${sw}" stroke-linecap="round">`
      + `<path d="M${e} ${L}V${e}H${L}"/><path d="M${W - L} ${e}H${W - e}V${L}"/><path d="M${e} ${B - L}V${B - e}H${L}"/><path d="M${W - L} ${B - e}H${W - e}V${B - L}"/></g>` + T(W / 2, B + th / 2 - U * 0.5, fc, W - U * 3) };
  }
  if (k === "ticket") {
    const th = U * 7, W = B, H = B + th;
    return { W, H, x: P, y: P, back: rrS(U * 0.6, U * 0.6, W - U * 1.2, H - U * 1.2, U * 2, bgFill, `stroke="${fc}" stroke-width="${U * 0.8}" stroke-dasharray="${U * 2} ${U * 1.2}"`)
      + `<line x1="${U * 2}" x2="${W - U * 2}" y1="${B - U * 0.5}" y2="${B - U * 0.5}" stroke="${fc}" stroke-width="${U * 0.4}" stroke-dasharray="${U} ${U}"/>` + T(W / 2, B + th / 2 - U * 0.6, fc, W - U * 4) };
  }
  if (k === "header") {
    const hh = U * 10, W = B, H = hh + B - P * 0.4, sw = U * 0.8;
    return { W, H, x: P, y: hh + P * 0.6, back: rrS(sw / 2, sw / 2, W - sw, H - sw, U * 3, bgFill, `stroke="${fc}" stroke-width="${sw}"`) + T(W / 2, hh / 2 + U * 0.6, fc, W - U * 4)
      + `<line x1="${f(W * 0.3)}" x2="${f(W * 0.7)}" y1="${f(hh + U * 0.2)}" y2="${f(hh + U * 0.2)}" stroke="${fc}" stroke-opacity=".3" stroke-width="${U * 0.5}" stroke-linecap="round"/>` };
  }
  if (k === "side") {
    const band = U * 8.5, W = band + B, H = B, sw = U * 0.8;
    const fs = fit(H - U * 5);
    return { W, H, x: band + P, y: P, back: rrS(sw / 2, sw / 2, W - sw, H - sw, U * 3, bgFill, `stroke="${fc}" stroke-width="${sw}"`)
      + `<path d="M0 ${f(U * 3)}Q0 0 ${f(U * 3)} 0H${f(band)}V${f(H)}H${f(U * 3)}Q0 ${f(H)} 0 ${f(H - U * 3)}Z" fill="${fc}"/>`
      + (raw ? `<text transform="translate(${f(band / 2 + fs * 0.36)} ${f(H / 2)}) rotate(-90)" x="0" y="0" text-anchor="middle" font-size="${f(fs)}" ${font} fill="${tc}">${txt}</text>` : "") };
  }
  if (k === "arrow") {
    const th = U * 8, W = B, H = B + th, fs = fit(W - U * 16), half = textW(fs) / 2 + U * 3, cy = B + th / 2 - U * 0.4;
    const chev = (x: number) => `<path d="M${f(x - U * 1.5)} ${f(cy + U * 1)}L${f(x)} ${f(cy - U * 0.8)}L${f(x + U * 1.5)} ${f(cy + U * 1)}" fill="none" stroke="${fc}" stroke-width="${U * 0.8}" stroke-linecap="round" stroke-linejoin="round"/>`;
    return { W, H, x: P, y: P, back: rrS(0, 0, W, H, U * 3, bgFill) + chev(W / 2 - half) + chev(W / 2 + half) + T(W / 2, cy, fc, W - U * 16) };
  }
  if (k === "underline") {
    const th = U * 10, W = B, H = B + th - U, fs = fit(W - U * 4), lw = Math.min(W - U * 6, textW(fs) * 0.7);
    return { W, H, x: P, y: P, back: rrS(0, 0, W, H, U * 3, bgFill) + T(W / 2, B + U * 2, fc, W - U * 4) + rrS((W - lw) / 2, B + U * 2 + fs * 0.75, lw, U * 0.9, U * 0.45, fc) };
  }
  if (k === "minimal") {
    const th = U * 7, W = S, H = S + th;
    return { W, H, x: 0, y: 0, back: rrS(0, 0, W, H, (S * o.radius) / 2, bgFill) + T(W / 2, S + th / 2 - U * 1.2, fc, W - U * 3) };
  }
  // Sin marco
  return { W: S, H: S, x: 0, y: 0, back: rrS(0, 0, S, S, (S * o.radius) / 2, bgFill) };
}
