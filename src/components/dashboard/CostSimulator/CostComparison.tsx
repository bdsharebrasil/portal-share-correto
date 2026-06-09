import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Download, X } from 'lucide-react';
import { usePdfExport } from './usePdfExport';

interface CostData {
  shortTerm: number;
  mediumTerm: number;
  longTerm: number;
  total: number;
  hourlyRate: number;
}

interface FormData {
  aircraftName: string;
  originName: string;
  destinationName: string;
  flightTimeRoundTrip: number;
  monthlyFlights: number;
  [key: string]: any;
}

interface SavedSimulation {
  id: string;
  name: string;
  formData: FormData;
  costs: CostData;
  createdAt: string;
}

interface CostComparisonProps {
  simulations: SavedSimulation[];
  onClose: () => void;
}

export function CostComparison({ simulations, onClose }: CostComparisonProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(simulations.slice(0, 2).map(s => s.id));
  const { generatePdf } = usePdfExport();

  const selectedSimulations = simulations.filter(s => selectedIds.includes(s.id));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Prepare chart data
  const chartData = selectedSimulations.map((sim) => ({
    name: sim.name.substring(0, 15),
    'Curto Prazo': sim.costs.shortTerm,
    'Médio Prazo': sim.costs.mediumTerm,
    'Longo Prazo': sim.costs.longTerm,
  }));

  const hourlyRateData = selectedSimulations.map((sim) => ({
    name: sim.name.substring(0, 15),
    'Taxa Horária': sim.costs.hourlyRate,
  }));

  const handleExportPdf = () => {
    generatePdf(
      selectedSimulations.map(s => ({
        name: s.name,
        formData: s.formData,
        costs: s.costs,
      })),
      'Comparativo de Custos de Aeronaves'
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white/[0.02] backdrop-blur-md border-white/[0.05]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>Comparativo de Simulações</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Selection */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Selecione simulações para comparar:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {simulations.map((sim) => (
                <div key={sim.id} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-white/[0.05]">
                  <Checkbox
                    checked={selectedIds.includes(sim.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIds([...selectedIds, sim.id]);
                      } else {
                        setSelectedIds(selectedIds.filter(id => id !== sim.id));
                      }
                    }}
                  />
                  <label className="text-sm cursor-pointer flex-1 truncate">
                    {sim.name}
                  </label>
                  <span className="text-xs text-muted-foreground">{formatCurrency(sim.costs.total)}</span>
                </div>
              ))}
            </div>
          </div>

          {selectedSimulations.length > 0 && (
            <>
              {/* Summary Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.05]">
                      <th className="text-left p-2">Simulação</th>
                      <th className="text-right p-2">Curto Prazo</th>
                      <th className="text-right p-2">Médio Prazo</th>
                      <th className="text-right p-2">Longo Prazo</th>
                      <th className="text-right p-2">Total</th>
                      <th className="text-right p-2">Taxa/h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSimulations.map((sim) => (
                      <tr key={sim.id} className="border-b border-white/[0.05] hover:bg-white/[0.02]">
                        <td className="p-2 font-medium truncate">{sim.name}</td>
                        <td className="text-right p-2 text-emerald-400">{formatCurrency(sim.costs.shortTerm)}</td>
                        <td className="text-right p-2 text-amber-400">{formatCurrency(sim.costs.mediumTerm)}</td>
                        <td className="text-right p-2 text-purple-400">{formatCurrency(sim.costs.longTerm)}</td>
                        <td className="text-right p-2 font-semibold text-primary">{formatCurrency(sim.costs.total)}</td>
                        <td className="text-right p-2">{formatCurrency(sim.costs.hourlyRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-white/[0.02] border-white/[0.05]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Custos por Período</CardTitle>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
                        <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
                        <Tooltip formatter={(value) => formatCurrency(value as number)} />
                        <Legend />
                        <Bar dataKey="Curto Prazo" fill="#10B981" />
                        <Bar dataKey="Médio Prazo" fill="#F59E0B" />
                        <Bar dataKey="Longo Prazo" fill="#8B5CF6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-white/[0.02] border-white/[0.05]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Taxa Horária</CardTitle>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={hourlyRateData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
                        <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
                        <Tooltip formatter={(value) => formatCurrency(value as number)} />
                        <Legend />
                        <Line type="monotone" dataKey="Taxa Horária" stroke="#FF8C00" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Difference Analysis */}
              {selectedSimulations.length === 2 && (
                <Card className="bg-white/[0.02] border-white/[0.05]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Análise de Diferença</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]">
                        <span>Diferença de Custo Total:</span>
                        <span className={selectedSimulations[0].costs.total > selectedSimulations[1].costs.total ? 'text-red-400' : 'text-green-400'}>
                          {formatCurrency(Math.abs(selectedSimulations[0].costs.total - selectedSimulations[1].costs.total))}
                        </span>
                      </div>
                      <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]">
                        <span>Diferença de Taxa Horária:</span>
                        <span className={selectedSimulations[0].costs.hourlyRate > selectedSimulations[1].costs.hourlyRate ? 'text-red-400' : 'text-green-400'}>
                          {formatCurrency(Math.abs(selectedSimulations[0].costs.hourlyRate - selectedSimulations[1].costs.hourlyRate))}
                        </span>
                      </div>
                      <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]">
                        <span>Mais Econômico:</span>
                        <span className="text-primary font-semibold">
                          {selectedSimulations[0].costs.total < selectedSimulations[1].costs.total
                            ? selectedSimulations[0].name
                            : selectedSimulations[1].name}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Export Button */}
              <Button
                onClick={handleExportPdf}
                className="w-full bg-primary/90 hover:bg-primary"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Comparativo em PDF
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
