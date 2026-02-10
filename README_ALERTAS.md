# Sistema de Alertas de Vencimentos

Bem-vindo! Este é um sistema completo de alertas para notificar usuários sobre vencimentos de documentos, CMA, licenças e manutenção. Cada usuário pode gerenciar seus alertas individualmente.

## 🚀 Início Rápido

### O que foi criado?

Um sistema de notificações em tempo real que:

✅ Mostra alertas de vencimento para **todos os usuários**  
✅ Permite cada usuário **descartar** ou **agendar novamente** individualmente  
✅ Funciona em **tempo real** com fallback a polling  
✅ **Persiste** as preferências de cada usuário no banco de dados  
✅ Agrupa alertas por **severidade** (Vencido, Crítico, Atenção, Info)  

### Como funciona?

1. **Sistema cria alertas** automaticamente quando um item está para vencer
2. **Todos veem** o alerta na tela como notificação
3. **Cada um escolhe** o que fazer (descartar ou agendar)
4. **Suas escolhas** são salvas e outras pessoas não são afetadas

**Exemplo Real:**
```
CMA de José vence em 15 dias
    ↓
Alerta aparece para TODOS os usuários
    ↓
João clica em "Descartar" → Ele nunca vê mais esse alerta
Maria clica em "Agendar 7 dias" → Ela vê novamente em 7 dias
Pedro não faz nada → Ele vê de novo em 5 minutos
```

## 📁 Arquivos Criados

```
src/
├── hooks/
│   └── useExpirationAlerts.ts          # Hook principal (248 linhas)
├── components/
│   └── alerts/
│       ├── ExpirationAlertDialog.tsx   # Modal do alerta (200 linhas)
│       └── ExpirationAlertsContainer.tsx # Notificações (203 linhas)
├── contexts/
│   └── ExpirationAlertsContext.tsx     # Contexto (30 linhas)
└── App.tsx                              # Integração ✅

Documentação/
├── GUIA_ALERTAS_VENCIMENTOS.md         # Documentação completa
├── EXEMPLOS_USO_ALERTAS.md             # 6 exemplos de código
├── RESUMO_IMPLEMENTACAO.md             # Visão técnica
├── CHECKLIST_DEPLOYMENT.md             # Passo-a-passo
├── setup-expiration-alerts.sql         # Script SQL
└── README_ALERTAS.md                   # Este arquivo
```

## 🎯 Próximos Passos

### 1️⃣ Setup do Banco de Dados (5 minutos)

Abra o **SQL Editor** do Supabase e execute o script:

```bash
# Copie o conteúdo de: setup-expiration-alerts.sql
# Cole no Supabase SQL Editor
# Clique em "Run"
```

**Isso criará:**
- ✅ Tabela `expiration_alerts`
- ✅ Tabela `user_alert_preferences`
- ✅ Row Level Security (RLS)
- ✅ Índices para performance
- ✅ Função automática de refresh

### 2️⃣ Testar Localmente (10 minutos)

```bash
# Iniciar dev server
pnpm run dev

# Abrir em: http://localhost:8080
# Fazer login
# Recarregar página
```

### 3️⃣ Inserir Dados de Teste (2 minutos)

```sql
-- No SQL Editor do Supabase:
INSERT INTO expiration_alerts (alert_type, reference_id, reference_table, title, entity_name, expiry_date, days_until_expiry, severity)
VALUES 
  ('cma', uuid_generate_v4(), 'crew_licenses', 'CMA de José vence amanhã', 'José da Silva', CURRENT_DATE + 1, 1, 'critical'),
  ('license', uuid_generate_v4(), 'crew_licenses', 'Licença de Maria vence em 10 dias', 'Maria Santos', CURRENT_DATE + 10, 10, 'warning');
```

### 4️⃣ Verificar se Funciona

- [ ] Veja as notificações aparecerem no topo da tela
- [ ] Clique para abrir o modal
- [ ] Teste "Descartar" e "Agendar"
- [ ] Recarregue e verifique se suas escolhas foram salvas

### 5️⃣ Deploy em Produção

```bash
git add .
git commit -m "feat: Adicionar sistema de alertas de vencimentos"
git push origin seu-branch
# Crie PR e merge após review
```

## 🎨 Como Fica na Tela

### Notificação Padrão (Toast)
```
┌─────────────────────────────────────────┐
│ 🔴 CMA de José da Silva - Vence em 1d  │
│ José da Silva                           │
│ Clique para agendar ou descartar        │
└─────────────────────────────────────────┘
```

### Modal Detalhado
```
┌──────────────────────────────────────────┐
│ 🔴 CRÍTICO                              │
│ CMA de José da Silva - Vence em 1 dia  │
├──────────────────────────────────────────┤
│ O CMA do tripulante vence em 1 dia     │
│                                          │
│ Entidade: José da Silva                 │
│ Data: sexta-feira, 14 de fevereiro      │
│                                          │
│ Agendar novamente para: [7 dias ▼]     │
├──────────────────────────────────────────┤
│ [Descartar]  [Agendar para 7 dias]     │
│                                          │
│ Você pode gerenciar esses alertas       │
│ individualmente. Ninguém verá suas      │
│ escolhas.                               │
└──────────────────────────────────────────┘
```

## 🔧 Como Usar no Código

### Exemplo 1: Mostrar alertas em uma página

```typescript
import { useExpirationAlerts } from '@/hooks/useExpirationAlerts';
import { useAuth } from '@/contexts/AuthContext';

export default function MyPage() {
  const { user } = useAuth();
  const { visibleAlerts, dismissAlert, snoozeAlert } = useExpirationAlerts(user?.id || null);

  return (
    <div>
      {visibleAlerts.map(alert => (
        <div key={alert.id}>
          <h3>{alert.title}</h3>
          <p>{alert.description}</p>
          <button onClick={() => dismissAlert(alert.id)}>Descartar</button>
          <button onClick={() => snoozeAlert(alert.id, 7)}>Agendar 7 dias</button>
        </div>
      ))}
    </div>
  );
}
```

### Exemplo 2: Filtrar por severidade

```typescript
const { visibleAlerts, getAlertsBySeverity } = useExpirationAlerts(userId);

const critical = getAlertsBySeverity('critical');
const expired = getAlertsBySeverity('expired');
```

### Exemplo 3: Filtrar por tipo

```typescript
const { visibleAlerts, getAlertsByType } = useExpirationAlerts(userId);

const cmaAlerts = getAlertsByType('cma');
const licenseAlerts = getAlertsByType('license');
```

Ver mais exemplos em: `EXEMPLOS_USO_ALERTAS.md`

## 📚 Documentação Completa

| Documento | Conteúdo |
|-----------|----------|
| **GUIA_ALERTAS_VENCIMENTOS.md** | Documentação técnica completa, funcionalidades, dados |
| **EXEMPLOS_USO_ALERTAS.md** | 6 exemplos práticos de integração |
| **RESUMO_IMPLEMENTACAO.md** | Visão geral técnica, arquitetura, tipos |
| **CHECKLIST_DEPLOYMENT.md** | Passo-a-passo completo de implementação |
| **setup-expiration-alerts.sql** | Script SQL pronto para executar |
| **README_ALERTAS.md** | Este arquivo! |

## 🎯 Severidades

| Severidade | Cor | Ícone | Quando Aparece |
|-----------|-----|-------|----------------|
| **Vencido** | 🔴 Vermelho | 🔴 | Já passou data de vencimento |
| **Crítico** | 🟠 Laranja | 🟠 | Faltam 15 dias ou menos |
| **Atenção** | 🟡 Amarelo | 🟡 | Faltam 30 dias |
| **Info** | 🔵 Azul | 🔵 | Faltam 60 dias |

## ⏰ Opções de Snooze

- 1 dia
- 3 dias
- 7 dias (recomendado)
- 14 dias
- 30 dias

## 🔐 Segurança

- ✅ Row Level Security (RLS) habilitado
- ✅ Cada usuário vê TODOS os alertas (para informação)
- ✅ Cada usuário gerencia APENAS suas preferências
- ✅ Autenticação via Supabase Auth

## 📊 Dados no Banco

### Tabela: `expiration_alerts`
Contém todos os alertas da sistema:
- Tipo (CMA, Licença, Manutenção, Documento)
- Entidade (que está vencendo)
- Data de vencimento
- Severidade
- Descrição

### Tabela: `user_alert_preferences`
Contém as preferências de CADA usuário:
- Qual alerta descartou
- Qual alerta agendou e para quando
- Atualizado sempre que o usuário toma uma ação

## 🚀 Performance

- ✅ Realtime subscriptions do Supabase
- ✅ Polling de 5 minutos como fallback
- ✅ Índices no banco para buscas rápidas
- ✅ Filtragem no frontend (não recarrega tudo)
- ✅ Lazy loading de componentes

## ❓ FAQ

### P: E se eu descartar um alerta?
R: Você não verá mais aquele alerta. Outros usuários continuam vendo.

### P: E se eu agendar para 7 dias?
R: O alerta desaparece e reaparece exatamente em 7 dias.

### P: Os dados de teste fazem diferença?
R: Sim! Você precisa inserir dados na tabela `expiration_alerts` para ver os alertas.

### P: Como executo a função que atualiza os alertas?
R: Automaticamente via trigger, ou manualmente:
```sql
SELECT refresh_expiration_alerts();
```

### P: Realtime não está funcionando?
R: Sem problemas! Polling a cada 5 minutos garante que não perde atualizações.

## 🐛 Troubleshooting

### Alertas não aparecem?
1. Verifique se os dados existem: `SELECT * FROM expiration_alerts;`
2. Verifique se está logado
3. Recarregue a página (F5)
4. Abra console (F12) e procure erros

### Modal não abre?
1. Clique novamente no alerta
2. Verifique console para erros
3. Tente em outro navegador

### Snooze não funcionou?
1. Verifique em: `SELECT * FROM user_alert_preferences;`
2. Recarregue a página
3. Aguarde 5 minutos (polling)

## 📞 Suporte

Dúvidas? Consulte:
1. `GUIA_ALERTAS_VENCIMENTOS.md` - Documentação detalhada
2. `EXEMPLOS_USO_ALERTAS.md` - Veja exemplos reais
3. `CHECKLIST_DEPLOYMENT.md` - Passo-a-passo
4. Console do navegador (F12) - Procure por erros

## ✅ Checklist Final

- [ ] Script SQL executado no Supabase
- [ ] Dados de teste inseridos
- [ ] Dev server rodando
- [ ] Alertas aparecem na tela
- [ ] Modal abre ao clicar
- [ ] Dismiss funciona
- [ ] Snooze funciona
- [ ] Recarregar página mantém suas escolhas
- [ ] Pronto para deploy!

---

## 🎉 Parabéns!

Você tem um sistema de alertas completo, robusto e fácil de usar!

**Próximas melhorias opcionais:**
- Integração com email (notificações por email)
- Notificações push (PWA)
- Dashboard com estatísticas
- Filtros avançados
- Integração com calendario

---

**Versão**: 1.0  
**Status**: ✅ Pronto para Usar  
**Última atualização**: 2025-02-10  
**Licença**: Interno - Portal ShareBrasil  

Aproveite! 🚀
