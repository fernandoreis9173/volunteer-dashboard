# Estágio 1: Build
# Usa uma imagem oficial do Node.js para construir o projeto
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Estágio 2: Produção
# Usa uma imagem menor para rodar o servidor
FROM node:18-alpine
WORKDIR /app

# Copia as dependências de produção do estágio de build
COPY --from=build /app/package*.json ./
RUN npm install --omit=dev

# Copia os arquivos construídos do estágio de build
COPY --from=build /app/dist ./dist

# Expõe a porta que o servidor irá usar
EXPOSE 3000

# Comando para iniciar o servidor
CMD [ "npm", "start" ]