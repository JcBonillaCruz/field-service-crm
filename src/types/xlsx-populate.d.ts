declare module "xlsx-populate" {
  interface Cell { value(v?: unknown): Cell; style(s: Record<string, unknown>): Cell; }
  interface RowObj { style(s: Record<string, unknown>): RowObj; }
  interface Sheet {
    name(n: string): Sheet;
    cell(row: number, col: number): Cell;
    row(n: number): RowObj;
    freezePanes(x: number, y: number): void;
  }
  interface Workbook {
    sheet(i: number): Sheet;
    outputAsync(opts?: { password?: string }): Promise<Buffer>;
  }
  const XlsxPopulate: { fromBlankAsync(): Promise<Workbook> };
  export default XlsxPopulate;
}
