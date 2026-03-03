
export type CTMTab = "os" | "componentes" | "peso" | "ras" | "orcamentos";
// Component interface
export interface Component {
  id: string;
  aircraft_id: string;
  name: string;
  part_number: string;
  serial_number: string;
  category?: ComponentCategory | null;
  manufacturer?: string | null;
  location?: string | null;
  
  // -- Controle por Horas (TSN / TSO / TBO) --
  total_life_hours?: number | null;     // Limite de horas (TBO)
  current_life_hours?: number | null;   // Horas desde novo (TSN)
  tso?: number | 'NOVO' | null;         // Horas desde a última revisão (TSO)
  installed_hours?: number | null;      // Horas da célula quando o item foi instalado
  remaining_hours?: number | null;      // Horas restantes para vencer
  remaining_percentage?: number | null; // Porcentagem de vida útil restante
  
  // -- Controle por Ciclos (CSN / CSO) --
  total_life_cycles?: number | null;    // Limite máximo de ciclos suportado
  current_life_cycles?: number | null;  // Total de ciclos atuais (geralmente igual ao CSN)
  csn?: number | 'NOVO' | null;         // Ciclos desde novo (CSN)
  cso?: number | 'NOVO' | null;         // Ciclos desde a última revisão (CSO)
  installed_cycles?: number | null;     // Ciclos da célula no momento da instalação
  
  // -- Controle por Data (Calendário) --
  installed_date?: string;              // Data em que foi instalado na aeronave
  due_date?: string | null;             // Data de vencimento (Para itens controlados por tempo, ex: Extintor, CVA)
  
  status?: string | null;
  observations?: string | null;
  created_at?: string;
  updated_at?: string;
}
