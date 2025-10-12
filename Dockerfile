# Estágio 1: Instalação das dependências
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

# Estágio 2: Build da aplicação Next.js
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Expõe as variáveis de ambiente PÚBLICAS para o processo de build
# O EasyPanel vai injetar os valores aqui
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY}

RUN npm run build

# Estágio 3: Produção - Roda o servidor otimizado do Next.js
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copia os arquivos da versão de produção otimizada (standalone)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Expõe a porta 3000, que é a porta que o Next.js vai usar
EXPOSE 3000

# Define a variável de ambiente PORT para o Next.js saber em qual porta rodar
ENV PORT=3000

# O comando final que inicia o servidor do Next.js
CMD ["node", "server.js"]