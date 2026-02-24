# Sistema CTM (Controle Técnico de Manutenção)

## Visão Geral

O Sistema CTM foi desenvolvido para gerenciar completamente a manutenção técnica de aeronaves, seguindo os padrões estabelecidos pela ANAC e os fabricantes.

## Estrutura do Sistema

### Páginas Principais

1. **CTMDashboardPage** (`src/pages/manutencao/CTMDashboardPage.tsx`)
   - Seleção inicial de aeronave
   - Visualização das aeronaves ativas e inativas
   - Acesso rápido ao dashboard de cada aeronave

2. **CTMManagementPage** (`src/pages/manutencao/CTMManagementPage.tsx`)
   - Dashboard completo da aeronave selecionada
   - Abas para diferentes funcionalidades:
     - Dashboard (visão geral)
     - RAS (Relatórios de Acompanhamento)
     - Financeiro (resumo de custos)
     - Motor (gastos específicos de motores)
     - Diretrizes (AD/SB)

### Componentes Principais

#### Dashboard
- **CTMDashboard** - Dashboard principal com indicadores de manutenção
- **AircraftCard** - Card com informações da aeronave
- **StatusCard** - Card de status (Vencida/Urgente/Atenção/OK)
- **MaintenanceList** - Lista de inspeções próximas
- **ComponentLifeCard** - Indicador de vida útil de componentes

#### RAS (Relatório de Acompanhamento de Serviço)
- **RASList** - Lista de RAS com busca e filtros
- **RASDetailModal** - Modal de visualização detalhada com fotos
- **PhotoUploadSection** - Upload e gerenciamento de fotos

#### Financeiro
- **FinancialSummaryCard** - Resumo financeiro com gráficos
- **MotorExpensesCard** - Gastos específicos de motores

#### Diretrizes
- **ADSBControlCard** - Controle de Airworthiness Directives e Service Bulletins

#### Utilitários
- **CTMSearchFilter** - Busca avançada e filtros

### Tipos de Dados

Todos os tipos estão definidos em `src/types/maintenance.ts`:

- **Aircraft** - Dados da aeronave
- **MaintenanceItem** - Item de manutenção (inspeção, revisão)
- **Component** - Componente crítico com vida útil
- **RAS** - Relatório de Acompanhamento de Serviço
- **RASPhoto** - Fotos associadas ao RAS
- **RASCostItem** - Item de custo no RAS
- **MotorExpense** - Despesa de motor
- **FinancialSummary** - Resumo financeiro
- **AirworthinessDirective** - Diretriz de Aeronavegabilidade
- **ServiceBulletin** - Boletim de Serviço
- **InsurancePolicy** - Política de seguro
- **Certification** - Certificado de aeronavegabilidade

## Funcionalidades Implementadas

### ✅ Dashboard CTM
- Seleção de aeronave com busca
- Visualização de status geral
- Inspeções próximas com prazos
- Componentes críticos com barra de progresso
- Alertas automáticos por urgência

### ✅ RAS (Relatório de Acompanhamento de Serviço)
- Listagem de RAS com filtros avançados
- Modal de visualização formatada
- Breakdown de custos por item
- Galeria de fotos com descrições
- Exportação para PDF (preparado)
- Impressão formatada

### ✅ Controle de Custos
- Resumo financeiro total
- Distribuição de custos por categoria
- Gráficos de despesas mensais
- Custos por tipo de gasto

### ✅ Gastos de Motor
- Rastreamento específico de motores (LH/RH/Both)
- Tipos de despesa (Overhaul, Reparo, Manutenção, Inspeção)
- Registro de horas de motor
- Fornecedores e valores

### ✅ AD e SB
- Controle de Airworthiness Directives
- Controle de Service Bulletins
- Status de execução
- Prazos de cumprimento
- Observações detalhadas

### ✅ Upload de Fotos
- Upload múltiplo de imagens
- Descrições para cada foto
- Visualização em galeria
- Integração com RAS

### ✅ Busca Integrada
- Busca por número de OS
- Busca por descrição
- Busca por mecânico responsável
- Filtros por status e tipo

## Integração com Supabase

### Tabelas Necessárias

As seguintes tabelas devem existir no Supabase:

1. **aircraft** - Aeronaves
2. **maintenance_items** - Itens de manutenção
3. **aircraft_components** - Componentes críticos
4. **ras** - Relatórios de Acompanhamento de Serviço
5. **ras_photos** - Fotos de RAS
6. **ras_cost_items** - Itens de custo de RAS
7. **motor_expenses** - Despesas de motor
8. **airworthiness_directives** - Diretrizes de Aeronavegabilidade
9. **service_bulletins** - Boletins de Serviço
10. **insurance_policies** - Políticas de seguro
11. **certifications** - Certificações

### Estrutura de Dados

#### aircraft
```sql
CREATE TABLE aircraft (
  id UUID PRIMARY KEY,
  registration TEXT,
  model TEXT,
  fabricante TEXT,
  serial_number TEXT,
  cell_hours_current NUMERIC,
  pousos_atuais INTEGER,
  status TEXT,
  ultima_revisao DATE,
  celula_prox_revisao NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### maintenance_items
```sql
CREATE TABLE maintenance_items (
  id UUID PRIMARY KEY,
  aircraft_id UUID REFERENCES aircraft(id),
  type TEXT, -- 'preventiva', 'corretiva', 'programada'
  description TEXT,
  interval_type TEXT, -- 'horas', 'ciclos', 'calendario', 'variavel'
  interval_value NUMERIC,
  last_done_date DATE,
  last_done_hours NUMERIC,
  next_due_date DATE,
  next_due_hours NUMERIC,
  status TEXT DEFAULT 'ok', -- 'expired', 'urgent', 'attention', 'ok'
  responsible_mechanic TEXT,
  observations TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### ras
```sql
CREATE TABLE ras (
  id UUID PRIMARY KEY,
  aircraft_id UUID REFERENCES aircraft(id),
  service_order_number TEXT,
  maintenance_center TEXT,
  maintenance_type TEXT, -- 'corretiva', 'preventiva', 'revisao'
  responsible_mechanic TEXT,
  date DATE,
  completion_date DATE,
  description TEXT,
  inspection_details TEXT,
  status TEXT DEFAULT 'pendente', -- 'pendente', 'em_andamento', 'concluido'
  total_cost NUMERIC DEFAULT 0,
  motor_hours NUMERIC,
  observations TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Como Usar

### Acessar o Sistema

1. Acesse `/manutencao/ctm` para visualizar a lista de aeronaves
2. Selecione uma aeronave ativa ou inativa
3. Visualize o dashboard com todas as informações de manutenção

### Gerenciar Manutenções

1. **Ver Inspeções**: No dashboard, visualize todas as inspeções próximas
2. **Consultar RAS**: Acesse a aba "RAS" para ver todos os relatórios
3. **Acompanhar Custos**: Use a aba "Financeiro" para análise de despesas
4. **Controlar Motores**: Na aba "Motor", acompanhe gastos específicos de motor
5. **Cumprir Diretrizes**: Use a aba "Diretrizes" para AD e SB

### Adicionar Novos Registros

> **Nota**: As funcionalidades de criação ainda estão em desenvolvimento. O sistema está preparado para receber novos registros através do Supabase.

## Status de Implementação

| Funcionalidade | Status | Notas |
|---|---|---|
| Dashboard | ✅ Completo | Carregamento de dados do Supabase |
| RAS Listing | ✅ Completo | Com busca e filtros |
| RAS Modal | ✅ Completo | Visualização formatada e impressão |
| RAS Fotos | ✅ Completo | Upload e visualização |
| Custos | ✅ Completo | Resumo e gráficos |
| Motor Expenses | ✅ Completo | Controle por lado do motor |
| AD/SB | ✅ Completo | Listagem e gerenciamento |
| Criação RAS | 🚧 Em Desenvolvimento | Formulário de entrada |
| Criação Motor | 🚧 Em Desenvolvimento | Formulário de entrada |
| Criação AD/SB | 🚧 Em Desenvolvimento | Formulário de entrada |
| Exportar PDF | 🚧 Em Desenvolvimento | Preparado para implementação |

## Próximas Etapas

1. ✅ Desenvolver formulários de criação de RAS
2. ✅ Desenvolver formulários de criação de gastos de motor
3. ✅ Desenvolver formulários de criação de AD/SB
4. ✅ Implementar export para PDF
5. ✅ Adicionar autenticação de usuários
6. ✅ Implementar histórico de alterações
7. ✅ Adicionar notificações para vencimentos

## Notas Técnicas

- Todos os componentes usam TypeScript para type safety
- Integração com Supabase usando `@supabase/supabase-js`
- Componentes UI baseados em Shadcn/ui
- Gráficos usando Recharts
- Icons de Lucide React
- Toast notifications com Sonner

## Suporte

Para dúvidas ou problemas com o sistema CTM, verifique:
1. Se as tabelas do Supabase existem
2. Se as credenciais do Supabase estão corretas
3. Os logs do console do navegador para mensagens de erro
4. A documentação do Supabase para schemas

---

**Último Update**: Dezembro 2025
**Versão**: 1.0
