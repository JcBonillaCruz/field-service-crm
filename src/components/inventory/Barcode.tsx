"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

// Formato del código: si el SKU es un UPC (12 dígitos) o EAN (13) se imprime igual que el de fábrica; si no, Code 128
export function barcodeFormat(code: string) {
  if (/^\d{12}$/.test(code)) return "UPC";
  if (/^\d{13}$/.test(code)) return "EAN13";
  if (/^\d{8}$/.test(code)) return "EAN8";
  return "CODE128";
}

// Imagen del código de barras (SVG que llena su caja; se ve nítido en pantalla y en papel)
export function BarcodeSvg({ value, className = "", showText = false, fill = true }: { value: string; className?: string; showText?: boolean; fill?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    if (!ref.current || !value) return;
    const draw = (format: string) => JsBarcode(ref.current, value, { format, displayValue: showText, margin: 0, height: 60, width: 2, fontSize: 14, textMargin: 2, background: "transparent" });
    try { draw(barcodeFormat(value)); setBad(false); }
    catch { try { draw("CODE128"); setBad(false); } catch { setBad(true); } }
    if (fill) { ref.current.setAttribute("width", "100%"); ref.current.setAttribute("height", "100%"); ref.current.setAttribute("preserveAspectRatio", "none"); }
  }, [value, showText, fill]);
  if (!value || bad) return <span className={`flex items-center justify-center text-[10px] text-slate-400 ${className}`}>No barcode</span>;
  return <svg ref={ref} className={className} aria-label={`Barcode ${value}`} />;
}

export function QrSvg({ value, className = "" }: { value: string; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(value || " ", { type: "svg", margin: 0, errorCorrectionLevel: "M" }).then((s) => { if (alive) setSvg(s); }, () => {});
    return () => { alive = false; };
  }, [value]);
  return <span className={`block [&>svg]:h-full [&>svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

// Descargar el código como imagen PNG (para mandarlo, pegarlo o imprimir en otro programa)
export async function downloadBarcodePng(value: string, name: string) {
  const canvas = document.createElement("canvas");
  try { JsBarcode(canvas, value, { format: barcodeFormat(value), displayValue: true, margin: 16, height: 110, width: 3, fontSize: 22 }); }
  catch { JsBarcode(canvas, value, { format: "CODE128", displayValue: true, margin: 16, height: 110, width: 3, fontSize: 22 }); }
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `${name.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 60) || "barcode"}-${value}.png`;
  a.click();
}
