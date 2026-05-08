# Refatoração — Lançamento Financeiro Cotista

## 1. Pagador "Cliente" com rateio automático igualitário

No seletor **Pagador** adicionar 3 opções fixas + lista de sócios:
- `EMPRESA` — Empresa (Share Brasil) — paga e gera reembolso devido pelos sócios
- `CLIENTE` — Cliente (PJ) — paga e divide automaticamente entre sócios em partes **iguais** (100/N), ignorando o `percentual_participacao` cadastrado
- `SOCIO:<id>` — um sócio específico paga (mantém comportamento atual)

Quando `CLIENTE` é selecionado:
- Forçar `rateios[i].percentual = 100/N` para todos os sócios
- `valor_pago_real` permanece 0 por sócio (quem pagou foi o cliente PJ, não o sócio)
- `fluxo = "cliente"`, `pago_por = razao_social` do cliente, `pago_diretamente = true`
- `fornecedor_nome` na movimentacao = `razao_social` do cliente
- Bloquear edição manual dos % (mostrar travado com badge "Rateio igualitário automático")
- Mostrar painel com cada sócio recebendo `valor_total / N` exibido logo abaixo

## 2. Formulário inline (sem Dialog) + UI moderna

- **Remover** `LancamentoDialog` como `<Dialog>`. Converter o conteúdo em um componente `LancamentoFormInline` renderizado diretamente dentro do `LancamentoForm.tsx` (rota já existe).
- Substituir `<Select>` por `SearchableCombobox` em: Grupo de custo, Pagador, Status, Categoria, Aeronave (quando aplicável).
- Substituir `<Input type="date">` pelo componente híbrido padrão do projeto (máscara `dd/mm/aaaa` + popover de calendário escuro `z-[9999]`) — usar `MaskedDateInput` / padrão já documentado em `mem://design/date-input-standard`.
- Layout largo `max-w-7xl`, `gap-6`, cards com glassmorphism alinhados com o resto do projeto.
- **Corrigir botão "Voltar para clientes"** em `FinanceiroCotistaDetalhe`: hoje está abrindo o formulário; deve navegar para `/financeiro/financeiro-cotistas` (lista de clientes). Investigar handler atual e separar do botão de "Novo lançamento".

## 3. Alinhamento de campos com `rateio_despesas`

Adicionar ao formulário os campos faltantes (que existem na tabela mas não estão no form):
- `aeronave_registro` (auto-preenchido a partir da aeronave selecionada)
- `categoria_custo` (texto livre OU lookup de categoria — usar combobox de `categorias_movimentacao`)
- `categoria_id` (já vinculado via combobox acima)
- `numero_doc`, `numero_nf`, `numero_boleto`, `numero_recibo`
- `data_vencimento` separado de `data_pagamento`
- `forma_pagamento` (combobox: PIX, TED, Boleto, Dinheiro, Cartão)
- `periodicidade` (combobox: única, mensal, trimestral, anual)

**Seção "Anexos"** — bloco único com lista dinâmica:
- Cada linha: combobox de tipo (`comprovante` | `recibo` | `nota_fiscal` | `boleto`) + input file
- Botão `+ Adicionar anexo` permite empilhar múltiplos
- Upload para Supabase Storage (bucket `documentos-financeiros` ou similar já existente) e gravar URL no campo correto: `comprovante_url`, `recibo_url`, `nf_url`, `boleto_url`
- Validação de URLs permissiva (sem pre-fetch — `mem://infra/pdf-validation-strategy`)

## 4. Revisão dos espelhos em `movimentacoes`

Validar e corrigir o ciclo completo de espelhamento para um lançamento de Financeiro Cotista. Hoje o fluxo grava em 3 pontos; precisa garantir consistência:

```text
movimentacoes (despesa principal)
   ├─→ rateio_despesas (1 linha por sócio)        ← OK hoje
   ├─→ partner_transactions (debit por sócio)     ← só quando pago
   └─→ partner_accounts (recálculo de saldo)      ← já feito
```

Pontos a corrigir:
- Quando `pagador = CLIENTE`: NÃO gerar `partner_transactions` (cliente paga direto, não consome saldo do sócio). Apenas `rateio_despesas` com `fluxo = "cliente"`.
- Quando `pagador = EMPRESA`: Gerar **espelho de receita futura** em `movimentacoes` com `reference_type = "rateio_reembolso"` e `reference_id = movId` para rastrear o reembolso devido pelos sócios. (hoje só existe `reembolsavel = true` sem espelho)
- Garantir `reference_type = "rateio_despesa"` na própria `movimentacao` original para idempotência e diferenciação dos demais módulos.
- Em `delMutation`: já remove `partner_transactions` e `rateio_despesas`; adicionar remoção do espelho de reembolso por `reference_type` se existir.
- Usar helper centralizado novo `src/lib/cotistaFinanceSync.ts` (padrão dos outros syncs: `nfSaidaFinanceSync.ts`, `partnerFinanceSync.ts`) com funções `syncCotistaLancamento` / `deleteCotistaLancamentoMirror`.

## Arquivos afetados

- `src/components/dashboard/gestor/FinanceiroCotista/LancamentosTab.tsx` — remover Dialog, manter só a tabela
- `src/components/dashboard/gestor/FinanceiroCotista/LancamentoForm.tsx` — passar a renderizar o form inline (não mais `<LancamentoDialog open>`)
- `src/components/dashboard/gestor/FinanceiroCotista/FinanceiroCotistaDetalhe.tsx` — corrigir botão "Voltar para clientes"
- `src/components/dashboard/gestor/FinanceiroCotista/LancamentoFormInline.tsx` — **NOVO** componente de formulário moderno
- `src/lib/cotistaFinanceSync.ts` — **NOVO** helper de sincronização e espelhos
- (eventual) migration para criar bucket de storage se não existir

## Confirmação necessária antes de implementar

1. **Bucket de Storage para anexos** — usar bucket existente (qual?) ou criar novo `documentos-cotistas`?
2. **Rateio igualitário do Cliente** — confirma ignorar o `percentual_participacao` cadastrado e usar 100/N? Ou usar o percentual de cada sócio mesmo assim?
3. **Espelho de reembolso (EMPRESA paga)** — devo criar a contrapartida automática como receita pendente em `movimentacoes`, ou manter apenas como `reembolsavel=true` (visível só nos relatórios)?
