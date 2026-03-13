# Guia Rápido - Sistema CTM

## 🚀 Como Começar

### Passo 1: Acessar o Sistema CTM

```
URL: /manutencao/ctm
```

### Passo 2: Selecionar uma Aeronave

A página mostrará uma lista de aeronaves ativas e inativas. Clique em qualquer aeronave para acessar o dashboard.

### Passo 3: Explorar as Abas

O dashboard contém 5 abas principais:

#### 📊 Dashboard
- Visão geral de manutenções
- Status das inspeções
- Componentes críticos
- Alertas de vencimento

#### 📄 RAS (Relatórios)
- Lista de manutenções corretivas
- Busca e filtros avançados
- Visualização de fotos
- Detalhamento de custos

#### 💰 Financeiro
- Resumo de despesas
- Gráficos de custos
- Breakdown por categoria
- Despesas mensais

#### ⚡ Motor
- Gastos específicos de motores
- Controle por lado (LH/RH)
- Tipos de despesa
- Total consolidado

#### ⚠️ Diretrizes
- Airworthiness Directives (AD)
- Service Bulletins (SB)
- Prazos e status
- Observações

## 🔍 Usar a Busca

### Busca Rápida
Na aba RAS, use o campo de busca para encontrar:
- Número de Ordem de Serviço (OS)
- Descrição da manutenção
- Mecânico responsável

### Filtros Avançados
Clique em "Filtros" para:
- Filtrar por status
- Filtrar por tipo de manutenção
- Combinar múltiplos filtros

## 👁️ Visualizar RAS

1. Na aba RAS, localize o relatório desejado
2. Clique no botão "Ver"
3. Modal abrirá com:
   - Informações completas
   - Fotos da manutenção
   - Breakdown de custos
   - Botões para imprimir/exportar

## 📸 Fotos de Manutenção

Cada RAS pode ter múltiplas fotos anexadas:
- Clique em qualquer foto para ampliar
- Leia a descrição adicional
- Cada foto está referenciada no relatório

## 💹 Analisar Custos

### Painel Financeiro
- Card superior: Total investido em motores
- Gráfico de pizza: Distribuição por categoria
- Gráfico de linha: Tendência mensal
- Cards de resumo: Custos por tipo

### Breakdown de RAS
Ao visualizar um RAS, verifique o item "Breakdown de Custos":
- Descrição do item
- Quantidade x valor unitário
- Subtotal
- Total geral

## ⚙️ Informações Técnicas

### Dados Carregados do Supabase

O sistema carrega automaticamente:
- ✅ Informações da aeronave
- ✅ Lista de manutenções agendadas
- ✅ Componentes com vida útil
- ✅ Relatórios de manutenção (RAS)
- ✅ Fotos associadas
- ✅ Gastos de motor
- ✅ Diretrizes (AD)
- ✅ Boletins de serviço (SB)

## 🚫 O Que Ainda Não Está Disponível

As seguintes funcionalidades estão em desenvolvimento:

- 🚧 Criar novo RAS
- 🚧 Editar RAS existente
- 🚧 Adicionar nova despesa de motor
- 🚧 Criar novo AD/SB
- 🚧 Upload de fotos via interface
- 🚧 Exportar para PDF
- 🚧 Enviar para impressora

**Nota**: Essas funcionalidades podem ser adicionadas à base de dados diretamente via Supabase enquanto aguarda o desenvolvimento da interface.

## 📌 Dicas Úteis

### 1. Monitorar Vencimentos
- Dashboard mostra automaticamente itens próximos ao vencimento
- Vermelho = Vencido
- Laranja = Urgente (próximo de vencer)
- Amarelo = Atenção
- Verde = OK

### 2. Comparar Custos
- Use a aba Financeiro para analisar tendências
- Compare gastos mensais
- Identifique picos de despesa

### 3. Rastrear Componentes
- Cada componente mostra % de vida utilizada
- Barra de progresso visual
- Alerta automático a 80%

### 4. Cumprir Regulamentações
- AD/SB marcam itens pendentes
- Status mostra progresso
- Prazos ficam visíveis

## ❓ Troubleshooting

### Não vejo nenhuma aeronave
- Verifique se existem registros na tabela `aircraft`
- Confirme credenciais do Supabase
- Verifique console do navegador para erros

### Dados estão desatualizados
- Refreshe a página (F5)
- Aguarde carregamento completo
- Verifique última atualização no Supabase

### Fotos não aparecem
- Verifique se URLs estão válidas
- Confirme permissões do Supabase Storage
- Verifique console para mensagens de erro

### Filtros não funcionam
- Limpe filtros e tente novamente
- Verifique se dados estão populados
- Atualize a página

## 📞 Suporte

Para problemas técnicos:

1. Abra Developer Tools (F12)
2. Verifique Console para erros
3. Consulte documentação em `src/docs/`
4. Entre em contato com suporte técnico

## 🎯 Casos de Uso

### Caso 1: Preparar Visita da ANAC
1. Acesse Dashboard
2. Verifique status de todas as manutenções
3. Confira AD/SB pendentes
4. Compile relatórios na aba Financeiro
5. Exporte informações conforme necessário

### Caso 2: Analisar Custos de Motor
1. Navegue para aba "Motor"
2. Visualize total investido
3. Identifique despesas maiores
4. Compare com período anterior

### Caso 3: Validar Componentes
1. No Dashboard, revise "Componentes Críticos"
2. Identifique componentes acima de 80%
3. Planeje substituição
4. Registre em novo RAS

### Caso 4: Documentar Manutenção
1. Acesse aba RAS
2. Visualize relatório completo
3. Confirme fotos e custos
4. Exporte ou imprima conforme necessário

---

**Última Atualização**: Dezembro 2025
**Versão**: 1.0

Para documentação completa, consulte `CTM_SYSTEM.md`
