# Módulos do Portal Share

## 📚 Documentação dos Módulos

Esta pasta contém todos os módulos de negócio do aplicativo. Cada módulo é independente e pode ter suas próprias páginas, componentes, hooks, services e tipos.

## 🏗️ Anatomia de um Módulo

```
module/
├── pages/              # 📄 Páginas/Telas
├── components/         # 🧩 Componentes reutilizáveis do módulo
├── hooks/              # 🪝 Hooks customizados
├── services/           # ⚙️ Lógica de negócio
├── types/              # 📋 Tipos TypeScript
├── index.ts            # 📦 Exports públicos
└── routes.tsx          # 🛣️ Definição de rotas
```

## 🔑 Módulos Principais

### 1. **core-finance** 💰
Gerenciamento financeiro central

**Páginas:**
- DashboardFinanceiro
- ConciliacaoBancaria
- ConfigEmpresa
- EmissaoRecibo
- RelatorioViagem
- RelatoriosFinanceiros
- SolicitacaoCompras
- ControlFinanceiro
- AgendamentoPagamentos
- Invoices
- GestaoFiscal
- DashboardGestor
- ConfigMovimentacoes
- BalancoCliente

**Características:**
- Gerenciador central de finanças
- Emissão de recibos
- Relatórios financeiros
- Controle de despesas

---

### 2. **ativos-aereos** ✈️
Gerenciamento de ativos aéreos

**Futuras Páginas:**
- Aeronaves
- Aerodromos
- ManutencaoProgramada
- RelatoriosManutenção

**Características:**
- Cadastro de aeronaves
- Gerenciamento de aeródromos
- Manutenção preventiva
- Controle de horas

---

### 3. **clientes** 👥
Gerenciamento de clientes

**Futuras Páginas:**
- ListaClientes
- ClienteDetalhes
- ContatosCliente

**Características:**
- Cadastro de clientes
- Gerenciamento de contatos
- Histórico transacional

---

### 4. **socios** 🤝
Gerenciamento de sócios/parceiros

**Páginas:**
- SociosPage
- RelatorioTransacoesSocios

**Características:**
- Cadastro de sócios
- Transações de sócios
- Relatórios financeiros

---

## 📖 Como Usar Um Módulo

### Importar Página
```typescript
import { DashboardFinanceiro } from '@/modules/core-finance';
```

### Importar Hook
```typescript
import { useBalance } from '@/modules/core-finance';
```

### Usar em Rota
```typescript
import CoreFinanceRoutes from '@/modules/core-finance/routes';

export default function AppRouter() {
  return (
    <Routes>
      {CoreFinanceRoutes()}
    </Routes>
  );
}
```

## 🎯 Criando Novo Conteúdo

### Adicionar uma Página
1. Criar arquivo em `pages/[PageName].tsx`
2. Adicionar tipo em `types/index.ts` se necessário
3. Criar hooks correspondentes em `hooks/`
4. Adicionar rota em `routes.tsx`
5. Atualizar `pages/index.ts`

### Adicionar um Componente
1. Criar arquivo em `components/[ComponentName].tsx`
2. Tornar componente "puro" (props in, JSX out)
3. Adicionar ao `components/index.ts`

### Adicionar Lógica de Negócio
1. Criar service em `services/[name].service.ts`
2. Criar hook em `hooks/use[Name].ts` que chama o service
3. Usar hook em página/componente

## 🔍 Estrutura de Tipos

Cada módulo tem seus próprios tipos em `types/index.ts`:

```typescript
// Exemplo
export interface Transaction {
  id: string;
  amount: number;
  date: Date;
  category: string;
}
```

## ⚙️ Services

Services contêm lógica de negócio SEM dependências React:

```typescript
// Exemplo
export const balanceService = {
  async getBalance(clientId: string) {
    const data = await supabase.from('balances')...
    return processedData;
  }
};
```

## 🪝 Hooks

Hooks gerenciam estado React e chamam services:

```typescript
// Exemplo
export function useBalance(clientId: string) {
  const [balance, setBalance] = useState(null);
  
  useEffect(() => {
    balanceService.getBalance(clientId)
      .then(setBalance);
  }, [clientId]);
  
  return balance;
}
```

## 🧩 Componentes

Componentes são UI pura e recebem tudo via props:

```typescript
// Exemplo
export function BalanceCard({ balance }: { balance: Balance }) {
  return <div>{balance.net}</div>;
}
```

## 🛣️ Routes

Cada módulo define suas próprias rotas:

```typescript
// src/modules/core-finance/routes.tsx
export default function CoreFinanceRoutes() {
  return (
    <>
      <Route path="/financeiro" element={<DashboardFinanceiro />} />
    </>
  );
}
```

## 📦 Exports Públicos

Cada módulo exporta públicamente através de `index.ts`:

```typescript
// src/modules/core-finance/index.ts
export * from './pages';
export type * from './types';
export * as Hooks from './hooks';
export * as Services from './services';
```

## 🔗 Componentes Compartilhados

Componentes used por múltiplos módulos ficam em `src/shared/components/`:

- UI Components (botões, inputs, etc)
- Layout Components (header, sidebar, etc)
- Form Components (validação, etc)
- Alert Components (notificações, etc)

## 🚀 Best Practices

1. ✅ Mantenha Services sem React
2. ✅ Mantenha Components puros
3. ✅ Use Types definidos
4. ✅ Crie Hooks para lógica complexa
5. ✅ Use index.ts para exports
6. ✅ Agrupe código relacionado
7. ❌ Não misture camadas
8. ❌ Não importe pela pasta inteira

## 📚 Referências

- [ARCHITECTURE.md](../ARCHITECTURE.md) - Visão geral da arquitetura
- [MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md) - Como migrar páginas
- [MODULAR_STRUCTURE_SUMMARY.md](../MODULAR_STRUCTURE_SUMMARY.md) - Sumário executivo

## 🎓 Exemplos

Exemplos de implementação corretos:

- `core-finance/services/balance.example.ts`
- `core-finance/hooks/useMonthlyBalance.example.ts`
- `core-finance/components/BalanceCard.example.tsx`

---

**Status**: Estrutura pronta para desenvolvimento  
**Última atualização**: 21 de Fevereiro de 2026