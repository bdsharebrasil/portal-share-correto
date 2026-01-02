import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Filter, Search, FileText, Download } from 'lucide-react';
import { formatDateToBR } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';

interface SalaryPayment {
  id: string;
  created_at: string;
  base_salary_holerite: number | null;
  benefit: string | null;
  horas_voo: string | null;
  extra: string | null;
  obs: string | null;
  comprovante_url: string | null;
  holerite_url: string | null;
}

interface EmployeeBankStatementProps {
  employeeId: string;
  employeeName: string;
}

const EmployeeBankStatement: React.FC<EmployeeBankStatementProps> = ({ employeeId, employeeName }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  const { data: payments = [], isLoading, isError } = useQuery({
    queryKey: ['employee-salary-payments', employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pagamento_salario_funcionario')
        .select('id, created_at, base_salary_holerite, benefit, horas_voo, extra, obs, comprovante_url, holerite_url')
        .eq('user_profile', employeeId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar pagamentos:', error);
        throw error;
      }

      return (data || []) as SalaryPayment[];
    },
    enabled: !!employeeId,
  });

  // Filter payments
  const filteredPayments = payments.filter((payment) => {
    const paymentDate = new Date(payment.created_at);
    const monthYear = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
    
    const descriptions = [
      payment.benefit,
      payment.horas_voo,
      payment.extra,
      payment.obs
    ].filter(Boolean).join(' ').toLowerCase();
    
    const matchesSearch = !searchTerm || descriptions.includes(searchTerm.toLowerCase());
    const matchesMonth = !filterMonth || monthYear === filterMonth;

    return matchesSearch && matchesMonth;
  });

  // Calculate totals
  const totalAmount = filteredPayments.reduce((sum, payment) => sum + (payment.base_salary_holerite || 0), 0);
  const totalCount = filteredPayments.length;
  const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-foreground">Extrato de Pagamentos</h2>
        <p className="text-sm text-muted-foreground">
          Histórico de pagamentos de {employeeName}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground font-medium">Total Recebido</p>
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                R$ {formatCurrency(totalAmount)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Quantidade de Pagamentos</p>
              <p className="text-2xl font-bold text-foreground">{totalCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Valor Médio</p>
              <p className="text-2xl font-bold text-foreground">
                R$ {formatCurrency(averageAmount)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-foreground">Filtros</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Pesquisar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Benefício, observação..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Mês</label>
              <Input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Payments Table */}
      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando extrato...</div>
          ) : isError ? (
            <div className="p-8 text-center text-destructive">Erro ao carregar extrato de pagamentos</div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum pagamento encontrado para os filtros selecionados
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-muted-foreground">Data</th>
                    <th className="px-6 py-3 text-left font-semibold text-muted-foreground">Descrição</th>
                    <th className="px-6 py-3 text-right font-semibold text-muted-foreground">Valor</th>
                    <th className="px-6 py-3 text-center font-semibold text-muted-foreground">Documentos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredPayments.map((payment) => {
                    const descriptions: string[] = [];
                    if (payment.base_salary_holerite) descriptions.push(`Salário`);
                    if (payment.benefit) descriptions.push(`Benefício: ${payment.benefit}`);
                    if (payment.horas_voo) descriptions.push(`Horas de Voo: ${payment.horas_voo}`);
                    if (payment.extra) descriptions.push(`Extra: ${payment.extra}`);
                    
                    return (
                      <tr key={payment.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {new Date(payment.created_at).toLocaleDateString('pt-BR', {
                            month: 'long',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            {descriptions.map((desc, i) => (
                              <p key={i} className="text-foreground">{desc}</p>
                            ))}
                            {payment.obs && (
                              <p className="text-xs text-muted-foreground italic">Obs: {payment.obs}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-green-600">
                          +R$ {formatCurrency(payment.base_salary_holerite || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            {payment.comprovante_url && (
                              <a href={payment.comprovante_url} target="_blank" rel="noreferrer">
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                                  <Download className="h-3 w-3" />
                                  Comprovante
                                </Button>
                              </a>
                            )}
                            {payment.holerite_url && (
                              <a href={payment.holerite_url} target="_blank" rel="noreferrer">
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                                  <FileText className="h-3 w-3" />
                                  Holerite
                                </Button>
                              </a>
                            )}
                            {!payment.comprovante_url && !payment.holerite_url && (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeBankStatement;