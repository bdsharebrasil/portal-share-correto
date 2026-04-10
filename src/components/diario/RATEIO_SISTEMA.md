# Sistema Dual: Cliente Específico ou Rateio Igual

## Visão Geral

O sistema de Diário de Bordo Detalhes implementa um modelo **dual** para alocação de custos de voos:

### Dois Modos de Operação

#### 1. **Modo Cliente Específico** (padrão)
- ✅ Selecione um cliente/cotista específico
- Custos do voo (combustível, diárias, etc.) são totalmente atribuídos ao cliente
- Use para: Voos fretados, executivos, serviços aéreos

#### 2. **Modo Rateio Igual** (compartilhado entre sócios)
- ✅ Marque a opção "Rateio Igual (Sócios)"
- Custos do voo são **divididos igualmente** entre TODOS os sócios da aeronave
- Não é necessário selecionar um cliente específico
- Custo por sócio = Custo Total ÷ Número de Sócios

---

## Tipos Especiais de Voo para Rateio

Quando você marca "Rateio Igual", deve selecionar um dos seguintes tipos de voo:

### 1. **CQ - Cheque (Voo de Verificação)**
- Voos de verificação de manutenção
- Teste de sistemas da aeronave
- Custos compartilhados entre sócios

### 2. **TR - Traslado (Ferry/Posicionamento)**
- Voos para reposicionar a aeronave
- Ferry between bases
- Custos compartilhados entre sócios

### 3. **TN - Teste (Manutenção/Teste)**
- Voos de teste pós-manutenção
- Verificação de performance
- Custos compartilhados entre sócios

---

## Como Usar

### Registrando um Voo de Cliente Específico

1. **Abra o formulário** "Novo Lançamento"
2. **Deixe desmarcado** "Rateio Igual (Sócios)" (padrão)
3. **Selecione o Cliente** no dropdown
4. **Preencha os dados** do voo (origem, destino, horários, etc.)
5. **Salve o voo** → Custo será atribuído ao cliente selecionado

### Registrando um Voo de Rateio

1. **Abra o formulário** "Novo Lançamento"
2. **Marque** "Rateio Igual (Sócios)" ✓
3. **Selecione o Tipo de Voo** (CQ, TR ou TN)
4. **Preencha os dados** do voo (origem, destino, horários, etc.)
5. **Salve o voo** → Custo será dividido entre todos os sócios

---

## Cálculo de Custos

### Fórmula de Rateio

```
Custo por Sócio = Custo Total do Voo ÷ Número de Sócios

Exemplo:
- Voo de check realizado
- Combustível: R$ 500,00
- Número de sócios: 4
- Custo por sócio: R$ 500,00 ÷ 4 = R$ 125,00 cada
```

### Custo Total do Voo

O custo total inclui:
- Combustível abastecido
- Serviços de pouso/handling (se aplicável)
- Diárias (se aplicável)
- Outros custos operacionais

---

## Exemplo Prático

### Cenário 1: Voo Fretado (Cliente Específico)

| Campo | Valor |
|-------|-------|
| Data | 15/12/2024 |
| Cliente | João Aviation |
| Modo | Cliente Específico |
| Origem | SBCY |
| Destino | SBMT |
| Combustível | R$ 300 |
| **Alocação** | **100% para João Aviation** |

### Cenário 2: Voo de Cheque (Rateio)

| Campo | Valor |
|-------|-------|
| Data | 16/12/2024 |
| Tipo | CQ - Cheque |
| Modo | Rateio Igual |
| Sócios | 4 (João, Maria, Pedro, Ana) |
| Origem | SBCY |
| Destino | SBCY |
| Combustível | R$ 400 |
| **Alocação** | **R$ 100 cada (400 ÷ 4)** |

---

## Dados no Banco

### Campo `is_equal_split`

```
is_equal_split = true  → Voo de rateio (custos divididos)
is_equal_split = false → Voo de cliente (custos atribuídos)
```

### Quando `is_equal_split = true`
- `client_id` = null (nenhum cliente específico)
- `flight_nature` = CQ, TR ou TN
- Custos são calculados em relação ao número total de sócios

### Quando `is_equal_split = false`
- `client_id` = ID do cliente selecionado
- `flight_nature` = Qualquer tipo disponível
- Custos são 100% do cliente

---

## Query de Exemplo (SQL)

```sql
-- Calcular custo por cliente considerando rateio
SELECT 
  le.id,
  le.entry_date,
  le.flight_nature,
  le.is_equal_split,
  le.client_id,
  le.fuel_added,
  CASE 
    WHEN le.is_equal_split THEN 
      le.fuel_added / (SELECT COUNT(*) FROM aircraft_partners WHERE aircraft_id = le.aircraft_id)
    ELSE 
      le.fuel_added
  END as cost_per_entity
FROM logbook_entries le
WHERE le.aircraft_id = ?
ORDER BY le.entry_date DESC;
```

---

## Validações

### Ao Salvar um Voo

✅ **Obrigatório:**
- PIC (Comandante)
- Origem (Aeródromo de Partida)
- Destino (Aeródromo de Chegada)
- Horários (Acionamento e Corte)

✅ **Condicionado:**
- Se `is_equal_split = false` → Cliente é obrigatório
- Se `is_equal_split = true` → Tipo de voo é obrigatório (CQ, TR ou TN)

### Não é Possível

❌ Deixar tanto "Rateio" quanto "Cliente" vazios
❌ Selecionar cliente E marcar rateio (uma coisa exclui a outra)

---

## Visualização na Tabela

Na tabela de voos do período:

- **Voo de Cliente**: Mostra o nome do cliente (ex: "João")
- **Voo de Rateio**: Mostra "Rateio" em fundo verde

```
Data    | De   | Para | Diárias | Voo Para | Ações
--------|------|------|---------|----------|-------
15/12   | SBCY | SBMT | 0       | João     | ✎ 🗑
16/12   | SBCY | SBCY | 0       | Rateio   | ✎ 🗑
```

---

## Edição de Voos

Ao editar um voo existente:

1. **Abra o modal de edição** (clique no ✎)
2. **Você pode alterar** entre cliente e rateio
3. **Se mudar de Cliente para Rateio:**
   - Cliente será limpo automaticamente
   - Tipo de voo (CQ/TR/TN) será necessário
4. **Se mudar de Rateio para Cliente:**
   - O campo cliente ficará visível
   - Selecione o cliente desejado
5. **Salve as alterações**

---

## Dicas e Boas Práticas

### ✅ Recomendações

- **Organizar por tipo**: Mantenha voos de mesmo cliente agrupados para facilitar análise
- **Nomes descritivos**: Use nomes de clientes claros e consistentes
- **Backup de dados**: Exporte mensalmente para análise financeira
- **Recalcular diárias**: Use "Recalcular Diárias do Período" após grandes mudanças

### ⚠️ Cuidados

- **Não misture modos**: Cada voo é OU cliente OU rateio
- **Tipo de voo**: Para rateio, sempre selecione um tipo específico
- **Verificar sócios**: Confirme o número de sócios antes de criar voos de rateio
- **Edições futuras**: Se editar um voo de rateio, considere o impacto na análise de custos

---

## Suporte

Se tiver dúvidas sobre o sistema de rateio:
1. Revise esta documentação
2. Verifique os exemplos práticos acima
3. Teste em ambiente de desenvolvimento primeiro
4. Consulte o administrador do sistema

---

**Versão**: 1.0  
**Última atualização**: Dezembro 2024  
**Sistema**: Diário de Bordo Detalhes - Share Brasil
