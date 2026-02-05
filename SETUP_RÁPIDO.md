# 🚀 Setup Rápido - Backend no Vercel

## O que foi feito automaticamente:
- ✅ `vite.config.ts` atualizado para usar variável de ambiente
- ✅ `src/config/api.ts` criado para configuração centralizada  
- ✅ `.env.example` com exemplo de configuração
- ✅ Nenhuma mudança no código necessária!

---

## 3 Passos para Funcionar:

### 1️⃣ Crie `.env.local` na raiz do projeto
```bash
touch .env.local
```

### 2️⃣ Adicione sua URL do Vercel
```env
VITE_SUPABASE_URL=https://seu-supabase.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sua-chave
VITE_API_BASE_URL=https://SEU-BACKEND-VERCEL.vercel.app
VITE_AVWX_API_TOKEN=seu-token
VITE_APP_ENV=development
```

**Substitua `SEU-BACKEND-VERCEL` pela URL real do seu backend!**

Exemplo:
```env
VITE_API_BASE_URL=https://portal-share-backend.vercel.app
```

### 3️⃣ Reinicie o frontend
```bash
npm run dev
```

---

## ✨ Pronto!

Se vir isso no Console (F12):
```
🔧 Configuração da API
API Base URL: https://seu-backend-vercel.app
Supabase URL: ✓
Environment: development
```

Está funcionando! ✓

---

## ⚠️ IMPORTANTE

- **NÃO faça commit de `.env.local`** (já está no .gitignore)
- **.env.local é privado** (chaves sensíveis)
- **Para Vercel produção**: Configure variáveis nas Settings do projeto

---

## ❓ Qual URL usar?

| Contexto | URL |
|----------|-----|
| Desenvolvimento local | `http://localhost:3001` |
| Build/Produção Vercel | `https://seu-backend.vercel.app` |

---

## 🔗 Mais Detalhes

Para guia completo, veja: `SETUP_VERCEL_BACKEND.md`

---

## 🆘 Não Funciona?

1. **Verifique F12 → Console** - Deve mostrar configuração
2. **Teste a URL manualmente:**
   ```bash
   curl https://seu-backend.vercel.app/api/aircraft
   ```
3. **Limpe cache:** Ctrl+Shift+Delete
4. **Reinicie:** `npm run dev`

Se ainda assim não funcionar, verifique:
- CORS configurado no backend
- URL do Vercel está correta
- Backend está online em: https://seu-backend.vercel.app/api/health (ou similar)
