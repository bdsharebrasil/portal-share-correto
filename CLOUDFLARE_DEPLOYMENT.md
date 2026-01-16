# Cloudflare Pages Deployment Guide

## Configuração para Deploy no Cloudflare Pages

Este projeto foi configurado para ser deployado no **Cloudflare Pages**.

### Pré-requisitos

1. **Conta Cloudflare** - Crie uma em https://dash.cloudflare.com
2. **Wrangler CLI** - Instale globalmente:
   ```bash
   npm install -g wrangler
   ```
3. **GitHub conectado ao Cloudflare** (recomendado para CI/CD automático)

### Opção 1: Deploy via CLI (Manual)

```bash
# 1. Fazer login no Cloudflare
wrangler login

# 2. Build do projeto
npm run build

# 3. Deploy para Cloudflare Pages
npm run deploy
```

### Opção 2: Deploy Automático (Recomendado)

1. **Conectar repositório GitHub ao Cloudflare Pages:**
   - Acesse: https://dash.cloudflare.com
   - Vá para: Pages > Create a project > Connect to Git
   - Selecione seu repositório
   - Configure as variáveis de ambiente

2. **Configurar Build Settings:**
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** 18+ (padrão do Cloudflare)

3. **Adicionar Variáveis de Ambiente:**
   - Vá para: Project Settings > Environment variables
   - Adicione as variáveis necessárias:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

### Estrutura do Projeto para Cloudflare Pages

```
projeto/
├── src/                    # Frontend (Vite)
│   ├── pages/
│   ├── components/
│   └── ...
├── api/                    # Backend (não será deployado, apenas dev local)
│   ├── index.ts           # Express app
│   └── ...
├── dev-server/            # Servidor dev local (não será deployado)
│   └── server.ts
├── dist/                  # Build output (gerado por npm run build)
├── wrangler.toml         # Configuração Cloudflare Pages
└── package.json
```

### ⚠️ Importante: Backend API

Este projeto tem um backend Express em `api/`, mas o **Cloudflare Pages é um serviço de hospedagem estática** (não executa Node.js/Express).

**Opções para o Backend:**

1. **Use Supabase** (já configurado):
   - O frontend faz requisições diretas ao Supabase
   - Não precisa de backend separado para a maioria das operações
   - Status: ✅ Já está configurado

2. **Migre para Cloudflare Workers** (futuro):
   - Converta o Express para Workers
   - Hospede as funções serverless no Cloudflare
   - Docs: https://developers.cloudflare.com/workers/

3. **Use um serviço externo** (ex: Fly.io, Railway, Heroku):
   - Hospede o Express em outro lugar
   - Frontend no Cloudflare Pages
   - APIs comunicam via HTTP

### Variáveis de Ambiente

**Em desenvolvimento** (`.env` local - não comite):
```env
VITE_SUPABASE_URL=https://jilmlmdgeyzubylncpjy.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sua_chave_publica
```

**Em produção** (Cloudflare Dashboard):
1. Vá para Project Settings > Environment variables
2. Adicione as mesmas variáveis
3. Deploy automático irá usá-las

### Troubleshooting

**Erro: "Build failed"**
- Verifique se `npm run build` funciona localmente
- Verifique variáveis de ambiente no Cloudflare Dashboard

**Erro: "CORS issues"**
- Cloudflare Pages hospeda no domínio `*.pages.dev`
- Atualize CORS no seu backend/Supabase se necessário

**Deploy não aparece**
- Verifique: https://dash.cloudflare.com > Pages > seu projeto
- Procure por abas "Deployments" para histórico

### URLs Úteis

- Dashboard Cloudflare: https://dash.cloudflare.com
- Projeto Pages: https://dash.cloudflare.com/?to=/:account/pages
- Documentação: https://developers.cloudflare.com/pages/
- Supabase Console: https://app.supabase.com

### Próximos Passos

1. **Instale Wrangler**: `npm install -g wrangler`
2. **Faça login**: `wrangler login`
3. **Teste build local**: `npm run build`
4. **Conecte seu repositório** no Cloudflare Dashboard
5. **Adicione variáveis de ambiente** no Dashboard
6. **Faça push** - Deploy automático iniciará!

---

Para dúvidas sobre Cloudflare Pages, consulte: https://developers.cloudflare.com/pages/get-started/
