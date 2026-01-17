# 📊 Guia de Integração - Histórico Consolidado

## Resumo

O sistema de histórico consolidado foi implementado com:

1. ✅ **Tabela**: `historico_rateio_consolidado` - Armazena dados consolidados
2. ✅ **Função SQL**: `consolidar_despesas_para_historico()` - Consolida rateios
3. ✅ **Trigger Automático**: Dispara consolidação ao atualizar `bank_reconciliations`
4. ✅ **Hook React**: `useHistoricoRateioConsolidado` - Busca dados do histórico
5. ✅ **Componente React**: `HistoricoRateioConsolidado` - Exibe tabela com filtros
6. ✅ **Página Integrada**: Aba "Despesas" do Balanço Cliente

---

## 🚀 Como Usar

### 1. No Dashboard (Automático)

Após executar o SQL (`CONSOLIDACAO_HISTORICO_RATEIO.sql`):

1. Acesse **Balanço Cliente**
2. Selecione um **Cliente** e **Período**
3. Clique na aba **Despesas**
4. Veja a seção **"Histórico de Rateio Consolidado"**
5. Dados aparecem automaticamente com filtros por categoria e tipo

### 2. Via API/RPC (Manual)

Se quiser consolidar dados manualmente:

#### **Exemplo 1: Consolidar um banco_reconciliation específico**

```javascript
// No seu código React ou backend
import { supabase } from '@/integrations/supabase/client';

async function consolidarRateio(bankReconciliationId) {
  try {
    const { data, error } = await supabase.rpc(
      'consolidar_despesas_para_historico',
      {
        p_bank_reconciliation_id: bankReconciliationId,
        p_consolidado_por: user.id, // ID do usuário logado
      }
    );

    if (error) {
      console.error('Erro ao consolidar:', error);
      return;
    }

    console.log('✅ Consolidado! IDs criados:', data);
    return data; // Array de UUIDs dos registros criados
  } catch (err) {
    console.error('Exceção:', err);
  }
}
```

#### **Exemplo 2: Consolidar todos os rateios pendentes de um cliente**

```javascript
async function consolidarTodosRateioPorCliente(clienteId) {
  try {
    // Buscar todos os bank_reconciliations do cliente com rateios
    const { data: bancos } = await supabase
      .from('bank_reconciliations')
      .select('id')
      .eq('client_id', clienteId)
      .eq('tipo_documento', 'rateio')
      .eq('status', 'consolidado'); // Ou 'pago'

    if (!bancos) return [];

    // Consolidar cada um
    const resultados = [];
    for (const banco of bancos) {
      const { data } = await supabase.rpc(
        'consolidar_despesas_para_historico',
        {
          p_bank_reconciliation_id: banco.id,
          p_consolidado_por: user.id,
        }
      );
      resultados.push(data);
    }

    return resultados.flat();
  } catch (err) {
    console.error('Erro ao consolidar tudo:', err);
  }
}
```

#### **Exemplo 3: Buscar histórico via SQL direto**

```sql
-- Buscar histórico de um cliente específico
SELECT 
  id,
  cliente_nome,
  aeronave_registro,
  categoria_grupo,
  data_competencia,
  horas_voadas,
  percentual_participacao,
  valor_rateado,
  foi_reembolso,
  status
FROM public.historico_rateio_consolidado
WHERE cliente_id = 'UUID-DO-CLIENTE'
AND data_competencia BETWEEN '2025-11-01' AND '2026-01-31'
AND status = 'consolidado'
ORDER BY data_competencia DESC;
```

---

## 📋 Dados Disponíveis

Cada registro no histórico contém:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | ID único do registro |
| `cliente_id` | UUID | ID do cliente (sócio) |
| `cliente_nome` | VARCHAR | Nome do cliente/sócio |
| `aeronave_id` | UUID | ID da aeronave |
| `aeronave_registro` | VARCHAR | Registro da aeronave (ex: PR-ABC) |
| `data_competencia` | DATE | Mês/ano do lançamento |
| `data_pagamento` | DATE | Data em que foi pago |
| `horas_voadas` | NUMERIC | Horas voadas pelo cliente |
| `horas_totais_aeronave` | NUMERIC | Total de horas da aeronave |
| `percentual_uso` | NUMERIC | Percentual de uso da aeronave |
| `percentual_participacao` | NUMERIC | Percentual de participação do cliente |
| `categoria_id` | UUID | ID da categoria |
| `categoria_nome` | VARCHAR | Nome da categoria |
| `categoria_grupo` | VARCHAR | Grupo (REEMBOLSOS, Despesas Aeronave, etc) |
| `valor_total_lancamento` | NUMERIC | Valor total da despesa |
| `valor_rateado` | NUMERIC | Quanto custou para este cliente |
| `valor_pago` | NUMERIC | Valor efetivamente pago |
| `foi_reembolso` | BOOLEAN | É reembolso? |
| `tipo_rateio` | VARCHAR | Tipo (rateio_despesas) |
| `status` | VARCHAR | Status (consolidado) |
| `consolidado_em` | TIMESTAMP | Quando foi consolidado |
| `consolidado_por` | UUID | Quem consolidou |

---

## 🎯 Filtros Disponíveis no Dashboard

Na página **Balanço Cliente > Despesas**, você pode filtrar por:

1. **Cliente** - Sócio específico ou consolidado
2. **Aeronave** - Todas ou uma específica
3. **Data Início/Fim** - Período de análise
4. **Categoria** (na tabela do histórico):
   - REEMBOLSOS
   - Despesas Aeronave
   - RECEITAS OPERACIONAIS
   - DESPESAS REEMBOLSÁVEIS
   - Outras categorias
5. **Tipo**:
   - Todos
   - Apenas Reembolsos
   - Sem Reembolsos

---

## 🔄 Fluxo de Consolidação Automática

```
1. Criar rateio_despesas
   ↓
2. Atualizar bank_reconciliations para 'consolidado' ou 'pago'
   ↓
3. Trigger dispara automaticamente
   ↓
4. Função consolidar_despesas_para_historico() executa:
   - Busca dados de rateio_despesas
   - Calcula horas voadas do cliente
   - Calcula percentual de participação
   - Filtra apenas categorias permitidas
   - Insere em historico_rateio_consolidado
   ↓
5. Dashboard busca automaticamente via hook useHistoricoRateioConsolidado
   ↓
6. Tabela é exibida com todos os dados
```

---

## 📊 Exemplos de Queries Úteis

### Exemplo 1: Resumo por categoria

```sql
SELECT 
  categoria_grupo,
  COUNT(*) as total_registros,
  SUM(valor_rateado) as valor_total,
  SUM(horas_voadas) as total_horas,
  COUNT(CASE WHEN foi_reembolso THEN 1 END) as total_reembolsos
FROM public.historico_rateio_consolidado
WHERE cliente_id = 'UUID-CLIENTE'
AND data_competencia >= '2025-11-01'
GROUP BY categoria_grupo
ORDER BY valor_total DESC;
```

### Exemplo 2: Comparação de clientes por aeronave

```sql
SELECT 
  cliente_nome,
  COUNT(*) as total_lancamentos,
  SUM(horas_voadas) as horas_voadas,
  ROUND(AVG(percentual_participacao), 2) as percentual_medio,
  SUM(valor_rateado) as valor_total
FROM public.historico_rateio_consolidado
WHERE aeronave_id = 'UUID-AERONAVE'
AND EXTRACT(YEAR FROM data_competencia) = 2025
AND EXTRACT(MONTH FROM data_competencia) = 11
GROUP BY cliente_nome
ORDER BY valor_total DESC;
```

### Exemplo 3: Reembolsos pendentes

```sql
SELECT 
  cliente_nome,
  aeronave_registro,
  categoria_nome,
  data_competencia,
  valor_rateado,
  (valor_rateado - valor_pago) as saldo_devedor
FROM public.historico_rateio_consolidado
WHERE foi_reembolso = TRUE
AND (valor_rateado - valor_pago) > 0
AND status = 'consolidado'
ORDER BY data_competencia DESC;
```

---

## 🐛 Troubleshooting

### Problema: Histórico vazio

**Solução:**
1. Verifique se `rateio_despesas` tem dados:
   ```sql
   SELECT COUNT(*) FROM public.rateio_despesas;
   ```
2. Verifique se `bank_reconciliations` tem status 'consolidado':
   ```sql
   SELECT COUNT(*) FROM public.bank_reconciliations 
   WHERE tipo_documento = 'rateio' 
   AND status IN ('consolidado', 'pago');
   ```
3. Manualmente consolide (execute a função RPC)
4. Aguarde o trigger (pode levar alguns segundos)

### Problema: Dados não aparecem no dashboard

**Solução:**
1. Recarregue a página (F5)
2. Verifique console do navegador (F12 > Console) para erros
3. Verifique se filtro de data está correto
4. Certifique-se de que cliente tem histórico

### Problema: Horas voadas está 0

**Solução:**
1. Verifique se há registros em `horas_voo` para esse cliente/aeronave
2. Verifique se a data em `horas_voo` bate com a data em `rateio_despesas`
3. Se vazio, os dados de horas podem não estar registrados

---

## 📚 Arquivos Criados/Modificados

### Novos Arquivos:
- `CONSOLIDACAO_HISTORICO_RATEIO.sql` - Script SQL para criar tabelas/funções
- `src/hooks/useHistoricoRateioConsolidado.ts` - Hook React para buscar dados
- `src/components/balanco-cliente/HistoricoRateioConsolidado.tsx` - Componente com tabela
- `GUIA_INTEGRACAO_HISTORICO.md` - Este arquivo

### Arquivos Modificados:
- `src/pages/BalancoCliente.tsx` - Integração do componente

---

## ✅ Checklist de Implementação

- [ ] Executou o SQL (`CONSOLIDACAO_HISTORICO_RATEIO.sql`) no Supabase
- [ ] Verificou que a tabela foi criada: `SELECT COUNT(*) FROM public.historico_rateio_consolidado;`
- [ ] Acessou Balanço Cliente > Despesas
- [ ] Viu a tabela "Histórico de Rateio Consolidado"
- [ ] Dados aparecem na tabela
- [ ] Filtros funcionam
- [ ] Exportação CSV funciona
- [ ] Estatísticas aparecem corretamente

---

## 🎓 Próximas Melhorias (Opcional)

1. **Gráficos Interativos**: Adicionar charts para visualizar distribuição por categoria
2. **Relatórios em PDF**: Exportar relatórios detalhados em PDF
3. **Alertas de Reembolsos**: Notificar quando há reembolsos pendentes
4. **Integração com Nota Fiscal**: Vincular automaticamente NF aos registros
5. **Aprovação de Rateios**: Workflow de aprovação antes de consolidar

---

## 📞 Dúvidas?

Se tiver problemas:
1. Verifique os logs de erro no console (F12)
2. Verifique o banco de dados via Supabase Admin Panel
3. Execute queries de teste (veja exemplos acima)
4. Revise este guia

**Tudo pronto para usar!** 🎉
