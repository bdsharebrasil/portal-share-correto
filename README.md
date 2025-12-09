# Share Brasil - Portal Colaborador

Plataforma de gestão integrada para colaboradores e operações da Share Brasil.

## 🚀 Tecnologias

- **React 18** - Interface de usuário
- **TypeScript** - Tipagem estática
- **Vite** - Build rápido
- **Tailwind CSS** - Estilização
- **shadcn/ui** - Componentes prontos
- **Supabase** - Backend e autenticação

## 📋 Pré-requisitos

- Node.js 18+ (instale com [nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- npm ou yarn

## ⚙️ Instalação

```bash
# 1. Clone o repositório
git clone <URL_DO_REPOSITORIO>

# 2. Entre na pasta do projeto
cd <NOME_DO_PROJETO>

# 3. Instale as dependências
npm install

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

O aplicativo estará disponível em `http://localhost:8080`

## 📦 Comandos Disponíveis

```bash
npm run dev        # Inicia servidor de desenvolvimento
npm run build      # Cria build para produção
npm run build:dev  # Cria build em modo desenvolvimento
npm run lint       # Verifica erros de código
npm run preview    # Visualiza build em produção localmente
```

## 🔐 Variáveis de Ambiente

Configure as seguintes variáveis no arquivo `.env`:

```
VITE_SUPABASE_URL=sua_url
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sua_chave
```

## 📚 Estrutura do Projeto

```
src/
├── components/     # Componentes reutilizáveis
├── pages/         # Páginas da aplicação
├── hooks/         # Hooks personalizados
├── services/      # Serviços e APIs
├── contexts/      # Contextos React
├── lib/           # Utilitários e helpers
└── types/         # Definições TypeScript
```

## 🚀 Deploy

Para fazer deploy, use sua plataforma preferida:
- Netlify
- Vercel
- Firebase Hosting
- Qualquer servidor com Node.js

Faça o build com `npm run build` e deploy da pasta `dist/`.

## 📝 Licença

Propriedade da Share Brasil
