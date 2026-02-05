# Guia de Configuração: Backend Express no Vercel

## Passo 1: Obter a URL do Backend no Vercel

Após fazer deploy do seu backend Express no Vercel:

1. Acesse [https://vercel.com](https://vercel.com)
2. Acesse seu projeto de backend
3. Copie a URL fornecida (exemplo: `https://seu-backend-nome.vercel.app`)

**Salve esta URL**, você precisará dela.

---

## Passo 2: Configurar Variáveis de Ambiente Localmente

### 2.1 Criar arquivo `.env.local`

Na **raiz do seu projeto frontend**, crie um arquivo chamado `.env.local`:

```bash
# No diretório raiz do projeto
touch .env.local
```

### 2.2 Adicionar conteúdo ao `.env.local`

Copie e cole o seguinte conteúdo, **substituindo a URL pela sua URL do Vercel**:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://seu-supabase-url.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=seu-supabase-key-publico

# Backend Express API - ALTERE PARA SUA URL DO VERCEL
VITE_API_BASE_URL=https://seu-backend-nome.vercel.app

# AVWX API (opcional)
VITE_AVWX_API_TOKEN=seu-token-avwx

# Modo
VITE_APP_ENV=development
```

**Exemplo prático:**
```env
VITE_SUPABASE_URL=https://xyzabc.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# URL DO VERCEL DO BACKEND
VITE_API_BASE_URL=https://portal-share-backend.vercel.app

VITE_AVWX_API_TOKEN=seu-token
VITE_APP_ENV=development
```

---

## Passo 3: IMPORTANTE - Adicionar à `.gitignore`

Certifique-se de que `.env.local` **NÃO será commitado**:

Abra `.gitignore` e verifique se existe a linha:
```
.env.local
```

Se não existir, adicione:
```bash
echo ".env.local" >> .gitignore
```

---

## Passo 4: Configurar Backend para Aceitar Requisições do Frontend

No seu backend Express (arquivo `dev-server/server.ts` ou `api/server.ts`), adicione CORS:

### 4.1 Instalar CORS (se não tiver)
```bash
npm install cors
```

### 4.2 Configurar CORS

Adicione no seu servidor Express:

```typescript
import cors from 'cors';

app.use(cors({
  origin: [
    'http://localhost:8080',  // Desenvolvimento local
    'http://localhost:3000',  // Alternativo
    'https://seu-frontend-url.vercel.app',  // URL do frontend em produção
  ],
  credentials: true,
}));
```

---

## Passo 5: Atualizar Frontend

Os arquivos já foram atualizados:

- ✅ `vite.config.ts` - Agora usa variável de ambiente
- ✅ `src/config/api.ts` - Configuração centralizada
- ✅ `.env.example` - Arquivo de exemplo

**Nenhuma mudança adicional necessária no código!**

---

## Passo 6: Testar Localmente

### 6.1 Reiniciar o servidor de desenvolvimento

```bash
# Parar o servidor (Ctrl+C se estiver rodando)
# Depois reiniciar:
npm run dev
```

### 6.2 Verificar Logs

Abra o navegador e vá para `http://localhost:8080`:

1. Abra Console (F12)
2. Vá à aba "Console"
3. Procure por:

```
🔧 Configuração da API
API Base URL: https://seu-backend-nome.vercel.app
Supabase URL: ✓
Environment: development
```

Se aparecer assim, está funcionando!

### 6.3 Testar uma Requisição

Qualquer página que faça requisição à API deve funcionar agora. Por exemplo:
- Ir a "Aeronaves" → Deve listar aeronaves
- Ir a "Manutenção" → Deve carregar dados
- Qualquer outra página que acesse `/api`

---

## Passo 7: Configurar Variáveis no Vercel (Produção)

Quando você fizer deploy do **frontend** no Vercel:

1. Acesse [https://vercel.com](https://vercel.com)
2. Selecione seu projeto frontend
3. Vá em **Settings** → **Environment Variables**
4. Adicione as mesmas variáveis:

```
VITE_SUPABASE_URL = https://seu-supabase-url.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY = seu-key
VITE_API_BASE_URL = https://seu-backend-nome.vercel.app
VITE_AVWX_API_TOKEN = seu-token
VITE_APP_ENV = production
```

**Importante:** No Vercel, a URL do backend deve ser a **URL pública de produção**, não localhost!

---

## Estrutura de Arquivos

```
seu-projeto/
├── .env.local                    ← NÃO FAZER COMMIT (privado)
├── .env.example                  ← FAZER COMMIT (exemplo público)
├── .gitignore                    ← Certifique-se de incluir .env.local
├── vite.config.ts               ← Atualizado para usar VITE_API_BASE_URL
├── src/
│   ├── config/
│   │   └── api.ts               ← Configuração centralizada
│   └── ...
└── ...
```

---

## Troubleshooting

### ❌ Erro: "Failed to fetch from /api/..."

**Causa:** URL da API não está configurada corretamente.

**Solução:**
1. Verifique se `.env.local` existe
2. Verifique se `VITE_API_BASE_URL` tem a URL correta
3. Reinicie o servidor (`npm run dev`)
4. Limpe o cache do navegador (Ctrl+Shift+Delete)

---

### ❌ Erro: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Causa:** Backend não está aceitando requisições do frontend.

**Solução:**
1. Verifique se CORS está configurado no backend
2. Adicione sua URL do frontend à lista de `origin` no CORS
3. Redeploy do backend

---

### ❌ Erro: "Cannot GET /api/..."

**Causa:** Rota não existe no backend ou URL está errada.

**Solução:**
1. Verifique se a rota existe no backend
2. Verifique a URL no console (F12)
3. Confirme que a URL do Vercel está correta

---

## Variáveis de Ambiente Explicadas

| Variável | Exemplo | Descrição |
|----------|---------|-----------|
| `VITE_SUPABASE_URL` | `https://xyz.supabase.co` | URL do seu projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | `eyJ...` | Chave pública do Supabase |
| `VITE_API_BASE_URL` | `https://backend.vercel.app` | **URL do backend Express (PRINCIPAL)** |
| `VITE_AVWX_API_TOKEN` | `token123` | Token para API de aviação (opcional) |
| `VITE_APP_ENV` | `production` | Ambiente (development/production) |

---

## Resumo Rápido

1. ✅ Copie URL do Vercel (backend)
2. ✅ Crie `.env.local` com `VITE_API_BASE_URL`
3. ✅ Configure CORS no backend
4. ✅ Reinicie frontend (`npm run dev`)
5. ✅ Teste acessando uma página com API
6. ✅ Quando fizer deploy, configure variáveis no Vercel

---

## Próximas Etapas

Após validar que está funcionando localmente:

1. **Fazer deploy do Frontend no Vercel**
2. **Configurar variáveis no painel do Vercel**
3. **Testar em produção**

---

## Dúvidas Comuns

**P: Preciso alterar o código frontend?**
A: Não! Os arquivos já foram atualizados.

**P: Qual URL devo usar - desenvolvimento ou produção?**
A: Depende:
- **Localmente** (.env.local): Use `http://localhost:3001`
- **Vercel (Frontend)**: Use `https://seu-backend.vercel.app`

**P: E se mudar a URL do backend?**
A: Basta atualizar `.env.local` (ou variáveis no Vercel) e reiniciar.

**P: Como sei se está funcionando?**
A: Abra F12 → Console e procure pela mensagem de configuração ou tente acessar uma página que usa API.

---

## Contato / Suporte

Se encontrar problemas:
1. Verifique o console do navegador (F12)
2. Verifique os logs do backend
3. Confirme que a URL está correta
4. Tente fazer requisição manualmente via curl:

```bash
curl -X GET https://seu-backend-nome.vercel.app/api/aircraft
```

Se retornar dados, o backend está OK e o problema é na configuração do frontend.
