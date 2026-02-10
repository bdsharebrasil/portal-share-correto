# Checklist de Deployment - Sistema de Alertas de Vencimentos

## ✅ Pré-requisitos

- [ ] Acesso ao Supabase Dashboard
- [ ] Acesso ao SQL Editor do Supabase
- [ ] Repositório Git atualizado
- [ ] Node.js e npm/pnpm instalados
- [ ] Dev server rodando (`pnpm run dev`)

---

## 📦 FASE 1: Preparação (Você Não Precisa Fazer - JÁ FOI FEITO)

### Código React
- [x] Hook `useExpirationAlerts` criado
- [x] Componente `ExpirationAlertDialog` criado
- [x] Componente `ExpirationAlertsContainer` criado
- [x] Contexto `ExpirationAlertsContext` criado
- [x] Provider integrado no `App.tsx`
- [x] Importações adicionadas

### Documentação
- [x] `GUIA_ALERTAS_VENCIMENTOS.md` - Documentação completa
- [x] `EXEMPLOS_USO_ALERTAS.md` - 6 exemplos práticos
- [x] `RESUMO_IMPLEMENTACAO.md` - Visão técnica
- [x] `setup-expiration-alerts.sql` - Script SQL
- [x] `CHECKLIST_DEPLOYMENT.md` - Este arquivo

---

## 🗄️ FASE 2: Setup do Banco de Dados

### Passo 1: Executar Script SQL

```bash
# 1. Abra o Supabase Dashboard
# 2. Vá para: SQL Editor
# 3. Clique em "New Query"
# 4. Cole o conteúdo de: setup-expiration-alerts.sql
# 5. Clique em "Run"
```

**Verificação**:
```sql
-- Verifique se as tabelas foram criadas
\dt public.expiration_alerts
\dt public.user_alert_preferences

-- Verifique os índices
\di public.idx_*

-- Verifique as policies
\dp public.expiration_alerts
\dp public.user_alert_preferences
```

- [ ] Tabelas criadas
- [ ] RLS habilitado
- [ ] Policies criadas
- [ ] Índices criados
- [ ] Função criada

### Passo 2: Verificar Dados de Teste

```sql
-- Ver quantos alertas existem
SELECT COUNT(*) FROM expiration_alerts;

-- Ver preferências de um usuário
SELECT * FROM user_alert_preferences WHERE user_id = 'seu-user-id';
```

- [ ] Banco está vazio ou tem dados
- [ ] Sem erros de permissão

---

## 💻 FASE 3: Testes Locais

### Passo 1: Iniciar Dev Server

```bash
pnpm install
pnpm run dev
```

- [ ] Dev server iniciou
- [ ] Nenhum erro de build
- [ ] App abriu no navegador

### Passo 2: Fazer Login

- [ ] Usuário autenticado
- [ ] Console do navegador sem erros
- [ ] Verify em Network tab - requests para Supabase

### Passo 3: Inserir Dados de Teste

```sql
-- No Supabase SQL Editor, execute:
INSERT INTO expiration_alerts (alert_type, reference_id, reference_table, title, entity_name, expiry_date, days_until_expiry, severity)
VALUES 
  ('cma', uuid_generate_v4(), 'crew_licenses', 'CMA de José vence amanhã', 'José da Silva', CURRENT_DATE + 1, 1, 'critical'),
  ('license', uuid_generate_v4(), 'crew_licenses', 'Licença de Maria expira em 10 dias', 'Maria Santos', CURRENT_DATE + 10, 10, 'warning'),
  ('cma', uuid_generate_v4(), 'crew_licenses', 'CMA de João já venceu', 'João Pereira', CURRENT_DATE - 5, -5, 'expired');
```

- [ ] Dados inseridos
- [ ] Sem erros SQL

### Passo 4: Verificar se os Alertas Aparecem

**Na aplicação:**
1. Recarregue a página (F5)
2. Procure por notificações no topo da tela
3. Você deve ver 3 alertas aparecerem

- [ ] Alertas aparecem na tela
- [ ] Alertas têm cores corretas (vermelho, amarelo, laranja)
- [ ] Alertas mostram informações corretas

### Passo 5: Testar Interações

**Clique em um alerta:**
1. Modal deve abrir
2. Deve mostrar detalhes
3. Deve ter seletor de dias para agendar
4. Deve ter botão "Descartar" e "Agendar"

- [ ] Modal abre
- [ ] Informações corretas
- [ ] Seletor funciona

### Passo 6: Testar Descartar

1. Clique em "Descartar"
2. Modal fecha
3. Alerta desaparece da notificação
4. Não deve reaparecer até limpar o banco

- [ ] Alerta desaparece
- [ ] No SQL: `SELECT * FROM user_alert_preferences` mostra ação = 'dismissed'

### Passo 7: Testar Agendar

1. Clique em outro alerta
2. Selecione "7 dias"
3. Clique em "Agendar"
4. Modal fecha
5. Alerta desaparece
6. Recarregue a página
7. Alerta NÃO deve reaparecer (está snoozed)

- [ ] Alerta desaparece
- [ ] No SQL: `SELECT * FROM user_alert_preferences` mostra action = 'snoozed' e snoozed_until = data futura

### Passo 8: Limpar Dados de Teste

```sql
-- Deletar dados de teste
DELETE FROM user_alert_preferences;
DELETE FROM expiration_alerts;
```

- [ ] Dados deletados
- [ ] Nenhuma notificação mais aparece

---

## 🚀 FASE 4: Deploy para Produção

### Passo 1: Fazer Commit

```bash
git add .
git commit -m "feat: Adicionar sistema de alertas de vencimentos

- Hook useExpirationAlerts para gerenciar alertas
- Componente ExpirationAlertDialog com ações
- Componente ExpirationAlertsContainer para notificações
- Provider ExpirationAlertsContext
- Integração no App.tsx
- Suporte para snooze individual por usuário"
```

- [ ] Commit feito
- [ ] Mensagem clara

### Passo 2: Push para Remote

```bash
git push origin treasury-mixture-z0l2bi5e
```

- [ ] Push sucesso
- [ ] Sem erros

### Passo 3: Criar Pull Request

```bash
gh pr create --fill
```

- [ ] PR criada
- [ ] Descrição completa
- [ ] Pronto para review

### Passo 4: Review e Merge

- [ ] Code review completo
- [ ] Testes passam
- [ ] Merge para main/develop

- [ ] Merged

### Passo 5: Deploy

```bash
# Seu comando de deploy
# Exemplo: vercel deploy, fly deploy, etc
```

- [ ] Deploy iniciado
- [ ] Deploy completado
- [ ] Sem erros

### Passo 6: Validação em Produção

1. Acesse a aplicação em produção
2. Faça login
3. Verifique se alertas aparecem (se houver dados)
4. Teste dismiss e snooze
5. Verifique console para erros

- [ ] Alertas aparecem
- [ ] Funcionalidades funcionam
- [ ] Sem erros no console
- [ ] Performance aceitável

---

## 📊 FASE 5: Operação e Manutenção

### Diariamente

- [ ] Monitorar logs do Supabase
- [ ] Verificar performance
- [ ] Responder a issues dos usuários

### Semanalmente

```sql
-- Contar alertas ativos
SELECT severity, COUNT(*) FROM expiration_alerts GROUP BY severity;

-- Contar preferências de usuários
SELECT action, COUNT(*) FROM user_alert_preferences GROUP BY action;
```

- [ ] Estatísticas verificadas
- [ ] Sem anomalias

### Mensalmente

```sql
-- Rodar função de refresh manualmente
SELECT refresh_expiration_alerts();

-- Verificar dados antigos
SELECT * FROM expiration_alerts WHERE created_at < CURRENT_DATE - 90;
```

- [ ] Função rodou
- [ ] Dados consistentes
- [ ] Limpeza de histórico (opcional)

### Trimestralmente

- [ ] Review de RLS policies
- [ ] Review de índices (performance)
- [ ] Feedback dos usuários
- [ ] Plano de melhorias

---

## 🐛 Troubleshooting Rápido

### Problema: Alertas não aparecem

**Checklist**:
```
[ ] Está logado?
[ ] Existem dados em expiration_alerts?
[ ] Console tem erros? (F12)
[ ] Supabase está online?
[ ] RLS policies criadas?
[ ] Recarregue a página (F5)
```

### Problema: Modal não abre

**Checklist**:
```
[ ] Clicou no alerta?
[ ] Sem erros no console?
[ ] Browser suporta (Chrome, Firefox, Safari)?
[ ] Atualize o navegador
```

### Problema: Snooze não funciona

**Checklist**:
```
[ ] Selecionou os dias?
[ ] Clicou em "Agendar"?
[ ] Network tab - request enviado?
[ ] user_alert_preferences tem dados?
```

### Problema: Realtime não funciona

**Checklist**:
```
[ ] Realtime habilitado no Supabase?
[ ] Polling funciona (5 min)?
[ ] Recarregue a página
[ ] Restart dev server
```

---

## 📞 Suporte

Dokumentação:
- `GUIA_ALERTAS_VENCIMENTOS.md` - Documentação completa
- `EXEMPLOS_USO_ALERTAS.md` - Exemplos de código
- `RESUMO_IMPLEMENTACAO.md` - Visão técnica
- `setup-expiration-alerts.sql` - Script SQL

---

## ✨ Status Final

- [ ] Tudo checado
- [ ] Tudo funcionando
- [ ] Documentação lida
- [ ] Pronto para usar!

**Parabéns! O sistema de alertas está instalado e funcionando!** 🎉

---

**Última atualização**: 2025-02-10
**Versão**: 1.0
**Status**: ✅ Pronto para Deploy
