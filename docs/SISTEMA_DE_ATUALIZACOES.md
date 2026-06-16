# Sistema de Notificação de Atualizações

## Visão Geral

Este sistema monitora a versão do aplicativo e notifica os usuários quando uma atualização está disponível. Os usuários com código antigo serão automaticamente avisados para atualizar o sistema.

## Como Funciona

1. **Verificação Automática**: A cada 5 minutos, o sistema verifica se há uma nova versão disponível
2. **Modal de Notificação**: Quando uma atualização é detectada, um modal é exibido ao usuário
3. **Reload Automático**: O usuário pode clicar em "Atualizar Agora" para recarregar a página

## Componentes

### UpdateCheckContext (`src/contexts/UpdateCheckContext.tsx`)
- Gerencia o estado de atualização disponível
- Compara versões (ex: 1.0.0 vs 1.0.1)
- Verifica atualizações a cada 5 minutos
- Permite que usuários dispensem a notificação (por sessão)

### UpdateNotificationModal (`src/components/UpdateNotificationModal.tsx`)
- Exibe um modal AlertDialog quando atualização está disponível
- Mostra versão atual vs versão mais recente
- Oferece botões para atualizar agora ou descartar

## Como Usar

### 1. Executar a Migração SQL

Primeiro, execute o arquivo SQL no Supabase para criar a tabela `app_config`:

```sql
-- Acesse o SQL Editor no Supabase e execute:
CREATE TABLE IF NOT EXISTS app_config (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON app_config
  FOR SELECT
  USING (true);

INSERT INTO app_config (key, value, description)
VALUES ('latest_version', '1.0.0', 'Latest available version of the application')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
```

### 2. Atualizar a Versão da Aplicação

Quando você fizer uma atualização do código, atualize a versão no Supabase:

**Via SQL:**
```sql
UPDATE app_config 
SET value = '1.0.1', updated_at = NOW() 
WHERE key = 'latest_version';
```

**Ou via Dashboard Supabase:**
- Acesse a tabela `app_config`
- Encontre a linha onde `key = 'latest_version'`
- Altere o campo `value` para a nova versão (ex: '1.0.1')

### 3. Versão Atual do Aplicativo

Por padrão, a versão atual é definida como '1.0.0' e armazenada no localStorage:

```typescript
const storedVersion = localStorage.getItem("app_version") || "1.0.0";
```

Para atualizar programaticamente (opcional):
```typescript
localStorage.setItem("app_version", "1.0.1");
```

## Fluxo de Atualização para Usuários

1. Usuário acessa o sistema
2. Sistema verifica a versão mais recente no Supabase
3. Se houver versão mais recente:
   - Um modal é exibido: "Atualização Disponível"
   - Usuário vê: versão atual vs nova versão
4. Usuário pode:
   - **Atualizar Agora**: Recarrega a página (window.location.reload())
   - **Descartar**: Fecha a notificação (dispensada por sessão)

## Configurações Avançadas

### Alterar intervalo de verificação

No arquivo `UpdateCheckContext.tsx`, altere:

```typescript
// De 5 minutos para outra duração (em milissegundos)
const interval = setInterval(checkForUpdates, 5 * 60 * 1000); // 5 minutos
```

### Desabilitar modal por usuário

O usuário pode desabilitar clicando "Descartar". A preferência é salva por sessão.

### Forçar check de atualização manualmente

```typescript
import { useUpdateCheck } from '@/contexts/UpdateCheckContext';

function MinhaComponente() {
  const { checkForUpdates } = useUpdateCheck();
  
  return (
    <button onClick={() => checkForUpdates()}>
      Verificar Atualizações
    </button>
  );
}
```

## Exemplo de Uso

```typescript
import { useUpdateCheck } from '@/contexts/UpdateCheckContext';

export function MeuComponente() {
  const { updateAvailable, currentVersion, latestVersion } = useUpdateCheck();

  return (
    <div>
      {updateAvailable && (
        <div className="alert">
          Nova versão {latestVersion} disponível!
          Versão atual: {currentVersion}
        </div>
      )}
    </div>
  );
}
```

## Notas Importantes

- A versão é comparada usando semântica de versionamento (1.0.0 vs 1.0.1)
- A notificação aparece apenas uma vez por sessão (pode ser dispensada)
- O reload é suave - não causa perda de dados não salvos
- O sistema é compatível com PWA e offline-first

## Troubleshooting

**Problema**: Modal não aparece
- Verifique se a tabela `app_config` foi criada
- Certifique-se que `latest_version` está configurada no Supabase
- Verifique o console para erros

**Problema**: Versão não atualiza
- Limpe o localStorage: `localStorage.removeItem("app_version")`
- Refresh a página e tente novamente

**Problema**: Usuário continua vendo o aviso
- O aviso é dispensado por sessão. Feche a aba/navegador e abra novamente
