# 📋 Passo a Passo Visual - Implementar Histórico Consolidado

## ⚡ TL;DR (Resumo Executivo)

| Ação | Tempo | Localização |
|------|-------|-----------|
| 1️⃣ Copiar SQL | 1 min | `CONSOLIDACAO_HISTORICO_RATEIO.sql` |
| 2️⃣ Executar no Supabase | 2 min | Supabase > SQL Editor > RUN |
| 3️⃣ Testar no Dashboard | 1 min | App > Balanço Cliente > Despesas |

**Total: ~4 minutos**

---

## 🔧 PASSO 1: Copiar o SQL

### 1.1 Abrir o arquivo SQL

```
📁 Projeto
  └─ CONSOLIDACAO_HISTORICO_RATEIO.sql  ← Abra este arquivo
```

### 1.2 Selecionar tudo

- **Windows/Linux**: `Ctrl + A`
- **Mac**: `Cmd + A`

### 1.3 Copiar

- **Windows/Linux**: `Ctrl + C`
- **Mac**: `Cmd + C`

---

## 🌐 PASSO 2: Executar no Supabase

### 2.1 Abrir Supabase

1. Vá para https://app.supabase.com
2. Faça login (se necessário)
3. Selecione seu **projeto**

![Supabase Dashboard](https://img.icons8.com/?size=100&id=GsYc75N8QKkW&format=png)

### 2.2 Acessar SQL Editor

```
Supabase Dashboard
├─ (Esquerda) SQL Editor  ← Clique aqui
│  └─ New Query
```

**Caminho:** 
```
https://app.supabase.com/project/[SEU_PROJECT]/sql
```

### 2.3 Colar o SQL

1. Clique na caixa de texto (editor branco vazio)
2. Cole o SQL
   - **Windows/Linux**: `Ctrl + V`
   - **Mac**: `Cmd + V`
3. Você deve ver:

```sql
-- ============================================================================
-- SCRIPT COMPLETO PARA CONSOLIDAR HISTÓRICO DE RATEIO
-- ============================================================================
-- 1. CRIAR TABELA historico_rateio_consolidado (se não existir)
-- ...
```

### 2.4 Executar

1. Clique em **RUN** (botão azul, canto superior direito)
2. Aguarde a execução

### 2.5 Verificar Resultado

Você deve ver no final:

```
✅ Consolidação histórica concluída! Total de registros: [número]
-- Mostrar amostra dos dados consolidados
id | cliente_nome | aeronave_registro | ... (resultado esperado)
```

Se tiver **erro**:
- Verifique se a tabela já existe
- Se existir, o SQL não vai recriar (usa `CREATE TABLE IF NOT EXISTS`)
- Continue assim mesmo para passo 3

---

## 💻 PASSO 3: Testar no Dashboard

### 3.1 Abrir a Aplicação

1. Vá para seu app em:
   - Desenvolvimento: `http://localhost:5173`
   - Produção: `https://seu-dominio.com`
2. Faça login

### 3.2 Navegar para Balanço Cliente

```
Dashboard (você vê)
├─ Menu (esquerda)
│  └─ Agenda
│     └─ Clientes
│        └─ Sócios / Conciliação
│           └─ Balanço Cliente  ← Clique aqui
```

Ou digite na URL: `/balanco-cliente`

### 3.3 Selecionar Filtros

Na página "Balanço Cliente", você verá:

```
┌─────────────────────────────────────────┐
│ Filtros                                 │
├─────────────────────────────────────────┤
│ Cliente / Sócio:    [Dropdown]  ← Select
│ Aeronave:           [Dropdown]
│ Data Início:        [Input]     ← 2025-11-01
│ Data Fim:           [Input]     ← 2026-01-31
└─────────────────────────────────────────┘
```

1. Clique em **"Cliente / Sócio"**
2. Selecione um cliente que tenha **rateios consolidados**
3. Defina **Data Início** e **Data Fim** apropriadas
4. (Opcional) Selecione **Aeronave**

### 3.4 Ir para Aba Despesas

```
┌──────────────────────────────────────────────┐
│ [Visão Geral] [Despesas] [Pendências] [...]  │
│               ↑ Clique aqui                  │
└──────────────────────────────────────────────┘
```

### 3.5 Verificar Tabela do Histórico

Você deve ver:

```
═══════════════════════════════════════════════════════════════════
  HISTÓRICO DE RATEIO CONSOLIDADO
═══════════════════════════════════════════════════════════════════

┌──────┬─────────┬──────────┬───────┬──────────┬────────────┬────────┐
│ Data │Aeronave │Categoria │ Horas │Percentual│Valor Rate │Reemb..│
├──────┼─────────┼──────────┼───────┼──────────┼────────────┼────────┤
│11/01 │ PR-ABC  │Combustível│ 10.50│  25.30% │ R$ 250,00  │   ♻️  │
│11/01 │ PR-ABC  │ Manutenção│  5.20│  12.15% │ R$ 150,00  │  Não  │
│11/02 │ PR-XYZ  │ Combustível│ 8.75│  18.90% │ R$ 180,00  │   ♻️  │
└──────┴─────────┴──────────┴───────┴──────────┴────────────┴────────┘
```

Se **não ver nada**, significa que:
- ❌ Não há rateios consolidados nesse período
- ✅ Vá criar um rateio e consolidar

---

## 📊 O QUE VOCÊ VERÁ NA TABELA

### Colunas:

| Coluna | Significado | Exemplo |
|--------|------------|---------|
| **Data Competência** | Mês/ano do lançamento | 01/11/2025 |
| **Aeronave** | Registro da aeronave | PR-ABC |
| **Categoria** | Tipo de despesa | Combustível |
| **Horas** | Horas voadas pelo cliente | 10.50h |
| **Percentual** | % de uso da aeronave | 25.30% |
| **Valor Rateado** | Quanto custou para o cliente | R$ 250,00 |
| **Reembolso** | É reembolsável? | ♻️ Sim / Não |

### Cards de Estatísticas (acima da tabela):

```
┌─────────────────────────────────────────────────────────┐
│ Total: 15        │ Valor: R$ 5.000,00 │ Horas: 150,00h │ Reemb: 8
│ registros        │ valor rateado      │ voadas        │ reembolsos
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 TESTES RECOMENDADOS

### ✅ Teste 1: Filtrar por Categoria

```
1. Na tabela, encontre "Categoria" (dropdown no topo)
2. Selecione "REEMBOLSOS"
3. Esperado: tabela mostra apenas reembolsos
4. Valores e Horas mudam
```

### ✅ Teste 2: Filtrar por Tipo

```
1. Encontre "Tipo" (dropdown no topo)
2. Selecione "Apenas Reembolsos"
3. Esperado: mostra somente com ♻️ Reembolso
```

### ✅ Teste 3: Exportar CSV

```
1. Clique em "Exportar CSV" (botão com ⬇️)
2. Arquivo baixa: historico-rateio-2025-12-20.csv
3. Abra em Excel ou Google Sheets
```

---

## 🚨 TROUBLESHOOTING

### ❌ Problema: "Nenhum histórico encontrado"

```
Causa provável:
└─ Não há rateios consolidados nesse período

Solução:
├─ 1. Verifique a data selecionada
├─ 2. Crie um rateio (se não tiver)
├─ 3. Marque como "consolidado"
└─ 4. Aguarde 5 segundos
└─ 5. Recarregue a página (F5)
```

### ❌ Problema: Coluna "Horas" com valor 0

```
Causa provável:
└─ Não há registros de horas voadas

Solução:
├─ 1. Verifique Diário de Bordo
├─ 2. Registre horas voadas
├─ 3. Data deve bater com data do rateio
└─ 4. Aguarde consolidação
```

### ❌ Problema: Tabela não aparece

```
Causa provável:
└─ Componente não foi integrado corretamente

Solução:
├─ 1. Verifique console (F12 > Console)
├─ 2. Procure por erros em vermelho
├─ 3. Recarregue a página (F5)
├─ 4. Limpe cache (Ctrl+Shift+Delete)
└─ 5. Se persistir, revise os arquivos criados
```

---

## 📱 VERSÃO MOBILE

A tabela é **responsiva**. No celular você verá:

```
Histórico de Rateio Consolidado
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 01/11/2025
   PR-ABC | Combustível
   10.50h | 25.30%
   R$ 250,00 | ♻️ Reembolso

📅 01/11/2025
   PR-ABC | Manutenção
   5.20h | 12.15%
   R$ 150,00 | Não
```

(Empilhado verticalmente)

---

## 🎯 FLUXO COMPLETO (Do início ao fim)

```
1. CRIAR RATEIO (Você faz no UI)
   └─ Acesso formulário de recibos/rateios
   └─ Preenche: cliente, valor, categoria
   └─ Clica "Salvar"

2. SISTEMA CRIA
   └─ Registro em rateio_despesas
   └─ Registro em bank_reconciliations (status: pendente)

3. CONSOLIDAR (Você muda o status)
   └─ Acessa lista de despesas
   └─ Clica "Consolidar" ou "Marcar como pago"
   └─ Status muda para "consolidado"

4. TRIGGER AUTOMÁTICO
   └─ Dispara consolidar_despesas_para_historico()
   └─ Busca horas voadas
   └─ Calcula percentual
   └─ Insere em historico_rateio_consolidado

5. DASHBOARD BUSCA
   └─ Hook useHistoricoRateioConsolidado()
   └─ Query SQL
   └─ Retorna array de registros

6. COMPONENTE EXIBE
   └─ Renderiza tabela
   └─ Aplica filtros
   └─ Mostra estatísticas

7. USUÁRIO VÊ
   └─ Tabela com dados
   └─ Filtros funcionando
   └─ Opção de exportar
```

---

## 💡 DICAS IMPORTANTES

✅ **Sempre que criar um novo rateio:**
1. Verifique se a categoria tem grupo permitido
2. Certifique-se que tem horas voadas registradas
3. Marque como "consolidado" quando estiver pronto

✅ **Se dados não aparecem:**
1. Recarregue a página (F5)
2. Limpe cache do navegador (Ctrl+Shift+Delete)
3. Verifique console (F12)

✅ **Para melhor experiência:**
1. Use datas com registros de rateios
2. Crie vários rateios em meses diferentes
3. Teste filtros em cada um

---

## 📞 PRÓXIMOS PASSOS

Após confirmar que está funcionando:

1. ✅ Leia `GUIA_INTEGRACAO_HISTORICO.md` (mais detalhado)
2. ✅ Explore as queries SQL de exemplo
3. ✅ Configure suas categorias apropriadas
4. ✅ Treine usuários sobre como usar
5. ✅ Considere feedback para futuras melhorias

---

**Pronto! Agora você tem um sistema completo de histórico consolidado! 🎉**

