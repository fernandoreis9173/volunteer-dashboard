# Estágio 1: Build - Constrói a aplicação
# Esta parte continua a mesma, pois já está funcionando perfeitamente.
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build


# Estágio 2: Produção - Serve os arquivos finais com um servidor Nginx
# Usamos uma imagem oficial do Nginx, que é extremamente pequena e otimizada.
FROM nginx:alpine

# Copia os arquivos construídos no Estágio 1 (a pasta 'dist') 
# para a pasta padrão que o Nginx usa para servir sites.
COPY --from=build /app/dist /usr/share/nginx/html

# Expõe a porta 80, que é a porta padrão para tráfego web.
EXPOSE 80

# O Nginx inicia automaticamente quando o container é executado.
# Não precisamos de um comando CMD.