import React, { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Users, Search } from 'lucide-react';
import { useClientesComSocios } from '@/hooks/useSocioBalanco';
import { Input } from '@/components/ui/input';

function ClientesComSociosSelectorContent() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Carregar clientes com sócios
  const { data: clientesComSocios = [], isLoading } = useClientesComSocios();
  
  // Filtrar apenas clientes que têm partners
  const clientesComPartners = clientesComSocios.filter(cliente => 
    cliente.socios && cliente.socios.length > 0
  );
  
  // Filtrar por termo de busca
  const clientesFiltrados = clientesComPartners.filter(cliente =>
    cliente.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.proprietario?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.cnpj?.includes(searchTerm)
  );

  const handleSelectCliente = (clienteId: string) => {
    navigate(`/financeiro/balanco-cliente?clienteId=${clienteId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Gestão de Sócios</h1>
        <p className="text-lg text-muted-foreground">
          Selecione um cliente para visualizar o balanço de seus sócios
        </p>
      </div>

      {/* Search */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Buscar Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF/CNPJ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Clientes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clientesFiltrados.map((cliente) => (
          <Card 
            key={cliente.id}
            className="border-border/50 bg-card/60 backdrop-blur-sm hover:bg-card/80 transition-colors cursor-pointer group"
            onClick={() => handleSelectCliente(cliente.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate group-hover:text-primary transition-colors">
                    {cliente.company_name || cliente.proprietario}
                  </CardTitle>
                  {cliente.cnpj && (
                    <CardDescription className="text-xs mt-1">
                      CNPJ: {cliente.cnpj}
                    </CardDescription>
                  )}
                </div>
                <Users className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Sócios */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Sócios</p>
                <div className="flex flex-wrap gap-2">
                  {cliente.socios.map((socio) => (
                    <Badge 
                      key={socio.id} 
                      variant="secondary" 
                      className="text-xs"
                    >
                      <span className="truncate">{socio.nome}</span>
                      <span className="ml-1 font-semibold">{socio.percentual.toFixed(1)}%</span>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Info */}
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-3">
                  {cliente.socios.length} sócio{cliente.socios.length > 1 ? 's' : ''} registrado{cliente.socios.length > 1 ? 's' : ''}
                </p>
                
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectCliente(cliente.id);
                  }}
                  className="w-full group/btn"
                  size="sm"
                >
                  <span>Ver Balanço</span>
                  <ArrowRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {!isLoading && clientesFiltrados.length === 0 && (
        <Card className="border-border/50 bg-card/60">
          <CardContent className="pt-12 pb-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente com sócios'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {searchTerm 
                ? 'Tente ajustar sua busca'
                : 'Não há clientes com sócios registrados no sistema'
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="border-border/50 bg-card/60">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4 animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
                  <div className="h-10 bg-muted rounded animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClientesComSociosSelector() {
  return (
    <Layout>
      <ClientesComSociosSelectorContent />
    </Layout>
  );
}
