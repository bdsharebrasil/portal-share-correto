import { useEffect, useState } from 'react';
import { 
  BarChart3, Calendar, TrendingUp, Clock, 
  PlaneTakeoff, Activity, Droplets
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { cn } from '@/lib/utils';

interface MediasAeronavesTabProps { aircraftId: string; registration: string; }

export function MediasAeronavesTab({ aircraftId, registration }: MediasAeronavesTabProps) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());

  useEffect(() => {
    supabase
      .from('lancamentos_diario_bordo')
      .select('data_registro, tempo_total, tempo_voo, celula, pousos_total, consumo_combustivel_voo, clientes_id, natureza_voo')
      .eq('aeronave_id', aircraftId)
      .order('data_registro', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('Erro ao carregar médias da aeronave:', error);
        setEntries(data ?? []);
        setLoading(false);
      });
  }, [aircraftId]);

  // Agrupar por mês/ano
  const porMes: Record<string, { horas: number; pousos: number; voos: number; combustivel: number }> = {};
  entries.forEach(e => {
    if (!e.data_registro) return;
    const [ano, mes] = e.data_registro.split('-');
    const key = `${ano}-${mes}`;
    
    if (!porMes[key]) porMes[key] = { horas: 0, pousos: 0, voos: 0, combustivel: 0 };
    porMes[key].horas += Number(e.tempo_total || e.tempo_voo || 0);
    porMes[key].pousos += Number(e.pousos_total || 0);
    porMes[key].voos += 1;
    porMes[key].combustivel += Number(e.consumo_combustivel_voo || 0);
  });

  // Filtrar por ano e garantir ordem cronológica
  const mesesFiltrados = Object.entries(porMes)
    .filter(([k]) => k.startsWith(String(anoSelecionado)))
    .sort(([a], [b]) => a.localeCompare(b));

  const anos = [...new Set(Object.keys(porMes).map(k => Number(k.split('-')[0])))].sort((a, b) => b - a);

  // Totais do ano
  const totalAno = mesesFiltrados.reduce((acc, [, v]) => ({
    horas: acc.horas + v.horas,
    pousos: acc.pousos + v.pousos,
    voos: acc.voos + v.voos,
    combustivel: acc.combustivel + v.combustivel,
  }), { horas: 0, pousos: 0, voos: 0, combustivel: 0 });

  const mediaHorasMes = mesesFiltrados.length > 0 ? totalAno.horas / mesesFiltrados.length : 0;
  const mediaVoosMes = mesesFiltrados.length > 0 ? totalAno.voos / mesesFiltrados.length : 0;

  // Máximo de horas (para calcular altura da barra)
  const maxHoras = Math.max(...mesesFiltrados.map(([, v]) => v.horas), 1);

  const nomeMes = (mesStr: string) => {
    const [, m] = mesStr.split('-');
    return new Date(2000, Number(m) - 1).toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header & Filtro */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="section-accent flex items-center gap-2">
          <div className="p-2 bg-ctm-teal/10 rounded-lg border border-ctm-teal/20">
            <BarChart3 className="h-5 w-5 text-ctm-teal" />
          </div>
          <h2 className="text-xl font-semibold">
            Médias e Estatísticas <span className="text-muted-foreground font-normal">| {registration}</span>
          </h2>
        </div>
        
        <div className="flex items-center gap-3 bg-secondary/50 p-1.5 rounded-lg border border-border">
          <div className="pl-3 pr-1 text-muted-foreground flex items-center">
            <Calendar className="h-4 w-4" />
          </div>
          <select
            className="bg-background border-border rounded-md px-3 py-1.5 text-sm font-medium focus:ring-1 focus:ring-ctm-teal outline-none"
            value={anoSelecionado}
            onChange={e => setAnoSelecionado(Number(e.target.value))}
          >
            {anos.length === 0
              ? <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
              : anos.map(a => <option key={a} value={a}>{a}</option>)
            }
          </select>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard 
          title={`Total de Horas (${anoSelecionado})`} 
          value={`${totalAno.horas.toFixed(1)}h`} 
          icon={Clock} 
          colorClass="text-ctm-teal" 
          bgClass="bg-ctm-teal/10" 
        />
        <SummaryCard 
          title="Média Mensal" 
          value={`${mediaHorasMes.toFixed(1)}h`} 
          icon={Activity} 
          colorClass="text-blue-500" 
          bgClass="bg-blue-500/10" 
        />
        <SummaryCard 
          title="Total de Voos" 
          value={String(totalAno.voos)} 
          icon={PlaneTakeoff} 
          colorClass="text-purple-500" 
          bgClass="bg-purple-500/10" 
        />
        <SummaryCard 
          title="Média Voos/Mês" 
          value={mediaVoosMes.toFixed(1)} 
          icon={TrendingUp} 
          colorClass="text-orange-500" 
          bgClass="bg-orange-500/10" 
        />
      </div>

      {mesesFiltrados.length === 0 ? (
        <div className="ctm-card flex flex-col items-center justify-center py-20 text-center border-dashed border-2 border-border bg-card/30">
          <div className="h-16 w-16 bg-secondary/50 rounded-full flex items-center justify-center mb-4">
            <BarChart3 className="h-8 w-8 text-muted-foreground opacity-50" />
          </div>
          <p className="text-foreground font-semibold text-lg">Nenhum dado registrado para {anoSelecionado}</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">Os dados estatísticos são calculados e agrupados automaticamente a partir dos lançamentos no Diário Técnico de Bordo.</p>
        </div>
      ) : (
        <>
          {/* Gráfico de Barras Modernizado (Correção do espaçamento) */}
          <div className="ctm-card p-6 border border-ctm-teal/20 shadow-sm bg-gradient-to-br from-card to-card/50">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-ctm-teal" /> 
              Evolução de Horas — {anoSelecionado}
            </h3>
            
            <div className="flex items-end justify-around gap-2 h-48 mt-4 pt-6 border-b border-border/50 pb-2">
              {mesesFiltrados.map(([key, val]) => {
                const pct = (val.horas / maxHoras) * 100;
                // Altura mínima visual de 4% para barras não ficarem invisíveis
                const barHeight = Math.max(pct, 4); 
                
                return (
                  <div key={key} className="flex-1 flex flex-col items-center justify-end h-full group">
                    {/* Número fixado exatamente no topo da barra */}
                    <div 
                      className="flex flex-col items-center justify-end w-full transition-all duration-300"
                      style={{ height: `${barHeight}%` }}
                    >
                      <span className="text-xs font-bold text-foreground mb-1.5 opacity-80 group-hover:opacity-100 group-hover:-translate-y-1 transition-all">
                        {val.horas.toFixed(1)}h
                      </span>
                      
                      <div className="w-full max-w-[2.5rem] h-full rounded-t-md bg-gradient-to-t from-ctm-teal/30 to-ctm-teal/80 border-t-2 border-ctm-teal group-hover:from-ctm-teal/50 group-hover:to-ctm-teal transition-colors shadow-[0_0_10px_rgba(var(--ctm-teal-rgb),0.1)] group-hover:shadow-[0_0_15px_rgba(var(--ctm-teal-rgb),0.3)]" />
                    </div>
                    
                    <span className="text-xs font-medium text-muted-foreground mt-3 group-hover:text-foreground transition-colors">
                      {nomeMes(key)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabela Detalhada */}
          <div className="ctm-card overflow-hidden border border-border/50">
            <div className="px-6 py-5 border-b border-border bg-secondary/30">
              <h3 className="font-bold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Detalhamento Mensal
              </h3>
            </div>
            
            <div className="overflow-x-auto ctm-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/80 bg-secondary/50">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mês</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Voos</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Horas</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pousos</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Média h/voo</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Combustível (L)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {mesesFiltrados.map(([key, val]) => {
                    const mediaHvoo = val.voos > 0 ? val.horas / val.voos : 0;
                    
                    return (
                      <tr key={key} className="hover:bg-secondary/30 transition-colors group">
                        <td className="px-6 py-3.5 font-medium text-foreground capitalize">
                          {new Date(key + '-01T12:00:00').toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-3.5 text-right font-medium text-muted-foreground group-hover:text-foreground transition-colors">{val.voos}</td>
                        <td className="px-6 py-3.5 text-right font-bold text-ctm-teal text-base">{val.horas.toFixed(2)}h</td>
                        <td className="px-6 py-3.5 text-right font-medium text-muted-foreground group-hover:text-foreground transition-colors">{val.pousos}</td>
                        <td className="px-6 py-3.5 text-right font-medium text-muted-foreground group-hover:text-foreground transition-colors">{mediaHvoo.toFixed(2)}h</td>
                        <td className="px-6 py-3.5 text-right font-medium text-muted-foreground group-hover:text-foreground transition-colors flex items-center justify-end gap-1.5">
                          {val.combustivel > 0 && <Droplets className="h-3 w-3 opacity-50" />}
                          {val.combustivel.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                  
                  {/* Linha de Totais */}
                  <tr className="bg-ctm-teal/5 border-t-2 border-ctm-teal/20">
                    <td className="px-6 py-4 font-black text-ctm-teal">TOTAL {anoSelecionado}</td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">{totalAno.voos}</td>
                    <td className="px-6 py-4 text-right font-black text-ctm-teal text-base">{totalAno.horas.toFixed(2)}h</td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">{totalAno.pousos}</td>
                    <td className="px-6 py-4 text-right font-semibold text-muted-foreground">{(totalAno.voos > 0 ? totalAno.horas / totalAno.voos : 0).toFixed(2)}h</td>
                    <td className="px-6 py-4 text-right font-semibold text-muted-foreground">{totalAno.combustivel.toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Helpers & Subcomponentes ──────────────────────────────────────────────────

function SummaryCard({ title, value, icon: Icon, colorClass, bgClass }: { title: string, value: string, icon: any, colorClass: string, bgClass: string }) {
  return (
    <div className="ctm-card p-5 relative overflow-hidden group hover:border-border/80 transition-colors">
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity -mr-4 -mt-4 rounded-bl-[100px] ${bgClass}`}>
        <Icon className={`h-16 w-16 ${colorClass}`} />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`h-4 w-4 ${colorClass}`} />
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
        </div>
        <p className={`text-2xl sm:text-3xl font-black ${colorClass}`}>{value}</p>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-3">
      <div className="h-10 w-10 border-4 border-ctm-teal/30 border-t-ctm-teal rounded-full animate-spin" />
      <p className="text-sm font-medium text-muted-foreground animate-pulse">Calculando médias da aeronave...</p>
    </div>
  );
}