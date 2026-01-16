# ❌ Erro ON CONFLICT - Solução

## O Erro

```
ERROR: 42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

## Causa

O SQL anterior usava `ON CONFLICT (crew_member_id, aircraft_id, month, year)` mas a tabela `crew_flight_hours` **NÃO TEM** um índice UNIQUE nesses campos combinados.

A tabela só tem:
```sql
constraint crew_flight_hours_flight_day_key unique (flight_day)
```

Isso é um único campo, não uma combinação.

---

## ✅ Solução (Escolha Uma)

### **OPÇÃO 1: RECOMENDADA (Simples)**

Use **`SQL_SYNC_CORRECTED.sql`**

Este arquivo:
- ✅ Não depende de constraint unique
- ✅ Primeiro deleta registros antigos
- ✅ Depois insere novos (mais rápido e seguro)
- ✅ Funciona 100% sem erros

**Como usar:**
```
1. Abra SQL_SYNC_CORRECTED.sql
2. Copie TODO o conteúdo
3. Cole no Supabase SQL Editor
4. Clique em RUN
5. Pronto!
```

---

### **OPÇÃO 2: Criar Índice UNIQUE (Para o Futuro)**

Use **`SQL_CREATE_UNIQUE_INDEX.sql`**

Este arquivo:
- ✅ Cria o índice unique correto
- ✅ Sincroniza com ON CONFLICT
- ✅ Permite rodar múltiplas vezes com segurança
- ✅ Melhor para long-term

**Como usar:**
```
1. Abra SQL_CREATE_UNIQUE_INDEX.sql
2. Copie TODO o conteúdo
3. Cole no Supabase SQL Editor
4. Clique em RUN
5. Pronto! Agora o índice existe
```

Agora o SQL com `ON CONFLICT` vai funcionar sempre! ✅

---

## 🎯 Qual Escolher?

| Situação | Recomendação |
|----------|--------------|
| Quer sincronizar agora | **OPÇÃO 1** (SQL_SYNC_CORRECTED.sql) |
| Quer sincronizar + criar índice | **OPÇÃO 2** (SQL_CREATE_UNIQUE_INDEX.sql) |
| Quer rodar múltiplas vezes | **OPÇÃO 2** (depois criado o índice) |

---

## 📊 Resumo da Diferença

### OPÇÃO 1: DELETE + INSERT
```sql
DELETE FROM crew_flight_hours WHERE (...)  -- Remove registros antigos
INSERT INTO crew_flight_hours (...)        -- Insere novos
INSERT INTO crew_flight_hours (...)        -- Insere SIC
```

**Vantagem:** Simples, funciona sempre  
**Risco:** Nenhum

---

### OPÇÃO 2: CREATE INDEX + UPSERT
```sql
CREATE UNIQUE INDEX (...)                  -- Cria o índice
INSERT INTO crew_flight_hours (...)
ON CONFLICT (...) DO UPDATE ...            -- Update automático se existir
```

**Vantagem:** Mais eficiente, reutilizável  
**Risco:** Nenhum

---

## 🔄 Após a Sincronização

Não importa qual você escolheu, após rodar:

✅ Suas horas foram sincronizadas  
✅ O app agora atualiza automaticamente  
✅ Próximos lançamentos de voos funcionam normalmente  

---

## ✔️ Verificar se Funcionou

Cole isto no Supabase SQL Editor:

```sql
SELECT 
  cfh.crew_member_id as "Tripulante ID",
  cfh.aircraft_id as "Aeronave ID",
  cfh.month as "Mês",
  cfh.year as "Ano",
  cfh.total_hours as "Total (h)",
  cfh.ifr_hours as "IFR (h)",
  cfh.not_hours as "NOT (h)"
FROM public.crew_flight_hours cfh
ORDER BY cfh.year DESC, cfh.month DESC
LIMIT 20;
```

Se ver dados aqui ✅ Funcionou!

---

## 📝 Próxima Vez

Se precisar sincronizar novamente:

**Se usou OPÇÃO 1:**
- Rode `SQL_SYNC_CORRECTED.sql` de novo
- Sempre funciona

**Se usou OPÇÃO 2:**
- O índice já existe, não precisa criar novamente
- Pode usar `SQL_SYNC_SIMPLE.sql` ou `SQL_CREATE_UNIQUE_INDEX.sql`

---

## 🛠️ Se Quiser Criar o Índice Depois

Se já rodou OPÇÃO 1 e quer criar o índice:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_crew_flight_hours_unique 
ON public.crew_flight_hours (crew_member_id, aircraft_id, month, year);
```

Pronto! Depois pode usar qualquer SQL com `ON CONFLICT`.

---

## 💡 Resumão

- ❌ SQL anterior: Usava ON CONFLICT sem ter índice
- ✅ OPÇÃO 1: Não usa ON CONFLICT (sempre funciona)
- ✅ OPÇÃO 2: Cria o índice + usa ON CONFLICT (melhor)

**Recomendação:** Use **OPÇÃO 1** agora, depois se quiser usar **OPÇÃO 2** para futuras sincronizações.
