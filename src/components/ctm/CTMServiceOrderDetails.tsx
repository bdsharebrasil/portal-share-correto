import React from 'react';
import {
  CTMServiceOrder,
  CTMService,
  CTMPart,
  CTMFlightReport,
  CTMCostSharing,
} from '@/hooks/useCTMServiceOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, RefreshCw, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CTMServiceOrderDetailsProps {
  order: CTMServiceOrder;
  services: CTMService[];
  parts: CTMPart[];
  flightReports: CTMFlightReport[];
  costSharing: CTMCostSharing[];
  onBack: () => void;
  onRefresh: () => void;
}

const statusColors: Record<string, string> = {
  em_andamento: 'default',
  concluída: 'secondary',
  pausada: 'outline',
  cancelada: 'destructive',
};

const statusLabels: Record<string, string> = {
  em_andamento: 'Em Andamento',
  concluída: 'Concluída',
  pausada: 'Pausada',
  cancelada: 'Cancelada',
};

const tipoManutencaoLabels: Record<string, string> = {
  CORRETIVA: 'Corretiva',
  PREVENTIVA: 'Preventiva',
  REVISÃO: 'Revisão',
};

const tipoManutencaoColors: Record<string, string> = {
  CORRETIVA: 'bg-red-100 text-red-800',
  PREVENTIVA: 'bg-blue-100 text-blue-800',
  REVISÃO: 'bg-green-100 text-green-800',
};

export function CTMServiceOrderDetails({
  order,
  services,
  parts,
  flightReports,
  costSharing,
  onBack,
  onRefresh,
}: CTMServiceOrderDetailsProps) {
  const totalServiceCost = services.reduce((sum, s) => sum + (s.valor || 0), 0);
  const totalPartsCost = parts.reduce((sum, p) => sum + (p.valor_total || 0), 0);
  const totalCost = order.total_geral || (totalServiceCost + totalPartsCost);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Ordem {order.numero}</h2>
            <p className="text-muted-foreground">{order.objetivo || 'Manutenção'}</p>
          </div>
        </div>
        <Button onClick={onRefresh} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* Status and Type */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <CardTitle>Status</CardTitle>
              <Badge variant={statusColors[order.status || ''] as any}>
                {statusLabels[order.status || ''] || order.status}
              </Badge>
            </div>
            <div className="space-y-2 text-right">
              <CardTitle>Tipo</CardTitle>
              <span className={`px-3 py-1 rounded-lg text-sm font-medium ${tipoManutencaoColors[order.tipo_manutencao] || 'bg-gray-100 text-gray-800'}`}>
                {tipoManutencaoLabels[order.tipo_manutencao] || order.tipo_manutencao}
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Gerais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {order.description && (
              <div className="md:col-span-2">
                <h4 className="font-semibold mb-2">Descrição</h4>
                <p className="text-muted-foreground">{order.description}</p>
              </div>
            )}

            {order.assigned_to && (
              <div>
                <p className="text-sm text-muted-foreground">Atribuído a</p>
                <p className="font-medium">{order.assigned_to}</p>
              </div>
            )}

            {order.scheduled_date && (
              <div>
                <p className="text-sm text-muted-foreground">Data Agendada</p>
                <p className="font-medium">
                  {format(new Date(order.scheduled_date), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
            )}

            {order.completion_date && (
              <div>
                <p className="text-sm text-muted-foreground">Data de Conclusão</p>
                <p className="font-medium">
                  {format(new Date(order.completion_date), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
            )}

            {order.estimated_hours && (
              <div>
                <p className="text-sm text-muted-foreground">Horas Estimadas</p>
                <p className="font-medium">{order.estimated_hours}h</p>
              </div>
            )}

            {order.actual_hours && (
              <div>
                <p className="text-sm text-muted-foreground">Horas Reais</p>
                <p className="font-medium">{order.actual_hours}h</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Services */}
      {services.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Serviços</CardTitle>
            <CardDescription>
              {services.length} serviço{services.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead className="text-right">Custo (R$)</TableHead>
                    <TableHead className="text-center">Concluído</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell>{service.description}</TableCell>
                      <TableCell className="text-right">{service.hours}h</TableCell>
                      <TableCell className="text-right">R$ {service.cost.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        {service.completed ? '✓' : '○'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 pt-4 border-t text-right">
              <p className="text-sm text-muted-foreground mb-1">Total de Serviços</p>
              <p className="text-xl font-bold">R$ {totalServiceCost.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parts */}
      {parts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Peças Utilizadas</CardTitle>
            <CardDescription>
              {parts.length} peça{parts.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Unit (R$)</TableHead>
                    <TableHead className="text-right">Total (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parts.map((part) => (
                    <TableRow key={part.id}>
                      <TableCell className="font-mono text-sm">{part.part_number}</TableCell>
                      <TableCell>{part.description}</TableCell>
                      <TableCell className="text-center">{part.quantity}</TableCell>
                      <TableCell className="text-right">R$ {part.unit_cost.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {part.total_cost.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 pt-4 border-t text-right">
              <p className="text-sm text-muted-foreground mb-1">Total de Peças</p>
              <p className="text-xl font-bold">R$ {totalPartsCost.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Flight Reports */}
      {flightReports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Relatórios de Voo</CardTitle>
            <CardDescription>
              {flightReports.length} relatório{flightReports.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {flightReports.map((report) => (
                <div key={report.id} className="p-4 border rounded-lg">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Data</p>
                      <p className="font-medium">
                        {format(new Date(report.date), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Piloto</p>
                      <p className="font-medium">{report.pilot_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Horas de Voo</p>
                      <p className="font-medium">{report.flight_hours}h</p>
                    </div>
                  </div>
                  {report.observations && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm text-muted-foreground">Observações</p>
                      <p className="text-sm">{report.observations}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost Sharing */}
      {costSharing.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rateio de Custos</CardTitle>
            <CardDescription>
              Distribuição de custos entre clientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Percentual</TableHead>
                    <TableHead className="text-right">Valor (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costSharing.map((share) => (
                    <TableRow key={share.id}>
                      <TableCell>{share.client_id}</TableCell>
                      <TableCell className="text-right">{share.percentage}%</TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {share.amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost Summary */}
      <Card className="bg-muted">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Custo de Serviços</p>
              <p className="text-2xl font-bold">R$ {totalServiceCost.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Custo de Peças</p>
              <p className="text-2xl font-bold">R$ {totalPartsCost.toFixed(2)}</p>
            </div>
            <div className="border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4">
              <p className="text-sm text-muted-foreground mb-1">Custo Total</p>
              <p className="text-3xl font-bold text-primary">R$ {totalCost.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
