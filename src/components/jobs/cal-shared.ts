import type { CalVisit } from "@/lib/jobs";

// Piezas compartidas por las vistas del calendario (Day/Week/Mon–Fri/Dispatch usan TimeGrid; Month usa MonthGrid)
export type Col = { key: string; day: Date; techId: string | null; label: string; sub?: string; color?: string; initials?: string; avatar?: string | null; today?: boolean };

// Dónde cae el puntero: columna + minuto del día (TimeGrid) o solo el día (MonthGrid)
export type Hit = { colKey: string; day: Date; techId: string | null; minute: number | null };
export type GridApi = { hit: (x: number, y: number) => Hit | null; scroller: () => HTMLElement | null };

// Vista previa mientras arrastras (fantasma punteado)
export type Preview = { colKey: string; day: Date; startMin: number; endMin: number; color: string; label: string } | null;

export type DragMode = "move" | "resize";
export type Handlers = {
  onVisitDown: (e: React.PointerEvent, v: CalVisit, col: Col, mode: DragMode) => void;
  onEmptyDown: (e: React.PointerEvent, col: Col, minute: number | null) => void;
  onVisitHover: (v: CalVisit | null, el: HTMLElement | null) => void;
  draggingId: string | null;
};
