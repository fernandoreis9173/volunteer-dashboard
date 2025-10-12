# Estágio 1: Build - Prepara o aplicativo para produção
# Usa uma versão mais moderna do Node.js, recomendada pelo seu projeto
FROM node:20-alpine AS build

WORKDIR /app

# Copia os arquivos de dependência primeiro para aproveitar o cache do Docker
COPY package*.json ./

# Instala TODAS as dependências necessárias para o build
RUN npm install

# Copia o restante do código-fonte do seu projeto
COPY . .

# Executa o build, criando a pasta 'dist'
RUN npm run build


# Estágio 2: Produção - Roda o aplicativo final
# Usa a mesma base para consistência
FROM node:20-alpine

WORKDIR /app

# Copia apenas os arquivos necessários do estágio de build
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Instala APENAS as dependências de produção (geralmente nenhuma para um app Vite puro)
# Esta etapa é leve e rápida
RUN npm install --omit=dev

# Expõe a porta que o servidor de produção irá usar
EXPOSE 3000

# O COMANDO CORRETO PARA INICIAR O SERVIDOR DE PRODUÇÃO
# Este comando substitui a necessidade do entrypoint.sh
CMD ["npm", "start"]