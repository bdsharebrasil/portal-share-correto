import { useEffect, useState } from 'react';
import { BarChart3, Clock, TrendingUp, Calendar } from 'lucide-react';
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

  // Filtrar por ano
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

  // Máximo de horas (para barra)
  const maxHoras = Math.max(...mesesFiltrados.map(([, v]) => v.horas), 1);

  const nomeMes = (mesStr: string) => {
    const [, m] = mesStr.split('-');
    return new Date(2000, Number(m) - 1).toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="section-accent">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 teal-text" /> Médias da Aeronave — {registration}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <select
            className="ctm-input"
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

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="ctm-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total de Horas ({anoSelecionado})</p>
          <p className="text-2xl font-bold teal-text">{totalAno.horas.toFixed(1)}h</p>
        </div>
        <div className="ctm-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Média Mensal</p>
          <p className="text-2xl font-bold text-blue-400">{mediaHorasMes.toFixed(1)}h</p>
        </div>
        <div className="ctm-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Voos</p>
          <p className="text-2xl font-bold text-purple-400">{totalAno.voos}</p>
        </div>
        <div className="ctm-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Média Voos/Mês</p>
          <p className="text-2xl font-bold text-orange-400">{mediaVoosMes.toFixed(1)}</p>
        </div>
      </div>

      {mesesFiltrados.length === 0 ? (
        <div className="ctm-card flex flex-col items-center justify-center py-16 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
          <p className="text-muted-foreground">Nenhum dado para {anoSelecionado}</p>
          <p className="text-xs text-muted-foreground mt-1">Os dados são calculados automaticamente do Diário Técnico</p>
        </div>
      ) : (
        <>
          {/* Gráfico de barras manual */}
          <div className="ctm-card p-5 mb-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 teal-text" /> Horas por Mês — {anoSelecionado}
            </h3>
            <div className="flex items-end gap-3 h-40">
              {mesesFiltrados.map(([key, val]) => {
                const pct = (val.horas / maxHoras) * 100;
                return (
                  <div key={key} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs teal-text font-bold">{val.horas.toFixed(1)}h</span>
                    <div className="w-full flex items-end" style={{ height: '90px' }}>
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-[hsl(var(--ctm-teal)/0.8)] to-[hsl(var(--ctm-teal)/0.4)] transition-all"
                        style={{ height: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{nomeMes(key)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabela detalhada */}
          <div className="ctm-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold">Detalhamento Mensal</h3>
            </div>
            <div className="overflow-x-auto ctm-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Mês</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Voos</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Horas</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Pousos</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Média h/voo</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Combustível (L)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Utilização</th>
                  </tr>
                </thead>
                <tbody>
                  {mesesFiltrados.map(([key, val]) => {
                    const mediaHvoo = val.voos > 0 ? val.horas / val.voos : 0;
                    const pct = (val.horas / maxHoras) * 100;
                    return (
                      <tr key={key} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          {new Date(key + '-01T12:00:00').toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-right">{val.voos}</td>
                        <td className="px-4 py-3 text-right font-bold teal-text">{val.horas.toFixed(2)}h</td>
                        <td className="px-4 py-3 text-right">{val.pousos}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{mediaHvoo.toFixed(2)}h</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{val.combustivel.toFixed(1)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-ctm-teal rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-[hsl(var(--ctm-teal)/0.08)] border-t border-[hsl(var(--ctm-teal)/0.2)]">
                    <td className="px-4 py-3 font-bold teal-text">TOTAL {anoSelecionado}</td>
                    <td className="px-4 py-3 text-right font-bold">{totalAno.voos}</td>
                    <td className="px-4 py-3 text-right font-bold teal-text">{totalAno.horas.toFixed(2)}h</td>
                    <td className="px-4 py-3 text-right font-bold">{totalAno.pousos}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{(totalAno.voos > 0 ? totalAno.horas / totalAno.voos : 0).toFixed(2)}h</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{totalAno.combustivel.toFixed(1)}</td>
                    <td className="px-4 py-3" />
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

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 border-2 border-ctm-teal border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
