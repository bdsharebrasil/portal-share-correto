# Exemplos de Uso - Sistema de Alertas de Vencimentos

## Exemplo 1: Dashboard com Resumo de Alertas

```typescript
// src/pages/Index.tsx (ou qualquer dashboard)
import { useExpirationAlerts } from '@/hooks/useExpirationAlerts';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const { visibleAlerts, getAlertsBySeverity } = useExpirationAlerts(user?.id || null);

  const expired = getAlertsBySeverity('expired');
  const critical = getAlertsBySeverity('critical');
  const warnings = getAlertsBySeverity('warning');

  return (
    <div className="grid gap-4">
      {/* Card de Alertas Expirados */}
      {expired.length > 0 && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Itens Vencidos ({expired.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {expired.map(alert => (
                <li key={alert.id} className="text-sm">
                  <strong>{alert.entity_name}</strong> - {alert.title}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Card de Alertas Críticos */}
      {critical.length > 0 && (
        <Card className="border-orange-500/50 bg-orange-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="w-5 h-5" />
              Críticos ({critical.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {critical.map(alert => (
                <li key={alert.id} className="text-sm">
                  {alert.entity_name} - Vence em {alert.days_until_expiry} dias
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

## Exemplo 2: Página de Alertas Dedicada

```typescript
// src/pages/AlertasVencimentos.tsx
import { useState } from 'react';
import { useExpirationAlerts } from '@/hooks/useExpirationAlerts';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface FilterOptions {
  type: 'all' | 'cma' | 'license' | 'maintenance' | 'document';
  severity: 'all' | 'expired' | 'critical' | 'warning' | 'info';
}

export default function AlertasVencimentos() {
  const { user } = useAuth();
  const { visibleAlerts, dismissAlert, snoozeAlert } = useExpirationAlerts(user?.id || null);
  const [filters, setFilters] = useState<FilterOptions>({ type: 'all', severity: 'all' });

  // Aplicar filtros
  const filteredAlerts = visibleAlerts.filter(alert => {
    const typeMatch = filters.type === 'all' || alert.alert_type === filters.type;
    const severityMatch = filters.severity === 'all' || alert.severity === filters.severity;
    return typeMatch && severityMatch;
  });

  // Agrupar por severidade
  const grouped = {
    expired: filteredAlerts.filter(a => a.severity === 'expired'),
    critical: filteredAlerts.filter(a => a.severity === 'critical'),
    warning: filteredAlerts.filter(a => a.severity === 'warning'),
    info: filteredAlerts.filter(a => a.severity === 'info'),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Alertas de Vencimentos</h1>
        <p className="text-muted-foreground mt-2">
          Total de {filteredAlerts.length} alerta(s) ativo(s)
        </p>
      </div>

      {/* Filtros */}
      <div className="flex gap-4">
        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value as any })}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="all">Todos os tipos</option>
          <option value="cma">CMA</option>
          <option value="license">Licenças</option>
          <option value="maintenance">Manutenção</option>
          <option value="document">Documentos</option>
        </select>

        <select
          value={filters.severity}
          onChange={(e) => setFilters({ ...filters, severity: e.target.value as any })}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="all">Todas as severidades</option>
          <option value="expired">Vencidos</option>
          <option value="critical">Críticos</option>
          <option value="warning">Aviso</option>
          <option value="info">Informação</option>
        </select>
      </div>

      {/* Tabs por severidade */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">Todos ({filteredAlerts.length})</TabsTrigger>
          <TabsTrigger value="expired" className="text-red-600">
            Vencidos ({grouped.expired.length})
          </TabsTrigger>
          <TabsTrigger value="critical" className="text-orange-600">
            Críticos ({grouped.critical.length})
          </TabsTrigger>
          <TabsTrigger value="warning" className="text-yellow-600">
            Aviso ({grouped.warning.length})
          </TabsTrigger>
          <TabsTrigger value="info" className="text-blue-600">
            Info ({grouped.info.length})
          </TabsTrigger>
        </TabsList>

        {/* Todos */}
        <TabsContent value="all" className="space-y-4">
          {filteredAlerts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum alerta ativo</p>
          ) : (
            filteredAlerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onDismiss={() => dismissAlert(alert.id)}
                onSnooze={(days) => snoozeAlert(alert.id, days)}
              />
            ))
          )}
        </TabsContent>

        {/* Vencidos */}
        <TabsContent value="expired" className="space-y-4">
          {grouped.expired.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum item vencido</p>
          ) : (
            grouped.expired.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onDismiss={() => dismissAlert(alert.id)}
                onSnooze={(days) => snoozeAlert(alert.id, days)}
              />
            ))
          )}
        </TabsContent>

        {/* Outros tabs similares... */}
      </Tabs>
    </div>
  );
}

function AlertCard({ alert, onDismiss, onSnooze }: any) {
  const severityConfig = {
    expired: { icon: '🔴', color: 'red', label: 'VENCIDO' },
    critical: { icon: '🟠', color: 'orange', label: 'CRÍTICO' },
    warning: { icon: '🟡', color: 'yellow', label: 'ATENÇÃO' },
    info: { icon: '🔵', color: 'blue', label: 'INFO' },
  };

  const config = severityConfig[alert.severity];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <span className="text-2xl">{config.icon}</span>
            <div className="flex-1">
              <CardTitle className="text-lg">{alert.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {alert.entity_name}
              </p>
            </div>
          </div>
          <span className={`text-sm font-bold text-${config.color}-600 whitespace-nowrap`}>
            {alert.days_until_expiry < 0
              ? `Vencido há ${Math.abs(alert.days_until_expiry)}d`
              : `Vence em ${alert.days_until_expiry}d`}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {alert.description && <p className="text-sm mb-4">{alert.description}</p>}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDismiss()}
          >
            Descartar
          </Button>
          <Button
            size="sm"
            onClick={() => onSnooze(7)}
          >
            Agendar 7 dias
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Exemplo 3: Integração na Página de Tripulantes

```typescript
// src/pages/GestaoTripulacao.tsx
import { useExpirationAlerts } from '@/hooks/useExpirationAlerts';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';

export default function GestaoTripulacao() {
  const { user } = useAuth();
  const { visibleAlerts, getAlertsByType } = useExpirationAlerts(user?.id || null);
  const cmaAlerts = getAlertsByType('cma');
  const licenseAlerts = getAlertsByType('license');

  // ... resto do componente

  const TripulantRow = ({ tripulante }: any) => {
    // Buscar alertas para este tripulante
    const alertas = visibleAlerts.filter(a => a.entity_name === tripulante.full_name);

    return (
      <tr>
        <td>{tripulante.full_name}</td>
        <td>
          <div className="flex gap-1">
            {alertas.map(alerta => (
              <Badge
                key={alerta.id}
                variant="outline"
                className={
                  alerta.severity === 'expired' ? 'bg-red-500/10 text-red-600 border-red-500' :
                  alerta.severity === 'critical' ? 'bg-orange-500/10 text-orange-600 border-orange-500' :
                  alerta.severity === 'warning' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500' :
                  'bg-blue-500/10 text-blue-600 border-blue-500'
                }
                title={alerta.title}
              >
                {alerta.alert_type.toUpperCase()} {alerta.days_until_expiry < 0 ? '❌' : '⚠️'}
              </Badge>
            ))}
          </div>
        </td>
        {/* ... outras colunas */}
      </tr>
    );
  };

  return (
    <div>
      {/* Resumo de alertas */}
      {visibleAlerts.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg mb-6">
          <p className="font-semibold text-blue-600">
            {visibleAlerts.length} alerta(s) de vencimento ativo(s)
          </p>
          <ul className="text-sm mt-2">
            {visibleAlerts.map(alert => (
              <li key={alert.id} className="text-blue-600/80">
                • {alert.title} ({alert.days_until_expiry}d)
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabela com alertas integrados */}
      <table>
        {/* ... */}
      </table>
    </div>
  );
}
```

## Exemplo 4: Widget para Dashboard

```typescript
// src/components/alerts/AlertsSummaryWidget.tsx
import { useExpirationAlerts } from '@/hooks/useExpirationAlerts';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, AlertCircle, AlertOctagon, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AlertsSummaryWidget() {
  const { user } = useAuth();
  const { visibleAlerts, getAlertsBySeverity } = useExpirationAlerts(user?.id || null);

  const expired = getAlertsBySeverity('expired');
  const critical = getAlertsBySeverity('critical');
  const warnings = getAlertsBySeverity('warning');
  const info = getAlertsBySeverity('info');

  const totalAlerts = visibleAlerts.length;

  if (totalAlerts === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-green-600">Nenhum alerta</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Tudo funcionando normalmente ✓</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          Alertas de Vencimentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Expirados */}
        {expired.length > 0 && (
          <div className="flex items-center justify-between p-2 bg-red-500/10 rounded border border-red-500/30">
            <span className="flex items-center gap-2 text-sm">
              <AlertOctagon className="w-4 h-4 text-red-600" />
              <span className="font-semibold text-red-600">
                {expired.length} Vencido{expired.length > 1 ? 's' : ''}
              </span>
            </span>
          </div>
        )}

        {/* Críticos */}
        {critical.length > 0 && (
          <div className="flex items-center justify-between p-2 bg-orange-500/10 rounded border border-orange-500/30">
            <span className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <span className="font-semibold text-orange-600">
                {critical.length} Crítico{critical.length > 1 ? 's' : ''}
              </span>
            </span>
          </div>
        )}

        {/* Avisos */}
        {warnings.length > 0 && (
          <div className="flex items-center justify-between p-2 bg-yellow-500/10 rounded border border-yellow-500/30">
            <span className="flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <span className="font-semibold text-yellow-600">
                {warnings.length} Aviso{warnings.length > 1 ? 's' : ''}
              </span>
            </span>
          </div>
        )}

        {/* Info */}
        {info.length > 0 && (
          <div className="flex items-center justify-between p-2 bg-blue-500/10 rounded border border-blue-500/30">
            <span className="flex items-center gap-2 text-sm">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-blue-600">
                {info.length} Info{info.length > 1 ? 's' : ''}
              </span>
            </span>
          </div>
        )}

        {/* Link para página de alertas */}
        <Link
          to="/alertas-vencimentos"
          className="text-sm text-blue-600 hover:underline mt-4 block"
        >
          Ver todos os alertas →
        </Link>
      </CardContent>
    </Card>
  );
}

// Usar no dashboard:
import { AlertsSummaryWidget } from '@/components/alerts/AlertsSummaryWidget';

export default function Dashboard() {
  return (
    <div className="grid gap-4">
      <AlertsSummaryWidget />
      {/* ... outros widgets */}
    </div>
  );
}
```

## Exemplo 5: Notificação no Header

```typescript
// src/components/layout/Header.tsx
import { useExpirationAlerts } from '@/hooks/useExpirationAlerts';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Bell } from 'lucide-react';

export function Header() {
  const { user } = useAuth();
  const { visibleAlerts } = useExpirationAlerts(user?.id || null);

  const expired = visibleAlerts.filter(a => a.severity === 'expired');
  const critical = visibleAlerts.filter(a => a.severity === 'critical');

  const urgentCount = expired.length + critical.length;

  return (
    <header className="border-b">
      <div className="flex items-center justify-between p-4">
        <h1>Portal ShareBrasil</h1>
        
        <div className="flex items-center gap-4">
          {/* Ícone de notificações */}
          {urgentCount > 0 && (
            <button className="relative p-2 hover:bg-muted rounded-lg">
              <Bell className="w-5 h-5" />
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {urgentCount}
              </Badge>
            </button>
          )}

          {/* ... resto do header */}
        </div>
      </div>
    </header>
  );
}
```

## Exemplo 6: Integração com Tabela

```typescript
// Adicionar coluna de alertas em qualquer tabela de dados
import { useExpirationAlerts } from '@/hooks/useExpirationAlerts';

function DataTable({ items }: { items: any[] }) {
  const { user } = useAuth();
  const { visibleAlerts } = useExpirationAlerts(user?.id || null);

  const getAlertsForItem = (itemName: string) => {
    return visibleAlerts.filter(a => a.entity_name === itemName);
  };

  return (
    <table>
      <thead>
        <tr>
          <th>Nome</th>
          <th>Status</th>
          <th>Alertas</th>
        </tr>
      </thead>
      <tbody>
        {items.map(item => {
          const alerts = getAlertsForItem(item.name);
          return (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.status}</td>
              <td>
                {alerts.length === 0 ? (
                  <span className="text-green-600 text-sm">✓ OK</span>
                ) : (
                  <div className="flex gap-1">
                    {alerts.map(alert => (
                      <Badge
                        key={alert.id}
                        variant={alert.severity === 'expired' ? 'destructive' : 'default'}
                      >
                        {alert.alert_type}
                      </Badge>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

---

## Dicas Importantes

1. **Sempre use o hook**: `useExpirationAlerts(userId)` para obter os alertas
2. **Filtre regularmente**: Use `getAlertsBySeverity()` e `getAlertsByType()` para agrupar
3. **Mostre contexto**: Sempre mostre qual entidade o alerta se refere (ex: nome do tripulante)
4. **Facilite ações**: Deixe claro como descartar ou agendar alertas
5. **Destaque o urgente**: Use cores e ícones para chamar atenção para críticos e expirados

## Padrão de Cores

Use estas cores consistentemente:

```typescript
const severityColors = {
  expired: 'red-500',      // 🔴 Crítico
  critical: 'orange-500',  // 🟠 Urgente
  warning: 'yellow-500',   // 🟡 Aviso
  info: 'blue-500',        // 🔵 Informativo
};
```
