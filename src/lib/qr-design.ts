import QRCode from "qrcode";

// ---------- Formas (en un cuadrito de 0 a 1) ----------
const star = (cx: number, cy: number, R: number, r: number, n = 5) => {
  let d = "";
  for (let i = 0; i < n * 2; i++) { const a = (Math.PI / n) * i - Math.PI / 2; const rr = i % 2 ? r : R; d += `${i ? "L" : "M"}${(cx + rr * Math.cos(a)).toFixed(3)} ${(cy + rr * Math.sin(a)).toFixed(3)}`; }
  return d + "Z";
};
const poly = (n: number, r = 0.5, rot = 0) => {
  let d = "";
  for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n + rot; d += `${i ? "L" : "M"}${(0.5 + r * Math.cos(a)).toFixed(3)} ${(0.5 + r * Math.sin(a)).toFixed(3)}`; }
  return d + "Z";
};
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;

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
const rrect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
const heart = "M.5 .9C.15 .65 0 .45 0 .3A.25 .25 0 0 1 .5 .2A.25 .25 0 0 1 1 .3C1 .45 .85 .65 .5 .9Z";

export const BODY: Record<string, { label: string; d: string }> = {
  square: { label: "Square", d: "M0 0H1.02V1.02H0Z" },
  circle: { label: "Circle", d: circle(0.5, 0.5, 0.5) },
  rounded: { label: "Rounded", d: rrect(0.04, 0.04, 0.92, 0.92, 0.3) },
  dot: { label: "Dot", d: circle(0.5, 0.5, 0.36) },
  diamond: { label: "Diamond", d: "M.5 0L1 .5L.5 1L0 .5Z" },
  "small-diamond": { label: "Small diamond", d: "M.5 .12L.88 .5L.5 .88L.12 .5Z" },
  hexagon: { label: "Hexagon", d: poly(6, 0.52) },
  octagon: { label: "Octagon", d: poly(8, 0.54, Math.PI / 8) },
  plus: { label: "Plus", d: "M.33 0H.67V.33H1V.67H.67V1H.33V.67H0V.33H.33Z" },
  vbar: { label: "Vertical", d: rrect(0.22, 0, 0.56, 1, 0.18) },
  hbar: { label: "Horizontal", d: rrect(0, 0.22, 1, 0.56, 0.18) },
  tiny: { label: "Tiny dot", d: circle(0.5, 0.5, 0.24) },
  triangle: { label: "Triangle", d: "M.5 .05L1 .95H0Z" },
  heart: { label: "Heart", d: heart },
  leaf: { label: "Leaf", d: "M0 1V.5Q0 0 .5 0H1V.5Q1 1 .5 1Z" },
  "soft-square": { label: "Soft square", d: rrect(0, 0, 1, 1, 0.15) },
  cross: { label: "X", d: "M.15 0L.5 .35L.85 0L1 .15L.65 .5L1 .85L.85 1L.5 .65L.15 1L0 .85L.35 .5L0 .15Z" },
};

// Marco del ojo: 7×7 con hueco (evenodd)
const ring = (outer: string, inner: string) => `${outer}${inner}`;
export const EYE_FRAME: Record<string, { label: string; d: string }> = {
  square: { label: "Square", d: ring("M0 0H7V7H0Z", "M1 1V6H6V1Z") },
  rounded: { label: "Rounded", d: ring(rrect(0, 0, 7, 7, 2), rrect(1, 1, 5, 5, 1.3)) },
  circle: { label: "Circle", d: ring(circle(3.5, 3.5, 3.5), circle(3.5, 3.5, 2.5)) },
  thin: { label: "Thin", d: ring("M0 0H7V7H0Z", "M.65 .65V6.35H6.35V.65Z") },
  "thin-round": { label: "Thin round", d: ring(rrect(0, 0, 7, 7, 2.2), rrect(0.65, 0.65, 5.7, 5.7, 1.7)) },
  "leaf-l": { label: "Leaf", d: ring("M0 7V2.6Q0 0 2.6 0H7V4.4Q7 7 4.4 7Z", "M1 6V3Q1 1 3 1H6V4Q6 6 4 6Z") },
  "leaf-r": { label: "Leaf 2", d: ring("M0 0H4.4Q7 0 7 2.6V7H2.6Q0 7 0 4.4Z", "M1 1H4Q6 1 6 3V6H3Q1 6 1 4Z") },
  thick: { label: "Bold", d: ring("M0 0H7V7H0Z", "M1.15 1.15V5.85H5.85V1.15Z") },
  octagon: { label: "Octagon", d: ring("M2 0H5L7 2V5L5 7H2L0 5V2Z", "M2.4 1H4.6L6 2.4V4.6L4.6 6H2.4L1 4.6V2.4Z") },
  shield: { label: "Shield", d: ring("M0 0H7V4Q7 7 3.5 7Q0 7 0 4Z", "M1 1V4Q1 6 3.5 6Q6 6 6 4V1Z") },
  "soft": { label: "Soft", d: ring(rrect(0, 0, 7, 7, 1), rrect(1, 1, 5, 5, 0.5)) },
  pill: { label: "Pill", d: ring(rrect(0, 0, 7, 7, 3.5), rrect(1, 1, 5, 5, 2.5)) },
};

// Centro del ojo: 3×3
export const EYE_INNER: Record<string, { label: string; d: string }> = {
  square: { label: "Square", d: "M0 0H3V3H0Z" },
  rounded: { label: "Rounded", d: rrect(0, 0, 3, 3, 0.8) },
  circle: { label: "Circle", d: circle(1.5, 1.5, 1.5) },
  diamond: { label: "Diamond", d: "M1.5 0L3 1.5L1.5 3L0 1.5Z" },
  "leaf-l": { label: "Leaf", d: "M0 3V1.3Q0 0 1.3 0H3V1.7Q3 3 1.7 3Z" },
  "leaf-r": { label: "Leaf 2", d: "M0 0H1.7Q3 0 3 1.3V3H1.3Q0 3 0 1.7Z" },
  plus: { label: "Plus", d: "M1 0H2V1H3V2H2V3H1V2H0V1H1Z" },
  hexagon: { label: "Hexagon", d: "M1.5 0L2.8 .75V2.25L1.5 3L.2 2.25V.75Z" },
  octagon: { label: "Octagon", d: "M.9 0H2.1L3 .9V2.1L2.1 3H.9L0 2.1V.9Z" },
  shield: { label: "Shield", d: "M0 0H3V1.6Q3 3 1.5 3Q0 3 0 1.6Z" },
  soft: { label: "Soft", d: rrect(0, 0, 3, 3, 0.4) },
};

export const FRAMES: Record<string, { label: string }> = {
  none: { label: "No frame" },
  bottom: { label: "Banner below" },
  top: { label: "Banner above" },
  outline: { label: "Outline + text" },
  pill: { label: "Pill label" },
  bubble: { label: "Speech bubble" },
  ticket: { label: "Dashed ticket" },
  brackets: { label: "Corner brackets" },
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

// Arma el SVG completo (cuerpo, ojos, colores, logo y marco)
export function buildQrSvg(o: QrOptions) {
  const qr = QRCode.create(o.text || " ", { errorCorrectionLevel: o.logo ? (o.ec === "L" || o.ec === "M" ? "Q" : o.ec) : o.ec });
  const n = qr.modules.size, m = o.margin, U = 10, S = (n + 2 * m) * U;
  const isEye = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const lm = o.logo ? Math.max(3, Math.round(n * o.logoSize)) : 0;
  const lo = Math.floor((n - lm) / 2), pad = o.logo ? o.logoPad : 0;
  const inLogo = (r: number, c: number) => o.logo && r >= lo - pad && r < lo + lm + pad && c >= lo - pad && c < lo + lm + pad;
  const shape = BODY[o.body] ?? BODY.square;
  let body = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!qr.modules.get(r, c) || isEye(r, c) || inLogo(r, c)) continue;
    body += placePath(shape.d, (c + m) * U, (r + m) * U, U);
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
  const grad = o.gradient === "radial"
    ? `<radialGradient id="qg" gradientUnits="userSpaceOnUse" cx="${S / 2}" cy="${S / 2}" r="${S * 0.62}"><stop offset="0" stop-color="${o.fg}"/><stop offset="1" stop-color="${o.fg2}"/></radialGradient>`
    : `<linearGradient id="qg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${S}" y2="0" gradientTransform="rotate(${o.gradientAngle} ${S / 2} ${S / 2})"><stop offset="0" stop-color="${o.fg}"/><stop offset="1" stop-color="${o.fg2}"/></linearGradient>`;
  let logo = "";
  if (o.logo) {
    const lx = (lo + m) * U, ls = lm * U, rr = (ls * o.logoRadius) / 2;
    if (o.logoBg) logo += `<rect x="${lx - pad * U * 0.5}" y="${lx - pad * U * 0.5}" width="${ls + pad * U}" height="${ls + pad * U}" rx="${rr}" fill="${o.transparent ? "#ffffff" : o.bg}"/>`;
    logo += `<clipPath id="ql"><rect x="${lx}" y="${lx}" width="${ls}" height="${ls}" rx="${rr}"/></clipPath><image href="${o.logo}" x="${lx}" y="${lx}" width="${ls}" height="${ls}" preserveAspectRatio="xMidYMid meet" clip-path="url(#ql)"/>`;
  }
  const code = `<defs>${grad}</defs><path d="${body}" fill="${paint}"/>${eyes}${logo}`;

  // ---------- Marco ----------
  const f = o.frame, fc = o.frameColor, tc = o.frameTextColor, txt = xml((o.frameText || "").toUpperCase());
  const bgFill = o.transparent ? "none" : o.bg;
  const fs = U * 3.2, font = `font-family="Helvetica, Arial, sans-serif" font-weight="700" letter-spacing="${U * 0.2}"`;
  let W = S, H = S, inner = `<g>${code}</g>`, extra = "";
  const P = U * 2.5; // espacio alrededor del código
  if (f === "none") {
    extra = `<rect width="${S}" height="${S}" rx="${(S * o.radius) / 2}" fill="${bgFill}"/>`;
  } else if (f === "bottom" || f === "top") {
    const bh = U * 8; W = S + P * 2; H = S + P * 2 + bh;
    const cy = f === "top" ? bh + P : P;
    inner = `<g transform="translate(${P} ${cy})">${code}</g>`;
    extra = `<rect x="${U * 0.6}" y="${U * 0.6}" width="${W - U * 1.2}" height="${H - U * 1.2}" rx="${U * 3}" fill="${bgFill}" stroke="${fc}" stroke-width="${U * 1.2}"/>`
      + `<path d="${f === "top" ? `M${U * 0.6} ${bh}V${U * 3.6}Q${U * 0.6} ${U * 0.6} ${U * 3.6} ${U * 0.6}H${W - U * 3.6}Q${W - U * 0.6} ${U * 0.6} ${W - U * 0.6} ${U * 3.6}V${bh}Z` : `M${U * 0.6} ${H - bh}H${W - U * 0.6}V${H - U * 3.6}Q${W - U * 0.6} ${H - U * 0.6} ${W - U * 3.6} ${H - U * 0.6}H${U * 3.6}Q${U * 0.6} ${H - U * 0.6} ${U * 0.6} ${H - U * 3.6}Z`}" fill="${fc}"/>`
      + `<text x="${W / 2}" y="${f === "top" ? bh / 2 + fs * 0.38 + U * 0.3 : H - bh / 2 + fs * 0.38 - U * 0.3}" text-anchor="middle" font-size="${fs}" ${font} fill="${tc}">${txt}</text>`;
  } else if (f === "outline") {
    const th = U * 7; W = S + P * 2; H = S + P * 2 + th;
    inner = `<g transform="translate(${P} ${P})">${code}</g>`;
    extra = `<rect width="${W}" height="${H}" rx="${U * 3}" fill="${bgFill}"/><rect x="${U * 0.6}" y="${U * 0.6}" width="${W - U * 1.2}" height="${S + P * 2 - U * 1.2}" rx="${U * 3}" fill="${bgFill}" stroke="${fc}" stroke-width="${U * 1.2}"/>`
      + `<text x="${W / 2}" y="${S + P * 2 + th / 2 + fs * 0.35}" text-anchor="middle" font-size="${fs}" ${font} fill="${fc}">${txt}</text>`;
  } else if (f === "pill") {
    const ph = U * 7.5; W = S + P * 2; H = S + P * 2 + ph + U * 2;
    inner = `<g transform="translate(${P} ${P})">${code}</g>`;
    const pw = Math.min(W - U * 4, txt.length * fs * 0.72 + U * 8);
    extra = `<rect width="${W}" height="${H}" rx="${U * 3}" fill="${bgFill}"/>`
      + `<rect x="${(W - pw) / 2}" y="${S + P * 2 + U}" width="${pw}" height="${ph}" rx="${ph / 2}" fill="${fc}"/>`
      + `<text x="${W / 2}" y="${S + P * 2 + U + ph / 2 + fs * 0.36}" text-anchor="middle" font-size="${fs}" ${font} fill="${tc}">${txt}</text>`;
  } else if (f === "bubble") {
    const bh = U * 8, tail = U * 3; W = S + P * 2; H = bh + tail + S + P * 2;
    inner = `<g transform="translate(${P} ${bh + tail + P})">${code}</g>`;
    extra = `<rect x="0" y="0" width="${W}" height="${bh}" rx="${U * 3}" fill="${fc}"/><path d="M${W / 2 - tail} ${bh - 1}L${W / 2} ${bh + tail}L${W / 2 + tail} ${bh - 1}Z" fill="${fc}"/>`
      + `<text x="${W / 2}" y="${bh / 2 + fs * 0.36}" text-anchor="middle" font-size="${fs}" ${font} fill="${tc}">${txt}</text>`
      + `<rect x="0" y="${bh + tail}" width="${W}" height="${S + P * 2}" rx="${U * 3}" fill="${bgFill}"/>`;
  } else if (f === "ticket") {
    const th = U * 7; W = S + P * 2; H = S + P * 2 + th;
    inner = `<g transform="translate(${P} ${P})">${code}</g>`;
    extra = `<rect x="${U * 0.6}" y="${U * 0.6}" width="${W - U * 1.2}" height="${H - U * 1.2}" rx="${U * 2}" fill="${bgFill}" stroke="${fc}" stroke-width="${U * 0.8}" stroke-dasharray="${U * 2} ${U * 1.2}"/>`
      + `<line x1="${U * 2}" x2="${W - U * 2}" y1="${S + P * 2 - U * 0.5}" y2="${S + P * 2 - U * 0.5}" stroke="${fc}" stroke-width="${U * 0.4}" stroke-dasharray="${U} ${U}"/>`
      + `<text x="${W / 2}" y="${S + P * 2 + th / 2 + fs * 0.25}" text-anchor="middle" font-size="${fs}" ${font} fill="${fc}">${txt}</text>`;
  } else if (f === "brackets") {
    const th = U * 7, L = U * 6; W = S + P * 2; H = S + P * 2 + th;
    inner = `<g transform="translate(${P} ${P})">${code}</g>`;
    const sw = U * 1.1, e = sw / 2, B = S + P * 2;
    extra = `<rect width="${W}" height="${H}" rx="${U * 2}" fill="${bgFill}"/><g fill="none" stroke="${fc}" stroke-width="${sw}" stroke-linecap="round">`
      + `<path d="M${e} ${L}V${e}H${L}"/><path d="M${W - L} ${e}H${W - e}V${L}"/><path d="M${e} ${B - L}V${B - e}H${L}"/><path d="M${W - L} ${B - e}H${W - e}V${B - L}"/></g>`
      + `<text x="${W / 2}" y="${B + th / 2 + fs * 0.2}" text-anchor="middle" font-size="${fs}" ${font} fill="${fc}">${txt}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${extra}${inner}</svg>`;
}
