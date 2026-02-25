// types.ts
export interface LogbookMonthData {
  celula_anterior: number | null;
  celula_atual: number | null;
  celula_prox_revisao: number | null;
  celula_disponivel: number | null;
  year?: number;
  month?: number;
}

export type ViewType = 'list' | 'diario' | 'banco';