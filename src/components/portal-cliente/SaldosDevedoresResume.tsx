import React from 'react';
import { useSaldosDevedoresCliente } from '@/hooks/useSaldosDevedoresCliente';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, TrendingDown, Fuel, CreditCard } from 'lucide-react';

interface SaldosDevedoresResumeProps {
  clienteId: string;
  aircraftId?: string;
}

export function SaldosDevedoresResume({ clienteId, aircraftId }: SaldosDevedoresResumeProps) {
  const { data: saldos, isLoading, error } = useSaldosDevedoresCliente(clienteId, aircraftId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="border border-white/10 bg-slate-800/30 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="animate-pulse space-y-3">
                <div className="h-6 bg-white/10 rounded w-3/4"></div>
                <div className="h-8 bg-white/10 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Tente recarregar a página';
    console.error('Erro no componente SaldosDevedoresResume:', error);

    return (
      <Card className="border border-destructive/50 bg-destructive/10 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 text-destructive">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Erro ao carregar saldos devedores</p>
              <p className="text-sm mt-1 text-destructive/80">
                {errorMessage}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!saldos) {
    return null;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Título da Seção */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Saldos Devedores</h2>
        <p className="text-muted-foreground">Resumo de valores pendentes por categoria</p>
      </div>

      {/* Cards de Saldos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Reembolsos Pendentes */}
        <Card className="border border-white/5 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 backdrop-blur-sm hover:border-white/10 transition-colors">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-foreground">
                {saldos.reembolsos.descricao}
              </CardTitle>
              <div className="p-1.5 rounded-full bg-yellow-500/10">
                <TrendingDown className="h-3 w-3 text-yellow-600" />
              </div>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              {saldos.reembolsos.quantidade_registros} registro{saldos.reembolsos.quantidade_registros !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="space-y-1">
              <p className="text-xl font-semibold text-yellow-500">
                {formatCurrency(saldos.reembolsos.saldo)}
              </p>
              {saldos.reembolsos.saldo > 0 && (
                <Badge variant="secondary" className="bg-yellow-500/15 text-yellow-600 border-yellow-500/20 w-fit text-xs">
                  Aguardando
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pagamento Direto */}
        <Card className="border border-white/5 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 backdrop-blur-sm hover:border-white/10 transition-colors">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-foreground">
                {saldos.pagamento_direto.descricao}
              </CardTitle>
              <div className="p-1.5 rounded-full bg-blue-500/10">
                <CreditCard className="h-3 w-3 text-blue-600" />
              </div>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              {saldos.pagamento_direto.quantidade_registros} registro{saldos.pagamento_direto.quantidade_registros !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="space-y-1">
              <p className="text-xl font-semibold text-blue-500">
                {formatCurrency(saldos.pagamento_direto.saldo)}
              </p>
              {saldos.pagamento_direto.saldo > 0 && (
                <Badge variant="secondary" className="bg-blue-500/15 text-blue-600 border-blue-500/20 w-fit text-xs">
                  Pendente
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Combustível */}
        <Card className="border border-white/5 bg-gradient-to-br from-green-500/5 to-emerald-500/5 backdrop-blur-sm hover:border-white/10 transition-colors">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-foreground">
                {saldos.combustivel.descricao}
              </CardTitle>
              <div className="p-1.5 rounded-full bg-green-500/10">
                <Fuel className="h-3 w-3 text-green-600" />
              </div>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              {saldos.combustivel.quantidade_registros} registro{saldos.combustivel.quantidade_registros !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="space-y-1">
              <p className="text-xl font-semibold text-green-500">
                {formatCurrency(saldos.combustivel.saldo)}
              </p>
              {saldos.combustivel.saldo > 0 && (
                <Badge variant="secondary" className="bg-green-500/15 text-green-600 border-green-500/20 w-fit text-xs">
                  Pendente
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Total Geral removed per request */}
    </div>
  );
}
