# 💰 Guia Completo do Fluxo Financeiro
## Share Brasil - Portal Colaborador

Este guia explica passo a passo como usar cada módulo do fluxo financeiro da Share Brasil. Ele foi dividido em 5 partes principais para facilitar sua compreensão.

---

## 📑 Índice
1. [Pagamentos de Contas Gerais](#-1-pagamentos-de-contas-gerais)
2. [Gestão de Salários](#-2-gestão-de-salários)
3. [Conciliação Bancária](#-3-conciliação-bancária)
4. [Emissão de Recibos](#-4-emissão-de-recibos)
5. [Relatório de Viagem](#-5-relatório-de-viagem)

---

## 🎯 1. Pagamentos de Contas Gerais

### O que é?
Este módulo gerencia contas a pagar (dinheiro que a empresa deve) e contas a receber (dinheiro que a empresa tem a receber). É como um caderno de débitos e créditos.

### Onde acessar?
**Financeiro → Gestão Fiscal**

### Como usar Contas a Pagar?

#### Criar uma nova conta a pagar
1. Clique em **"Gestão Fiscal"** no menu
2. Vá para a aba **"Contas a Pagar"**
3. Clique em **"+ Nova Conta"**
4. Preencha os dados:
   - **Fornecedor**: Quem você deve pagar (ex: empresa de combustível)
   - **Descrição**: O que é a despesa (ex: abastecimento de aeronave)
   - **Valor**: Quanto deve ser pago
   - **Data de Vencimento**: Quando precisa pagar
   - **Categoria**: Tipo de despesa (combustível, manutenção, etc.)
5. Clique em **"Salvar"**

#### Agendar um pagamento
Se a conta será paga regularmente:
1. Na conta criada, clique em **"Agendar Pagamento"**
2. Selecione a data de pagamento
3. Se for recorrente, marque a opção **"Recorrente"**
4. Clique em **"Salvar"**

#### Marcar como paga
Quando o pagamento é realizado:
1. Clique na conta na lista
2. Clique em **"Marcar como Paga"**
3. Selecione a **conta bancária** onde o dinheiro saiu
4. (Opcional) Faça upload do comprovante de pagamento
5. Clique em **"Confirmar"**

**O que acontece automaticamente:**
- A conta muda para status "Paga"
- Cria automaticamente uma entrada no fluxo de caixa (registro de saída de dinheiro)
- A conciliação bancária é atualizada

---

### Como usar Contas a Receber?

#### Criar uma nova conta a receber
1. Clique em **"Gestão Fiscal"** no menu
2. Vá para a aba **"Contas a Receber"**
3. Clique em **"+ Nova Conta"**
4. Preencha os dados:
   - **Cliente**: Quem deve lhe pagar
   - **Descrição**: O que foi prestado/vendido
   - **Valor**: Quanto deve receber
   - **Data de Vencimento**: Quando espera receber
   - **Categoria**: Tipo de receita
5. (Opcional) Faça upload da Nota Fiscal em PDF
6. Clique em **"Salvar"**

#### Marcar como recebida
Quando o cliente paga:
1. Clique na conta na lista
2. Clique em **"Marcar como Recebido"**
3. Selecione a **conta bancária** onde o dinheiro entrou
4. (Opcional) Faça upload do comprovante
5. Clique em **"Confirmar"**

**O que acontece automaticamente:**
- A conta muda para status "Recebido"
- Cria automaticamente uma entrada no fluxo de caixa (registro de entrada de dinheiro)
- Atualiza a conciliação bancária

---

## 💼 2. Gestão de Salários

### O que é?
Este módulo permite gerenciar salários dos colaboradores, holerites (contracheques) e cálculos de benefícios. Você pode ver histórico de pagamentos e documentos.

### Onde acessar?
**Financeiro → Gestão de Salários**

### Como funciona?

#### Visualizar salários dos colaboradores
1. Clique em **"Gestão de Salários"**
2. Escolha o mês e ano que deseja visualizar
3. Será exibida uma lista de todos os colaboradores com:
   - Salário base
   - Benefícios (alimentação, transporte, etc.)
   - Descontos (INSS, IR, etc.)
   - Salário líquido final

#### Visualizar holerites (contracheques)
1. Vá para a aba **"Holerites"**
2. Clique em um colaborador para ver seus contracheques
3. Você pode:
   - **Visualizar** cada holerite
   - **Baixar** em PDF
   - **Imprimir** diretamente

#### Gerenciar férias
1. Vá para a aba **"Férias"**
2. Configure o saldo de dias de férias para cada colaborador
3. O sistema calcula automaticamente o valor de férias gozadas
4. Aprove solicitações de férias dos colaboradores

#### Gerenciar 13º salário
1. Vá para a aba **"13º Salário"**
2. O sistema mostra quanto cada colaborador tem direito
3. Você pode:
   - **Parcelar** em 2 ou 3 vezes
   - **Marcar como pago**
   - **Gerar comprovante**

#### Calcular benefícios
Se precisa calcular auxílios ou benefícios especiais:
1. Clique em **"Calculadora de Benefícios"**
2. Selecione o colaborador
3. Insira o valor a ser beneficiado
4. O sistema mostra o cálculo final
5. Clique em **"Salvar"** para registrar

---

## 🏦 3. Conciliação Bancária

### O que é?
Conciliação é o processo de conferir se o dinheiro que você registrou está correto com o que o banco mostra. Você concilia contas de clientes e colaboradores.

### Onde acessar?
**Financeiro → Conciliação Bancária**

### Fluxo passo a passo

#### Passo 1: Criar uma Conciliação

1. Clique em **"Conciliação Bancária"**
2. Escolha a aba:
   - **"Clientes"** - se é para receber de um cliente
   - **"Colaborador"** - se é para pagar um colaborador
3. Clique em **"+ Nova Conciliação"**
4. Preencha os dados:
   - **Tipo**: Selecione Cliente ou Colaborador
   - **Cliente/Colaborador**: Quem envolve a conciliação
   - **Aeronave** (se aplicável): Qual aeronave está envolvida
   - **Valor**: Quanto deve ser conciliado
   - **Categoria**: Tipo de despesa/receita
   - **Descrição**: Detalhes adicionais
   - **Data de Vencimento**: Quando deve ser finalizado
5. Clique em **"Salvar"**

**Status inicial:** A conciliação começa como **PENDENTE** (não foi enviada ainda)

---

#### Passo 2: Enviar para Conferência

Quando a conciliação está pronta para ser conferida:

1. Na conciliação criada, clique em **"Enviar por Email"**
2. A conciliação muda para status **"ENVIADO"**

**O que acontece automaticamente:**
- ✅ Cria uma **Conta a Receber** (se cliente) ou **Conta a Pagar** (se colaborador)
- ✅ A conta recebe um número automático:
  - **CR-0001/24** (Conta a Receber - 2024)
  - **CP-0001/24** (Conta a Pagar - 2024)
- ✅ A conta fica vinculada à conciliação

**Exemplo prático:**
- Você cria conciliação do cliente "Viações Silva" de R$ 5.000
- Clica em "Enviar"
- Automaticamente cria "Conta a Receber" CR-0001/24 de R$ 5.000
- O cliente pode agora conferir e confirmar

---

#### Passo 3: Conferir/Receber o Pagamento

Quando você recebe o dinheiro ou o cliente/colaborador confirma:

1. Na conciliação, clique no ícone **"Conferido"** (cliente) ou **"Pago"** (colaborador)
2. Uma janela abre pedindo:
   - **Conta Bancária**: Qual banco recebeu/pagou o dinheiro
   - **Comprovante**: (Opcional) PDF do comprovante do banco
3. Clique em **"Atualizar"**

**O que acontece automaticamente:**
- ✅ Status muda para **"CONFERIDO"** (cliente) ou **"PAGO"** (colaborador)
- ✅ Cria uma entrada no **Fluxo de Caixa**:
  - **Entrada de dinheiro** (RECEITA) - se cliente
  - **Saída de dinheiro** (DESPESA) - se colaborador
- ✅ Registra a referência no banco:
  - **REC-{número}** para cliente
  - **PAG-{número}** para colaborador
- ✅ Marca como finalizado na conciliação

---

#### Sincronização automática

A conciliação está conectada com o módulo de Contas a Pagar/Receber:

**Cenário 1:** Você marca a conta como paga/recebida
- → Status da conciliação atualiza automaticamente
- → Cria entrada no fluxo de caixa

**Cenário 2:** Você marca a conciliação como conferida/paga
- → Status da conta atualiza automaticamente
- → Cria entrada no fluxo de caixa

**Nenhum dos dois precisa ser feito em duplicado!**

---

#### Caso especial: Conciliação de Viagem

Se a conciliação inclui um relatório de viagem:

1. Na descrição, mencione **"RELATORIO DE VIAGEM"**
2. Quando marca como conferida/paga
3. O status do relatório de viagem também atualiza automaticamente
4. Fica tudo sincronizado

---

## 📄 4. Emissão de Recibos

### O que é?
Um recibo é um documento que comprova que você recebeu dinheiro de alguém. Aqui você cria, visualiza e baixa recibos em PDF.

### Onde acessar?
**Financeiro → Emissão de Recibos**

### Como emitir um recibo?

#### Passo 1: Preencher os dados
1. Clique em **"Emissão de Recibos"**
2. Clique em **"Emitir Novo Recibo"**
3. Preencha os campos:
   - **Tipo**: Escolha entre:
     - **Pagamento**: Para recebimentos de clientes
     - **Reembolso**: Para devoluções ou reembolsos
   - **Pagador**: Quem está pagando (obrigatório)
   - **Valor**: Quanto está sendo recebido
   - **Descrição**: O que está sendo pago (ex: "Serviço de transporte aéreo")
   - **Data de Vencimento**: Até quando é válido o recibo
   - **Cliente/Aeronave**: Se aplicável
4. Clique em **"Gerar Recibo"**

**O que acontece automaticamente:**
- ✅ Um número único é gerado para o recibo
- ✅ O sistema gera automaticamente um **PDF** com:
  - Dados da empresa (Share Brasil)
  - Dados de quem pagou
  - Valor e descrição
  - Assinatura digital
  - Data e hora
- ✅ O recibo fica salvo no sistema

---

#### Passo 2: Visualizar e Baixar
1. Clique na aba **"Histórico"**
2. Você vê todos os recibos já emitidos
3. Clique em um recibo para:
   - **Visualizar** em PDF
   - **Baixar** para seu computador
   - **Imprimir** diretamente
   - **Deletar** (se ainda não foi usado)

---

#### Caso especial: Reembolso
Se o tipo for **"Reembolso"**:
1. Preencha os dados normalmente
2. O sistema pode criar automaticamente uma **Conciliação de Reembolso**
3. Isso facilita depois para marcar como pago/recebido

---

### Exemplo prático
```
Situação: Um cliente pagou R$ 2.500 pelo serviço de manutenção

1. Vá para "Emissão de Recibos"
2. Clique "Emitir Novo Recibo"
3. Tipo: "Pagamento"
4. Pagador: "Cliente A"
5. Valor: "R$ 2.500"
6. Descrição: "Manutenção de aeronave em Janeiro"
7. Clique "Gerar Recibo"
8. Sistema cria um PDF automático (ex: REC-2024-001)
9. Clique em "Baixar" para salvar no computador
10. Envie para o cliente ou guarde nos arquivos
```

---

## ✈️ 5. Relatório de Viagem

### O que é?
Um relatório de viagem registra todas as despesas de uma viagem (hospedagem, refeições, transporte, etc.) e gera um documento PDF para comprovação.

### Onde acessar?
**Financeiro → Relatório de Viagem**

### Como criar um relatório?

#### Passo 1: Iniciar novo relatório
1. Clique em **"Relatório de Viagem"**
2. Clique em **"+ Novo Relatório"**
3. Preencha os dados iniciais:
   - **Colaborador**: Quem fez a viagem
   - **Data de Início**: Quando começou
   - **Data de Término**: Quando terminou
   - **Destino**: Aonde foi
   - **Motivo**: Qual foi o objetivo (reunião, inspeção, etc.)
   - **Responsável Aprovação**: Quem vai aprovar

#### Passo 2: Adicionar despesas
A partir daqui, você adiciona cada despesa da viagem:

1. Clique em **"+ Adicionar Despesa"**
2. Para cada despesa, preencha:
   - **Data**: Quando gastou
   - **Tipo**: Que tipo de despesa:
     - 🍽️ Alimentação
     - 🏨 Hospedagem
     - 🚗 Transporte
     - ✈️ Passagem Aérea
     - 📞 Telefone
     - 📋 Outros
   - **Descrição**: Detalhes (ex: "Hotel 3 noites", "Uber airport")
   - **Valor**: Quanto custou
   - **Comprovante**: Faça upload do recibo/nota fiscal
3. Clique em **"Salvar Despesa"**
4. Repita para cada despesa da viagem

---

#### Passo 3: Revisar totalizações
O sistema calcula automaticamente:
- **Total por tipo** (quanto gastou em alimentação, hospedagem, etc.)
- **Total geral** de toda a viagem
- **Moeda** (se viagem internacional)

Você pode revisar e editar antes de finalizar.

---

#### Passo 4: Salvar como rascunho
1. Clique em **"Salvar Rascunho"**
2. O relatório fica guardado para editar depois
3. Você pode voltar a qualquer hora para adicionar mais despesas

---

#### Passo 5: Finalizar relatório
Quando todas as despesas foram adicionadas:

1. Clique em **"Finalizar Relatório"**
2. O sistema:
   - ✅ Bloqueia edições (não pode mais alterar)
   - ✅ Gera um PDF automático com:
     - Dados da viagem
     - Todos os comprovantes
     - Totalizações
     - Data de finalização
   - ✅ Muda o status para **"FINALIZADO"**

---

#### Passo 6: Submeter para aprovação (Opcional)
Se o relatório precisa de aprovação:

1. Clique em **"Submeter para Aprovação"**
2. O responsável aprovador recebe notificação
3. Ele pode:
   - **Aprovar** → Relatório fica "APROVADO"
   - **Rejeitar** → Volta para editar

---

#### Passo 7: Conciliar relatório
Se este relatório envolve reembolso:

1. Vá para **Conciliação Bancária**
2. Crie uma nova conciliação
3. Na descrição, coloque **"RELATORIO DE VIAGEM"**
4. Siga os passos normais de conciliação
5. Quando você marca como conferida/paga
6. O relatório de viagem sincroniza automaticamente

---

### Exemplo prático
```
Situação: Um colaborador fez viagem para São Paulo

1. Clique "Novo Relatório"
2. Colaborador: "João Silva"
3. Destino: "São Paulo"
4. Motivo: "Reunião com cliente"
5. Datas: 01/02/2024 a 03/02/2024

Despesas adicionadas:
- 01/02: Passagem aérea - R$ 800
- 01/02: Hotel 2 noites - R$ 600
- 02/02: Alimentação - R$ 120
- 02/02: Uber/taxi - R$ 150
- 03/02: Alimentação - R$ 80
- 03/02: Passagem aérea volta - R$ 800

Total: R$ 2.550

Clique "Finalizar Relatório"
→ PDF gerado com todas as despesas
→ Status muda para "FINALIZADO"

Se for reembolsar:
→ Cria conciliação no banco
→ Marca como paga
→ Relatório sincroniza automaticamente
```

---

## 🔗 Como os 5 módulos trabalham juntos

```
┌─────────────────────────────────────────────────────────────┐
│                  FLUXO COMPLETO FINANCEIRO                  │
└─────────────────────────────────────────────────────────────┘

1. CONTAS A PAGAR/RECEBER (Registro de débitos e créditos)
   ↓
2. CONCILIAÇÃO BANCÁRIA (Conferência com o banco)
   ↓
3. FLUXO DE CAIXA (Registro de entrada/saída de dinheiro)
   ↓
4. RECIBOS (Comprovantes de pagamento)
   ↓
5. RELATÓRIO DE VIAGEM (Despesas de viagem finalizadas)
```

### Exemplo real integrado:
```
CENÁRIO: Cliente paga uma fatura e você quer rastrear tudo

1. CONTAS A RECEBER
   → Cria "Conta a Receber" do cliente por R$ 5.000

2. CONCILIAÇÃO BANCÁRIA
   → Cliente recebe e confirma o pagamento
   → Você marca como "CONFERIDO"
   → Fluxo de caixa atualiza automaticamente

3. FLUXO DE CAIXA
   → Registra entrada de R$ 5.000 na conta bancária
   → Com referência REC-0001

4. RECIBOS
   → Emite um recibo comprovando o recebimento
   → PDF gerado automaticamente

5. RELATÓRIO (se houver viagem)
   → Se foi viagem do cliente, sincroniza automaticamente
```

---

## ⚠️ Dicas Importantes

### ✅ O que sempre fazer:
- Preencha com cuidado os valores (revisão dupla evita erros)
- Use categorias corretas (facilita relatórios depois)
- Guarde comprovantes (para auditoria)
- Sincronize regularmente (confira se dados batem com o banco)

### ❌ O que evitar:
- Criar contas duplicadas (verifique antes de criar)
- Editar dados após marcar como finalizado
- Esquecer comprovantes (difícil recuperar depois)
- Deixar contas pendentes muito tempo (organize-se)

### 🔄 Sincronização automática:
- A conciliação atualiza a conta → A conta atualiza a conciliação
- Ninguém precisa fazer duas vezes
- Tudo fica consistente automaticamente

---

## 📞 Ajuda e Dúvidas

Se tiver dúvidas durante o uso:
1. Revise esta documentação
2. Procure na seção ["Como usar"] do módulo em questão
3. Entre em contato com a equipe de suporte

---

**Versão:** 1.0  
**Última atualização:** 2024  
**Empresa:** Share Brasil  
